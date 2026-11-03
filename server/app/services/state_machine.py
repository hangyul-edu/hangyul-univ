"""Application state machine. Transitions are explicit; each has the set of actor kinds allowed to perform it."""
from dataclasses import dataclass

from fastapi import HTTPException, status

from app.models.enums import ApplicationStatus as S

STUDENT, AGENCY, UNIVERSITY, HANGYUL, SYSTEM = "STUDENT", "AGENCY", "UNIVERSITY", "HANGYUL", "SYSTEM"


@dataclass(frozen=True)
class Transition:
    to: S
    actors: frozenset[str]


def _t(to: S, *actors: str) -> Transition:
    return Transition(to, frozenset(actors) | {HANGYUL, SYSTEM})


TRANSITIONS: dict[S, list[Transition]] = {
    S.DRAFT: [_t(S.PROFILE_REVIEW, STUDENT, AGENCY), _t(S.DOCUMENT_PREPARATION, STUDENT, AGENCY), _t(S.WITHDRAWN, STUDENT, AGENCY)],
    S.PROFILE_REVIEW: [_t(S.DOCUMENT_PREPARATION, AGENCY), _t(S.DRAFT, AGENCY), _t(S.WITHDRAWN, STUDENT, AGENCY)],
    S.DOCUMENT_PREPARATION: [_t(S.READY, AGENCY), _t(S.WITHDRAWN, STUDENT, AGENCY)],
    S.READY: [_t(S.SUBMITTED, AGENCY, STUDENT), _t(S.DOCUMENT_PREPARATION, AGENCY), _t(S.WITHDRAWN, STUDENT, AGENCY)],
    S.SUBMITTED: [_t(S.UNIVERSITY_REVIEW, UNIVERSITY), _t(S.WITHDRAWN, STUDENT, AGENCY)],
    S.UNIVERSITY_REVIEW: [
        _t(S.ADDITIONAL_DOCUMENTS, UNIVERSITY),
        _t(S.INTERVIEW, UNIVERSITY),
        _t(S.OFFERED, UNIVERSITY),
        _t(S.WAITLISTED, UNIVERSITY),
        _t(S.REJECTED, UNIVERSITY),
        _t(S.WITHDRAWN, STUDENT, AGENCY),
    ],
    S.ADDITIONAL_DOCUMENTS: [_t(S.UNIVERSITY_REVIEW, UNIVERSITY, AGENCY), _t(S.WITHDRAWN, STUDENT, AGENCY)],
    S.INTERVIEW: [_t(S.OFFERED, UNIVERSITY), _t(S.WAITLISTED, UNIVERSITY), _t(S.REJECTED, UNIVERSITY), _t(S.WITHDRAWN, STUDENT, AGENCY)],
    S.WAITLISTED: [_t(S.OFFERED, UNIVERSITY), _t(S.REJECTED, UNIVERSITY), _t(S.WITHDRAWN, STUDENT, AGENCY)],
    S.OFFERED: [_t(S.OFFER_ACCEPTED, STUDENT, AGENCY), _t(S.WITHDRAWN, STUDENT, AGENCY)],
    S.OFFER_ACCEPTED: [_t(S.TUITION_PENDING, UNIVERSITY, AGENCY), _t(S.WITHDRAWN, STUDENT, AGENCY)],
    S.TUITION_PENDING: [_t(S.TUITION_PAID, UNIVERSITY), _t(S.WITHDRAWN, STUDENT, AGENCY)],
    S.TUITION_PAID: [_t(S.ADMISSION_CERTIFICATE_PENDING, UNIVERSITY), _t(S.ADMISSION_CERTIFICATE_ISSUED, UNIVERSITY)],
    S.ADMISSION_CERTIFICATE_PENDING: [_t(S.ADMISSION_CERTIFICATE_ISSUED, UNIVERSITY)],
    S.ADMISSION_CERTIFICATE_ISSUED: [_t(S.VISA_PREPARATION, AGENCY, STUDENT)],
    S.VISA_PREPARATION: [_t(S.VISA_SUBMITTED, AGENCY, STUDENT), _t(S.WITHDRAWN, STUDENT, AGENCY)],
    S.VISA_SUBMITTED: [_t(S.VISA_ISSUED, AGENCY, STUDENT), _t(S.VISA_PREPARATION, AGENCY)],
    S.VISA_ISSUED: [_t(S.ENROLLED, UNIVERSITY), _t(S.WITHDRAWN, STUDENT, AGENCY)],
    S.REJECTED: [],
    S.ENROLLED: [],
    S.WITHDRAWN: [],
}

TERMINAL = {S.REJECTED, S.ENROLLED, S.WITHDRAWN}

# Ordered progression used for funnels and progress bars.
PROGRESS_ORDER: list[S] = [
    S.DRAFT, S.PROFILE_REVIEW, S.DOCUMENT_PREPARATION, S.READY, S.SUBMITTED, S.UNIVERSITY_REVIEW,
    S.ADDITIONAL_DOCUMENTS, S.INTERVIEW, S.WAITLISTED, S.OFFERED, S.OFFER_ACCEPTED, S.TUITION_PENDING, S.TUITION_PAID,
    S.ADMISSION_CERTIFICATE_PENDING, S.ADMISSION_CERTIFICATE_ISSUED, S.VISA_PREPARATION, S.VISA_SUBMITTED,
    S.VISA_ISSUED, S.ENROLLED,
]


def allowed_next(current: S, actor: str) -> list[S]:
    return [t.to for t in TRANSITIONS.get(current, []) if actor in t.actors]


def check_transition(current: S, target: S, actor: str) -> None:
    options = TRANSITIONS.get(current, [])
    match = next((t for t in options if t.to == target), None)
    if match is None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"An application cannot move from {current.value} to {target.value}.",
        )
    if actor not in match.actors:
        raise HTTPException(status.HTTP_403_FORBIDDEN, f"{actor.title()} users cannot move an application to {target.value}.")


def reached(status_: S, milestone: S) -> bool:
    """True if an application in `status_` has passed `milestone` in the normal progression."""
    if status_ in (S.REJECTED, S.WITHDRAWN):
        return False
    try:
        return PROGRESS_ORDER.index(status_) >= PROGRESS_ORDER.index(milestone)
    except ValueError:
        return False
