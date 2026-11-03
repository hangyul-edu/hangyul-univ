# Doc drift actions (working note — folded into docs at the doc phase, then deleted)
README:50 port 8000→8001; :80 HG_ENV default production; :89 payment provider toss test key-in; :56,61-71 one role per tenant + test sign-in; :22,133 Docker optional
ARCHITECTURE:50 69→119 tables; :155 v10.css gone (list real CSS layers → after V26 consolidation); :217 KRW→USD cents; add Identity V22/Payments V21 pointer; :146 scripts/v9_visa_data.py → server/scripts/
PRODUCT:72-74 card form→Toss key-in relay not stored; :139 "real prices" external dep → live Toss keys/contract
FRONTEND_CONVENTIONS:32 formatMoney currency; :35,49 V12 no sample labels; :36 analyst role gone; :56 marketing = Koreanasha over Eduan chassis
ROADMAP: label V3 snapshot; remove done items; pointer to REPORT §0.6 backlog
I18N:25 45→46 drafts; :7 path packages/i18n/scripts/gen-resources.mjs; add current header
SECURITY:19-20,25 every AGENCY_ADMIN sees agency students; :12 unset HG_ENV=production; :37 consents add CROSS_BORDER_VERIFICATION, PURCHASE_TERMS
LEGAL_DEPENDENCIES L5 prices set/Toss test/refund OWNER_POLICY_REQUIRED; L13 two-tier media rule (/credits retired); L7 processors published
MEDIA_LICENSE_AUDIT: retitle current; V25 rule first; 2/425 → current coverage
MARKETING_ASSETS: retired /credits + retired photos → merge into MEDIA_LICENSE_AUDIT
STATE_MAP:16,18,65-66 student-facing "counselor" → Hangyul Univ team
WORKFLOWS:128 quick.ts gone; :134 add V22 registration + V21 purchase; :68,82 package→plan, drop "labelled"
SSO:33,38,47 role names
payments/TOSS_FOREIGN_CARD_REVIEW: superseded banner (V21 bill_talkoab1 key-in)
mobile/STORE_READINESS: update to V26, 3 apps
SERVICE_BLUEPRINT:19,23 → V9 snapshot banner
ANALYTICS_EVENTS:22 demo provider → toss test
DATA_MODEL: regenerate (server/scripts/gen_data_model_doc.py)
DOCUMENT_AUTOMATION:114, WRITING_REVIEW:69-74, SUBMISSION_CONNECTORS:84 → any agency administrator
TEMPLATE_* inventories: 56 locales
REPORT §0: §0.5 V18 measurement label; §0.6 qa:v24 note; preamble V20–V26; section order
research/v8-*.md NOT RUN protocols superseded by v9 → delete/archive; v9-validation-protocols:23 missing dir
docs/qa/v25/REPORT.before-v25.md 17k-line duplicate → delete in cleanup
Side finding: server/.env has HG_PAYMENT_PROVIDER twice (demo then toss)
