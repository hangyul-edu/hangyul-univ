"""V9 — apply the 2026-10-10 re-validation corrections to the research JSON files.

Input (read-only):
  docs/research/archive/*.v8-2026-09-29.json   the pre-V9 baselines (copied once, never edited)
  docs/research/v9-visa-sources.json           source registry (ids V9V-Sn)
  docs/research/v9-visa-revalidation.md §5     46 visa corrections (numbered #1–#46 below)
  docs/research/v9-arrival-revalidation.md §5  10 arrival corrections (numbered A1–A10 below)
Output:
  docs/research/visa-playbooks.json, arrival-official.json, post-arrival-official.json

Deterministic and idempotent: the output is always rebuilt from the archived baseline, so running it twice writes the
same files. Provenance rules:
  * every changed field is listed in the route's ``v9_revalidation.changes`` with its correction number, verdict, the
    source ids + urls and ``verified_at`` 2026-10-10; the cited sources are appended to ``sources[]`` (with ``id``);
  * fields the re-validation could NOT confirm are listed in ``v9_revalidation.unconfirmed`` (never guessed);
  * ``verification_status`` is VERIFIED only when nothing is left unconfirmed;
  * time-versioned rules (Kyrgyzstan 2027-01-01) live in ``scheduled_changes`` with ``effective_from`` and are NOT
    applied to the current values (see app/seed/visa_playbooks.py ``materialize``);
  * announced-but-not-in-force MOJ plans (2026-10-07) are ``watch_items`` only, never rules.

Usage (from server/):  .venv/bin/python scripts/v9_visa_research_apply.py
"""
from __future__ import annotations

import copy
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RES = ROOT / "docs" / "research"
ARCHIVE = RES / "archive"
V9 = "2026-10-10"
REPORT = "docs/research/v9-visa-revalidation.md"
REPORT_ARR = "docs/research/v9-arrival-revalidation.md"
REGISTRY = "docs/research/v9-visa-sources.json"

SRC = {s["id"]: s for s in json.loads((RES / "v9-visa-sources.json").read_text(encoding="utf-8"))}


def sid(n: int | str) -> str:
    return n if isinstance(n, str) else f"V9V-S{n}"


def src_entry(n) -> dict:
    s = SRC[sid(n)]
    return {"id": s["id"], "url": s["url"], "title": s["title"], "verified_at": V9, "page_date": None, "quote": s.get("note"),
            "evidence": s.get("evidence")}


# ================================================================================================ visa playbooks
COUNTRY_IDX = {"NP": [0, 1, 2], "MM": [3, 4, 5], "VN": [6, 7, 8], "UZ": [9, 10, 11], "MN": [12, 13, 14], "CN": [15, 16, 17],
               "IN": [18, 19, 20], "BD": [21, 22, 23], "PK": [24, 25, 26], "ID": [27, 28, 29, 30], "TH": [31, 32], "PH": [33, 34],
               "KZ": [35, 36, 37, 38], "KG": [39, 40]}

THIRD_COUNTRY_OLD = "Posts in third countries generally do not accept applications from these nationals unless they have long-term residence there."
THIRD_COUNTRY_NEW = ("For D-2/D-4 the MOJ manual says: apply at the post covering your country of residence or your last school "
                     "(the third-country restriction in the manual applies to E-6-2 only). Some posts (e.g. Hanoi, Bangkok) apply their own "
                     "third-country restrictions.")
BANK30_OLD = "[MOJ national rule] Bank balance certificates are valid only if issued within 30 days (a post may set a stricter window, see embassy docs)."
BANK30_D4 = ("[MOJ national rule, D-4] Bank balance certificates are valid only if issued within 30 days (a post may set a stricter "
             "window, see embassy docs).")
BANK30_D2 = ("[Post rule] For D-2 the post's own certificate window applies; the MOJ manual states the 30-day balance-certificate rule "
             "only for D-4.")
EVISA_NEW = ("Conditional on the university, not the nationality (MOJ national rule, visa manual 2026.9): e-visa via visa.go.kr (filed by "
             "the university) is available for all D-2 levels at 'excellent certified' (우수 인증) universities, and for D-2-3/D-2-4 only at "
             "'certified' (인증) universities. Not available at general universities, at 비자심사강화대학 (visa-screening-strengthened "
             "universities: 컨설팅대학 and 비자정밀심사대학 — formerly 'lower-tier' / 'visa-restricted'), or for D-4-1. Tiers follow the "
             "2025 IEQAS results (released 2026-02-12, valid 2026.3–2030.2: excellent 39, certified 181, general 134, consulting 13, "
             "비자정밀심사 16 per the MOJ/MOE release; some posts cite 43 excellent universities — not reconciled). Cuba, Syria, North "
             "Macedonia and Kosovo nationals are excluded.")
EVISA_D41_NEW = ("Not available for D-4-1 at any university tier (MOJ visa manual 2026.9 issuance table: e-visa × for language training).")
WATCH_MOJ = {"announced": "2026-10-07", "in_force": False, "sources": ["V9V-S8"],
             "text": ("MOJ press release 2026-10-07 announces PLANS only, none in force: finance-proof waiver for TOPIK 4 / KIIP 4 holders; a "
                      "study-fund deposit scheme ('27 first half / '28); suspension of certified-university benefits for weekend, night and "
                      "online programmes. Do not show these as rules.")}
WATCH_NOTE = ("WATCH (announced by MOJ 2026-10-07, NOT in force — not a current requirement): TOPIK 4 / KIIP 4 finance waiver; study-fund "
              "deposit scheme ('27–'28); certified-university benefit suspension for weekend/night/online programmes.")


class Route:
    """Edits one route and records provenance as it goes."""

    def __init__(self, r: dict):
        self.r = r
        self.prov = {"verified_at": V9, "report": REPORT, "source_registry": REGISTRY, "changes": [], "confirmed": [], "unconfirmed": [],
                     "watch_items": [WATCH_MOJ]}

    def cite(self, ids) -> list[dict]:
        out = []
        for n in ids:
            e = src_entry(n)
            hit = next((s for s in self.r["sources"] if s.get("url") == e["url"]), None)
            if hit is not None:
                hit["verified_at"] = V9
                hit.setdefault("id", e["id"])
            else:
                self.r["sources"].append(e)
            out.append({"id": e["id"], "url": e["url"]})
        return out

    def change(self, n, path: str, verdict: str, ids, value=None, context=()) -> None:
        """``context``: sources of OTHER countries' posts that the research quotes as examples — recorded in the provenance
        only, never attached to this route's sources (no cross-country leaks)."""
        ctx = [{"id": sid(i), "url": SRC[sid(i)]["url"], "role": "example from another post"} for i in context]
        self.prov["changes"].append({"correction": n, "path": path, "verdict": verdict, "sources": self.cite(ids), "verified_at": V9,
                                     **({"context_sources": ctx} if ctx else {}), **({"value": value} if value is not None else {})})

    def confirm(self, field: str, verdict: str, ids) -> None:
        self.prov["confirmed"].append({"field": field, "verdict": verdict, "sources": self.cite(ids), "verified_at": V9})

    def unconfirmed(self, field: str, detail: str) -> None:
        self.prov["unconfirmed"].append({"field": field, "status": "STILL_UNCONFIRMED", "detail": detail,
                                         "needs": "a human call or email to the post"})

    def doc(self, key: str) -> dict | None:
        return next((d for d in self.r["documents"] if d["key"] == key), None)

    def add_doc(self, d: dict, after: str | None = None) -> None:
        if self.doc(d["key"]):
            return
        base = {"required": True, "condition": None, "validity": None, "legalization": None, "translation": None, "provided_by": "student",
                "notes": None}
        base.update(d)
        docs = self.r["documents"]
        i = next((j + 1 for j, x in enumerate(docs) if x["key"] == after), len(docs))
        docs.insert(i, base)

    def notes_replace(self, old: str, new: str) -> bool:
        hit = False
        for i, s in enumerate(self.r["special_notes"]):
            if old in s:
                self.r["special_notes"][i] = s.replace(old, new)
                hit = True
        return hit

    def note_add(self, s: str) -> None:
        if s not in self.r["special_notes"]:
            self.r["special_notes"].append(s)


