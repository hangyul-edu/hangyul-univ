"""V34 — one authoritative catalogue (owner requirement 3).

``normalize``  reference/research files → catalogue payloads (pure)      ``sources``   source registry, priority order
``fetcher``    polite HTTP (robots.txt, ≥ 2 s per host, retries)         ``pipeline``  staged ingestion + run ledger
``publish``    payloads → universities / programmes / intakes            ``bootstrap`` empty-catalogue bootstrap + scheduler
``schedule``   Monday 09:00 Asia/Seoul windows                           ``status``    READY / PREPARING / EMPTY, counts, health

CLI: ``python -m app.services.catalog_ingest bootstrap | refresh | status [--counts]``.
"""
