"""Service packages, payments, partner contracts, scholarship pools."""
import uuid
from datetime import date, datetime

from sqlalchemy import JSON, BigInteger, Boolean, Date, DateTime, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, IdMixin, TimestampMixin, enum_col, fk
from app.models.enums import AddOnStatus, AwardStatus, ContractStatus, OrderStatus


class ServiceProduct(IdMixin, TimestampMixin, Base):
    """One retail plan. Its numbers come from ``shared/plans.json``, never from this file or the frontend.

    V29: this row is the plan **as currently sold**. What a student bought is the snapshot on their order and
    their ``ServiceEngagement`` — never this row, which changes when the catalogue does.

    V15: ``entitlements`` replaced three ad-hoc scope columns. ``includes_agency_assignment`` and
    ``includes_essay_review`` were booleans over promises the business plan grades (서류 검토 is
    체크리스트 / 기본 검토 / 집중 검토, not on/off), and ``max_applications`` meant "applications the student
    may create" while the plan sells "지원 학교 최대 N곳" — applications Hangyul *manages*. Two different
    promises had been sharing one column. See REPORT §117 and packages/types/src/plans.ts.
    """
    __tablename__ = "service_products"
    code: Mapped[str] = mapped_column(String(48), unique=True)
    name_key: Mapped[str] = mapped_column(String(120))  # i18n key; name_en fallback
    name_en: Mapped[str] = mapped_column(String(120))
    name_ko: Mapped[str | None] = mapped_column(String(120))  # canonical semantic source (brief Part 30)
    tagline_en: Mapped[str | None] = mapped_column(String(300))
    features: Mapped[list[str]] = mapped_column(JSON)  # display codes; UI renders translated labels
    #: Machine-readable scope — the shape in packages/types/src/plans.ts ``PlanEntitlements``.
    entitlements: Mapped[dict] = mapped_column(JSON, default=dict)
    #: The plan the business runs on (business plan §9). Exactly one product has this set.
    is_recommended: Mapped[bool] = mapped_column(Boolean, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    prices: Mapped[list["ServicePrice"]] = relationship(back_populates="product", cascade="all, delete-orphan")

    # -- convenience readers, so call sites never index a raw dict and typo a key silently
    def ent(self, key: str, default=None):
        return (self.entitlements or {}).get(key, default)

    @property
    def includes_agency_assignment(self) -> bool:
        """Every paid plan assigns a responsible counselor; Basic included (business plan §3-1 후속 상담)."""
        return True

    @property
    def includes_essay_review(self) -> bool:
        return bool(self.ent("essay_review_rounds", 0))

    @property
    def max_managed_applications(self) -> int:
        return int(self.ent("max_managed_applications", 0) or 0)


class ServicePrice(IdMixin, TimestampMixin, Base):
    __tablename__ = "service_prices"
    product_id: Mapped[uuid.UUID] = fk("service_products.id")
    currency: Mapped[str] = mapped_column(String(3))
    amount_minor: Mapped[int] = mapped_column(BigInteger)  # minor units (KRW has none; USD cents)
    country_code: Mapped[str | None] = mapped_column(String(2))  # regional pricing; null = default
    valid_from: Mapped[date | None] = mapped_column(Date)
    valid_to: Mapped[date | None] = mapped_column(Date)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=True)
    product: Mapped[ServiceProduct] = relationship(back_populates="prices")


