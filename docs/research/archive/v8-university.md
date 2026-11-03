# V8 research protocol — University admissions staff

> **Status: protocol only — NOT RUN.** No sessions with real university admissions officers have taken place. Analytics load
> times and page heights in REPORT §53 are machine measurements; task timings are scripted walkthroughs.

## 1. Questions
1. On the applicant review page, can an officer decide "Can I make a decision now?" without leaving it?
2. Do the applicant lists and analytics totals match each other, and do officers trust them? (Every drill-down must equal the chart number.)
3. Are the safe bulk actions (assign reviewer, request a standard document, export, mark admin check) the ones officers actually need? Do they ask for bulk admit/reject, and why?
4. Are the exports the ones the international office really sends to the MOE, immigration and finance?

## 2. Participants
- 5 admissions or international-office staff from ≥ 3 universities (national and private, Seoul and regional).
- 1 analyst or manager role.
- Recruitment through Hangyul's university partnership contacts. Participation is unpaid where institution policy forbids payment.

## 3. Consent and data
- Institutional consent plus individual consent. Demo tenant with synthetic applicants only. No real applicant data.

## 4. Tasks (45 min)
| # | Task | Success | Measures |
|---|---|---|---|
| U1 | "Which applications need a decision from you this week?" | Opens Overview → the right list | time |
| U2 | Review one applicant end to end: requirements vs evidence, one document, the statement, then a decision or a request for a document | Correct decision path; no dead ends | time, scroll depth, steps |
| U3 | "How many fall-intake bachelor applicants from Vietnam are missing documents? Show me who they are." | Analytics drill-down → filtered Applicants; the number matches | time, match (yes/no) |
| U4 | "Ask all shortlisted applicants without a bank certificate to upload one." | Uses a bulk request; per-item results understood | time, errors |
| U5 | "Export the admitted list for the visa team." | Uses the preset; understands the personal-data warning | time |

## 5. Analysis
Success, time, SEQ, trust rating (1–7) of the numbers, list of missing exports, and severity × frequency.
