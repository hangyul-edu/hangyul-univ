## 63.7 Final hostile review — why a competitor would still tell you not to use Hangyul

*Written as a rival's product review, after V9 was built. Each point is either fixed, answered, or classified honestly as external. Nothing here is softened.*

### To a student
1. **"Nothing in it has been used by a student like you."** True. Zero real students, parents, counselors or admissions officers have used V9; every figure is a scripted walkthrough or a machine measurement. *External: user research (§64).*
2. **"The catalogue is sample data."** True for tuition, fees, deadlines and dorm costs: they carry `verification_status=DEMO`, labelled in the UI, with the dated source shown where one exists. A student planning on these numbers would be planning on demo figures. *Business dependency.*
3. **"Your language is a machine translation."** True. 20 locales have a complete, leak-scanned student journey, but **no locale has been reviewed by a human**; the app says so and offers English. *Human review (§64).*
4. **"Hangyul cannot actually submit your application."** True by design and by law: every real university requires the applicant to submit personally, so Hangyul prepares everything and hands off, then records the evidence. A competitor claiming "we submit for you" in Korea is either an authorised rail user or overstating.
5. **"You still leave for the embassy, the bank and the portal."** True; those are official acts. Hangyul removes the search and the paperwork around them, not the acts.
6. **"No one can tell you your chances."** By choice: no acceptance-rate claim, no score, no probability. A competitor advertising "95 % success" is making a claim it cannot support.

### To an agency
7. **"Your counselors would run two systems."** Partly answered: V9 has one work queue, waiting-on, templates in the student's language, submissions and meetings — but **external channels (KakaoTalk, WhatsApp, Zalo, SMS, email) are not connected**, so student conversations that live there still live there. *External: provider agreements.*
8. **"Your mobile app is behind the web."** True: the agency native app does not show the V9 queue or the seven-party waiting values; only the keys were added. *Engineering backlog.*
9. **"We only tested it at 200 students."** True: one counselor with 200 students and 1,011 applicants, p95 under 1 s on 13 endpoints. Beyond that is unmeasured.
10. **"Commission and payouts aren't there."** True: commission tracking, agency payout and sub-agent accounting are modelled only as identity and contract data. *Business/engineering.*

### To a university
11. **"It is one more inbox."** Answered where it counts (requests and decisions live on the applicant record, outcomes come back), but there is **no SIS, no SSO beyond OIDC, no scheduled export**, and no rail integration — so email and Excel do not disappear for everything. *External/infrastructure.*
12. **"Your numbers come from a handful of applicants."** True in the demo: most rates are withheld at n < 5, and that is the honest behaviour, but it also means a university sees little until real volume exists.
13. **"Agencies will be regulated and you are not ready."** Partly: V9 records agency legal identity, registration status ("Not recorded" until real) and the responsible counselor per case, ready for the announced Certificate-of-Admission field — but the MOJ package is a **draft** and the MOE standard agreement text is not public. *Legal, tracked.*

### To a parent
14. **"You cannot verify who Hangyul is."** True: no company proof, reviews, partners or outcomes exist to publish, and the product refuses to invent them. Trust today rests on transparency (sources, dates, honest states) alone.
15. **"Your money is not protected by anything in the app."** Fair: the product tells you who receives each payment, when, and whether it is refundable, warns against paying through changers or agents, and opens a refund case on a visa refusal — but refund terms, prices and the payment provider are all still external.
16. **"The sponsor page shows what the student chooses."** By design: scopes are the student's, messages/essays/notes/files are never shown. A parent wanting full visibility will not get it.

### Where the review changed the product (this pass)
The hostile pass was run against the build, not against the plan. It produced the budget-summary contradiction fix (§62.8), the match-tier vocabulary corrections, the "46 languages" and "Korean is reviewed" claims, the seeded English provider name, and the i18n load bug that could show raw keys. Everything else above is either a stated boundary or a dependency in §64.