class Order(IdMixin, TimestampMixin, Base):
    __tablename__ = "orders"
    user_id: Mapped[uuid.UUID] = fk("users.id")
    product_id: Mapped[uuid.UUID] = fk("service_products.id", ondelete="RESTRICT")
    price_id: Mapped[uuid.UUID | None] = fk("service_prices.id", nullable=True, ondelete="SET NULL")
    currency: Mapped[str] = mapped_column(String(3))
    amount_minor: Mapped[int] = mapped_column(BigInteger)
    status: Mapped[OrderStatus] = enum_col(OrderStatus, default=OrderStatus.PENDING, index=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # ---- V17 refunds (REPORT §152). The *technical* record only: what was refunded, when and why.
    # How much a student is owed is a legal policy that nobody has approved yet, so nothing here computes
    # an amount — a caller supplies one and the server checks it against what was actually paid.
    refunded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    refund_amount_minor: Mapped[int | None] = mapped_column(BigInteger)
    refund_reason: Mapped[str | None] = mapped_column(String(200))
    # ---- V29 contract snapshot (REPORT §390). Frozen at order creation; never rewritten by a catalogue change.
    #: PLAN · UPGRADE · ADD_ON. An ADD_ON order's ``product_id`` is the plan it extends; its add-on is the
    #: ``ServiceAddOn`` whose ``order_id`` points here.
    kind: Mapped[str] = mapped_column(String(16), default="PLAN", server_default="PLAN", index=True)
    catalog_version: Mapped[str | None] = mapped_column(String(32))
    #: The plan (or add-on) exactly as sold: name, price, entitlements, comparison cells, catalogue version.
    plan_snapshot: Mapped[dict | None] = mapped_column(JSON)
    purchase_terms_version: Mapped[str | None] = mapped_column(String(32))


class ServiceEngagement(IdMixin, TimestampMixin, Base):
    """One purchased plan, as a service instance with a term (V29 §7, §11, §22).

    The entitlements a student is held to are ``entitlements`` here — copied from the order's snapshot — so a
    catalogue change never alters a purchase. An upgrade creates a new engagement and marks the old one
    ``SUPERSEDED``; usage is derived from work records and carries over.

    Dates:
      * ``service_started_at`` — when the team starts the service (first consultation), set by staff.
      * ``support_window_ends_at`` — start + ``support_window_days`` for DAYS plans; the term end for Premium.
      * ``service_ends_at`` — the contracted term end. The owner's document fixes no Premium duration, so it is
        an explicit field set when the service begins; until then Premium's term reads "to be agreed".
      * ``arrival_at`` → ``pre_arrival_starts_at`` (arrival − N days) and ``settlement_ends_at`` (arrival + N days).
    """
    __tablename__ = "service_engagements"
    user_id: Mapped[uuid.UUID] = fk("users.id")
    order_id: Mapped[uuid.UUID | None] = fk("orders.id", nullable=True, ondelete="SET NULL")
    product_code: Mapped[str] = mapped_column(String(48))
    catalog_version: Mapped[str] = mapped_column(String(32))
    entitlements: Mapped[dict] = mapped_column(JSON, default=dict)
    plan_snapshot: Mapped[dict] = mapped_column(JSON, default=dict)
    purchase_terms_version: Mapped[str | None] = mapped_column(String(32))
    #: ACTIVE · SUPERSEDED · ENDED · REFUNDED
    status: Mapped[str] = mapped_column(String(16), default="ACTIVE", index=True)
    service_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    support_window_ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    service_ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    arrival_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    pre_arrival_starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    settlement_ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    #: Premium's dedicated responsible staff member — internal only; the student still sees the team (V22).
    dedicated_owner_user_id: Mapped[uuid.UUID | None] = fk("users.id", nullable=True, ondelete="SET NULL")
    superseded_by_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    #: Set when a migration (not a purchase) moved this engagement to another catalogue version.
    migrated_from_version: Mapped[str | None] = mapped_column(String(32))
    #: First time each service milestone was reached ({"settlement_started": iso, …}) — analytics fire once.
    milestones: Mapped[dict | None] = mapped_column(JSON)


class ServiceAddOn(IdMixin, TimestampMixin, Base):
    """An extra the counselor offered and the student approved — business plan §6-2 (추가 유료 서비스).

    It is a **delta on one entitlement key**, not a second plan: approving "추가 첨삭 1회" raises
    ``essay_review_rounds`` by one for that student and changes nothing else. That is what keeps the optional
    services out of the homepage and inside the case where they become relevant (brief Part 3).

    ``OFFERED`` is visible to the student with its price before they approve it; declining leaves the case
    exactly as it was. Only ``APPROVED`` rows count towards an effective limit.
    """
    __tablename__ = "service_add_ons"
    user_id: Mapped[uuid.UUID] = fk("users.id")
    #: V29: the catalogue code (``EXTRA_MANAGED_APPLICATION`` …, packages/types/src/plans.ts ``ADD_ONS``).
    code: Mapped[str] = mapped_column(String(48))
    #: The allowance an ENTITLEMENT add-on raises; null for a SERVICE_CASE add-on.
    entitlement_key: Mapped[str | None] = mapped_column(String(48), index=True, nullable=True)
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[AddOnStatus] = enum_col(AddOnStatus, default=AddOnStatus.OFFERED, index=True)
    amount_minor: Mapped[int | None] = mapped_column(BigInteger)
    currency: Mapped[str | None] = mapped_column(String(3))
    note: Mapped[str | None] = mapped_column(Text)
    offered_by_user_id: Mapped[uuid.UUID | None] = fk("users.id", nullable=True, ondelete="SET NULL")
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    order_id: Mapped[uuid.UUID | None] = fk("orders.id", nullable=True, ondelete="SET NULL")
    # ---- V29: priced inside the catalogue's range (or quoted), paid before anything is granted.
    catalog_version: Mapped[str | None] = mapped_column(String(32))
    #: The price of one unit, as offered. ``amount_minor`` = unit × quantity is what the student pays.
    unit_amount_minor: Mapped[int | None] = mapped_column(BigInteger)
    #: The agreed scope in the operator's words — required for quote-based services.
    scope: Mapped[str | None] = mapped_column(Text)
    #: What the extra is for, when it is for one record (an essay for an out-of-scope edit, an application).
    subject_type: Mapped[str | None] = mapped_column(String(24))
    subject_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    #: The service case a SERVICE_CASE add-on opened once paid.
    case_id: Mapped[uuid.UUID | None] = fk("service_cases.id", nullable=True, ondelete="SET NULL")
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    activated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Payment(IdMixin, TimestampMixin, Base):
    """Provider transaction record. Card data never touches our servers (provider-hosted checkout)."""
    __tablename__ = "payments"
    order_id: Mapped[uuid.UUID] = fk("orders.id")
    provider: Mapped[str] = mapped_column(String(24))  # demo | stripe | toss
    provider_ref: Mapped[str | None] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(String(24))
    amount_minor: Mapped[int] = mapped_column(BigInteger)
    currency: Mapped[str] = mapped_column(String(3))
    raw: Mapped[dict | None] = mapped_column(JSON)  # sanitized provider payload
    #: V17 — the provider's own cancellation, so a refund can be reconciled against Toss's record of it.
    refunded_amount_minor: Mapped[int | None] = mapped_column(BigInteger)
    refund_ref: Mapped[str | None] = mapped_column(String(120))
    refunded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class PartnerContract(IdMixin, TimestampMixin, Base):
    __tablename__ = "partner_contracts"
    university_id: Mapped[uuid.UUID] = fk("universities.id")
    title: Mapped[str] = mapped_column(String(200))
    status: Mapped[ContractStatus] = enum_col(ContractStatus, default=ContractStatus.DRAFT)
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)
    recruitment_fee_krw: Mapped[int | None] = mapped_column(BigInteger)  # per enrolled student
    commission_percent: Mapped[float | None] = mapped_column()
    guaranteed_minimum_krw: Mapped[int | None] = mapped_column(BigInteger)
    target_countries: Mapped[list[str] | None] = mapped_column(JSON)
    target_program_ids: Mapped[list[str] | None] = mapped_column(JSON)
    intake_label: Mapped[str | None] = mapped_column(String(40))
    incentive_tiers: Mapped[list[dict] | None] = mapped_column(JSON)  # [{min_enrolled, bonus_krw}]
    # Conditional admission guarantee: only surfaced to students when enabled AND criteria + quota are met.
    guarantee_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    guarantee_terms: Mapped[str | None] = mapped_column(Text)
    guarantee_criteria: Mapped[dict | None] = mapped_column(JSON)  # {min_topik, min_gpa_percent, degree_levels}
    notes: Mapped[str | None] = mapped_column(Text)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=True)
    quotas: Mapped[list["PartnerQuota"]] = relationship(back_populates="contract", cascade="all, delete-orphan")
    pools: Mapped[list["ScholarshipPool"]] = relationship(back_populates="contract", cascade="all, delete-orphan")


