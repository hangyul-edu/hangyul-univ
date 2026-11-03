"""V8 agency + Hangyul operations routers, registered once in app.main.

Each sub-module owns one job:
  * agency_ops   — manager "Operations" aggregation (/agency/ops/*)
  * channels_api — message channel registry status (/channels)
  * readiness    — production-readiness of integrations (/admin/readiness)
"""
from app.api.v1 import agency_ops, channels_api, readiness

routers = (agency_ops.router, channels_api.router, readiness.router)