def fees_dict(r: dict) -> dict:
    f = r.get("fees")
    if isinstance(f, dict):
        return f
    return {"details": f} if f else {}


def apply_visa(data: list[dict]) -> list[dict]:
    data = copy.deepcopy(data)
    R = [Route(r) for r in data]
    by = lambda c: [R[i] for i in COUNTRY_IDX[c]]  # noqa: E731
    d2 = lambda x: x.r["visa_type"] != "D-4-1"  # noqa: E731

    # ---------------------------------------------------------------- cross-cutting (#42 #43 #44 #46) + MOJ manual refresh
    for x in R:
        if x.notes_replace(THIRD_COUNTRY_OLD, THIRD_COUNTRY_NEW):
            own = {"VN": [5, 40], "TH": [5, 49]}.get(x.r["country"], [5])
            x.change(42, "special_notes[21 designated countries]", "CHANGED (note text)", own, context=[i for i in (40, 49) if i not in own])
        if x.notes_replace(BANK30_OLD, BANK30_D2 if d2(x) else BANK30_D4):
            x.change(43, "special_notes[30-day balance certificate]", "CHANGED (scope)" if d2(x) else "SAME (D-4 national rule)", [5])
        if x.r["e_visa_condition"].startswith("Conditional on the university"):
            x.r["e_visa_condition"] = EVISA_NEW
            x.change(44, "e_visa_condition", "NEWLY CONFIRMED (tier names/counts)", [5, 7])
        elif x.r["e_visa_condition"].startswith("Not available for D-4-1"):
            x.r["e_visa_condition"] = EVISA_D41_NEW
            x.confirm("e_visa_condition", "SAME", [5])
        x.prov["changes"].append({"correction": 46, "path": "reviewer_notes (watch)", "verdict": "NEW watch item (not in force)",
                                  "sources": x.cite([8]), "verified_at": V9})
        x.r["reviewer_notes"] = ((x.r["reviewer_notes"] or "").rstrip() + " " + WATCH_NOTE).strip()
        x.confirm("national rules (TB list, 21 designated countries, legalisation, family proof)", "SAME", [5])
        if x.r["country"] not in ("NP", "MM"):
            x.confirm("apostille status (HCCH)", "SAME", [1, 2])
    for c in ("IN", "BD"):
        for x in by(c):
            sr = x.r["financial"]["sponsor_rules"]
            if d2(x):
                sr = sr.replace("MOJ national rule: balance certificate valid if issued within 30 days; ", "MOJ national rule: ")
                sr = sr.replace("balance certificate valid 30 days; ", "")
                sr += (" Balance-certificate window: not stated by the post; the MOJ 30-day rule is stated only for D-4 (not confirmed for "
                       "D-2).")
                x.change(43, "financial.sponsor_rules", "CHANGED (scope)", [5])
                x.unconfirmed("financial.certificate_window", "The post states no balance-certificate window for D-2; the MOJ 30-day rule is D-4 only.")
            else:
                sr = sr.replace("MOJ national rule: balance certificate valid if issued within 30 days", "MOJ national rule (D-4): balance certificate valid only if issued within 30 days")
                sr = sr.replace("balance certificate valid 30 days", "balance certificate valid only if issued within 30 days (D-4 rule)")
                x.confirm("financial.certificate_window (MOJ D-4 rule)", "SAME", [5])
            x.r["financial"]["sponsor_rules"] = sr

    # ---------------------------------------------------------------- Nepal (#16 #23 #24 #25)
    for x in by("NP"):
        f = x.r["fees"]
        f["details"] = f["details"].replace("KVAC service charge not stated on the embassy page.",
                                            "KVAC service fee NPR 2,000 per application (cash); optional: delivery NPR 1,000, form-filling NPR 1,000, VIP NPR 5,000.")
        x.change(16, "fees.details", "NEWLY CONFIRMED", [18])
        b = x.doc("bank_balance_certificate")
        b["validity"] = "Issued within 1 month of application (KVAC)"
        b["notes"] = "The page states no minimum amount. KVAC: 'issued within one month from the date of your visa application'."
        x.change(23, "documents:bank_balance_certificate.validity", "NEWLY CONFIRMED", [19])
        old = "Document validity: documents must be issued within 6 months of application; language scores within 2 years."
        new = ("Document validity — the two official sources differ: the Embassy says issued within 6 months (language scores 2 years); KVAC "
               "says general documents are valid 3 months from issue and verified education documents 6 months. Use the stricter value "
               "(3 months) until the post confirms.")
        assert x.notes_replace(old, new)
        x.change(24, "special_notes[document validity]", "CHANGED (conflict surfaced)", [12, 19])
        x.unconfirmed("document validity", "Embassy 6 months vs KVAC 3 months for general documents.")
        kvac = "KVAC checklist (D-2 2026.05.08 / D-4 2026.06.09); not on the Embassy list"
        x.add_doc({"key": "family_relation_certificate", "name": "Family relationship certificate (originals and photocopies)", "provided_by": "authority",
                   "notes": kvac}, after="sponsor_documents")
        x.add_doc({"key": "other_sop", "name": "Statement of purpose (SOP)", "notes": kvac}, after="other_study_plan")
        x.add_doc({"key": "other_character_certificate", "name": "Character certificates", "provided_by": "authority", "notes": kvac},
                  after="transcript")
        x.add_doc({"key": "other_grade11_marksheet", "name": "Grade 11 mark sheet", "notes": kvac}, after="transcript")
        x.change(25, "documents (+family_relation_certificate, other_sop, other_character_certificate, other_grade11_marksheet)",
                 "NEWLY CONFIRMED (KVAC additions)", [19, 20])
        x.r["application_method"]["details"] = x.r["application_method"]["details"].replace(
            "Student visa intake windows:", "KVAC is walk-in, 09:00–16:00 on working days (passport pickup 09:00–17:00). Student visa intake windows:")
        x.change("NP hours", "application_method.details", "NEWLY CONFIRMED (hours)", [15, 16, 18])
        x.confirm("jurisdiction, holding period, TB hospitals, visa fee, D-2 processing time, interview", "SAME", [12, 13, 15, 16])
        x.note_add("KVAC fraud warning (2026-02-04): only the title was read; check the KVAC notice board.")
    np41 = R[2]
    np41.unconfirmed("processing_time", "D-4 is not named in the processing-time notice (D-2-1~D-2-4: 8 working days; 'other general visas': 15).")
    for x in by("NP"):
        x.r["verification_status"] = "PARTIAL"

    # ---------------------------------------------------------------- Myanmar (#26 #27 #28)
    for x in by("MM"):
        fe = x.doc("final_education_certificate")
        fe["legalization"] = "NONE"
        fe["notes"] = ("Post rule (list 2026.10): Myanmar-issued documents need only the original + 2 copies + a notarised English translation "
                       "(no apostille — Myanmar is not a party — and no consular confirmation). Documents issued in a third country need an "
                       "apostille or Korean consular confirmation.")
        x.change(26, "documents:final_education_certificate.legalization", "NEWLY CONFIRMED (settled)", [1, 21], "NONE")
        nrc = x.doc("other_nrc")
        nrc["notes"] = "Listed on the 2026.10 document list (modified 2026-10-02)."
        lc = x.doc("language_certificate")
        if lc:
            lc["notes"] = "2026.10 list: language proof (TOPIK 3/4, KIIP or Sejong equivalents) for consulting / visa-restricted (비자심사강화) university admits."
        x.change(26, "documents:other_nrc + language_certificate", "CHANGED (2 items on the 2026.10 list)", [21])
        s0 = x.r["sources"][0]
        s0["page_date"] = "modified 2026-10-02 (list dated 2026.10)"
        s0["verified_at"] = V9
        s0["id"] = "V9V-S21"
        x.change(27, "sources[0].page_date", "CHANGED (source date)", [21], s0["page_date"])
        x.r["application_method"]["details"] = x.r["application_method"]["details"].replace("Collect the passport Mon–Fri 15–16",
                                                                                            "Collect the passport Mon–Fri 15:00–16:00")
        x.confirm("finance amounts, holding period, certificate window, TB (hospital list 2026.4), validity, fee, 30 days, 6-month re-apply bar",
                  "SAME", [21, 22, 23, 24, 25])
        x.r["reviewer_notes"] = x.r["reviewer_notes"].replace(
            "The embassy lists are clear, but the legalization requirement for Myanmar education documents is not stated: the list asks for original + copies + notarised English translation, while the MOJ national rule requires apostille or consular confirmation. ",
            "V9 (2026-10-10): legalization settled by the 2026.10 list — Myanmar-issued documents need original + copies + notarised English translation only. ").replace(
            "had not been posted as of 2026-09-29. The document list is dated Sep 2025 and the TB hospital list Apr 2026 (attachment not parsed).",
            "had still not been posted on 2026-10-10. The document list is dated 2026.10 (modified 2026-10-02); TB hospital list 2026.4.")
        x.r["verification_status"] = "PARTIAL"
    for x in (R[3], R[4]):
        x.unconfirmed("application_method (D-2 intake date)", "The Mar-2027 D-2 waiting-number notice is not posted yet (latest seq=91, Sep-2026 term).")
    R[5].change(28, "documents:other_training_plan", "SAME (item present)", [21])
    R[5].unconfirmed("application_method (D-4 booking windows)", "Booking windows for the next D-4 term are announced per term; none newer than the Dec-2026 term was read.")

    # ---------------------------------------------------------------- Vietnam (#5 #9 #39 #40 #41)
    for x in by("VN"):
        am = x.r["application_method"]
        am["details"] = am["details"].replace(
            "fee 390,000 VND); agencies", "fee 390,000 VND; walk-in with queue numbers since 2026-04-06 — online booking stopped — Mon–Fri 08:00–16:30); agencies"
        ).replace("www.visaforkorea-hc.com; 390,000 VND).", "www.visaforkorea-hc.com; 390,000 VND; 08:30–12:00 and 13:00–16:00; optional paid VIP service from 2026-10-05).")
        x.change(5, "application_method.details", "CHANGED (Hanoi booking)", [46, 47])
        x.r["fees"] = {"amount": 50, "currency": "USD",
                       "details": ("USD 50 at all three posts for a single-entry visa with a stay of 91+ days (multiple entry USD 80). Plus a KVAC "
                                   "service fee of 390,000 VND at Hanoi and HCMC."),
                       "source_url": SRC["V9V-S39"]["url"]}
        x.change(9, "fees", "CHANGED (resolved)", [39, 42, 44], {"amount": 50, "currency": "USD"})
        assert x.notes_replace("The June-2026 embassy document lists predate this, so reconfirm with the post.",
                        "In force since 2026-09-11 (Korea did not object); sticker apostille only, e-apostille not yet in use. Posts may still "
                        "consular-confirm Vietnamese high-school records, and the receiving body may require one method. The study lists "
                        "(Hanoi June, HCMC Jan, Da Nang Mar) have not yet been updated, so reconfirm with the post.")
        x.change(39, "special_notes[apostille]", "NEWLY CONFIRMED (in force + high-school caveat)", [1, 2, 3, 37])
        x.note_add("Embassy notice (2026-05-28): records from 'Global International School' / St. Mary's International School (Hanoi) are invalid "
                   "even if already consular-confirmed.")
        x.note_add("Da Nang: refusal for false documents means a 6-month bar; its FAQ mentions a 1–3 year restriction.")
        x.change(40, "special_notes[+invalid-records notice, Da Nang bar]", "NEWLY CONFIRMED", [38, 44, 45])
        dn = next(j for j in x.r["jurisdiction"] if j["city"] == "Da Nang")
        dn["covers_regions"] = dn["covers_regions"].rstrip(")") + "; pre-merger names — which post covers the former Kon Tum area, now in Quang Ngai, is not confirmed)"
        x.change(41, "jurisdiction[Da Nang].covers_regions", "STILL UNCONFIRMED (Kon Tum)", [45, 48])
        x.unconfirmed("jurisdiction (former Kon Tum)", "Which post covers the former Kon Tum area after the provincial merger.")
        x.unconfirmed("documents legalization (apostille vs consular)", "Whether the study lists accept an apostille alone for degrees and high-school records.")
        x.r["reviewer_notes"] = x.r["reviewer_notes"].replace(", and (2) the fee table mapping is ambiguous", " (the fee-table ambiguity is resolved in V9: USD 50)")
        x.confirm("jurisdiction (Hanoi, HCMC), documents, finance, holding period, 10-day window, TB, processing time", "SAME", [36, 40, 41, 43])
        x.r["verification_status"] = "PARTIAL"

    # ---------------------------------------------------------------- Uzbekistan (unconfirmed list only; no correction)
    for x in by("UZ"):
        x.confirm("channel, documents, finance, holding period, KDB window, apostille, D-4-1 amounts", "SAME", [61, 62, 63, 65])
        x.note_add("Embassy: an applicant who cannot submit the language proof is refused without interview; the study plan must be written by "
                   "the applicant.")
        x.change("UZ interview", "special_notes[+refusal without interview]", "NEWLY CONFIRMED", [61])
        x.unconfirmed("fees.visa_fee", "Not stated on any current page (the 2013 '$70' post is obsolete).")
        x.unconfirmed("processing_time", "Not stated (the 2013 '10 days' is obsolete).")
        x.unconfirmed("documents:tb_test.validity", "No validity period stated.")
        x.unconfirmed("document validity", "Not stated.")
        x.r["verification_status"] = "PARTIAL"

    # ---------------------------------------------------------------- Mongolia (#3 #4 #30)
    for x in by("MN"):
        am = x.r["application_method"]
        am["details"] = am["details"].replace(
            "Applicants must in principle apply in person at the Korea Visa Application Center (KVAC, Shine Songolt Bldg 8F, Khan-Uul; www.visaforkorea.mn) or at one of the 13 embassy-accredited agencies (list on the embassy site).",
            "Since 2026-09-09 individuals may file directly at the Korea Visa Application Center (KVAC, Shine Songolt Bldg 8F, Khan-Uul; "
            "www.visaforkorea.mn) without an agency, or use one of the 12 embassy-accredited agencies (agency J, DIDO LLC, stopped on "
            "2026-09-28). KVAC hours: individuals 08:30–16:00, agencies 08:30–11:00. The embassy says the agency system changes at the end of "
            "2026 (briefing held 2026-10-08; outcome not yet published).")
        x.change(3, "application_method.details", "CHANGED", [72, 73, 74, 75])
        f = x.r["fees"]
        f["center_fee"] = "KVAC 57,000 MNT; accredited agencies 30,000 MNT (Keybridge 50,000); optional form-filling 17,000, translation 6,000/page"
        f["details"] = "Visa fee $60 (GKS government scholars exempt). Service fee: KVAC 57,000 MNT, accredited agencies 30,000 MNT (Keybridge 50,000)."
        x.change(4, "fees.center_fee", "NEWLY CONFIRMED", [71, 75])
        x.change(30, "documents:criminal_record + other_marital_status", "NEWLY CONFIRMED (items present)", [68])
        x.r["reviewer_notes"] = x.r["reviewer_notes"].replace(" Service fees for KVAC/agencies were not parsed.", " Service fees confirmed in V9.")
        x.confirm("jurisdiction, finance, holding period, 2-week window, TB 3 months, apostille, validity, fee, processing time, re-apply 3 months",
                  "SAME", [68, 69, 70])
        x.prov["watch_items"].append({"announced": "2026-10-08", "in_force": False, "sources": ["V9V-S74"],
                                      "text": "Embassy agency-system change at the end of 2026 (outcome not published)."})
        x.r["verification_status"] = "VERIFIED"

    # ---------------------------------------------------------------- China (#7 #14 #15 #18)
    for x in by("CN"):
        sy = next(j for j in x.r["jurisdiction"] if j["city"] == "Shenyang")
        sy["post_name"] = "Consulate General in Shenyang (visa intake at Korea Visa Application Center Shenyang, visaforkorea-shenyang.com)"
        x.r["application_method"]["details"] += (" Shenyang: the Korea Visa Application Center moved on 2026-09-04 to 灵浠中心 A座15层 "
                                                 "(visaforkorea-shenyang.com); general visas are filed only via the centre or designated agencies. "
                                                 "Shanghai KVAC: 长宁区仙霞路99号31层. Beijing hours: agencies 09:00–12:00, individuals 09:00–16:00.")
        x.change(7, "jurisdiction[Shenyang] + application_method.details", "CHANGED (Shenyang VAC address)", [88, 92, 93])
        x.r["processing_time"] += " Shanghai: D-2/D-4 within 5 days, counted from the day after receipt. Shenyang: not stated."
        x.change(14, "processing_time", "NEWLY CONFIRMED (Shanghai)", [92])
        f = x.r["fees"]
        f["center_fee"] = ("Korea Visa Application Center fee: Beijing CNY 120 (express CNY 200); Guangzhou CNY 110 (express 190); Shenyang CNY 120 "
                           "(express +80)")
        f["amount"], f["currency"] = 420, "CNY"
        f["details"] = ("Visa fee CNY 420 (single entry, stay ≥91 days; express +CNY 140) at all posts checked. Centre fee: Beijing CNY 120 "
                        "(express 200), Guangzhou 110 (express 190), Shenyang 120 (express +80).")
        x.change(15, "fees.center_fee (+amount)", "SAME (+express NEWLY CONFIRMED)", [88, 90, 92, 93, 95])
        x.r["financial"]["holding_period"] = (
            "Post-specific — check your post. Beijing: deposit frozen ≥3 months from the application date. Guangzhou: frozen ≥1 month. "
            "Shanghai: at least 30 days remaining. Shenyang: at least 30 days. Consulting / visa-restricted (비자심사강화) universities: ≥6 months. "
            "Certificate issued within 30 days of application at every post checked. Designated banks — Guangzhou: ICBC, BOC, Minsheng, Hana, "
            "CCB (other banks need an explanation letter and proof of the freeze); Shenyang: ICBC, BOC, Minsheng, CCB. Qingdao, Chengdu, Xi'an, "
            "Wuhan and Dalian were not re-checked.")
        x.change(18, "financial.holding_period", "CHANGED (per post)", [87, 91, 92, 94])
        bb = x.doc("bank_balance_certificate")
        bb["validity"] = "issued within 30 days of application; the freeze period depends on the post (see the financial block)"
        x.note_add("Guangzhou and Shanghai published new guides (Guangzhou 260930, Shanghai 2026.09.30). Guangzhou waives final-education proof "
                   "for excellent-certified and certified universities and rejects TB certificates missing the hospital phone, doctor's name "
                   "or stamp; it may hold phone interviews.")
        x.change("CN guides", "special_notes[+consulate guides]", "NEWLY CONFIRMED", [91, 92])
        x.unconfirmed("processing_time (Shenyang)", "Not stated by the Shenyang consulate.")
        x.unconfirmed("financial.holding_period (Qingdao, Chengdu, Xi'an, Wuhan, Dalian)", "Not re-checked; only Beijing, Guangzhou, Shanghai and Shenyang were read.")
        x.unconfirmed("special notice", "KVAC Beijing notice of 2026-09-28 has an empty body (content unknown).")
        x.r["reviewer_notes"] = x.r["reviewer_notes"].replace(
            "Consulates other than Guangzhou were not individually checked for local variations (fees/centre).",
            "V9: Guangzhou, Shanghai and Shenyang also checked; holding period differs per post. Qingdao, Chengdu, Xi'an, Wuhan and Dalian not checked.")
        x.confirm("jurisdiction, KRW amounts, 30-day window, TB, CHSI, validity, visa fee, re-apply 2 months", "SAME", [87, 88, 89, 90])
        x.r["verification_status"] = "PARTIAL"

    # ---------------------------------------------------------------- India (#6 #12 #13 #32)
    for x in by("IN"):
        x.r["application_method"]["details"] += (" Mumbai (confirmed): from 2026-10-01 only through one of 14 designated travel agencies (list "
                                                 "dated 27.07.2026, may change); walk-in applications are no longer accepted. New Delhi VAC "
                                                 "hours 09:00–13:00 (Kolkata 10:00–13:00); the Delhi VAC was enlarged on 2026-09-15 with Friday "
                                                 "collection until 21:00.")
        x.change(6, "application_method.details", "NEWLY CONFIRMED", [96, 98, 99])
        x.r["fees"] = {"amount": 5400, "currency": "INR",
                       "visa_fee": ("New Delhi: INR 5,400 (single entry, stay over 90 days, from 2026-08-01; up to 90 days INR 3,600; multiple "
                                    "INR 8,100). Mumbai: INR 5,400 regular / 8,100 express (from 2026-08-03; was 5,100 / 7,650). Chennai: Rs 5,400."),
                       "center_fee": "VFS service charge Rs 1,380 (New Delhi, Chennai); Chennai courier Rs 550",
                       "details": ("Visa fee INR 5,400 at all three posts (single entry, stay over 90 days; Mumbai express INR 8,100). VFS service "
                                   "charge Rs 1,380 (New Delhi, Chennai); Chennai courier Rs 550."),
                       "source_url": SRC["V9V-S97"]["url"]}
        x.change(12, "fees", "NEWLY CONFIRMED", [97, 101, 102])
        x.r["processing_time"] = ("New Delhi: application day + 14 working days (Kolkata VAC +2–3 days); express suspended. "
                                  + x.r["processing_time"].replace(" New Delhi: not stated.", ""))
        x.change(13, "processing_time", "NEWLY CONFIRMED (Delhi)", [96])
        x.change(32, "documents:other_health_condition_report + other_declaration_form", "NEWLY CONFIRMED (items present)", [96])
        x.r["reviewer_notes"] = x.r["reviewer_notes"].replace(
            "Fee amounts after the Aug-2026 revision not verified for Delhi/Mumbai (image). ", "Fees after the Aug-2026 revision confirmed in V9. ")
        x.unconfirmed("financial.amount", "No minimum balance is stated by any Indian post; the admission-certificate amount applies.")
        x.unconfirmed("document validity", "Not stated.")
        x.unconfirmed("refusal re-apply interval", "Not published.")
        x.confirm("jurisdiction, holding period, TB labs, family documents, apostille per post, VFS fee", "SAME", [96, 100, 102])
        x.r["verification_status"] = "PARTIAL"

    # ---------------------------------------------------------------- Bangladesh (#1 #2 #29)
    for x in by("BD"):
        x.r["jurisdiction"] = [
            {"post_name": "Embassy of the Republic of Korea in Bangladesh (decides on the visa; intake via KVAC Dhaka)", "city": "Dhaka",
             "url": "https://overseas.mofa.go.kr/bd-en/index.do", "covers_regions": None},
            {"post_name": "Korea Visa Application Center Dhaka (KVAC, operated by VFS Global)", "city": "Dhaka",
             "url": SRC["V9V-S34"]["url"], "covers_regions": None},
        ]
        x.r["application_method"] = {
            "kind": "VISA_CENTER",
            "details": ("Since 2026-09-02 general visas, including student visas, are taken only at the Korea Visa Application Center Dhaka "
                        "(KVAC, run by VFS Global): 2F B&T Nehaleeya Tower, Plot 80, Block B, Kemal Ataturk Avenue, Dhaka 1213. "
                        "Sunday–Thursday 09:00–16:00. Each applicant books an individual appointment on visaforkorea-bd.com. Fill in the "
                        "e-Form (visa) on visa.go.kr first (required for student applicants since 4 May 2025) and print it with the bar code. "
                        "The Embassy still decides on the visa (and handles diplomatic and official visas). The Embassy's student-visa page "
                        "still says to visit the consular section — that wording is out of date since the centre opened."),
            "url": SRC["V9V-S27"]["url"],
        }
        x.change(1, "application_method + jurisdiction (+KVAC Dhaka)", "CHANGED", [27, 28, 34])
        x.r["fees"] = {"amount": 60, "currency": "USD",
                       "visa_fee": x.r["fees"]["visa_fee"],
                       "center_fee": ("VFS service fee BDT 2,150 per application (cash for about the first two weeks, then paid online in "
                                      "advance); optional services priced on the VFS site"),
                       "details": ("Visa fee USD 60 (more than 90 days, single; paid in BDT at USD 1 = BDT 125) + KVAC/VFS service fee BDT 2,150 "
                                   "per application. Non-refundable."),
                       "notes": x.r["fees"].get("notes")}
        x.change(2, "fees.center_fee", "NEWLY CONFIRMED", [34])
        x.change(29, "documents (police clearance 3 months, English score 2 years, air ticket, payment certificate)", "NEWLY CONFIRMED (items present)", [29])
        fe = x.doc("final_education_certificate")
        fe["notes"] = fe["notes"].replace(
            "The page does not use the word 'apostille' (Bangladesh apostille in force since 2025-03-30) — confirm whether MoFA attestation means an apostille.",
            "The page does not use the word 'apostille'. Bangladesh's apostille has been in force since 2025-03-30 and Korea did not object, so an "
            "apostille is legally valid between the two states; the Embassy already asks for e-Apostille for GKS (2026-02-02). Whether the "
            "visa desk accepts an apostille instead of MoE + MoFA attestation is not confirmed.")
        x.note_add("Embassy notice (2026-07-28): Shin Gyeongju University bankruptcy claims go through the Daegu court; the Embassy 'has no "
                   "authority to intervene'.")
        x.r["processing_time"] = "Not stated (the KVAC launch notice gives none); students were asked to apply at least 5 days before the term starts."
        x.r["reviewer_notes"] = ("V9 (2026-10-10): intake moved to the VFS-run KVAC Dhaka on 2026-09-02; the Embassy's student page is stale on "
                                 "where to apply. Embassy publishes ONE combined D-2/D-4 list; this route repeats it per visa type. Open: "
                                 "apostille vs MoE + MoFA attestation; processing time; re-apply rule; no minimum balance amount stated. "
                                 + WATCH_NOTE)
        x.unconfirmed("documents legalization (apostille vs attestation)", "Whether a Bangladesh MoFA (e-)Apostille replaces MoE + MoFA attestation for visa files.")
        x.unconfirmed("financial.amount", "No minimum balance amount is stated; the admission-certificate amount applies.")
        x.unconfirmed("processing_time", "Not stated since the KVAC took over intake.")
        x.unconfirmed("refusal re-apply rule", "Not published.")
        x.confirm("TB (PRAAVA, 3 months), family documents, validity 3 months, visa fee USD 60", "SAME", [27, 29, 30, 31])
        x.r["verification_status"] = "PARTIAL"

    # ---------------------------------------------------------------- Pakistan (#10 #11 #31)
    for x in (R[24], R[25]):
        x.r["fees"] = {"amount": 18000, "currency": "PKR", "visa_fee": "Single entry > 91 days: Rs 18,000",
                       "details": "Single entry > 91 days: Rs 18,000 (Embassy fee notice 2026-03-02; Karachi notice 2026-02-24). Non-refundable; paid at application.",
                       "notes": "The USD 60 on the static requirement pages is out of date."}
        x.change(10, "fees.visa_fee", "CHANGED (resolved)", [105, 109, 110], "Rs 18,000")
        x.r["processing_time"] = "Minimum 8 weeks after receipt (Islamabad and Karachi). The 3-week figure on Karachi's static page is out of date."
        x.change(11, "processing_time", "CHANGED (resolved)", [106, 108, 109])
        x.change(31, "documents:language_certificate + other_polio_vaccination", "NEWLY CONFIRMED (items present)", [104, 109])
        x.r["reviewer_notes"] = ("Posts publish one D-2 list (Karachi: 'D-2 series, bachelor, master doctoral etc'). Legalization marked APOSTILLE "
                                 "from the Embassy apostille notice + MOJ rule; the visa page itself still says HEC/board attestation. V9 "
                                 "(2026-10-10): fee (Rs 18,000) and processing time (8 weeks) conflicts resolved. No fixed minimum balance: the "
                                 "post's rule is the whole cost of stay on the admission certificate. " + WATCH_NOTE)
        x.confirm("jurisdiction, channel, finance rule, holding period, TB, family documents, apostille, re-apply 3 months", "SAME", [104, 107, 108, 111])
        x.r["verification_status"] = "VERIFIED"
    R[26].unconfirmed("documents", "No D-4-1 document list is published by the Embassy Islamabad or the Karachi Office.")
    R[26].cite([104, 106, 108, 110])
    R[26].r["verification_status"] = "NEEDS_REVIEW"

    # ---------------------------------------------------------------- Indonesia (#37 #38)
    for x in by("ID"):
        if x.r["visa_type"] in ("D-2-3", "D-2-4"):
            fe = x.doc("final_education_certificate")
            fe["legalization"] = None
            fe["notes"] = ("The embassy guide places '고등학교 이하인 경우 … 공증 또는 아포스티유' only under D-2-1, D-2-2 and D-4-1; no such note for "
                           "D-2-3/D-2-4. Not marked APOSTILLE here (the MOJ national rule on foreign education documents still applies).")
            x.change(37, "documents:final_education_certificate.legalization", "CHANGED (D-2-3 / D-2-4 tag)", [114], "null")
        tb = x.doc("tb_test")
        tb["validity"] = "valid 3 months from issue"
        tb["notes"] = "New designated form in force from 2026-06-11; non-designated forms are not accepted. 115 designated hospitals."
        x.note_add("Refused applicants cannot re-apply for 3 months from the refusal date; fraud can lead to a restriction of up to 3 years.")
        x.change(38, "special_notes[+3-month refusal bar] + documents:tb_test.validity", "NEWLY CONFIRMED", [113, 116])
        x.r["application_method"]["details"] += " KVAC intake 09:00–15:00; collection 12:00–17:00."
        x.change("ID hours", "application_method.details", "NEWLY CONFIRMED (hours)", [117])
        x.unconfirmed("special_notes['43 universities' list]", "Jakarta has not published the list; 43 matches the Beijing PDF count but MOJ says 39 — do not infer.")
        x.confirm("jurisdiction, channel, documents, finance, holding period, family documents, fees, processing time", "SAME", [112, 114, 116, 117])
        x.r["verification_status"] = "PARTIAL"

    # ---------------------------------------------------------------- Thailand (#17 #36)
    for x in by("TH"):
        x.r["fees"] = {"amount": None, "currency": "THB",
                       "details": ("Embassy fee table (2023-03-29, Thai baht cash): Thai nationals FREE (fee-exempt row; checked visually "
                                   "2026-10-10). 'GENERAL' single entry over 91 days = THB 2,040 (USD 60)."),
                       "thai_nationals": "FREE", "source_url": SRC["V9V-S49"]["url"]}
        x.change(17, "fees", "NEWLY CONFIRMED (Thai nationals FREE)", [49])
        pr = x.doc("other_passport_record")
        pr["name"] = "Record of passport (Thai nationals only; issued by the Thai MFA)"
        s0 = x.r["sources"][0]
        s0["page_date"], s0["verified_at"], s0["id"] = "2026-09-30", V9, "V9V-S49"
        x.note_add("Thai MFA certification (notice 2026-04-22): the stamp should read 'Certified Genuine Signature(s)' / 'Certified True Copy'; "
                   "'Seen at the Ministry …' may trigger requests for more documents.")
        x.change(36, "documents:other_passport_record + sources[0].page_date + special_notes[MFA stamp]", "CHANGED (+1 document, page 2026-09-30)", [49, 52])
        x.r["reviewer_notes"] = x.r["reviewer_notes"].replace("modified 2026-09-14", "modified 2026-09-30").replace(
            " The Thai-national fee exemption was read from a PDF table and should be re-checked visually.", " Thai-national fee exemption confirmed in V9.")
        x.unconfirmed("financial.amount", "The embassy states no minimum amount; the admission-certificate amount applies.")
        x.confirm("jurisdiction, channel, holding period / 2-week window, TB, family documents, validity, processing time", "SAME", [49, 50, 51])
        x.r["verification_status"] = "PARTIAL"

    # ---------------------------------------------------------------- Philippines (#8)
    for x in by("PH"):
        x.r["jurisdiction"] = [
            {"post_name": "Embassy of the Republic of Korea in the Philippines (applications via Korea Visa Application Center Manila)",
             "city": "Manila (Taguig)", "url": "https://overseas.mofa.go.kr/ph-en/index.do", "covers_regions": ["Luzon", "Mindanao"]},
            {"post_name": "Consulate (분관) of the Republic of Korea in Cebu", "city": "Cebu", "url": "https://overseas.mofa.go.kr/ph-cebu-ko/index.do",
             "covers_regions": ["Visayas (16 provinces)"]},
        ]
        x.r["application_method"] = {
            "kind": "MIXED",
            "details": ("Luzon and Mindanao residents: all visa applications are filed and released at the Korea Visa Application Center Manila, "
                        "9/F (zone2) Brittany Hotel, 6 McKinley Parkway, BGC, Taguig — individuals 08:30–16:00, release 13:00–17:00 — in person "
                        "or through one of the 55 embassy-designated travel agencies (from 2026-10-01). Visayas residents: Cebu consulate, "
                        "booking on g4k.go.kr required (study slot 11:00–12:00), release 14:00–16:00 at the consulate."),
            "url": x.r["application_method"]["url"],
        }
        x.change(8, "jurisdiction.covers_regions + application_method", "NEWLY CONFIRMED (split) / CHANGED (address, Cebu booking)", [55, 56, 58, 60])
        fe = fees_dict(x.r)
        x.r["fees"] = {"amount": None, "currency": "PHP", "details": fe.get("details"), "source_url": SRC["V9V-S60"]["url"]}
        x.r["processing_time"] = ("Cebu: at least 10 working days (usually 2+ weeks), covering study visas. Manila: no D-2/D-4 figure published "
                                  "(the 12-day figure from 2026-10-01 is for C-3 only).")
        x.change("PH time", "processing_time", "NEWLY CONFIRMED (Cebu); Manila STILL UNCONFIRMED", [54, 57])
        x.note_add("Cebu's English page says 'master or PhD' for the USD amount, while its Korean page says 전문학사 이상 (associate degree and "
                   "above) — follow the Korean text and confirm.")
        x.r["reviewer_notes"] = x.r["reviewer_notes"].replace(" The Manila/Cebu jurisdiction split is not verified.", " Manila/Cebu split confirmed in V9 (Luzon + Mindanao / Visayas).").replace(
            " The current D-2 processing time is not verified.", " Manila D-2 processing time and consular fee not published.")
        x.unconfirmed("fees (Manila consular visa fee)", "The Manila page states no consular visa fee.")
        x.unconfirmed("processing_time (Manila)", "No D-2/D-4 figure published by Manila.")
        x.unconfirmed("documents (2019 Manila list)", "Whether the 2019 Manila list is still complete.")
        x.confirm("finance, window, TB, family documents, KVAC fee PHP 1,000, D-4-1 USD 9,000 (Cebu)", "SAME", [53, 54, 59, 60])
        x.r["verification_status"] = "PARTIAL"

    # ---------------------------------------------------------------- Kazakhstan (#33 #34 #35 #45)
    for x in by("KZ"):
        ac = x.doc("other_address_certificate")
        ac["notes"] = "Astana: at least 6 months of registration in its region ('не менее 6 месяцев'); Almaty: at least 3 months ('как минимум 3 месяца')."
        x.change(33, "documents:other_address_certificate + language_certificate", "NEWLY CONFIRMED (items present)", [76, 81])
        tb = x.doc("tb_test")
        tb["notes"] = ("Almaty notice (modified 2026-08-25): chest X-ray + sputum PCR at designated hospitals. This conflicts with the visa page "
                       "options; show the stricter requirement (X-ray + PCR) for Almaty until the consulate confirms.")
        x.change(34, "documents:tb_test.notes", "CHANGED (conflict surfaced)", [80])
        x.note_add("Astana (2025-09-23): the funds must stay in the account until the date of entry ('вплоть до даты въезда'); the embassy may "
                   "re-request the certificate. Forged documents: entry ban of 1 year, then 3 years, agencies included.")
        x.change(35, "special_notes[+Astana funds/fraud rules]", "NEWLY CONFIRMED", [78])
        assert x.notes_replace("Apostille: Kazakhstan in force since 30 Jan 2001.", "Apostille: Kazakhstan acceded on 5 Apr 2000; in force since 30 Jan 2001.")
        x.change(45, "special_notes[apostille]", "SAME (adds accession date)", [1])
        x.unconfirmed("documents:tb_test (Almaty)", "Which TB test Almaty accepts: the visa-page options or the notice's X-ray + PCR.")
        x.confirm("jurisdiction, channel, finance, window, family documents, apostille per post, fee, processing time, re-apply 3 months", "SAME", [76, 77, 79, 81])
        x.r["verification_status"] = "PARTIAL"

    # ---------------------------------------------------------------- Kyrgyzstan (#19 #20 #21 #22) — time-versioned
    kg_notice = SRC["V9V-S84"]
    for x, cur, new_amt, hold in ((R[39], "USD 20,000", "USD 15,500 (university in Seoul, Gyeonggi or Incheon) / USD 12,500 (other regions)", "at least 1 month"),
                                  (R[40], "USD 10,000", "USD 7,800 (university in Seoul, Gyeonggi or Incheon) / USD 6,300 (other regions)", "at least 3 months")):
        old_fig = "18,000" if x is R[39] else "9,000"
        fin = x.r["financial"]
        fin["amount"] = f"{cur} final balance (embassy Russian page; applications up to 2026-12-31). The older 2022 figure ({old_fig}) is superseded."
        fin["holding_period"] = "Bank statement for the last 3 months (applications up to 2026-12-31)"
        x.change(19 if x is R[39] else 20, "financial.amount", "CHANGED (resolved)", [82, 84, 85], cur)
        bb = x.doc("bank_balance_certificate")
        bb["notes"] = f"Final balance {cur} (embassy Russian page) for applications up to 2026-12-31. A new rule applies from 2027-01-01 (see scheduled changes)."
        lang = ("D-4-1: TOPIK 1 or SKA 150" if x is R[40] else
                "associate TOPIK 2; bachelor TOPIK 3; master's and above TOPIK 4; lower-tier universities TOPIK 4; English track IELTS 5.5 / TOEFL iBT 71")
        x.r["scheduled_changes"] = [{
            "effective_from": "2027-01-01", "announced": "2026-08-24 (notice HWP dated 2026-08-14)", "status": "ANNOUNCED_NOT_IN_FORCE",
            "sources": [{"id": kg_notice["id"], "url": kg_notice["url"]}],
            "changes": [
                {"path": "financial.amount", "value": f"{new_amt}, KICB balance certificate in the applicant's or a parent's name, deposited {hold}"},
                {"path": "financial.holding_period", "value": f"Deposited {hold} at KICB; QR-verifiable certificate"},
                {"path": "financial.sponsor_rules", "value": ("Applicant or parent. Parents' finance documents: business, salary (Tunduk) and property "
                                                              "(Tunduk / cadastre.kg) records, QR-verifiable; property held at least 3 months; a bank "
                                                              "certificate alone is not enough for parents.")},
                {"path": "documents:bank_balance_certificate.notes", "value": f"KICB certificate, QR-verifiable; {new_amt}; deposited {hold}."},
                {"path": "documents:sponsor_documents.notes", "value": ("From 2027-01-01: business, salary (Tunduk) and property (Tunduk / "
                                                                        "cadastre.kg) records; QR-verifiable; property held at least 3 months.")},
                {"path": "documents:language_certificate.notes", "value": f"From 2027-01-01 thresholds: {lang}."},
            ],
        }]
        x.change(21, "scheduled_changes[2027-01-01] (financial, sponsor_documents, language)", "CHANGED (from 2027-01-01, not applied)", [84])
        x.note_add(f"Announced by the embassy (notice 2026-08-24), effective 2027-01-01 — NOT in force before that date: proof of funds becomes "
                   f"{new_amt.replace('USD ', '')} US dollars at KICB, deposited {hold}; parents' records via Tunduk / cadastre.kg; new language thresholds.")
        x.r["reviewer_notes"] = (f"V9 (2026-10-10): amount conflict resolved — {cur} applies to applications up to 2026-12-31 (the 2022 figure is "
                                 "superseded); a new KICB-based rule takes effect 2027-01-01 (stored in scheduled_changes, applied only from that "
                                 "date by re-running scripts/v9_visa_data.py). Still open: TB validity (Russian page 6 months vs 2022 notice 3 "
                                 "months — use the stricter 3 months), processing time, whether a Russian version of the 2027 rule will be issued. "
                                 + WATCH_NOTE)
        x.change(22, "reviewer_notes", "CHANGED", [82, 84, 85])
        x.unconfirmed("documents:tb_test.validity", "Russian page 6 months vs 2022 notice 3 months; the 2026 notice is silent.")
        x.unconfirmed("processing_time", "Not stated.")
        x.unconfirmed("document validity", "Not stated.")
        x.confirm("jurisdiction, channel, family documents, apostille, fee USD 70, refusal reasons not given", "SAME", [82, 83, 85])
        x.r["verification_status"] = "PARTIAL"

    # ---------------------------------------------------------------- finish
    for x in R:
        if x.prov["unconfirmed"] and x.r["verification_status"] == "VERIFIED":
            raise SystemExit(f"{x.r['country']} {x.r['visa_type']}: VERIFIED with unconfirmed fields")
        x.prov["status_reason"] = ("every field confirmed by a current official source" if x.r["verification_status"] == "VERIFIED"
                                   else f"{len(x.prov['unconfirmed'])} field(s) still unconfirmed — see unconfirmed[]")
        x.r["v9_revalidation"] = x.prov
    return data


