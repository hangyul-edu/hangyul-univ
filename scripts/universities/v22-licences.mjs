/**
 * V22 — the licence vocabulary shared by the Commons harvest, the media fetch and the apply step.
 *
 * One place, so the three scripts cannot disagree about what "servable" means. Read against the
 * `LicenseShortName` Commons' API reports per file, never against a cached string.
 */

/** No attribution condition — servable with no credit (photos **and** logos). */
export const FREE = /^(cc0|cc-zero|cc0 1\.0|public domain|pd(-self|-user|-old(-\d+)?|-art|-text|-textlogo|-shape|-ineligible|-korea|-author|-release)?|no restrictions|copyrighted free use|cc-pd-mark)$/i;

/** Attribution required and **supported** for photographs: the credit (author, licence, licence URL, source URL) is rendered. */
export const ATTRIBUTION = /^(cc[- ]by([- ]sa)?([- ]\d(\.\d)?)?( [a-z]{2})?|attribution|kogl type 1)$/i;

/** Never: a non-commercial or no-derivatives condition cannot be met by a commercial directory serving resized files. */
export const NC_ND = /\b(nc|nd)\b/i;

/** The rights classes a page may render (`scripts/qa/v21-gate.mjs`, `audit-content.mjs`). */
export const SERVABLE = new Set(['HANGYUL_OWNED', 'OWNER_AUTHORISED', 'COMMERCIAL_NO_ATTRIBUTION', 'CC0_PUBLIC_DOMAIN', 'ATTRIBUTION_SUPPORTED']);

export const rightsOf = (licence) => (FREE.test(licence) ? 'CC0_PUBLIC_DOMAIN' : ATTRIBUTION.test(licence) && !NC_ND.test(licence) ? 'ATTRIBUTION_SUPPORTED' : null);
