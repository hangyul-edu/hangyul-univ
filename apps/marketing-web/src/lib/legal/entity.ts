/**
 * The legal identity Hangyul publishes on its own policies (V12, brief Part 25).
 *
 * Every field here is `null` because no value for it exists anywhere in this repository — not in the server
 * configuration, not in the i18n bundles, not in the footer. §74.3 recorded the footer identity block as "empty
 * pending owner-supplied data" and nothing has filled it since.
 *
 * The rule this module exists to enforce: **a missing legally-required field is never rendered.** Not as
 * `[회사명]`, not as `[TBD]`, not as "추후 입력", not as a greyed-out row. A section whose required fields are
 * absent does not render at all, and the absence is a launch blocker recorded in REPORT §92 — which is a
 * different and more honest state than a page that looks complete and is not.
 *
 * Filling these in is a configuration change and nothing else: set the values, and the sections appear.
 */

export interface LegalEntity {
  /** 상호 — the registered company name. */
  legalNameKo: string | null;
  legalNameEn: string | null;
  /** 대표자 */
  representative: string | null;
  /** 사업자등록번호 */
  businessRegistrationNumber: string | null;
  /** 통신판매업신고번호 — required once Hangyul sells to consumers in Korea. */
  ecommerceRegistrationNumber: string | null;
  /** 주소 */
  addressKo: string | null;
  /** 개인정보 보호책임자 */
  privacyOfficerName: string | null;
  privacyOfficerDepartment: string | null;
  privacyOfficerEmail: string | null;
  privacyOfficerPhone: string | null;
  /**
   * 사업부문 — the business division named on the customer-facing footer. V14: the owner supplied 남우준 for
   * this and **only** this. It is deliberately a separate field from `privacyOfficerName`: the two roles are
   * different in Korean law, the owner did not say they are the same person, and assigning a named individual
   * to a statutory data-protection role they were not appointed to would be a false public filing. See
   * REPORT §115 and docs/LEGAL_DEPENDENCIES.md.
   */
  businessDivisionContact: string | null;
  /** General support address, if different from the privacy officer's. */
  supportEmail: string | null;
  /** 공고일 / 시행일 of the current policy version. */
  policyAnnouncedOn: string | null;
  policyEffectiveOn: string | null;
  /** 준거법·관할 — the agreed governing-law and jurisdiction wording. */
  governingLaw: string | null;
  jurisdiction: string | null;
}

/**
 * Configured in V14 from the exact values the owner supplied, and **nothing else** (brief Parts 48–49).
 *
 * Five fields now have values. Nine are still `null`, and that is the point of this file: a field without an
 * owner-supplied value is never filled with a plausible one. In particular
 *
 *   `privacyOfficerName`   stays null. 남우준 was given as 사업부문 (business division), which is a different
 *                          role; the brief says in as many words not to assume he is the privacy officer.
 *   `addressKo`            stays null. A 통신판매업 number encodes a filing office (서울도봉) but not an address,
 *                          and deriving a street address from a registration number would be an invention.
 *   `legalNameKo`          stays null. "한귤" is the brand; the registered 상호 was not supplied and is not the
 *                          same thing.
 *
 * Those three, plus retention and the governing-law wording, remain launch blocker L14 in `release:check`.
 */
export const LEGAL_ENTITY: LegalEntity = {
  legalNameKo: null,
  legalNameEn: null,
  representative: '유재희',
  businessRegistrationNumber: '403-87-03380',
  ecommerceRegistrationNumber: '제2026-서울도봉-0542호',
  addressKo: null,
  privacyOfficerName: null,
  privacyOfficerDepartment: null,
  privacyOfficerEmail: null,
  privacyOfficerPhone: null,
  businessDivisionContact: '남우준',
  supportEmail: 'support@talkhangyul.com',
  policyAnnouncedOn: null,
  policyEffectiveOn: null,
  governingLaw: null,
  jurisdiction: null,
};

/** Fields a published Korean privacy policy and terms of service cannot legally be complete without. */
export const REQUIRED_FOR_LAUNCH: (keyof LegalEntity)[] = [
  'legalNameKo',
  'representative',
  'businessRegistrationNumber',
  'addressKo',
  'privacyOfficerName',
  'privacyOfficerEmail',
  'policyAnnouncedOn',
  'policyEffectiveOn',
  'governingLaw',
  'jurisdiction',
];

export const missingLegalFields = (e: LegalEntity = LEGAL_ENTITY): (keyof LegalEntity)[] =>
  REQUIRED_FOR_LAUNCH.filter((k) => !e[k]);

/** True once every legally-required field is configured. The legal routes are not production-ready until then. */
export const legalEntityReady = (e: LegalEntity = LEGAL_ENTITY): boolean => missingLegalFields(e).length === 0;

/**
 * Retention is the other launch blocker and is deliberately not a number in this file. Korean statutory
 * commerce records have fixed periods and can be published as soon as Hangyul is the seller of record; the
 * periods for an applicant's *documents* and *account* are a business decision nobody has made, and
 * `docs/LEGAL_DEPENDENCIES.md` L8 has carried them as OPEN since V9. Inventing "3 years" to fill a table is
 * exactly the failure this pass exists to stop, so the section states the rule it does follow — purpose
 * achieved, then destroyed — and names the statutory records only.
 */
export const RETENTION_SCHEDULE_APPROVED = false;