# ================================================================================================ arrival facts
def apply_arrival(data: list[dict]) -> list[dict]:
    data = copy.deepcopy(data)
    T = {t["key"]: t for t in data}

    def prov(t, n, field, verdict, ids, unconfirmed=None):
        p = t.setdefault("v9_revalidation", {"verified_at": V9, "report": REPORT_ARR, "source_registry": REGISTRY, "changes": [], "unconfirmed": []})
        cites = []
        for i in ids:
            e = src_entry(i)
            if not any(s.get("url") == e["url"] for s in t["sources"]):
                t["sources"].append(e)
            else:
                for s in t["sources"]:
                    if s.get("url") == e["url"]:
                        s["verified_at"] = V9
                        s.setdefault("id", e["id"])
            cites.append({"id": e["id"], "url": e["url"]})
        if field:
            p["changes"].append({"correction": n, "path": field, "verdict": verdict, "sources": cites, "verified_at": V9})
        for u in unconfirmed or []:
            p["unconfirmed"].append({"field": u[0], "status": "STILL_UNCONFIRMED", "detail": u[1], "needs": "a human call or email"})

    # A1 — change reports: 15 days for an address change (Immigration Act Art. 36); other deadlines not re-confirmed
    t = T["residence_report_changes"]
    t["summary"] = ("After registering, report a change of address to immigration (or your community centre / ward office) within 15 days of "
                    "moving in — the Immigration Act (Art. 36) deadline for registered foreigners. Also report a new passport and a lost card "
                    "promptly; their exact deadlines were not re-confirmed from the law text, so check with 1345. Late reports can lead to fines.")
    t["steps"] = ["Moving (for example from a temporary room to the dorm): report the new address within 15 days of moving in",
                  "New passport: report it promptly (deadline not re-confirmed — check with 1345)",
                  "Lost card: apply for a new one promptly (deadline not re-confirmed — check with 1345)"]
    t["timing"] = "Address change: within 15 days of moving in"
    t["notes"] = ("V9 (2026-10-10): the 15-day address rule is confirmed by a district office citing Immigration Act Art. 36; the earlier "
                  "'14 days' is the 외국국적동포 residence-report rule and does not apply to D-2/D-4. law.go.kr did not render.")
    prov(t, "A1", "summary/steps/timing (14 → 15 days)", "CHANGED", [166],
         [("passport-change and lost-card deadlines", "Not re-confirmed from the Immigration Act text (law.go.kr did not render).")])
    t["verification_status"] = "PARTIAL"

    # A3 — Climate Card
    t = T["transport_card_tmoney"]
    t["summary"] = t["summary"].replace(
        "The Climate Card can only be bought or topped up with cash or a Korean-issued card.",
        "The Climate Card (기후동행카드) can only be bought or topped up with cash or a Korean-issued card. From 1 Oct 2026 its 30-day pass "
        "ended and the card works only within Seoul; short-term passes continue (Seoul only), and the replacement benefit is for Seoul citizens only.")
    prov(t, "A3", "summary (Climate Card)", "CHANGED", [137, 138])
    prov(t, None, None, None, [137])

    # A4 — ICN T2 counters
    t = T["sim_esim_arrival"]
    t["steps"][1] = ("On arrival: go to a carrier roaming centre in the arrivals hall (T1: 24h KT, SKT and LG U+ near Arrival Hall F; more near "
                     "Hall A, 06:00–22:00. T2: 24h KT and LG U+ near Exit 4 on 1F, SKT near Exit 7 on 1F; LG U+ also near Exit 7, 06:00–22:00)")
    t["summary"] = t["summary"].replace("some open 24 hours near Arrival Hall F.",
                                        "some open 24 hours near Arrival Hall F; at T2, 24-hour KT and LG U+ counters are near Exit 4 and SKT near Exit 7 (1F).")
    t["notes"] = t["notes"].replace("Counter locations and hours are verified on airport.kr for T1 only; check T2 separately.",
                                    "Counter locations and hours are verified on airport.kr for T1 and T2 (V9).")
    prov(t, "A4", "summary/steps (T2 counters)", "NEWLY CONFIRMED", [135, 136],
         [("carrier tourist eSIM products and prices", "Carrier pages could not be read."),
          ("postpaid needs the residence card", "Commercial guides only; not re-verified.")])

    # A5 — pickup
    t = T["university_airport_pickup"]
    t["summary"] = ("Some universities run shuttles on specific check-in days (cost varies; Korea University's 2026 notice does not state a "
                    "price). Example: Korea University's 2026 International Summer Campus ran hourly buses (11:00–19:00, up to 40 per trip) "
                    "from Incheon T1 Arrival Gate F to its dormitory on check-in day only; a similar shuttle runs on its winter programme "
                    "check-in day. Degree-programme pickups differ by university and intake.")
    prov(t, "A5", "summary (remove 'free')", "CHANGED", [141, 142], [("pickup cost", "Not stated by the university.")])

    # A6 — NHIS premium
    t = T["nhis_student_premium"]
    t["summary"] = t["summary"].replace(
        "One university notice gives the 2026 student premium as KRW 79,320 a month.",
        "University notices give the 2026 student premium as about KRW 79,320 a month (Sungshin, SeoulTech; a Sogang excerpt reads 79,310); "
        "NHIS itself does not state the 2026 amount.")
    t["cost"] = "About KRW 79,320/month in 2026 (university notices; not stated by NHIS; set yearly)"
    prov(t, "A6", "summary/cost (sources)", "SAME (stronger university support)", [124, 125, 126, 127, 128],
         [("2026 premium amount", "Not stated by NHIS (call 033-811-2000).")])

    # A7 — bank limits (FSC)
    t = T["bank_account_opening"]
    t["notes"] = t["notes"].replace("The limit figures come from the 2024 KOTRA guide; recheck them each year.",
                                    "The restricted-account limits (branch 3M, ATM 1M, internet 1M) are confirmed by the FSC (2024-05-02); recheck yearly.")
    prov(t, "A7", "notes (restricted-account limits)", "SAME (regulator-confirmed)", [132, 133, 134])

    # A8 — residence card booking
    t = T["residence_card_registration"]
    t["steps"][0] = ("Book a visit on HiKorea (www.hikorea.go.kr); whether walk-ins are accepted is set by each office (e.g. the Sejongno branch "
                     "suspended walk-in student registration from 2026-03-13 to 2026-04-03)")
    t["documents"] = [d.replace("Fee KRW 35,000 (some offices and universities say cash only)",
                                "Fee KRW 35,000 (payment method: only an outdated 2021 HiKorea page says cash only — confirm with the office)")
                      for d in t["documents"]]
    t["notes"] = t["notes"].replace("The deadline, the fee and the reservation requirement are verified from official or university pages.",
                                    "The deadline and the fee are verified (V9); the booking rule is set per office.")
    prov(t, "A8", "steps[0] (booking per office)", "SAME (rule is per office)", [118, 119, 120, 121, 122],
         [("fee payment method", "No current official statement (only a 2021 page says cash only)."),
          ("processing time", "No official MOJ figure (KHU: 1–2+ weeks).")])
    t["verification_status"] = "PARTIAL"

    # A9 — insurance
    t = T["private_insurance_bridge"]
    t["summary"] += (" No immigration rule requires private insurance for D-2/D-4. Several language institutes require 6-month group insurance "
                     "for D-4 students (e.g. Dankook; Yonsei KLI enrols students automatically); some universities provide free group "
                     "insurance (SeoulTech). Private insurance cannot replace NHIS.")
    prov(t, "A9", "summary (no legal requirement; D-4 group insurance)", "SAME (recommendation)", [127, 129, 130, 131])

    # A10 — helplines
    t = T["emergency_and_helplines"]
    t["summary"] = t["summary"].replace("also reachable as +82-2-1330 from overseas and by chat.",
                                        "also reachable as +82-2-1330 from overseas, by chat on KakaoTalk, Line, WhatsApp and Facebook, and by free online call.")
    prov(t, "A10", "summary (1330 channels)", "SAME (+channels)", [123, 139, 140],
         [("119 interpretation", "No official page on 119 interpretation languages was found.")])

    prov(T["nhis_enrollment_timing"], "A-", None, None, [124, 127])
    T["nhis_enrollment_timing"]["v9_revalidation"]["confirmed"] = [{"field": "D-2 from entry / D-4 after 6 months", "verdict": "SAME", "verified_at": V9}]
    prov(T["airport_to_city"], None, None, None, [], [("AREX all-stop fare", "The official AREX site needs JavaScript; not confirmed.")])
    for k in ("mobile_residence_card", "orientation_course_registration", "residence_card_group_application"):
        prov(T[k], None, None, None, [], [("all facts", "Not re-checked in the V9 pass (2026-10-10).")])
    for t in data:
        prov(t, None, None, None, [])
    return data