class PartnerQuota(IdMixin, Base):
    __tablename__ = "partner_quotas"
    contract_id: Mapped[uuid.UUID] = fk("partner_contracts.id")
    program_id: Mapped[uuid.UUID | None] = fk("programs.id", nullable=True, ondelete="SET NULL")
    intake_label: Mapped[str] = mapped_column(String(40))
    seats: Mapped[int] = mapped_column(Integer)
    used: Mapped[int] = mapped_column(Integer, default=0)
    contract: Mapped[PartnerContract] = relationship(back_populates="quotas")


class ScholarshipPool(IdMixin, TimestampMixin, Base):
    """Budget that funds Hangyul Partner Scholarships; balance = total - committed - paid."""
    __tablename__ = "scholarship_pools"
    contract_id: Mapped[uuid.UUID] = fk("partner_contracts.id")
    name: Mapped[str] = mapped_column(String(200))
    intake_label: Mapped[str] = mapped_column(String(40))
    total_krw: Mapped[int] = mapped_column(BigInteger)
    rules_summary: Mapped[str | None] = mapped_column(Text)
    contract: Mapped[PartnerContract] = relationship(back_populates="pools")
    awards: Mapped[list["ScholarshipAward"]] = relationship(back_populates="pool", cascade="all, delete-orphan")


