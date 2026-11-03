import { describe, expect, it } from 'vitest';

import { DATA_CATEGORIES, DISCLOSURES, PROCESSORS, STATUTORY_RECORDS } from '../lib/legal/data-map';
import { LEGAL_ENTITY, REQUIRED_FOR_LAUNCH, legalEntityReady, missingLegalFields } from '../lib/legal/entity';
import { KOREA_REGIONS, KOREA_VIEWBOX } from '../media/korea-regions';

/**
 * V12 — the two things the legal pages must not be able to do by accident: publish a placeholder, and publish a
 * processing table that has drifted from the code. See REPORT §84 and §90.7.
 */

describe('legal entity configuration', () => {
  /**
   * V14: the owner supplied five values and nothing else. The assertion is therefore about the *shape* of the
   * state, not a frozen list — what must hold is that the supplied values are exactly the supplied values and
   * that every other required field is still reported as missing rather than quietly filled.
   */
  const SUPPLIED = {
    representative: '유재희',
    businessRegistrationNumber: '403-87-03380',
    ecommerceRegistrationNumber: '제2026-서울도봉-0542호',
    businessDivisionContact: '남우준',
    supportEmail: 'support@talkhangyul.com',
  } as const;

  it('holds exactly the values the owner supplied, byte for byte', () => {
    // Registration numbers and personal names are never reformatted, transliterated or localised
    // (brief Part 50). A "tidied" 통신판매업 number is a wrong one.
    for (const [field, value] of Object.entries(SUPPLIED)) {
      expect(LEGAL_ENTITY[field as keyof typeof LEGAL_ENTITY], field).toBe(value);
    }
  });

  it('does not infer a privacy officer from the business division contact', () => {
    // 남우준 was given as 사업부문. Assigning a named person to a statutory data-protection role they were
    // not appointed to would be a false public filing — brief Part 49 rules it out by name.
    expect(LEGAL_ENTITY.privacyOfficerName).toBeNull();
    expect(LEGAL_ENTITY.privacyOfficerEmail).toBeNull();
    expect(LEGAL_ENTITY.businessDivisionContact).toBe('남우준');
  });

  it('reports every still-unconfigured required field rather than hiding it', () => {
    const missing = missingLegalFields();
    // Everything the owner supplied is out of the missing list…
    for (const field of Object.keys(SUPPLIED)) expect(missing).not.toContain(field);
    // …and everything else that launch requires is still in it, so the pages cannot look finished.
    for (const field of REQUIRED_FOR_LAUNCH) {
      if (field in SUPPLIED) continue;
      expect(missing, field).toContain(field);
    }
    expect(legalEntityReady()).toBe(false);
  });

  it('is not production-ready until the last required field is set', () => {
    const configured = Object.fromEntries(
      Object.keys(LEGAL_ENTITY).map((k) => [k, 'set']),
    ) as unknown as typeof LEGAL_ENTITY;
    expect(legalEntityReady(configured)).toBe(true);
    expect(missingLegalFields(configured)).toEqual([]);

    // One missing field is enough to keep it out of production.
    expect(legalEntityReady({ ...configured, privacyOfficerEmail: null })).toBe(false);
  });

  it('never holds a placeholder string in place of a real value', () => {
    // The failure this guards against is a well-meaning "[회사명]", "TBD" or "추후 입력" landing here and
    // rendering as though it were the company's actual registered name.
    const PLACEHOLDER = /\[|\bTBD\b|TODO|추후|미정|placeholder|example|샘플|sample|xxx/i;
    for (const [field, value] of Object.entries(LEGAL_ENTITY)) {
      if (value === null) continue;
      expect(typeof value, field).toBe('string');
      expect(value, field).not.toMatch(PLACEHOLDER);
      expect((value as string).trim(), field).toBe(value);
      expect((value as string).length, field).toBeGreaterThan(0);
    }
  });
});

describe('the processing inventory', () => {
  it('covers the eight categories the policy publishes (V22 added verification and security), each with tables and a purpose', () => {
    expect(DATA_CATEGORIES.map((c) => c.key)).toEqual([
      'account', 'profile', 'documents', 'counselling', 'payment', 'verification', 'security', 'automatic',
    ]);
    for (const c of DATA_CATEGORIES) {
      expect(c.tables.length, c.key).toBeGreaterThan(0);
      expect(c.fields.length, c.key).toBeGreaterThan(0);
      expect(c.recipients.length, c.key).toBeGreaterThan(0);
    }
  });

  it('claims no payment instrument of any kind', () => {
    const payment = DATA_CATEGORIES.find((c) => c.key === 'payment')!;
    const joined = payment.fields.join(' ').toLowerCase();
    // Checkout is provider-hosted; `payments` holds a reference, a status and an amount.
    for (const term of ['card number', 'cvc', 'expiry', 'billing address', 'pan']) {
      expect(joined, term).not.toContain(term);
    }
    expect(payment.optional).toBe(true);
  });

  it('only names recipients the product actually has a sharing state for', () => {
    expect(DISCLOSURES.map((d) => d.key)).toEqual(['agency', 'university', 'sponsor']);
    for (const d of DISCLOSURES) {
      expect(d.consent).toBeTruthy();
      expect(d.trigger).toBeTruthy();
    }
  });

  it('lists the three V22 processors with every 제28조의8② transfer item (REPORT §256)', () => {
    // §§4–5 of the policy are rendered from this list. V12 kept it empty because nothing was contracted; V22 wires
    // SendGrid (email codes), Twilio (SMS codes) and Turnstile (bot protection), all processing in the United States.
    expect(PROCESSORS.map((p) => p.key)).toEqual(['twilio_sms', 'sendgrid', 'turnstile']);
    for (const p of PROCESSORS) {
      expect(p.entity, p.key).toMatch(/Inc\./);
      expect(p.address, p.key).toMatch(/United States/);
      expect(p.contact, p.key).toMatch(/@/);
      expect(p.countries, p.key).toEqual(['US']);
      expect(p.privacyUrl, p.key).toMatch(/^https:\/\//);
      expect(p.dpaUrl, p.key).toMatch(/^https:\/\//);
      expect(p.basis, p.key).toBe('28-8-1-3');
      // retention is the vendor's published figure or an explicit null — never a guess
      expect(p.retention === null || p.retention.length > 10, p.key).toBe(true);
    }
  });

  it('publishes only the statutory retention periods, and invents none', () => {
    expect(STATUTORY_RECORDS.map((r) => r.key)).toEqual(['advertising', 'contract', 'payment', 'complaint']);
    // No record for documents, accounts or logs: none is approved (LEGAL_DEPENDENCIES L8).
    for (const r of STATUTORY_RECORDS) {
      expect('months' in r || 'years' in r).toBe(true);
    }
  });
});

describe('the Korea map', () => {
  it('has one path per official region and no more', () => {
    expect(KOREA_REGIONS).toHaveLength(17);
    const keys = KOREA_REGIONS.map((r) => r.key);
    expect(new Set(keys).size).toBe(17);
    expect(keys).toContain('Seoul');
    expect(keys).toContain('Jeju');
    expect(keys).toContain('Sejong');
  });

  it('draws every region inside the viewBox', () => {
    const [, , w, h] = KOREA_VIEWBOX.split(' ').map(Number);
    for (const r of KOREA_REGIONS) {
      expect(r.d.startsWith('M'), r.key).toBe(true);
      expect(r.d.endsWith('Z'), r.key).toBe(true);
      const [lx, ly] = r.label;
      // The label anchor is the centroid of the largest landmass; it must be on the canvas.
      expect(lx, `${r.key} label x`).toBeGreaterThan(0);
      expect(lx, `${r.key} label x`).toBeLessThan(w);
      expect(ly, `${r.key} label y`).toBeGreaterThan(0);
      expect(ly, `${r.key} label y`).toBeLessThan(h);
      // V11's lesson: a rounded-to-zero coordinate renders the shape as nothing (REPORT §81.2).
      const numbers = r.d.match(/-?\d+(\.\d+)?/g)!.map(Number);
      expect(numbers.some((n) => n !== 0), r.key).toBe(true);
      expect(numbers.length, r.key).toBeGreaterThan(20);
    }
  });

  it('gives every region a Korean name for its accessible label', () => {
    for (const r of KOREA_REGIONS) {
      expect(r.nameKo, r.key).toMatch(/[가-힣]/);
    }
  });
});
