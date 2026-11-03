/**
 * V12 copy — the directory, the map and the two legal documents (ko + en together, per the repo convention).
 *
 *     node scripts/i18n/v12-copy.mjs
 *
 * Korean is the baseline the owner supplied in the brief. Three classes of edit were made to it, each because a
 * sentence would otherwise state something this repository cannot support:
 *
 *  1. **Corporate form.** The brief's intro opens "주식회사 한귤(이하 '한귤')은". 한귤 is the verified Korean brand
 *     (confirmed against /root/hangyul-web/messages/ko.json), but no registered legal name, corporate form or
 *     business-registration number exists anywhere in this repository. Publishing "주식회사 한귤" would assert a
 *     corporate registration nobody has recorded, so the copy says 한귤 and the registered legal name is a
 *     launch blocker (REPORT §92) rather than a guess.
 *  2. **Retention periods.** §2 keeps the brief's rule verbatim and the four statutory commerce periods, and
 *     publishes no period for accounts or documents, because none is approved (LEGAL_DEPENDENCIES L8).
 *  3. **Processors and overseas transfer.** §§4–5 are written from the configured processor list, which is
 *     empty. They say so, rather than naming a vendor that has not been contracted.
 *
 * English is a translation of the Korean written in the same pass and re-read against it. It is not
 * human-reviewed and is not marked as such.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const file = (loc) => resolve(ROOT, `packages/i18n/locales/${loc}/marketing.json`);

const ko = {
  seo: {
    directory: {
      title: '한국 대학 — 지역으로 찾아보기',
      description: '대학알리미에 공시된 한국의 대학·전문대학·대학원대학을 지역별로 살펴보세요.',
    },
    university: {
      title: '{{name}} — 한국 대학',
      description: '{{region}}에 있는 {{name}}의 공식 정보입니다.',
    },
    privacy: { title: '개인정보 처리방침', description: 'Hangyul Univ가 처리하는 개인정보의 항목과 목적, 이용자의 권리를 안내합니다.' },
    terms: { title: '이용약관', description: 'Hangyul Univ 서비스의 이용 조건과 한귤 및 이용자의 권리·의무입니다.' },
  },

  map: {
    title: '지역으로 대학 찾기',
    regionLabel: '{{region}} · 대학 {{count}}곳',
    hint: '지역을 선택하세요',
  },

  directory: {
    title: '한국에서 어디에서 공부하고 싶나요?',
    lede: '서울의 캠퍼스부터 바다가 보이는 부산, 산으로 둘러싸인 강원까지. 지역을 고르면 그곳의 대학을 보여 드립니다.',
    all: '전국',
    count_one: '{{count}}곳',
    count_other: '{{count}}곳',
    countShort_one: '{{count}}곳',
    countShort_other: '{{count}}곳',
    inRegion: '{{region}}의 대학',
    emptyTitle: '이 지역에는 공시된 대학이 없습니다',
    emptyText: '다른 지역을 선택하거나 전국을 둘러보세요.',
    source: '출처: 교육부·한국대학교육협의회 대학알리미 공시 자료, 교육국제화역량 인증제(Study in Korea).',
  },

  type: {
    UNIVERSITY: '대학교',
    JUNIOR_COLLEGE: '전문대학',
    GRADUATE_UNIVERSITY: '대학원대학',
  },
  establishment: { NATIONAL: '국립', PUBLIC: '공립', PRIVATE: '사립' },

  ieqas: {
    certified: '교육국제화역량 인증대학',
    excellent: '교육국제화역량 우수 인증대학',
    language: '어학연수 과정 인증',
    certifiedWhat: '법무부·교육부가 매년 심사하는 인증으로, 외국인 유학생 비자 심사에서 완화된 기준이 적용됩니다.',
    languageWhat: '이 대학의 한국어 연수 과정이 인증 대상에 포함되어 있습니다.',
  },

  uni: {
    back: '한국 대학 목록으로',
    region: '지역',
    kind: '학교 구분',
    establishment: '설립 구분',
    majors: '공시 학과 수',
    majorsValue: '{{count}}개',
    campuses: '그 밖의 캠퍼스',
    aboutTitle: '학교 개요',
    intlTitle: '외국인 유학생 환경',
    sourcesTitle: '공식 정보',
    officialSite: '공식 홈페이지',
    prepare: '이 대학 유학 준비하기',
    surveyYear: '{{year}}년 공시',
    checked: '공식 정보 확인일 {{date}}',
  },

  legal: { effective: '시행일 {{date}}' },

  privacy: {
    title: '개인정보 처리방침',
    summary: '한귤은 Hangyul Univ를 운영하며, 유학 준비와 지원 과정에서 필요한 개인정보를 필요한 범위에서만 처리하고 안전하게 보호합니다.',
    scope: '본 개인정보 처리방침은 Hangyul Univ 웹사이트, 모바일 앱 및 한귤이 제공하는 유학 준비·지원 서비스에 적용됩니다. 한귤은 개인정보 보호법 등 관련 법령을 준수합니다.',

    collect: {
      h: '처리하는 개인정보와 이용 목적',
      intro: '한귤은 아래의 개인정보를 처리합니다. 서비스를 이용하지 않으면 해당 정보도 수집하지 않습니다.',
      colKind: '구분',
      colItems: '처리하는 정보',
      colPurpose: '이용 목적',
      noCard: '결제는 결제대행사가 제공하는 화면에서 이루어지며, 한귤은 카드번호·유효기간·CVC·청구지 주소를 보관하지 않습니다. 한귤이 보관하는 것은 주문 내용, 금액, 결제 상태와 결제대행사가 돌려주는 거래 참조번호입니다.',
      passport: '여권번호는 프로필에 마지막 세 자리만 남기고 가려서 보관합니다. 여권 사본 자체는 서류 보관함에 저장되며 접근할 때마다 기록이 남습니다.',
      account: {
        kind: '회원 및 계정',
        items: '이름, 이메일, 전화번호, 사용 언어, 시간대, 로그인 기록, 동의 기록',
        purpose: '회원 식별, 로그인 및 계정 관리, 서비스 안내, 문의 대응',
      },
      profile: {
        kind: '유학 준비 프로필',
        items: '국적, 거주 국가, 생년월일, 성별, 가려진 여권번호와 만료일, 한국 비자 이력, 학력·학교·졸업 여부·성적(GPA), 어학 성적, 희망 학위·분야·지역, 입학 시기, 예산, 장학금 필요 여부, 주거 희망, 재정 지원 주체, 진로 목표',
        purpose: '대학교 정보 개인화, 지원 가능 조건 확인, 유학 준비 계획 제공',
      },
      documents: {
        kind: '지원 및 증빙 서류',
        items: '여권, 신분증, 증명사진, 성적증명서, 졸업·졸업예정증명서, 가족관계·출생증명서, 잔고증명서, 후원인 서류, 재직·소득 증빙, TOPIK·IELTS·TOEFL 성적표, 추천서, 자기소개서, 학업계획서, 이력서, 아포스티유·공증·번역 공증, 외국인등록증, 비자, 표준입학허가서',
        purpose: '대학 지원 준비, 서류 검토, 유학원 업무, 대학 제출 준비, 비자 준비 지원',
      },
      counselling: {
        kind: '상담 및 지원 과정',
        items: '상담 내용과 메시지, 자기소개서·학업계획서 초안과 수정 이력, 첨삭 코멘트, 대학 요청사항, 지원 진행 기록',
        purpose: '유학 상담, 문서 검토, 지원 진행 관리, 고객 지원',
      },
      payment: {
        kind: '결제 정보',
        items: '주문 내용과 금액, 통화, 결제 상태, 결제대행사 이름과 거래 참조번호, 환불 기록',
        purpose: '서비스 구매, 결제 확인, 환불, 거래 기록 관리',
      },
      automatic: {
        kind: '자동 생성 정보',
        items: 'IP 주소, 브라우저·기기 정보, 접속 일시와 로그인 성공 여부, 서비스 이용 기록, 서류 열람·검토·내보내기 기록',
        purpose: '로그인 보안, 부정 이용 방지, 서비스 안정성, 사용성 개선',
      },
    },

    retention: {
      h: '개인정보의 보유 및 이용 기간',
      rule: '한귤은 개인정보의 처리 목적이 달성되면 해당 정보를 지체 없이 파기합니다.',
      statutory: '다만 관계 법령에 따라 일정 기간 보관해야 하는 정보는 해당 법령에서 정한 기간 동안 별도로 보관합니다.',
      colRecord: '보관 대상',
      colPeriod: '보관 기간',
      months_one: '{{count}}개월',
      months_other: '{{count}}개월',
      years_one: '{{count}}년',
      years_other: '{{count}}년',
      advertising: { record: '표시·광고에 관한 기록' },
      contract: { record: '계약 또는 청약철회 등에 관한 기록' },
      payment: { record: '대금결제 및 서비스 제공에 관한 기록' },
      complaint: { record: '소비자 불만 또는 분쟁처리에 관한 기록' },
    },

    sharing: {
      h: '개인정보의 제3자 제공',
      rule: '한귤은 원칙적으로 이용자의 개인정보를 이용 목적의 범위 안에서 처리하며, 이용자의 동의 또는 법률상 근거가 있는 경우를 제외하고 제3자에게 제공하지 않습니다.',
      whenApplying: '대학 지원 또는 유학 지원 서비스를 이용하는 경우, 이용자가 선택한 서비스와 진행 단계에 따라 필요한 정보가 해당 대학 또는 담당 유학원에 제공될 수 있습니다.',
      colWho: '제공받는 자',
      colPurpose: '제공 목적',
      colItems: '제공 항목',
      colWhen: '제공 시점',
      notAll: '모든 대학이나 유학원이 모든 서류를 받는 것은 아닙니다. 실제로 제공되는 항목은 이용자가 선택한 서비스와 지원서의 진행 상태에 따라 결정되며, 제공 이력은 서류 보관함에서 확인할 수 있습니다.',
      agency: {
        who: '담당 유학원',
        purpose: '상담, 서류 검토, 지원 준비 지원',
        items: '계정 정보, 유학 준비 프로필, 담당 지원서에 연결된 서류와 상담 기록',
        when: '유학원 지원이 포함된 플랜을 구매하거나 담당 배정에 동의한 때',
      },
      university: {
        who: '지원하는 대학',
        purpose: '입학 심사',
        items: '지원서, 프로필 중 지원에 필요한 항목, 해당 지원서에 공유된 서류',
        when: '해당 대학에 지원서를 제출한 때',
      },
      sponsor: {
        who: '이용자가 지정한 후원인',
        purpose: '이용자가 선택한 범위의 진행 상황 공유',
        items: '이용자가 직접 선택한 범위(서류 파일, 메시지, 상담 기록은 제외)',
        when: '이용자가 열람 링크를 만든 때이며, 언제든 철회할 수 있습니다',
      },
    },

    processors: {
      h: '개인정보 처리업무의 위탁',
      colWho: '수탁자',
      colPurpose: '위탁 업무',
      colCountry: '소재 국가',
      none: '현재 운영 환경에서 개인정보 처리업무를 위탁하고 있는 수탁자는 없습니다. 위탁이 시작되면 수탁자와 위탁 업무를 이 항목에 공개하고, 시행 전에 안내합니다.',
    },

    transfer: {
      h: '국외 이전',
      none: '현재 개인정보를 국외로 이전하는 수탁자는 이용하고 있지 않습니다. 국외 이전이 발생하게 되면 이전받는 자, 국가, 목적, 항목, 시기와 방법, 보유 기간을 이 항목에 공개하고 시행 전에 안내합니다.',
      universities: '다만 이용자가 한국의 대학에 지원하는 경우, 지원에 필요한 정보는 해당 대학에 제공됩니다. 이는 이용자가 선택한 지원 절차를 위한 제공이며, 제공 항목은 위 제3자 제공 항목에 안내한 범위와 같습니다.',
    },

    destruction: {
      h: '개인정보의 파기',
      p1: '보유 기간이 종료되거나 처리 목적이 달성된 개인정보는 복구 또는 재생되지 않도록 안전한 방법으로 파기합니다.',
      p2: '전자적 파일은 복구가 어렵도록 삭제하고, 종이 문서는 분쇄 또는 이에 준하는 방법으로 파기합니다.',
    },

    rights: {
      h: '이용자의 권리',
      intro: '이용자는 언제든지 자신의 개인정보에 대해 다음을 요구할 수 있습니다.',
      access: '열람 — 어떤 정보를 처리하고 있는지 확인',
      correct: '정정 — 사실과 다른 정보의 수정',
      delete: '삭제 — 법령에 따라 보관해야 하는 기록을 제외한 정보의 삭제',
      suspend: '처리정지 — 처리의 일시 중단',
      withdraw: '동의 철회 — 동의를 근거로 처리 중인 항목의 동의 철회',
      close: '회원 탈퇴',
      how: '열람·내보내기·삭제 요청은 <settings>계정 설정</settings>에서 직접 접수할 수 있습니다. 접수된 요청은 처리 기한과 함께 기록되며, 진행 상황을 같은 화면에서 확인할 수 있습니다.',
    },

    security: {
      h: '개인정보 보호를 위한 조치',
      access: '접근 통제 — 학생 본인, 배정된 유학원, 지원서를 받은 대학만 해당 정보에 접근할 수 있으며, 권한은 요청할 때마다 서버에서 다시 확인합니다.',
      roles: '역할 분리 — 유학원 상담사는 자신의 담당 학생만, 대학 분석 담당자는 읽기 전용으로 접근합니다.',
      audit: '접근 기록 — 서류 열람·검토·내보내기는 누가 누구의 정보를 보았는지와 함께 기록됩니다.',
      transport: '전송 구간 암호화 — 모든 통신은 암호화된 연결로 이루어집니다.',
      links: '서류 파일은 공개 주소를 갖지 않으며, 권한 확인 후 발급되는 단기 유효 링크로만 내려받을 수 있습니다.',
      passwords: '비밀번호는 복호화할 수 없는 형태로 저장하고, 로그인 기록을 남깁니다.',
      uploads: '업로드 파일은 형식과 용량을 검사하고 악성코드 검사를 거친 뒤에만 검토 대상이 됩니다.',
    },

    cookies: {
      h: '쿠키 및 유사 기술',
      essential: 'Hangyul Univ는 로그인 상태를 유지하기 위한 필수 쿠키 한 종류만 사용합니다. 이 쿠키는 자바스크립트에서 읽을 수 없고, 인증 경로에서만 전송되며, 로그아웃하면 삭제됩니다.',
      storage: '이와 별도로 선택한 언어, 사이드바 접힘 여부 같은 화면 설정이 브라우저 안에만 저장됩니다. 이 값은 서버로 전송되지 않습니다.',
      noTracking: '광고, 행태정보 수집, 제3자 분석 도구는 사용하지 않습니다. 동의가 필요한 쿠키가 없으므로 쿠키 동의 창도 표시하지 않습니다.',
    },

    contact: {
      h: '개인정보 보호책임자 및 문의',
      colField: '구분',
      colValue: '내용',
      officer: '개인정보 보호책임자',
      department: '담당 부서',
      email: '이메일',
      phone: '전화번호',
    },

    changes: {
      h: '개인정보 처리방침의 변경',
      p1: '이 개인정보 처리방침의 내용이 변경되는 경우, 시행 전에 Hangyul Univ를 통해 변경 내용을 안내합니다.',
    },
  },

  terms: {
    title: 'Hangyul Univ 이용약관',
    summary: '이 약관은 한귤이 제공하는 Hangyul Univ 서비스의 이용 조건과 한귤 및 이용자의 권리·의무를 정합니다.',
    intro: 'Hangyul Univ는 한국 유학을 준비하는 이용자가 대학 정보를 확인하고, 필요한 서류와 지원 절차를 준비하며, 상담·첨삭·지원 관리 등의 서비스를 이용할 수 있도록 돕습니다.',

    purpose: {
      h: '목적',
      p: '본 약관은 Hangyul Univ 서비스의 이용과 관련하여 한귤과 이용자 사이의 기본적인 사항을 정하는 것을 목적으로 합니다.',
    },
    definitions: {
      h: '용어',
      service: { term: '서비스', def: 'Hangyul Univ 웹사이트와 모바일 앱, 그리고 이를 통해 제공되는 유학 준비·지원 기능 전체를 말합니다.' },
      member: { term: '회원', def: '약관에 동의하고 계정을 만들어 서비스를 이용하는 사람을 말합니다.' },
      support: { term: '유학 지원 서비스', def: '상담, 서류 검토, 자기소개서·학업계획서 첨삭, 지원 진행 관리 등 회원이 선택해 이용하는 유료 서비스를 말합니다.' },
      agency: { term: '제휴 유학원', def: '한귤과 계약을 맺고 회원의 상담 및 서류 업무를 수행하는 유학원을 말합니다.' },
      university: { term: '대학', def: '회원이 지원하는 한국의 고등교육기관을 말합니다.' },
      content: { term: '콘텐츠', def: '서비스에서 제공하는 대학 정보, 안내 자료, 서식 등 한귤이 제작하거나 수집한 자료를 말합니다.' },
    },
    accounts: {
      h: '회원가입과 계정',
      p: '회원은 가입 및 이용 과정에서 사실에 맞는 정보를 제공해야 합니다. 계정은 본인만 사용할 수 있으며, 한귤의 동의 없이 타인에게 양도하거나 빌려줄 수 없습니다. 계정이 도용된 정황이 확인되면 한귤은 회원을 보호하기 위해 해당 계정의 이용을 일시 중지하고 회원에게 알립니다.',
    },
    services: {
      h: '서비스의 내용',
      intro: '한귤은 다음과 같은 서비스를 제공할 수 있습니다.',
      info: '한국 대학 정보 제공',
      profile: '유학 준비 프로필 관리',
      documents: '지원 서류 준비와 검토',
      writing: '자기소개서 및 학업계획서 첨삭',
      applications: '대학 지원 준비와 진행 관리',
      counselling: '유학 상담',
      visa: '비자 준비 안내',
      arrival: '주거·입국·정착 지원',
      messages: '메시지 및 진행 상태 관리',
      scope: '실제로 제공되는 서비스의 범위는 회원이 선택한 상품 또는 플랜에 따라 다르며, 구매 전 해당 상품 화면에서 확인할 수 있습니다.',
    },
    universityInfo: {
      h: '대학 정보',
      p: '서비스에서 제공하는 대학 정보는 대학알리미 공시 자료, Study in Korea, 각 대학의 공식 자료 등 공개된 출처를 근거로 합니다. 모집 시기에 따라 달라지는 정보에는 출처와 확인한 날짜를 함께 표시합니다. 공개된 대학 소개는 정보 제공을 목적으로 하며, 회원 개인의 지원 가능 조건과 준비 사항은 로그인 후 학생 화면에서 안내합니다.',
    },
    support: {
      h: '유학 지원 서비스',
      coordination: '한귤은 회원의 유학 준비 과정 전체를 연결하고 관리합니다.',
      agency: '상담, 서류 검토, 제출 준비 등 개별 업무는 배정된 제휴 유학원이 수행할 수 있습니다.',
      responsible: '각 단계에서 어떤 업무를 누가 담당하고 있는지는 서비스 화면에 표시됩니다.',
      decisions: '대학의 합격, 장학금 및 출입국 관련 최종 결정은 각 대학 또는 관계 기관의 기준과 심사에 따릅니다.',
    },
    duties: {
      h: '이용자의 의무',
      p: '회원은 지원에 사용하는 정보와 서류를 사실에 맞게 제출해야 합니다. 타인을 사칭하거나, 위조·변조된 서류를 제출하거나, 계정을 부정하게 이용하거나, 서비스의 정상적인 운영을 방해하거나, 타인의 권리를 침해하는 행위를 해서는 안 됩니다.',
    },
    fees: {
      h: '서비스 이용료와 결제',
      shown: '유료 서비스의 가격과 포함 범위는 결제 전 해당 상품 화면에 표시되며, 표시된 금액 외에 추가로 청구되는 금액은 없습니다.',
      provider: '결제는 결제대행사가 제공하는 화면에서 이루어지고, 결제가 완료되면 거래 내역을 계정에서 확인할 수 있습니다.',
      tuition: '대학 등록금은 한귤이 수납하지 않습니다. 등록금은 회원 본인 명의로 해당 대학에 직접 납부합니다.',
    },
    refunds: {
      h: '취소 및 환불',
      route: '유료 서비스의 취소와 환불은 계정의 거래 내역에서 요청할 수 있으며, 담당자가 처리 결과를 회원에게 안내합니다.',
      visaRefusal: '등록금 납부 후 비자가 거부된 경우, 등록금 환불의 기준과 금액은 해당 대학의 환불 규정에 따릅니다. 환불금은 회원 본인 명의의 계좌로 받습니다.',
      statutory: '전자상거래 등에서의 소비자보호에 관한 법률 등 관계 법령이 정한 청약철회 및 환불에 관한 권리는 본 약관과 관계없이 보장됩니다.',
    },
    privacy: {
      h: '개인정보 보호',
      p: '한귤이 처리하는 개인정보의 항목과 목적, 보유 기간, 제3자 제공, 이용자의 권리는 <privacy>개인정보 처리방침</privacy>에서 안내합니다.',
    },
    ip: {
      h: '지식재산권',
      p: '서비스에서 한귤이 제작한 콘텐츠에 대한 권리는 한귤 또는 정당한 권리자에게 있습니다. 대학의 명칭, 표장, 이미지와 그 밖의 제3자 자료에 대한 권리는 각 권리자에게 있으며, 서비스에 표시된다는 사실만으로 한귤과 해당 기관 사이에 제휴 관계가 있음을 의미하지 않습니다.',
    },
    changes: {
      h: '서비스 변경 및 중단',
      p: '한귤은 서비스의 내용을 개선하기 위해 일부 기능을 변경하거나 종료할 수 있습니다. 회원이 이미 구매한 서비스의 범위에 영향을 주는 변경이나 중단은 사전에 회원에게 알리고, 이미 받은 대가 중 제공되지 않은 부분은 환불합니다. 시스템 점검이나 장애로 서비스가 일시 중단되는 경우에는 가능한 범위에서 미리 알립니다.',
    },
    termination: {
      h: '계정 제한 및 이용 종료',
      p: '회원이 위조·변조된 서류를 제출하거나, 타인을 사칭하거나, 타인의 계정을 무단으로 이용하거나, 서비스의 운영을 고의로 방해한 경우 한귤은 계정의 이용을 제한하거나 종료할 수 있습니다. 이 경우 한귤은 사유와 근거를 회원에게 알리고 소명할 기회를 드리며, 긴급히 조치할 필요가 있는 경우에는 조치 후 지체 없이 알립니다.',
    },
    liability: {
      h: '책임과 분쟁',
      p: '한귤은 서비스 제공과 관련하여 고의 또는 과실로 회원에게 손해를 입힌 경우 관계 법령에 따라 책임을 집니다. 소비자보호 관련 법령이 회원에게 보장하는 권리는 본 약관으로 제한되지 않습니다. 서비스 이용과 관련하여 분쟁이 발생한 경우 한귤과 회원은 먼저 협의로 해결하도록 노력하며, 회원은 한국소비자원 등 분쟁조정기구에 조정을 신청할 수 있습니다.',
    },
    law: { h: '준거법 및 관할' },
    effective: { h: '시행일', p: '이 약관은 {{date}}부터 시행합니다.' },
  },
};

const en = {
  seo: {
    directory: { title: 'Universities in Korea — browse by region', description: 'Every university, junior college and graduate institution on the national public-disclosure register, by region.' },
    university: { title: '{{name}} — universities in Korea', description: 'Official information about {{name}} in {{region}}.' },
    privacy: { title: 'Privacy policy', description: 'What personal information Hangyul Univ processes, why, and the rights you have over it.' },
    terms: { title: 'Terms of service', description: 'The conditions for using Hangyul Univ, and the rights and duties of Hangyul and of members.' },
  },

  map: { title: 'Find universities by region', regionLabel: '{{region}} · {{count}} institutions', hint: 'Choose a region' },

  directory: {
    title: 'Where in Korea do you want to study?',
    lede: 'From a campus in Seoul to the sea at Busan and the mountains of Gangwon. Choose a region and see the universities that are there.',
    all: 'All of Korea',
    count_one: '{{count}} institution',
    count_other: '{{count}} institutions',
    countShort_one: '{{count}} institution',
    countShort_other: '{{count}} institutions',
    inRegion: 'Universities in {{region}}',
    emptyTitle: 'No institutions are listed in this region',
    emptyText: 'Choose another region, or browse all of Korea.',
    source: 'Sources: 대학알리미 public-disclosure data (Ministry of Education / KCUE) and the International Education Quality Assurance System (Study in Korea).',
  },

  type: { UNIVERSITY: 'University', JUNIOR_COLLEGE: 'Junior college', GRADUATE_UNIVERSITY: 'Graduate institution' },
  establishment: { NATIONAL: 'National', PUBLIC: 'Public', PRIVATE: 'Private' },

  ieqas: {
    certified: 'IEQAS certified',
    excellent: 'IEQAS certified — outstanding',
    language: 'Certified Korean-language programme',
    certifiedWhat: 'Reviewed each year by the Ministry of Justice and the Ministry of Education. Students applying to a certified institution are assessed against relaxed visa criteria.',
    languageWhat: "This institution's Korean-language programme is on the certified list.",
  },

  uni: {
    back: 'Back to universities in Korea',
    region: 'Region',
    kind: 'Institution',
    establishment: 'Established as',
    majors: 'Majors disclosed',
    majorsValue: '{{count}}',
    campuses: 'Other campuses',
    aboutTitle: 'About',
    intlTitle: 'For international students',
    sourcesTitle: 'Official information',
    officialSite: 'Official website',
    prepare: 'Prepare to study here',
    surveyYear: '{{year}} disclosure',
    checked: 'Official information checked {{date}}',
  },

  legal: { effective: 'Effective {{date}}' },

  privacy: {
    title: 'Privacy policy',
    summary: 'Hangyul operates Hangyul Univ. We process only the personal information that preparing and submitting a study-abroad application actually needs, and we protect it.',
    scope: 'This policy applies to the Hangyul Univ website and mobile apps and to the study-abroad preparation and application services Hangyul provides. Hangyul complies with the Personal Information Protection Act and related law.',

    collect: {
      h: 'What we process, and why',
      intro: 'Hangyul processes the information below. If you do not use a service, we do not collect the information it would need.',
      colKind: 'Category',
      colItems: 'Information',
      colPurpose: 'Purpose',
      noCard: 'Payment happens on the payment provider’s own checkout. Hangyul does not store card numbers, expiry dates, security codes or billing addresses. What we keep is the order, the amount, the payment status and the provider’s transaction reference.',
      passport: 'Your passport number is stored masked, with only the last three characters in the clear. The passport document itself is held in your document vault, and every access to it is recorded.',
      account: { kind: 'Account', items: 'Name, email address, phone number, language, time zone, sign-in records, consent records', purpose: 'Identifying you, signing you in, managing your account, service notices, answering enquiries' },
      profile: { kind: 'Study-abroad profile', items: 'Nationality, country of residence, date of birth, gender, masked passport number and expiry, Korean visa history, education, school, graduation status, GPA, language test scores, intended degree, field, region and intake, budget, scholarship need, housing preference, who is funding your studies, career goal', purpose: 'Personalising university information, checking what you are eligible for, preparing a study plan' },
      documents: { kind: 'Application documents', items: 'Passport, national ID, photograph, transcripts, graduation and expected-graduation certificates, family-relation and birth certificates, bank statements, sponsor documents, employment and income proof, TOPIK, IELTS and TOEFL reports, recommendations, personal statements, study plans, CV, apostille, notarisation and certified translations, residence card, visa, admission letter', purpose: 'Preparing applications, reviewing documents, agency work, preparing submissions to universities, supporting visa preparation' },
      counselling: { kind: 'Counselling and progress', items: 'Counselling records and messages, drafts of personal statements and study plans and their revision history, review comments, university requests, application progress records', purpose: 'Counselling, document and writing review, managing your application, customer support' },
      payment: { kind: 'Payment', items: 'Order contents and amount, currency, payment status, provider name and transaction reference, refund records', purpose: 'Taking payment, confirming it, refunds, keeping transaction records' },
      automatic: { kind: 'Automatically generated', items: 'IP address, browser and device information, sign-in times and results, service-usage records, records of document access, review and export', purpose: 'Sign-in security, preventing misuse, service stability, improving usability' },
    },

    retention: {
      h: 'How long we keep it',
      rule: 'When the purpose we processed your information for has been achieved, we destroy it without delay.',
      statutory: 'Information the law requires us to retain is kept separately, for the period that law specifies.',
      colRecord: 'Record',
      colPeriod: 'Period',
      months_one: '{{count}} month',
      months_other: '{{count}} months',
      years_one: '{{count}} year',
      years_other: '{{count}} years',
      advertising: { record: 'Records of labelling and advertising' },
      contract: { record: 'Records of contracts and withdrawal of subscription' },
      payment: { record: 'Records of payment and of the supply of services' },
      complaint: { record: 'Records of consumer complaints and dispute resolution' },
    },

    sharing: {
      h: 'Disclosure to third parties',
      rule: 'Hangyul processes your personal information within the purposes it was collected for, and does not disclose it to third parties except with your consent or on a legal basis.',
      whenApplying: 'If you use the application or study-abroad support services, the information those services need may be provided to the university you are applying to or to the agency assigned to you, according to the service you chose and the stage your case has reached.',
      colWho: 'Recipient',
      colPurpose: 'Purpose',
      colItems: 'Information',
      colWhen: 'When',
      notAll: 'Not every university or agency receives every document. What is actually provided depends on the service you chose and the state of your application, and you can see where each document has been sent in your document vault.',
      agency: { who: 'Your assigned agency', purpose: 'Counselling, document review, application preparation', items: 'Account details, study-abroad profile, and the documents and counselling records attached to the applications it handles', when: 'When you buy a plan that includes agency support, or accept an assignment' },
      university: { who: 'The university you apply to', purpose: 'Admission assessment', items: 'Your application, the profile fields the application needs, and the documents shared with that application', when: 'When you submit an application to that university' },
      sponsor: { who: 'A sponsor you name', purpose: 'Sharing the progress you choose to share', items: 'Only the scopes you select — never document files, messages or counselling notes', when: 'When you create a read-only link, which you can revoke at any time' },
    },

    processors: {
      h: 'Processors',
      colWho: 'Processor',
      colPurpose: 'Work',
      colCountry: 'Country',
      none: 'No processor currently handles personal information on Hangyul’s behalf in production. If that changes, the processor and the work entrusted to it will be published here and announced before it begins.',
    },

    transfer: {
      h: 'Transfers outside Korea',
      none: 'No processor that transfers personal information outside Korea is currently in use. If an overseas transfer becomes necessary, the recipient, country, purpose, information, timing, method and retention period will be published here and announced before it begins.',
      universities: 'If you apply to a university in Korea, the information that application needs is provided to that university. That is a disclosure for the application process you chose, on the terms set out in the section above.',
    },

    destruction: {
      h: 'Destruction',
      p1: 'Personal information whose retention period has ended, or whose purpose has been achieved, is destroyed by a method that prevents it being recovered or reconstructed.',
      p2: 'Electronic files are deleted so that they cannot be recovered; paper documents are shredded or destroyed by an equivalent method.',
    },

    rights: {
      h: 'Your rights',
      intro: 'You can ask us at any time to:',
      access: 'Access — see what information we hold about you',
      correct: 'Correct — fix information that is wrong',
      delete: 'Delete — remove information, other than records the law requires us to keep',
      suspend: 'Suspend — stop processing for a time',
      withdraw: 'Withdraw consent — for anything processed on the basis of your consent',
      close: 'Close your account',
      how: 'You can raise an access, export or deletion request yourself in <settings>account settings</settings>. Requests are recorded with a due date, and you can follow their progress on the same screen.',
    },

    security: {
      h: 'How we protect it',
      access: 'Access control — only you, the agency assigned to you and a university you have submitted an application to can reach your information, and permission is re-checked on the server with every request.',
      roles: 'Separation of roles — an agency counsellor sees only their own caseload; a university analyst has read-only access.',
      audit: 'Access logging — document views, reviews and exports are recorded, together with whose information was seen.',
      transport: 'Encryption in transit — all traffic travels over an encrypted connection.',
      links: 'Document files have no public address. They can be downloaded only through a short-lived link issued after a permission check.',
      passwords: 'Passwords are stored in a form that cannot be reversed, and sign-ins are recorded.',
      uploads: 'Uploads are checked for file type and size and scanned for malware before they can be reviewed.',
    },

    cookies: {
      h: 'Cookies and similar technology',
      essential: 'Hangyul Univ uses one essential cookie, to keep you signed in. It cannot be read by JavaScript, it is sent only to the authentication path, and it is deleted when you sign out.',
      storage: 'Separately, interface preferences such as your chosen language and whether a sidebar is collapsed are stored in your browser only. Those values are never sent to our servers.',
      noTracking: 'We use no advertising, behavioural tracking or third-party analytics. There is no cookie that needs your consent, which is why there is no cookie banner.',
    },

    contact: { h: 'Privacy officer and contact', colField: 'Field', colValue: 'Detail', officer: 'Privacy officer', department: 'Department', email: 'Email', phone: 'Phone' },

    changes: { h: 'Changes to this policy', p1: 'If this privacy policy changes, we will announce the change through Hangyul Univ before it takes effect.' },
  },

  terms: {
    title: 'Hangyul Univ terms of service',
    summary: 'These terms set out the conditions for using the Hangyul Univ service that Hangyul provides, and the rights and duties of Hangyul and of members.',
    intro: 'Hangyul Univ helps people preparing to study in Korea to look at university information, get the documents and application steps ready, and use counselling, writing review and application management.',

    purpose: { h: 'Purpose', p: 'These terms set out the basic matters between Hangyul and members in connection with the use of the Hangyul Univ service.' },
    definitions: {
      h: 'Definitions',
      service: { term: 'Service', def: 'The Hangyul Univ website and mobile apps, and the study-abroad preparation and application features provided through them.' },
      member: { term: 'Member', def: 'A person who has agreed to these terms, created an account and uses the service.' },
      support: { term: 'Study-abroad support service', def: 'The paid services a member chooses — counselling, document review, personal-statement and study-plan review, and application management.' },
      agency: { term: 'Partner agency', def: 'A study-abroad agency under contract with Hangyul that carries out counselling and document work for a member.' },
      university: { term: 'University', def: 'The Korean higher-education institution a member applies to.' },
      content: { term: 'Content', def: 'University information, guidance and forms that Hangyul has produced or collected and that the service provides.' },
    },
    accounts: { h: 'Accounts', p: 'Members must give accurate information when registering and when using the service. An account may be used only by the person it belongs to, and may not be transferred or lent to anyone else without Hangyul’s agreement. If there are signs that an account has been compromised, Hangyul will suspend it to protect the member and tell them.' },
    services: {
      h: 'What the service provides',
      intro: 'Hangyul may provide:',
      info: 'Information about Korean universities',
      profile: 'A study-abroad profile',
      documents: 'Preparation and review of application documents',
      writing: 'Review of personal statements and study plans',
      applications: 'Preparation and management of university applications',
      counselling: 'Study-abroad counselling',
      visa: 'Guidance on preparing a visa',
      arrival: 'Housing, arrival and settlement support',
      messages: 'Messages and progress tracking',
      scope: 'What is actually provided in any one case depends on the product or plan the member chose, and is shown on that product’s own page before purchase.',
    },
    universityInfo: { h: 'University information', p: 'University information in the service is based on published sources: 대학알리미 public-disclosure data, Study in Korea, and each university’s own official material. Information that changes between intakes is shown with its source and the date it was checked. Public university introductions are for information; what a particular member is eligible for, and what they need to prepare, is shown in the student platform after signing in.' },
    support: {
      h: 'Study-abroad support',
      coordination: 'Hangyul connects and manages the member’s preparation from end to end.',
      agency: 'Individual work — counselling, document review, preparing a submission — may be carried out by the partner agency assigned to the member.',
      responsible: 'The service shows who is responsible for the work at each stage.',
      decisions: 'Final decisions on admission, scholarships and immigration are made by each university or the relevant authority, according to their own criteria and assessment.',
    },
    duties: { h: 'Member obligations', p: 'Members must submit information and documents that are true. Members must not impersonate another person, submit forged or altered documents, misuse accounts, interfere with the proper operation of the service, or infringe the rights of others.' },
    fees: {
      h: 'Fees and payment',
      shown: 'The price of a paid service and what it includes are shown on that product’s page before payment, and nothing is charged beyond the amount shown.',
      provider: 'Payment is taken on the payment provider’s own checkout, and once it completes the transaction appears in your account.',
      tuition: 'Hangyul does not collect university tuition. Tuition is paid directly to the university, in the member’s own name.',
    },
    refunds: {
      h: 'Cancellation and refunds',
      route: 'Cancellation and refund of a paid service can be requested from the transaction records in your account, and the person handling it will tell you the outcome.',
      visaRefusal: 'If a visa is refused after tuition has been paid, the basis and amount of any tuition refund follow that university’s refund rules. The refund is received into an account in the member’s own name.',
      statutory: 'Rights of withdrawal and refund given to consumers by the Act on Consumer Protection in Electronic Commerce and other applicable law apply regardless of these terms.',
    },
    privacy: { h: 'Personal information', p: 'What personal information Hangyul processes, why, for how long, who it is disclosed to and what rights you have are set out in the <privacy>privacy policy</privacy>.' },
    ip: { h: 'Intellectual property', p: 'Rights in content Hangyul has produced for the service belong to Hangyul or to the rightful rights holder. Rights in university names, marks and images and in other third-party material belong to their respective holders, and their appearance in the service does not by itself indicate any relationship between Hangyul and that institution.' },
    changes: { h: 'Changes to and suspension of the service', p: 'Hangyul may change or discontinue parts of the service in order to improve it. Where a change or discontinuation affects the scope of a service a member has already bought, Hangyul will tell the member beforehand and refund the part of what they paid that has not been provided. Where the service is interrupted by maintenance or a fault, Hangyul will give notice as far as it reasonably can.' },
    termination: { h: 'Restriction and termination of accounts', p: 'Hangyul may restrict or terminate an account where a member submits forged or altered documents, impersonates another person, uses someone else’s account without authorisation, or deliberately interferes with the operation of the service. Hangyul will tell the member the reason and the basis and give them an opportunity to respond; where urgent action is needed, it will tell them immediately afterwards.' },
    liability: { h: 'Liability and disputes', p: 'Hangyul is liable under applicable law for loss caused to a member by its intent or negligence in providing the service. Rights given to members by consumer-protection law are not limited by these terms. If a dispute arises, Hangyul and the member will first try to resolve it by discussion, and the member may apply for mediation to a dispute-resolution body such as the Korea Consumer Agency.' },
    law: { h: 'Governing law and jurisdiction' },
    effective: { h: 'Effective date', p: 'These terms take effect on {{date}}.' },
  },
};

function deepMerge(target, source) {
  for (const [k, v] of Object.entries(source)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      target[k] = deepMerge(target[k] && typeof target[k] === 'object' ? target[k] : {}, v);
    } else {
      target[k] = v;
    }
  }
  return target;
}

let written = 0;
for (const [loc, data] of [['ko', ko], ['en', en]]) {
  const path = file(loc);
  const json = JSON.parse(readFileSync(path, 'utf8'));
  json.v12 = deepMerge(json.v12 ?? {}, data);
  writeFileSync(path, `${JSON.stringify(json, null, 2)}\n`, 'utf8');
  const count = JSON.stringify(data).match(/"/g).length;
  console.log(`${loc}: v12 namespace written (${path.split('/locales/')[1]})`);
  written += count;
}
console.log('done');
