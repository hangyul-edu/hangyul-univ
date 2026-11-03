"""Writing-assistance provider abstraction (V5).

``HG_AI_PROVIDER=none`` (default) → only the deterministic rule-based checks in ``app.services.writing`` run, and the UI
labels them "Automatic check" — never "AI". ``anthropic`` is reserved for a future adapter; it is NOT implemented in this
build (this machine has no API key), so requesting it falls back to ``none`` and says so in ``status()``.

Contract for any future model-backed provider (enforced by the caller, not trusted to the model):
- it may only return *observations* about structure, clarity and grammar-level issues, each anchored to a quote of the
  student's own text;
- it must never return replacement content: no new experiences, awards, jobs, volunteer work, motivations, research or
  achievements, and no rewritten paragraphs;
- its output is stored as WritingFinding rows (kind CLARITY) and shown with the same "Automatic check" label.
"""
from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass
class ProviderStatus:
    requested: str
    active: str
    label: str
    note: str | None = None


class RuleBasedProvider:
    """No model: the rule-based checks are the whole analysis. Adds nothing beyond them."""
    name = "none"

    def clarity_observations(self, text: str) -> list[dict]:  # pragma: no cover - trivial
        return []


def _requested() -> str:
    return (os.environ.get("HG_AI_PROVIDER") or "none").strip().lower()


def get_provider() -> RuleBasedProvider:
    # Only the rule-based provider exists in this build; see module docstring.
    return RuleBasedProvider()


def status() -> ProviderStatus:
    req = _requested()
    if req in ("", "none"):
        return ProviderStatus(requested="none", active="none", label="AUTOMATIC_CHECK")
    return ProviderStatus(requested=req, active="none", label="AUTOMATIC_CHECK",
                          note=f"HG_AI_PROVIDER={req} is not implemented in this build; rule-based automatic checks are used.")
