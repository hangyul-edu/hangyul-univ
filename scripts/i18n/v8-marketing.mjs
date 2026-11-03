// V8 marketing copy (en + ko) — merges the `v8` subtree into marketing.json. Run: node scripts/i18n/v8-marketing.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const en = {
  work: {
    subtitle: 'Hangyul at work',
    title: 'What Hangyul actually does for you',
    text: 'Not promises — the four moments students tell us matter most, as they look inside Hangyul.',
    note: 'Illustrations of Hangyul screens with example data. Your own requirements, documents and visa steps come from official sources for your country and program.',
    match: {
      title: 'You see exactly where you stand',
      text: 'Every program is checked against its published requirements — and the one thing still missing is named.',
      aria: 'Example eligibility check for Business Administration at Pusan National University',
      program: 'Business Administration (BBA)',
      where: 'Pusan National University · Busan',
      l1: 'TOPIK 3 required', l1v: 'You have TOPIK 4',
      l2: 'GPA 65% minimum', l2v: 'Yours: 87%',
      l3: 'Apostille on your diploma', l3v: 'Needed for Vietnam',
    },
    docs: {
      title: 'Upload once, use everywhere',
      text: 'A verified document is reused for every application that accepts it — you never upload it twice.',
      aria: 'Example verified graduation certificate reused across applications',
      doc: 'Graduation certificate',
      state: 'Verified by your counselor',
      l1: 'Ready for Pusan National University',
      l2: 'Ready for Kyungpook National University',
      l3: 'Korea University', l3v: 'Needs a newer copy',
    },
    writing: {
      title: 'A real person reviews your statement',
      text: 'Comments line by line, a rubric, and every version kept. You accept or decline each suggestion — the words stay yours.',
      aria: 'Example reviewer comment on a personal statement',
      p1: 'I want to study media because',
      mark: 'it has always interested me.',
      who: 'Your reviewer',
      comment: 'Name the moment that made you choose media — this sentence could be anyone’s.',
    },
    visa: {
      title: 'Your visa, as a checklist for your consulate',
      text: 'The D-2 route for your nationality and consulate, with what is ready, what is next and the official source.',
      aria: 'Example D-2 visa checklist for the Korean consulate in Hanoi',
      route: 'Student visa (D-2)',
      where: 'Embassy of Korea in Hanoi',
      l1: 'Admission certificate',
      l2: 'Passport', l2v: 'Valid until 2031',
      l3: 'Bank balance certificate', l3v: 'Needed next',
    },
  },
  weeks: { more: 'What happens when you land' },
  trust: { showAll: 'Show all {{count}} sources' },
  qc: { step: 'Question {{n}} of 3', next: 'Next', back: 'Back', remembered: 'We kept your last answers on this device.', forget: 'Clear' },
};

const ko = {
  work: {
    subtitle: '한귤이 하는 일',
    title: '한귤이 실제로 해 드리는 일',
    text: '약속이 아니라, 학생들이 가장 중요하다고 말하는 네 가지 순간을 한귤 화면 그대로 보여 드립니다.',
    note: '예시 데이터로 만든 한귤 화면 예시입니다. 실제 요건, 서류, 비자 단계는 학생의 국가와 과정에 맞는 공식 출처에서 가져옵니다.',
    match: {
      title: '내 위치를 정확히 알 수 있습니다',
      text: '모든 과정을 공개된 요건과 대조하고, 아직 부족한 한 가지를 정확히 알려 드립니다.',
      aria: '부산대학교 경영학과 지원 요건 확인 예시',
      program: '경영학과 (BBA)',
      where: '부산대학교 · 부산',
      l1: 'TOPIK 3급 필요', l1v: '보유: TOPIK 4급',
      l2: 'GPA 최소 65%', l2v: '내 성적: 87%',
      l3: '졸업증명서 아포스티유', l3v: '베트남 서류에 필요',
    },
    docs: {
      title: '한 번 올리면 어디서나',
      text: '확인된 서류는 그 서류를 받는 모든 지원에 다시 사용됩니다. 같은 서류를 두 번 올릴 필요가 없습니다.',
      aria: '여러 지원에 재사용되는 확인된 졸업증명서 예시',
      doc: '졸업증명서',
      state: '상담사 확인 완료',
      l1: '부산대학교 지원에 사용 가능',
      l2: '경북대학교 지원에 사용 가능',
      l3: '고려대학교', l3v: '최근 발급본 필요',
    },
    writing: {
      title: '사람이 직접 자기소개서를 검토합니다',
      text: '문장 단위 의견, 평가 기준, 모든 버전 보관. 제안의 수락 여부는 학생이 정합니다. 글은 끝까지 학생의 것입니다.',
      aria: '자기소개서에 대한 검토자 의견 예시',
      p1: '저는 미디어를 공부하고 싶습니다.',
      mark: '항상 관심이 있었기 때문입니다.',
      who: '검토자',
      comment: '미디어를 선택하게 된 구체적인 순간을 적어 보세요. 이 문장은 누구에게나 해당될 수 있습니다.',
    },
    visa: {
      title: '내 영사관에 맞춘 비자 체크리스트',
      text: '국적과 관할 영사관에 맞는 D-2 경로 — 준비된 것, 다음 할 일, 공식 출처까지.',
      aria: '주베트남 대한민국 대사관 D-2 비자 체크리스트 예시',
      route: '학생 비자 (D-2)',
      where: '주베트남 대한민국 대사관',
      l1: '표준입학허가서',
      l2: '여권', l2v: '2031년까지 유효',
      l3: '잔고증명서', l3v: '다음 준비',
    },
  },
  weeks: { more: '도착하면 일어나는 일' },
  trust: { showAll: '출처 {{count}}개 모두 보기' },
  qc: { step: '질문 {{n}} / 3', next: '다음', back: '이전', remembered: '이 기기에 지난 답변을 저장해 두었습니다.', forget: '지우기' },
};

for (const [loc, v8] of [['en', en], ['ko', ko]]) {
  const f = `packages/i18n/locales/${loc}/marketing.json`;
  const j = JSON.parse(readFileSync(f, 'utf8'));
  j.v8 = v8;
  writeFileSync(f, JSON.stringify(j, null, 2) + '\n');
  console.log('wrote', f);
}
