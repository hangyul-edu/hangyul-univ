"""V28 (UX_AUDIT D-1): one rule for seeded sample facts."""

from app.core.config import get_settings


def withheld(obj) -> bool:
    """In production a seeded sample (DEMO) fact is never served as a fact: its numbers and dates are withheld (null) and
    `withheld: true` says why. Development keeps them under the one global environment indicator."""
    return get_settings().is_production and getattr(obj, "verification_status", None) == "DEMO"
