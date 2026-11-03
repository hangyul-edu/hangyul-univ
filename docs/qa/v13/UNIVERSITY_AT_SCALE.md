# V13 — university at scale

*Brief Part 19. Measured against the isolated scale database: **1,011 submitted applications** to Pusan
National University across programmes, intakes and four agencies.*

## The V12 doubt, tested

V12's hostile review (§94.4) could not defend the Overview's four decision tiles against the brief's own "no
KPI gallery", and said so:

> *"with five applications in total, four tiles reading 2 / 1 / 1 / 1 look like a dashboard pretending to have
> data. At real volume they will read correctly. That is an argument from future data, which is exactly the
> argument this report has spent three passes distrusting."*

The argument from future data can now be checked, and **it was wrong in a way nobody predicted**. The problem
at volume is not that the tiles read badly. It is that there are no longer four things.

At 1,011 applications, six kinds of decision are waiting:

| Decision | Count |
|---|---|
| Awaiting review | **513** |
| Interviews | **84** |
| Tuition invoices to issue | **51** |
| Flagged | **46** |
| Waitlisted | **43** |
| Documents returned | **1** |

The four *core* tiles were a fixed set: review, documents returned, interviews, waitlisted. At this volume
that fixed set would have given a full-width tile to **Documents returned: 1** while hiding **Tuition
invoices to issue: 51** and **Flagged: 46** below the fold — because those two were "conditional" tiles that
appear after the core four. A composition chosen at five applications would have buried two queues of fifty.

## What V13 changed

"Needs your decision" is a **ranked queue**, largest first, one row per kind, each row opening exactly the
applications it counts. Kinds with nothing waiting are not rows. The tones, icons and `StatCard`s are gone:
colour on this screen now means status rather than decoration, and seven differently coloured tiles was a
rainbow by another name.

It reads correctly at both ends, which is the test the old design could not pass:

* **At 5 applications** (development seed): four short rows — `2 / 1 / 1 / 1` — instead of four tiles of
  mostly whitespace.
* **At 1,011** (scale): six rows, `513` first, every queue visible, nothing buried.

The header also lost its two buttons. *Applicants* and *Analytics* were both permanent items in the left
rail two rows above, and *Applicants* was a filled primary — which made navigating away the loudest control
on a screen whose job is to get a decision made. The page's own primary action is *Open all awaiting
decision*, on the queue it belongs to, and it is now the only emphasised control.

## Measurements

| Measure | At 1,011 applications |
|---|---|
| Decision-queue rows | 6 (all non-zero kinds) |
| Decision total | 641 waiting on the team |
| Overview height @1440 | **2.1 screens** |
| Overview height @390 | 3.0 screens |
| Applicants height @1440 | 2.0 screens |
| Analytics height @1440 | 1.2 screens |
| Horizontal overflow, every view, 390 + 1440 | **0px** |
| `h1` per route | 1 |
| Funnel | 398 submitted → 323 reviewed (81%) → 86 offered (**largest drop, 27%**) |

**The Overview is 2.1 screens, not the 1–1.5 the brief prefers.** Recorded rather than forced: the four
components on it are the decision queue, the intake funnel, "waiting on applicants" and "coming up", which is
inside the brief's own 4–5 component budget, and the extra height is the queue having six real rows instead
of four invented ones. Trimming it would mean hiding a queue, and hiding a queue of fifty to hit a height
target is the kind of change this pass exists to argue against.

## Rates and suppression, at volume

At five applications the funnel withheld almost every conversion rate ("Too few to rate"), which was correct
and made the screen look broken. At 1,011 the rates are published and the largest drop is marked — submitted
→ reviewed 81%, reviewed → offered 27%. **The `MIN_N` suppression is doing exactly what it was built for in
both directions**, and this is the first pass in which anyone has seen it do the second.

## What was *not* tested

* **Multiple intakes under load.** The scale seed concentrates on one university's current intake. Switching
  intakes at volume is unmeasured.
* **Agency-quality comparison at n ≥ 5 per agency.** The four agencies exist in the scale data, but the
  per-agency cohort sizes were not checked against `MIN_N`, so the agency-quality view is unverified at scale.
* **Analytics cross-filtering.** Measured only for height and overflow, not for correctness of a filtered
  drill-down against its chart.

These are gaps in the V13 measurement, not findings of correctness.