class ScholarshipAward(IdMixin, TimestampMixin, Base):
    __tablename__ = "scholarship_awards"
    pool_id: Mapped[uuid.UUID | None] = fk("scholarship_pools.id", nullable=True)
    scholarship_id: Mapped[uuid.UUID | None] = fk("scholarships.id", nullable=True, ondelete="SET NULL")
    student_user_id: Mapped[uuid.UUID] = fk("users.id")
    application_id: Mapped[uuid.UUID | None] = fk("applications.id", nullable=True, ondelete="SET NULL")
    amount_krw: Mapped[int] = mapped_column(BigInteger)
    status: Mapped[AwardStatus] = enum_col(AwardStatus, default=AwardStatus.PROPOSED)
    decided_by_id: Mapped[uuid.UUID | None] = fk("users.id", nullable=True, ondelete="SET NULL")
    note: Mapped[str | None] = mapped_column(String(300))
    pool: Mapped[ScholarshipPool | None] = relationship(back_populates="awards")


class StudentPaymentMethod(IdMixin, TimestampMixin, Base):
    """A card a student has used, and whatever of it Hangyul may legally keep (V21, brief §32–§33).

    **What is never in here**: the card number, the expiry a provider did not return, a CVC, a card
    password, an identity number, or anything else that is cardholder data. The columns below are the
    *provider's own* safe echo — a masked number Toss produced, its issuer code, its own payment key.

    `billing_key_ciphertext` is AES-256-GCM (`app/core/crypto.py`), bound to this row's `student_id`,
    so a credential moved to another student's row fails to decrypt rather than charging the wrong
    person. It is **null for `bill_talkoab1`**: that configuration performs a 키인 one-time charge and
    issues no reusable credential (REPORT §229.2), and `reusable` says so rather than the UI implying
    a saved card that cannot in fact be charged again. The column exists because the moment a
    billing-key route is contracted, nothing else here has to change.

    `customer_key` is a random server-side identifier (brief §31) — never an email, a phone number or
    a database id — and stays paired with the credential for the life of the row.
    """

    __tablename__ = "student_payment_methods"

    user_id = fk("users.id")
    provider: Mapped[str] = mapped_column(String(24), default="TOSS")
    #: Which merchant configuration issued it. Two MIDs' credentials are not interchangeable.
    provider_mid: Mapped[str | None] = mapped_column(String(48))
    #: Random, non-guessable, server-generated, stable for this method (brief §31).
    customer_key: Mapped[str] = mapped_column(String(64), index=True)

    #: AES-256-GCM envelope; null when the configuration issues no reusable credential.
    billing_key_ciphertext: Mapped[str | None] = mapped_column(Text)
    billing_key_version: Mapped[int | None] = mapped_column(Integer)
    #: True only when a stored credential exists **and** can be charged without the card again.
    reusable: Mapped[bool] = mapped_column(Boolean, default=False)

    # -- the provider's own safe echo, and nothing we inferred -------------------------------------
    card_brand: Mapped[str | None] = mapped_column(String(32))
    issuer_code: Mapped[str | None] = mapped_column(String(8))
    acquirer_code: Mapped[str | None] = mapped_column(String(8))
    masked_number: Mapped[str | None] = mapped_column(String(32))
    last4: Mapped[str | None] = mapped_column(String(4))
    card_type: Mapped[str | None] = mapped_column(String(24))
    owner_type: Mapped[str | None] = mapped_column(String(24))

    is_default: Mapped[bool] = mapped_column(Boolean, default=True)
    #: ACTIVE · REVOKED. A revoked row is kept for reconciliation and can never be charged.
    status: Mapped[str] = mapped_column(String(16), default="ACTIVE", index=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    @property
    def display(self) -> str:
        """What the student sees. Never the credential, never an unmasked digit beyond the last four."""
        brand = self.card_brand or "Card"
        return f"{brand} •••• {self.last4}" if self.last4 else brand
