import { i18next, resolveKoreanParticles } from '@hangyul/i18n';
import { describe, expect, it } from 'vitest';

// V26 (REPORT §341): Korean particles follow the word they attach to, at the shared i18n layer.
describe('resolveKoreanParticles', () => {
  it('picks the particle from the last syllable', () => {
    expect(resolveKoreanParticles('성적증명서을(를) 확인해 주세요')).toBe('성적증명서를 확인해 주세요');
    expect(resolveKoreanParticles('여권을(를) 올리세요')).toBe('여권을 올리세요');
    expect(resolveKoreanParticles('비자이(가) 만료됐어요')).toBe('비자가 만료됐어요');
    expect(resolveKoreanParticles('자기소개서은(는) 이미 있어요')).toBe('자기소개서는 이미 있어요');
    expect(resolveKoreanParticles('서울(으)로 이동')).toBe('서울로 이동');
    expect(resolveKoreanParticles('부산(으)로 이동')).toBe('부산으로 이동');
  });
  it('reads Latin letters and digits the Korean way, and looks through quotes', () => {
    expect(resolveKoreanParticles('PDF을(를) 올리세요')).toBe('PDF를 올리세요');
    expect(resolveKoreanParticles('IELTS이(가) 필요해요')).toBe('IELTS가 필요해요');
    expect(resolveKoreanParticles('버전 3이(가) 사용돼요')).toBe('버전 3이 사용돼요');
    expect(resolveKoreanParticles('“서류”을(를) 의도하셨나요')).toBe('“서류”를 의도하셨나요');
  });
  it('leaves text it cannot judge, and text without pairs, unchanged', () => {
    expect(resolveKoreanParticles('🙂을(를)')).toBe('🙂을(를)');
    expect(resolveKoreanParticles('(필수) 이용약관')).toBe('(필수) 이용약관');
  });
  it('is applied by i18next for Korean only', async () => {
    const inst = i18next.createInstance();
    const { koreanParticles } = await import('../../../../packages/i18n/src/particles');
    await inst.use(koreanParticles).init({ lng: 'ko', postProcess: ['hgKoParticles'], resources: { ko: { t: { k: '{{doc}}을(를) 보냈어요' } }, en: { t: { k: '{{doc}}을(를)' } } }, ns: ['t'], defaultNS: 't', interpolation: { escapeValue: false } });
    expect(inst.t('k', { doc: '여권' })).toBe('여권을 보냈어요');
    expect(inst.t('k', { doc: '비자' })).toBe('비자를 보냈어요');
    await inst.changeLanguage('en');
    expect(inst.t('k', { doc: '비자' })).toBe('비자을(를)');
  });
});