def apply_post_arrival(data: dict) -> dict:
    data = copy.deepcopy(data)
    e = src_entry(166)
    data["sources"]["v9_s166_art36"] = {"url": e["url"], "title": e["title"], "verified_at": V9, "page_date": None, "quote": e["quote"], "id": e["id"]}
    for it in data["items"]:
        if it["key"] == "address_change_report":
            f = it["facts"][0]
            f["status"] = "VERIFIED"
            f["source_ref"] = "v9_s166_art36"
            f["also_source_ref"] = "easylaw_address"
            f["verified_at"] = V9
            f["note"] = ("V9 (2026-10-10): confirmed by a district office citing Immigration Act Art. 36 ('체류지를 이전한 날부터 15일 이내'); "
                         "law.go.kr itself did not render.")
    data["v9_revalidated_at"] = V9
    return data


def check(v: list[dict]) -> None:
    blob = json.dumps(v, ensure_ascii=False)
    assert THIRD_COUNTRY_OLD not in blob, "third-country note left"
    assert BANK30_OLD not in blob, "30-day national note left"
    assert "lower-tier or visa-restricted universities, or for D-4-1" not in blob, "old tier names left in e_visa_condition"
    for r in v:
        assert r["verification_status"] != "VERIFIED" or not r["v9_revalidation"]["unconfirmed"], (r["country"], r["visa_type"])
        assert any(s.get("verified_at") == V9 for s in r["sources"]), (r["country"], r["visa_type"])


def main() -> None:
    visa = json.loads((ARCHIVE / "visa-playbooks.v8-2026-09-29.json").read_text(encoding="utf-8"))
    arr = json.loads((ARCHIVE / "arrival-official.v8-2026-09-29.json").read_text(encoding="utf-8"))
    post = json.loads((ARCHIVE / "post-arrival-official.v8-2026-09-29.json").read_text(encoding="utf-8"))
    check(apply_visa(visa))
    out = {"visa-playbooks.json": apply_visa(visa), "arrival-official.json": apply_arrival(arr), "post-arrival-official.json": apply_post_arrival(post)}
    for name, d in out.items():
        (RES / name).write_text(json.dumps(d, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    v = out["visa-playbooks.json"]
    n_changes = sum(len(r["v9_revalidation"]["changes"]) for r in v)
    status = {}
    for r in v:
        status[r["verification_status"]] = status.get(r["verification_status"], 0) + 1
    print(f"visa routes: {len(v)}, change records: {n_changes}, status: {status}")


if __name__ == "__main__":
    main()
