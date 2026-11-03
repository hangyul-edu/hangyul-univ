// V8 student copy (en + ko) — deep-merges into student.json. Run: node scripts/i18n/v8-student.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const en = {
  discover: {
    verdict: { check: 'Needs your grades' },
    emptyVerdict: { check: 'Nothing is waiting on your grades.' },
    otherDegree_one: '{{count}} program at another degree level is not listed here.',
    otherDegree_other: '{{count}} programs at other degree levels are not listed here.',
    confirmEducation: {
      title_one: 'Add your grades to check {{count}} program',
      title_other: 'Add your grades to check {{count}} programs',
      text: 'Nothing here says you are not eligible — we simply cannot check the academic minimum without your school level and grades. It takes about a minute.',
    },
  },
  more: { budget: 'Budget', hint: { universities: 'Programs that fit you, with reasons', compare: 'Your shortlist side by side', applications: 'Every application and what is next', documents: 'Upload once, reuse everywhere', budget: 'First-year cost incl. what you pay before you fly' } },
  v8: { compare: { next: 'Next step', open: 'Open program', budget_one: 'See the full first-year budget', budget_other: 'See the full first-year budget for these {{count}}', noWinner: 'We show differences, not a winner — what matters most is your call.' }, budget: { fee: {
    title: 'Hangyul service',
    text: { PAID: '{{name}}, paid on {{date}}. Paid once to Hangyul — not part of what you pay the university.', DUE: '{{name}} — due to Hangyul before your counselor starts. Not part of what you pay the university.', NONE: 'Optional. You can apply on your own with the free plan; paid plans add a counselor and reviews.' },
    status: { PAID: 'Paid', DUE: 'Due', NONE: 'Optional' },
    from: 'from {{amount}}',
    cta: 'Compare plans',
  } } },
  v4: { verdictText: { check: 'These programs have a published academic minimum, and we do not have your grades yet. Add them and each program moves to the group it really belongs in.' } },
};

const ko = {
  discover: {
    verdict: { check: '성적 필요' },
    emptyVerdict: { check: '성적 입력을 기다리는 프로그램이 없습니다.' },
    otherDegree_one: '다른 학위 과정의 프로그램 {{count}}개는 여기에 표시되지 않습니다.',
    otherDegree_other: '다른 학위 과정의 프로그램 {{count}}개는 여기에 표시되지 않습니다.',
    confirmEducation: {
      title_one: '성적을 입력하면 프로그램 {{count}}개를 확인할 수 있습니다',
      title_other: '성적을 입력하면 프로그램 {{count}}개를 확인할 수 있습니다',
      text: '지원 자격이 없다는 뜻이 아닙니다. 학력과 성적이 없어 학업 최저 기준을 확인하지 못했을 뿐입니다. 입력은 1분 정도 걸립니다.',
    },
  },
  more: { budget: '예산', hint: { universities: '나에게 맞는 프로그램과 이유', compare: '관심 목록을 나란히 비교', applications: '모든 지원과 다음 할 일', documents: '한 번 올리면 어디서나 재사용', budget: '출국 전 비용을 포함한 첫해 비용' } },
  v8: { compare: { next: '다음 단계', open: '프로그램 보기', budget_one: '첫해 전체 예산 보기', budget_other: '프로그램 {{count}}개의 첫해 전체 예산 보기', noWinner: '한귤은 승자를 정하지 않고 차이만 보여 드립니다. 무엇이 가장 중요한지는 학생이 결정합니다.' }, budget: { fee: {
    title: '한귤 서비스',
    text: { PAID: '{{name}}, {{date}} 결제 완료. 한귤에 한 번 결제하는 비용이며 대학에 내는 비용과는 별개입니다.', DUE: '{{name}} — 상담사 배정 전에 한귤에 결제해야 합니다. 대학에 내는 비용과는 별개입니다.', NONE: '선택 사항입니다. 무료 플랜으로 직접 지원할 수 있으며, 유료 플랜에는 상담사와 검토가 포함됩니다.' },
    status: { PAID: '결제 완료', DUE: '결제 필요', NONE: '선택' },
    from: '{{amount}}부터',
    cta: '플랜 비교',
  } } },
  v4: { verdictText: { check: '이 프로그램들은 학업 최저 기준이 공개되어 있지만 아직 성적 정보가 없습니다. 성적을 입력하면 각 프로그램이 실제 해당하는 그룹으로 이동합니다.' } },
};

const merge = (a, b) => { for (const [k, v] of Object.entries(b)) a[k] = v && typeof v === 'object' && !Array.isArray(v) ? merge(a[k] ?? {}, v) : v; return a; };
for (const [loc, add] of [['en', en], ['ko', ko]]) {
  const f = `packages/i18n/locales/${loc}/student.json`;
  writeFileSync(f, JSON.stringify(merge(JSON.parse(readFileSync(f, 'utf8')), add), null, 2) + '\n');
  console.log('wrote', f);
}
