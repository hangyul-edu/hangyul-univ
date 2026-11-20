"""A polite HTTP fetcher for official sources.

* identified User-Agent (``HangyulUnivCatalogBot/1.0 (+contact page)``), connect/read timeouts;
* ``robots.txt`` is read once per host (``urllib.robotparser``) and honoured — a disallowed URL is never requested;
* at most one request per host every ``min_interval`` seconds (≥ 2 s), across threads;
* bounded retries with exponential backoff on network errors, 429 and 5xx — never on 4xx;
* no anti-bot bypass: a 401/403/429 answer is recorded as such, never worked around (no header spoofing, no proxies,
  no CAPTCHA solving, no headless browser).

Tests inject ``transport=httpx.MockTransport(...)`` so nothing touches the network.
"""

from __future__ import annotations

import threading
import time
import urllib.robotparser
from dataclasses import dataclass
from urllib.parse import urlsplit

import httpx

USER_AGENT = "HangyulUnivCatalogBot/1.0 (+https://univ.talkhangyul.com; catalogue link check)"


@dataclass
class FetchResult:
    url: str
    status: str  # OK | BROKEN | ERROR | ROBOTS_DISALLOWED
    http_status: int | None = None
    final_url: str | None = None
    fingerprint: str | None = None
    error: str | None = None


class PoliteFetcher:
    def __init__(self, *, min_interval: float = 2.0, timeout: float = 10.0, retries: int = 2, backoff: float = 2.0,
                 transport: httpx.BaseTransport | None = None, sleep=time.sleep, clock=time.monotonic):
        self.min_interval = max(2.0, float(min_interval))
        self.retries = max(0, int(retries))
        self.backoff = backoff
        self._sleep, self._clock = sleep, clock
        self._client = httpx.Client(timeout=httpx.Timeout(timeout, connect=min(timeout, 5.0)), follow_redirects=True,
                                    headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/pdf,application/json;q=0.9,*/*;q=0.5"},
                                    transport=transport)
        self._lock = threading.Lock()
        self._host_locks: dict[str, threading.Lock] = {}
        self._last: dict[str, float] = {}
        self._robots: dict[str, urllib.robotparser.RobotFileParser | None] = {}
        self.requests = 0

    def close(self) -> None:
        self._client.close()

    # ------------------------------------------------------------------------------------------ politeness
    def _host_lock(self, host: str) -> threading.Lock:
        with self._lock:
            return self._host_locks.setdefault(host, threading.Lock())

    def _wait_turn(self, host: str) -> None:
        last = self._last.get(host)
        if last is not None:
            gap = self.min_interval - (self._clock() - last)
            if gap > 0:
                self._sleep(gap)
        self._last[host] = self._clock()

    def _robots_for(self, scheme: str, host: str) -> urllib.robotparser.RobotFileParser | None:
        key = f"{scheme}://{host}"
        if key in self._robots:
            return self._robots[key]
        parser: urllib.robotparser.RobotFileParser | None = urllib.robotparser.RobotFileParser()
        try:
            self._wait_turn(host)
            self.requests += 1
            r = self._client.get(f"{key}/robots.txt")
            if r.status_code in (401, 403):
                parser.disallow_all = True  # the site refuses robots entirely
            elif r.status_code >= 400:
                parser.allow_all = True  # no robots.txt: everything allowed
            else:
                parser.parse(r.text.splitlines())
        except httpx.HTTPError:
            parser = None  # robots.txt unreachable: treat the host as unreachable for this run
        self._robots[key] = parser
        return parser

    def allowed(self, url: str) -> bool | None:
        parts = urlsplit(url)
        host = parts.hostname or ""
        with self._host_lock(host):
            robots = self._robots_for(parts.scheme or "https", parts.netloc or host)
        if robots is None:
            return None
        return robots.can_fetch(USER_AGENT, url)

    # ------------------------------------------------------------------------------------------ requests
    def check(self, url: str) -> FetchResult:
        """HEAD (falling back to a streamed GET when HEAD is refused). Never reads a body beyond the headers."""
        parts = urlsplit(url)
        if parts.scheme not in ("http", "https") or not parts.hostname:
            return FetchResult(url, "ERROR", error="unsupported URL")
        allowed = self.allowed(url)
        if allowed is None:
            return FetchResult(url, "ERROR", error="host unreachable")
        if not allowed:
            return FetchResult(url, "ROBOTS_DISALLOWED")
        host = parts.hostname
        attempt = 0
        while True:
            try:
                with self._host_lock(host):
                    self._wait_turn(host)
                    self.requests += 1
                    r = self._client.head(url)
                    if r.status_code in (405, 501):  # HEAD not supported: a GET whose body is never read
                        self._wait_turn(host)
                        self.requests += 1
                        with self._client.stream("GET", url) as s:
                            r = s
                status = r.status_code
                if status == 429 or status >= 500:
                    raise _Retryable(status)
                fp = "|".join(x for x in (r.headers.get("etag"), r.headers.get("last-modified"), r.headers.get("content-length")) if x) or None
                return FetchResult(url, "OK" if status < 400 else "BROKEN", status, str(r.url), fp[:300] if fp else None)
            except (_Retryable, httpx.TransportError) as exc:
                attempt += 1
                if attempt > self.retries:
                    code = exc.status if isinstance(exc, _Retryable) else None
                    return FetchResult(url, "BROKEN" if code and code >= 500 else "ERROR", code,
                                       error=(f"HTTP {code}" if code else type(exc).__name__)[:300])
                self._sleep(self.backoff * (2 ** (attempt - 1)))


class _Retryable(Exception):
    def __init__(self, status: int):
        super().__init__(status)
        self.status = status
