# V22 §79 user simulations

Run 2026-10-23T13:01:31.218Z against http://localhost:8001/api/v1.

| scenario | input | steps | stored / observed | result |
|---|---|---|---|---|
| Student from Nepal | locale ne · phone "98 4123 9132" (NP) | email send 200 · sms send 200 · verify 200/200 · register 201 | +9779841239132 · ne · consents=4 | home loads |
| Student from Myanmar | locale my · phone "09 77 123 9132" (MM) | email send 200 · sms send 200 · verify 200/200 · register 201 | +959771239132 · my · consents=4 | home loads |
| Student from Vietnam | locale vi · phone "0912 489132" (VN) | email send 200 · sms send 200 · verify 200/200 · register 201 | +84912489132 · vi · consents=4 | home loads |
| Student from the US | locale en · phone "(415) 555-9132" (US) | email send 200 · sms send 200 · verify 200/200 · register 201 | +14155559132 · en · consents=4 | home loads |
| Agency Admin 1 then Admin 2 answer the same student | AGENCY_ADMIN + AGENCY_ADMIN | student sees 2 replies as team:Hangyul Univ Team | db authors: 2 distinct user ids | one team identity ✓ |
| University Admin A (Pusan) vs Admin B (SKKU) | A lands in Pusan National University (1 membership) · B in Sungkyunkwan University | 6 guessed application URLs, 0 conversations, 1 export with a foreign university_id | cross-tenant 200s: 0 · export 200 | isolated ✓ |
