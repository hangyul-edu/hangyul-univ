# V22 Legal Research — Signup verification (SendGrid / Twilio SMS / Turnstile), consent screen, refund article

Research date (all URLs accessed): **2026-10-23**
Scope: read-only research for Hangyul Univ (talkhangyul.com) — one-time paid study-abroad support plans sold online to international students; email verification via Twilio SendGrid, SMS OTP via Twilio Programmable Messaging, bot protection via Cloudflare Turnstile. Email addresses, phone numbers, IP/browser signals will be processed by US vendors.

Method: statute text was pulled from 국가법령정보센터 (law.go.kr) current-law pages (`lsInfoR.do`, lsiSeq noted per law) and quoted verbatim; PIPC guidance from the PIPC board PDF; vendor facts from the vendors' own legal/docs pages. Where a fact could not be confirmed from a primary source it is marked **UNVERIFIED**. Nothing below is legal advice; it is a sourced reading of the texts.

Versions read:

| Law | Version read | 시행일 | law.go.kr id |
|---|---|---|---|
| 개인정보 보호법 (PIPA) | 법률 제21445호, 2026. 3. 10. 일부개정 | 2026. 9. 11. | lsiSeq=283839 |
| 개인정보 보호법 시행령 | 대통령령 제36671호, 2026. 9. 10. 일부개정 | 2026. 9. 11. | lsiSeq=289537 |
| 전자상거래 등에서의 소비자보호에 관한 법률 | 법률 제21312호, 2026. 1. 20. 일부개정 | 2026. 7. 21. | lsiSeq=282793 |
| 전자상거래법 시행령 | 대통령령 제36507호, 2026. 7. 20. 일부개정 | 2026. 7. 21. | lsiSeq=288143 |
| 약관의 규제에 관한 법률 | 법률 제20239호, 2024. 2. 6. 타법개정 | 2024. 8. 7. | lsiSeq=260021 |
| 정보통신망 이용촉진 및 정보보호 등에 관한 법률 | 법률 제21988호, 2026. 9. 29. 일부개정 | 2026. 10. 2. | lsiSeq=290001 |
| 정보통신망법 시행령 | 대통령령 제36728호, 2026. 9. 29. 타법개정 | 2026. 10. 2. | lsiSeq=290483 |

---

## 1. 개인정보 보호법 (PIPA) — 법률 제21445호, 시행 2026. 9. 11.

Source: https://www.law.go.kr/법령/개인정보보호법 (renders https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=283839&efYd=20260911). Accessed 2026-10-23.

### 제15조 (개인정보의 수집ㆍ이용)
Verbatim (relevant parts):

> ① 개인정보처리자는 다음 각 호의 어느 하나에 해당하는 경우에는 개인정보를 수집할 수 있으며 그 수집 목적의 범위에서 이용할 수 있다.
> 1. 정보주체의 동의를 받은 경우
> 2. 법률에 특별한 규정이 있거나 법령상 의무를 준수하기 위하여 불가피한 경우
> 3. 공공기관이 법령 등에서 정하는 소관 업무의 수행을 위하여 불가피한 경우
> 4. 정보주체와 체결한 계약을 이행하거나 계약을 체결하는 과정에서 정보주체의 요청에 따른 조치를 이행하기 위하여 필요한 경우
> 5. 명백히 정보주체 또는 제3자의 급박한 생명, 신체, 재산의 이익을 위하여 필요하다고 인정되는 경우
> 6. 개인정보처리자의 정당한 이익을 달성하기 위하여 필요한 경우로서 명백하게 정보주체의 권리보다 우선하는 경우. …
> 7. 공중위생 등 공공의 안전과 안녕을 위하여 긴급히 필요한 경우
> ② 개인정보처리자는 제1항제1호에 따른 동의를 받을 때에는 다음 각 호의 사항을 정보주체에게 알려야 한다. 다음 각 호의 어느 하나의 사항을 변경하는 경우에도 이를 알리고 동의를 받아야 한다.
> 1. 개인정보의 수집ㆍ이용 목적
> 2. 수집하려는 개인정보의 항목
> 3. 개인정보의 보유 및 이용 기간
> 4. 동의를 거부할 권리가 있다는 사실 및 동의 거부에 따른 불이익이 있는 경우에는 그 불이익의 내용

Also relevant, 제16조:
> ② 개인정보처리자는 정보주체의 동의를 받아 개인정보를 수집하는 경우 필요한 최소한의 정보 외의 개인정보 수집에는 동의하지 아니할 수 있다는 사실을 구체적으로 알리고 개인정보를 수집하여야 한다.
> ③ 개인정보처리자는 정보주체가 필요한 최소한의 정보 외의 개인정보 수집에 동의하지 아니한다는 이유로 정보주체에게 재화 또는 서비스의 제공을 거부하여서는 아니 된다.

Product requirement: when consent is the basis for collecting email/phone/name, the consent text must state the four items of 제15조②. 제15조①4 (계약 이행/체결) is a separate lawful basis that does not require consent; if used, 제22조③ (below) requires that those items and the legal basis be disclosed in the 처리방침 separately from consent-based items.

### 제22조 (동의를 받는 방법)
> ① 개인정보처리자는 이 법에 따른 개인정보의 처리에 대하여 정보주체…의 동의를 받을 때에는 각각의 동의 사항을 구분하여 정보주체가 이를 명확하게 인지할 수 있도록 알리고 동의를 받아야 한다. 이 경우 다음 각 호의 경우에는 동의 사항을 구분하여 각각 동의를 받아야 한다.
> 1. 제15조제1항제1호에 따라 동의를 받는 경우
> 2. 제17조제1항제1호에 따라 동의를 받는 경우
> 3. 제18조제2항제1호에 따라 동의를 받는 경우
> 4. 제19조제1호에 따라 동의를 받는 경우
> 5. 제23조제1항제1호에 따라 동의를 받는 경우
> 6. 제24조제1항제1호에 따라 동의를 받는 경우
> 7. 재화나 서비스를 홍보하거나 판매를 권유하기 위하여 개인정보의 처리에 대한 동의를 받으려는 경우
> 8. 그 밖에 정보주체를 보호하기 위하여 동의 사항을 구분하여 동의를 받아야 할 필요가 있는 경우로서 대통령령으로 정하는 경우
> ② 개인정보처리자는 제1항의 동의를 서면(「전자문서 및 전자거래 기본법」 제2조제1호에 따른 전자문서를 포함한다)으로 받을 때에는 개인정보의 수집ㆍ이용 목적, 수집ㆍ이용하려는 개인정보의 항목 등 대통령령으로 정하는 중요한 내용을 보호위원회가 고시로 정하는 방법에 따라 명확히 표시하여 알아보기 쉽게 하여야 한다.
> ③ 개인정보처리자는 정보주체의 동의 없이 처리할 수 있는 개인정보에 대해서는 그 항목과 처리의 법적 근거를 정보주체의 동의를 받아 처리하는 개인정보와 구분하여 제30조제2항에 따라 공개하거나 전자우편 등 대통령령으로 정하는 방법에 따라 정보주체에게 알려야 한다. 이 경우 동의 없이 처리할 수 있는 개인정보라는 입증책임은 개인정보처리자가 부담한다.
> ⑤ 개인정보처리자는 정보주체가 선택적으로 동의할 수 있는 사항을 동의하지 아니하거나 제1항제3호 및 제7호에 따른 동의를 하지 아니한다는 이유로 정보주체에게 재화 또는 서비스의 제공을 거부하여서는 아니 된다.
> ⑦ 제1항부터 제5항까지에서 규정한 사항 외에 정보주체의 동의를 받는 세부적인 방법에 관하여 필요한 사항은 개인정보의 수집매체 등을 고려하여 대통령령으로 정한다.

Note: ④ and ⑥ are 삭제 <2023. 3. 14.>. The pre-2023 wording "필수/선택 구분" now lives in ①, ⑤ and 시행령 제17조④ (below).

Product requirement: each consent category is a separate, individually checkable item; marketing consent (①7) must be its own checkbox; declining optional/marketing consent must not block signup or purchase (⑤).

### 제22조의2 (아동의 개인정보 보호)
> ① 개인정보처리자는 만 14세 미만 아동의 개인정보를 처리하기 위하여 이 법에 따른 동의를 받아야 할 때에는 그 법정대리인의 동의를 받아야 하며, 법정대리인이 동의하였는지를 확인하여야 한다.
> ③ … 만 14세 미만의 아동에게 … 이해하기 쉬운 양식과 명확하고 알기 쉬운 언어를 사용하여야 한다.

Product requirement: 제22조의2 is about children under 14 (not the "required vs optional" rule). If the service admits minors under 14, a parental-consent flow is required; otherwise an age gate (14+) statement suffices. (See also 전자상거래법 제13조③ on minors below.)

### 제26조 (업무위탁에 따른 개인정보의 처리 제한)
> ① 개인정보처리자가 제3자에게 개인정보의 처리 업무를 위탁하는 경우에는 다음 각 호의 내용이 포함된 문서로 하여야 한다.
> 1. 위탁업무 수행 목적 외 개인정보의 처리 금지에 관한 사항
> 2. 개인정보의 기술적ㆍ관리적 보호조치에 관한 사항
> 3. 그 밖에 개인정보의 안전한 관리를 위하여 대통령령으로 정한 사항
> ② … 위탁자…는 위탁하는 업무의 내용과 개인정보 처리 업무를 위탁받아 처리하는 자(… 재위탁받은 제3자를 포함하며, 이하 “수탁자”라 한다)를 정보주체가 언제든지 쉽게 확인할 수 있도록 대통령령으로 정하는 방법에 따라 공개하여야 한다.
> ③ 위탁자가 재화 또는 서비스를 홍보하거나 판매를 권유하는 업무를 위탁하는 경우에는 대통령령으로 정하는 방법에 따라 위탁하는 업무의 내용과 수탁자를 정보주체에게 알려야 한다. …
> ④ 위탁자는 … 수탁자를 교육하고, 처리 현황 점검 등 대통령령으로 정하는 바에 따라 수탁자가 개인정보를 안전하게 처리하는지를 감독하여야 한다.
> ⑥ 수탁자는 위탁받은 개인정보의 처리 업무를 제3자에게 다시 위탁하려는 경우에는 위탁자의 동의를 받아야 한다.

시행령 제28조 (개인정보의 처리 업무 위탁 시 조치): ① "대통령령으로 정한 사항" = 1. 위탁업무의 목적 및 범위 2. 재위탁 제한에 관한 사항 3. 개인정보에 대한 접근 제한 등 안전성 확보 조치에 관한 사항 4. 위탁업무와 관련하여 보유하고 있는 개인정보의 관리 현황 점검 등 감독에 관한 사항 5. 수탁자가 준수하여야 할 의무를 위반한 경우의 손해배상 등 책임에 관한 사항. ② "대통령령으로 정하는 방법" = 위탁자의 인터넷 홈페이지에 위탁하는 업무의 내용과 수탁자를 지속적으로 게재하는 방법. ④ Marketing-outsourcing notice (법 제26조③) = 서면등의 방법.

Product requirement: Twilio Inc. (SMS), Twilio Inc./SendGrid (email) and Cloudflare, Inc. (Turnstile) are 수탁자 and must be listed by name with the outsourced task in the 처리방침 (처리위탁 table). The vendor DPA/ToS is the "문서" of ①; Twilio's DPA and Cloudflare's DPA (section 6) are the written documents. If SendGrid/Twilio SMS is later used to send marketing, ③ notice applies.

### 제28조의8 (개인정보의 국외 이전)
> ① 개인정보처리자는 개인정보를 국외로 제공(조회되는 경우를 포함한다)ㆍ처리위탁ㆍ보관(이하 이 절에서 “이전”이라 한다)하여서는 아니 된다. 다만, 다음 각 호의 어느 하나에 해당하는 경우에는 개인정보를 국외로 이전할 수 있다.
> 1. 정보주체로부터 국외 이전에 관한 별도의 동의를 받은 경우
> 2. 법률, 대한민국을 당사자로 하는 조약 또는 그 밖의 국제협정에 개인정보의 국외 이전에 관한 특별한 규정이 있는 경우
> 3. 정보주체와의 계약의 체결 및 이행을 위하여 개인정보의 처리위탁ㆍ보관이 필요한 경우로서 다음 각 목의 어느 하나에 해당하는 경우
> 가. 제2항 각 호의 사항을 제30조에 따른 개인정보 처리방침에 공개한 경우
> 나. 전자우편 등 대통령령으로 정하는 방법에 따라 제2항 각 호의 사항을 정보주체에게 알린 경우
> 4. 개인정보를 이전받는 자가 제32조의2에 따른 개인정보 보호 인증 등 보호위원회가 정하여 고시하는 인증을 받은 경우로서 다음 각 목의 조치를 모두 한 경우 …
> 5. 개인정보가 이전되는 국가 또는 국제기구의 개인정보 보호체계, 정보주체 권리보장 범위, 피해구제 절차 등이 이 법에 따른 개인정보 보호 수준과 실질적으로 동등한 수준을 갖추었다고 보호위원회가 인정하는 경우
> ② 개인정보처리자는 제1항제1호에 따른 동의를 받을 때에는 미리 다음 각 호의 사항을 정보주체에게 알려야 한다.
> **1. 이전되는 개인정보 항목**
> **2. 개인정보가 이전되는 국가, 시기 및 방법**
> **3. 개인정보를 이전받는 자의 성명(법인인 경우에는 그 명칭과 연락처를 말한다)**
> **4. 개인정보를 이전받는 자의 개인정보 이용목적 및 보유ㆍ이용 기간**
> **5. 개인정보의 이전을 거부하는 방법, 절차 및 거부의 효과**
> ③ 개인정보처리자는 제2항 각 호의 어느 하나에 해당하는 사항을 변경하는 경우에는 정보주체에게 알리고 동의를 받아야 한다.
> ④ 개인정보처리자는 제1항 각 호 외의 부분 단서에 따라 개인정보를 국외로 이전하는 경우 국외 이전과 관련한 이 법의 다른 규정, 제17조부터 제19조까지의 규정 및 제5장의 규정을 준수하여야 하고, 대통령령으로 정하는 보호조치를 하여야 한다.
> ⑤ 개인정보처리자는 이 법을 위반하는 사항을 내용으로 하는 개인정보의 국외 이전에 관한 계약을 체결하여서는 아니 된다.

시행령:
- 제29조의7 (개인정보의 국외 처리위탁ㆍ보관 시 정보주체에게 알리는 방법): "법 제28조의8제1항제3호나목에서 “전자우편 등 대통령령으로 정하는 방법”이란 서면등의 방법을 말한다." ("서면등의 방법" is defined in 시행령 제17조⑤ as 서면, 전자우편, 팩스, 전화, 문자전송 또는 이에 상당하는 방법.)
- 제29조의10 (개인정보의 국외 이전 시 보호조치 등): ① 1. 제30조제1항에 따른 안전성 확보 조치 2. 개인정보 침해에 대한 고충처리 및 분쟁해결에 관한 조치 3. 그 밖에 정보주체의 개인정보 보호를 위하여 필요한 조치. ② "… 제1항 각 호의 사항에 관하여 이전받는 자와 미리 협의하고 이를 계약내용 등에 반영해야 한다."

Product requirement: the five ② items must be populated per vendor (see §7). Two routes exist under the text: (a) ①1 separate consent, or (b) ①3 — 처리위탁·보관 necessary for 계약 체결·이행, with the five items either published in the 처리방침 (가) or notified by 서면등의 방법 (나). Route (b) does not require consent by its text. 제28조의9 gives PIPC a 국외 이전 중지 명령 power if ①/④/⑤ are violated.

### 제29조 (안전조치의무)
> 개인정보처리자는 개인정보가 유출등이 되지 아니하도록 내부 관리계획 수립, 접속기록 보관 등 대통령령으로 정하는 바에 따라 안전성 확보에 필요한 기술적ㆍ관리적 및 물리적 조치를 하여야 한다.

시행령 제30조① lists the measures: 1. 내부 관리계획 수립ㆍ시행 및 점검; 2. 접근 권한 제한 (권한 부여ㆍ변경ㆍ말소 기준, 인증수단); 3. 접근 통제 (침입 탐지ㆍ차단 등); 4. 안전한 저장ㆍ전송 — 가. 비밀번호의 일방향 암호화 저장 등 인증정보의 암호화, 나. 고시 지정 정보의 암호화 저장, 다. 정보통신망을 통한 개인정보/인증정보 송수신 시 암호화; 5. 접속기록 보관 및 위조ㆍ변조 방지; 6. 악성프로그램 방지 프로그램 설치ㆍ운영; 7. 물리적 조치; 8. 그 밖에 필요한 조치. ③ details are in a PIPC 고시 (개인정보의 안전성 확보조치 기준 — not fetched; title only, **UNVERIFIED** as to current version).

Product requirement: OTP codes and passwords stored hashed; TLS for all vendor API calls; access logs for the admin console; the 처리방침 must have an 안전성 확보조치 section (시행령 제31조①3).

### 제30조 (개인정보 처리방침의 수립 및 공개)
> ① … 다음 각 호의 사항이 포함된 개인정보의 처리 방침…을 정하여야 한다.
> 1. 개인정보의 처리 목적
> 2. 개인정보의 처리 및 보유 기간
> 3. 개인정보의 제3자 제공에 관한 사항(해당되는 경우에만 정한다)
> 3의2. 개인정보의 파기절차 및 파기방법(제21조제1항 단서에 따라 개인정보를 보존하여야 하는 경우에는 그 보존근거와 보존하는 개인정보 항목을 포함한다)
> 3의3. 제23조제3항에 따른 민감정보의 공개 가능성 및 비공개를 선택하는 방법(해당되는 경우에만 정한다)
> 4. 개인정보처리의 위탁에 관한 사항(해당되는 경우에만 정한다)
> 4의2. 제28조의2 및 제28조의3에 따른 가명정보의 처리 등에 관한 사항(해당되는 경우에만 정한다)
> 5. 정보주체와 법정대리인의 권리ㆍ의무 및 그 행사방법에 관한 사항
> 6. 제31조에 따른 개인정보 보호책임자의 성명 또는 개인정보 보호업무 및 관련 고충사항을 처리하는 부서의 명칭과 전화번호 등 연락처
> 7. 인터넷 접속정보파일 등 개인정보를 자동으로 수집하는 장치의 설치ㆍ운영 및 그 거부에 관한 사항(해당하는 경우에만 정한다)
> 8. 그 밖에 개인정보의 처리에 관하여 대통령령으로 정한 사항
> ② … 정보주체가 쉽게 확인할 수 있도록 대통령령으로 정하는 방법에 따라 공개하여야 한다.
> ③ 개인정보 처리방침의 내용과 개인정보처리자와 정보주체 간에 체결한 계약의 내용이 다른 경우에는 정보주체에게 유리한 것을 적용한다.

시행령 제31조① ("대통령령으로 정한 사항"): 1. 처리하는 개인정보의 항목; **2. 법 제28조의8제1항 각 호에 따라 개인정보를 국외로 이전하는 경우 국외 이전의 근거와 같은 조 제2항 각 호의 사항**; 3. 제30조에 따른 안전성 확보 조치에 관한 사항; 4. 국외에서 국내 정보주체의 개인정보를 직접 수집하여 처리하는 경우 개인정보를 처리하는 국가명. 시행령 제31조②: publish continuously on the 인터넷 홈페이지.

Product requirement: the 처리방침 must carry a 국외 이전 section with the legal basis (which 호 of 제28조의8①) plus the five 제28조의8② items, a 처리위탁 table, and the 안전조치 section. The 처리방침 is where route (b) above is satisfied.

### 시행령 제17조 (동의를 받는 방법) — 대통령령 제36671호, 시행 2026. 9. 11.
> ① … 다음 각 호의 조건을 모두 충족해야 한다.
> 1. 정보주체가 자유로운 의사에 따라 동의 여부를 결정할 수 있을 것
> 2. 동의를 받으려는 내용이 구체적이고 명확할 것
> 3. 그 내용을 쉽게 읽고 이해할 수 있는 문구를 사용할 것
> 4. 동의 여부를 명확하게 표시할 수 있는 방법을 정보주체에게 제공할 것
> ② … 4. 인터넷 홈페이지 등에 동의 내용을 게재하고 정보주체가 동의 여부를 표시하도록 하는 방법 …
> ③ 법 제22조제2항에서 “대통령령으로 정하는 중요한 내용”이란 … 1. 개인정보의 수집ㆍ이용 목적 중 재화나 서비스의 홍보 또는 판매 권유 등을 위하여 해당 개인정보를 이용하여 정보주체에게 연락할 수 있다는 사실 2. 처리하려는 개인정보의 항목 중 … 가. 민감정보 나. … 여권번호, 운전면허의 면허번호 및 외국인등록번호 3. 개인정보의 보유 및 이용 기간(제공 시에는 제공받는 자의 보유 및 이용 기간을 말한다) 4. 개인정보를 제공받는 자 및 개인정보를 제공받는 자의 개인정보 이용 목적
> ④ 개인정보처리자는 정보주체로부터 법 제22조제1항 각 호에 따른 동의를 받으려는 때에는 정보주체가 동의 여부를 선택할 수 있다는 사실을 명확하게 알 수 있도록 표시해야 한다.

Product requirement: no pre-ticked boxes (①1, ①4); the marketing-contact fact, retention period, and any passport/foreigner-registration number (relevant for international students if ever collected) must be visually emphasised (③, per PIPC 고시 method — 고시 not fetched, **UNVERIFIED** as to typography rule).

---

## 2. 개인정보 처리방침 작성지침 (PIPC) — 2026. 4. 개정

Source page: https://pipc.go.kr/np/cop/bbs/selectBoardArticle.do?bbsId=BS217&mCode=D010030000&nttId=12018 (posted 2026-04-23; attachment "2026 개인정보 처리방침 작성지침.pdf", 185 pages, PDF created 2026-04-23). Accessed 2026-10-23. Prior version: 2025. 4. (nttId=11134). Legal basis stated in the guide: 법 제30조 및 시행령 제31조. Revision history in the guide: '20.12 발간 → '22.3 → '24.4 → '25.4 → '26.4 ("조건부 유형화 허용(위탁, 제3자 제공), 개인정보 처리방침 변경사항 안내 방식 개선, '생성형 인공지능(AI) 서비스 처리방침 부록' 신설 및 사례 추가").

Checklist of sections (guide p.16, "기재 사항"; items marked 해당시 only when applicable, 권장 = recommended):
1 제목 및 서문 · 2 개인정보의 처리 목적 · 3 처리하는 개인정보의 항목 · 4 14세 미만 아동 (해당시) · 5 처리 및 보유 기간 · 6 파기 절차 및 방법 · 7 제3자 제공 (해당시) · 8 추가적인 이용·제공 판단 기준 (해당시) · **9 개인정보 처리업무의 위탁에 관한 사항 (해당시)** · **10 개인정보의 국외 수집 및 이전에 관한 사항 (해당시)** · 11 안전성 확보조치 · 12 민감정보 공개 가능성 (해당시) · 13 가명정보 (해당시) · 14 자동 수집 장치 설치·운영 및 거부 (해당시) · 15 제3자 행태정보 수집 허용 (권장, 해당시) · 16 정보주체와 법정대리인의 권리·의무 및 행사방법 · 17 자동화된 결정 (해당시) · 18 개인정보 보호책임자 / 고충처리 부서 · 19 국내대리인 (해당시) · 20 권익침해 구제방법 (권장) · 21/22 영상정보처리기기 (해당시) · 23 자율적 사항 (권장) · 24 처리방침의 변경에 관한 사항.

Section 9 (위탁), guide p.42–43, key rules:
- Must list ➀ 위탁받은 자(수탁자, including 재수탁자) and ➁ 위탁하는 업무의 내용.
- "위탁자는 정보주체가 수탁자를 쉽게 확인할 수 있도록 수탁자의 명칭을 구체적으로 기재하여야 하며, 수탁자를 '~등'과 같이 축약하여 기재하여서는 안 됨".
- "국외 위탁이 발생하는 경우, 해당 내용(위탁받은 자, 위탁하는 업무의 내용)을 '10. 개인정보의 국외 수집 및 이전에 관한 사항'에서 개인정보 처리업무의 위탁임을 명시하여 작성할 수 있음".
- Example table layout: two columns — 위탁받는 자(수탁자) | 위탁업무.

Section 10 (국외 이전), guide p.45–48, key rules:
- "개인정보를 국외로 이전(제공, 조회, 처리위탁, 보관)하는 경우 보호법 제28조의8제1항 각 호 중에 해당하는 국외 이전의 법적 근거와 동법 제28조의8제2항 각 호의 사항을 구체적으로 기재하여야 함(국외로 이전된 개인정보의 재이전을 포함)".
- "클라우드 서비스 이용 등으로 인해 복수의 국가로 개인정보가 이전되는 경우 해당 국가를 모두 기재하여야 함".
- Checklist: ✓ 국외이전의 법적 근거 ✓ 이전되는 개인정보 항목 ✓ 이전되는 국가, 시기 및 방법 ✓ 이전받는 자의 성명(법인: 명칭과 연락처) ✓ 이용 목적 및 보유·이용 기간 ✓ 이전을 거부하는 방법, 절차 및 거부의 효과.
- Example 1 (일반형) is explicitly built on 「개인정보 보호법」 제28조의8제1항제3호 ('계약 이행을 위한 국외 처리위탁·보관') with item 8 reading: "… 국외 이전을 거부할 경우 서비스 이용이 불가능합니다. 국외 이전을 원치 않을 경우 홈페이지(메뉴 – 내 정보 – 회원 탈퇴) … 회원 탈퇴를 요청할 수 있습니다."
- Example 2 table columns: 관련 근거 | 이전하는 개인정보 항목 | 이전 국가 | 이전 시기 및 방법 | 이전받는 자 (연락처) | 이용 목적 | 보유 및 이용 기간. Rows show both "제28조의8제1항 제1호 (동의)" and "제28조의8제1항 제3호 (처리위탁·보관)" as alternative bases. Example "이전 시기 및 방법": "서비스 이용 시점부터 ○일 이내 / 전용 네트워크(가상사설망(VPN))를 이용한 원격지 전송".
- The 2026 revision allows conditional "유형화" (typed grouping) of 수탁자/제공받는 자 (revision history line; detailed conditions are in the guide body, not transcribed here).

Product requirement: the 처리방침 needs a §9 table (Twilio Inc. — SMS 인증번호 발송; Twilio Inc. (SendGrid) — 이메일 인증/거래 메일 발송; Cloudflare, Inc. — 봇 방지(Turnstile) 검증) and a §10 table with the seven columns above, filled per §7 of this document, and a stated 거부 효과.

---

## 3. 전자상거래 등에서의 소비자보호에 관한 법률 — 법률 제21312호, 시행 2026. 7. 21.

Source: https://www.law.go.kr/법령/전자상거래등에서의소비자보호에관한법률 (lsiSeq=282793). Accessed 2026-10-23.

### 제12조 (통신판매업자의 신고 등)
> ① 통신판매업자는 대통령령으로 정하는 바에 따라 다음 각 호의 사항을 공정거래위원회 또는 특별자치시장ㆍ특별자치도지사ㆍ시장ㆍ군수ㆍ구청장에게 신고하여야 한다. 다만, 통신판매의 거래횟수, 거래규모 등이 공정거래위원회가 고시로 정하는 기준 이하인 경우에는 그러하지 아니하다.
> 1. 상호(법인인 경우에는 대표자의 성명 및 주민등록번호를 포함한다), 주소, 전화번호
> 2. 전자우편주소, 인터넷도메인 이름, 호스트서버의 소재지
> 3. 그 밖에 사업자의 신원 확인을 위하여 필요한 사항으로서 대통령령으로 정하는 사항

시행령 제13조: file with the 시장ㆍ군수ㆍ구청장 of the 주된 사무소 소재지; 선지급식 통신판매 requires extra documents (제24조 소비자피해보상보험 등). 시행령 제16조: changes within 15 days. The exemption 고시 threshold was not fetched — **UNVERIFIED**.

Product requirement: talkhangyul.com sells prepaid plans → 통신판매업 신고 and display of 신고번호 (제13조①3) in the footer/terms.

### 제13조 (신원 및 거래조건에 대한 정보의 제공)
> ① 통신판매업자가 재화등의 거래에 관한 청약을 받을 목적으로 표시ㆍ광고를 할 때에는 … 1. 상호 및 대표자 성명 2. 주소ㆍ전화번호ㆍ전자우편주소 3. 제12조에 따라 … 한 신고의 신고번호와 그 신고를 받은 기관의 이름 등 신고를 확인할 수 있는 사항
> ② 통신판매업자는 소비자가 계약체결 전에 재화등에 대한 거래조건을 정확하게 이해하고 실수나 착오 없이 거래할 수 있도록 다음 각 호의 사항을 적절한 방법으로 표시ㆍ광고하거나 고지하여야 하며, 계약이 체결되면 계약자에게 다음 각 호의 사항이 기재된 계약내용에 관한 서면을 재화등을 공급할 때까지 교부하여야 한다. …
> 1. 재화등의 공급자 및 판매자의 상호, 대표자의 성명ㆍ주소 및 전화번호 등
> 2. 재화등의 명칭ㆍ종류 및 내용
> 2의2. 재화등의 정보에 관한 사항. …
> 3. 재화등의 가격(가격이 결정되어 있지 아니한 경우에는 가격을 결정하는 구체적인 방법)과 그 지급방법 및 지급시기
> 4. 재화등의 공급방법 및 공급시기
> 5. 청약의 철회 및 계약의 해제(이하 “청약철회등”이라 한다)의 기한ㆍ행사방법 및 효과에 관한 사항(청약철회등의 권리를 행사하는 데에 필요한 서식을 포함한다)
> 6. 재화등의 교환ㆍ반품ㆍ보증과 그 대금 환불 및 환불의 지연에 따른 배상금 지급의 조건ㆍ절차
> 7. 전자매체로 공급할 수 있는 재화등의 전송ㆍ설치 등을 할 때 필요한 기술적 사항
> 8. 소비자피해보상의 처리, 재화등에 대한 불만 처리 및 소비자와 사업자 사이의 분쟁 처리에 관한 사항
> 9. 거래에 관한 약관(그 약관의 내용을 확인할 수 있는 방법을 포함한다)
> 10. … 결제대금예치 … 또는 … 소비자피해보상보험계약등의 체결을 선택할 수 있다는 사항(제15조제1항에 따른 선지급식 통신판매의 경우에만 해당하며 …)
> 11. 그 밖에 … 대통령령으로 정하는 사항
> ③ 통신판매업자는 미성년자와 재화등의 거래에 관한 계약을 체결할 때에는 법정대리인이 그 계약에 동의하지 아니하면 미성년자 본인 또는 법정대리인이 그 계약을 취소할 수 있다는 내용을 미성년자에게 고지하여야 한다.
> ⑤ 통신판매업자는 제2항에 따라 소비자에게 표시ㆍ광고하거나 고지한 거래조건을 신의를 지켜 성실하게 이행하여야 한다.
> ⑥ (정기결제 증액/유료 전환 사전 동의 — 시행령 제20조의2: 30일 전) — not applicable to one-time plans unless subscriptions are added.

Product requirement: plan page/checkout must show the ② items before payment, and a 계약내용 서면 (e-mail receipt/order confirmation containing the same items, incl. the 청약철회 terms and a withdrawal form/link) must be delivered no later than service start. Since plans are prepaid (선지급식), item 10 (escrow/보험 option) applies unless a 제24조③ exclusion applies — **UNVERIFIED** which exclusion, if any, fits.

### 제17조 (청약철회등)
> ① 통신판매업자와 재화등의 구매에 관한 계약을 체결한 소비자는 다음 각 호의 기간(거래당사자가 다음 각 호의 기간보다 긴 기간으로 약정한 경우에는 그 기간을 말한다) 이내에 해당 계약에 관한 청약철회등을 할 수 있다.
> 1. 제13조제2항에 따른 계약내용에 관한 서면을 받은 날부터 7일. 다만, 그 서면을 받은 때보다 재화등의 공급이 늦게 이루어진 경우에는 재화등을 공급받거나 재화등의 공급이 시작된 날부터 7일
> 2. 제13조제2항에 따른 계약내용에 관한 서면을 받지 아니한 경우, 통신판매업자의 주소 등이 적혀 있지 아니한 서면을 받은 경우 또는 통신판매업자의 주소 변경 등의 사유로 제1호의 기간에 청약철회등을 할 수 없는 경우에는 통신판매업자의 주소를 안 날 또는 알 수 있었던 날부터 7일
> 3. 제21조제1항제1호 또는 제2호의 청약철회등에 대한 방해 행위가 있는 경우에는 그 방해 행위가 종료한 날부터 7일
> ② 소비자는 다음 각 호의 어느 하나에 해당하는 경우에는 통신판매업자의 의사에 반하여 제1항에 따른 청약철회등을 할 수 없다. 다만, 통신판매업자가 제6항에 따른 조치를 하지 아니하는 경우에는 제2호부터 제5호까지의 규정에 해당하는 경우에도 청약철회등을 할 수 있다.
> 1. 소비자에게 책임이 있는 사유로 재화등이 멸실되거나 훼손된 경우. …
> 2. 소비자의 사용 또는 일부 소비로 재화등의 가치가 현저히 감소한 경우
> 3. 시간이 지나 다시 판매하기 곤란할 정도로 재화등의 가치가 현저히 감소한 경우
> 4. 복제가 가능한 재화등의 포장을 훼손한 경우
> **5. 용역 또는 「문화산업진흥 기본법」 제2조제5호의 디지털콘텐츠의 제공이 개시된 경우. 다만, 가분적 용역 또는 가분적 디지털콘텐츠로 구성된 계약의 경우에는 제공이 개시되지 아니한 부분에 대하여는 그러하지 아니하다.**
> 6. 그 밖에 거래의 안전을 위하여 대통령령으로 정하는 경우
> ③ 소비자는 제1항 및 제2항에도 불구하고 재화등의 내용이 표시ㆍ광고의 내용과 다르거나 계약내용과 다르게 이행된 경우에는 그 재화등을 공급받은 날부터 3개월 이내, 그 사실을 안 날 또는 알 수 있었던 날부터 30일 이내에 청약철회등을 할 수 있다.
> ④ 제1항 또는 제3항에 따른 청약철회등을 서면으로 하는 경우에는 그 의사표시가 적힌 서면을 발송한 날에 그 효력이 발생한다.
> ⑤ … 재화등의 훼손에 대하여 소비자의 책임이 있는지 여부, 재화등의 구매에 관한 계약이 체결된 사실 및 그 시기, 재화등의 공급사실 및 그 시기 등에 관하여 다툼이 있는 경우에는 통신판매업자가 이를 증명하여야 한다.
> **⑥ 통신판매업자는 제2항제2호부터 제5호까지의 규정에 따라 청약철회등이 불가능한 재화등의 경우에는 그 사실을 재화등의 포장이나 그 밖에 소비자가 쉽게 알 수 있는 곳에 명확하게 표시하거나 시험 사용 상품을 제공하는 등의 방법으로 청약철회등의 권리 행사가 방해받지 아니하도록 조치하여야 한다.** 다만, 제2항제5호 중 디지털콘텐츠에 대하여 소비자가 청약철회등을 할 수 없는 경우에는 청약철회등이 불가능하다는 사실의 표시와 함께 대통령령으로 정하는 바에 따라 시험 사용 상품을 제공하는 등의 방법으로 청약철회등의 권리 행사가 방해받지 아니하도록 하여야 한다.

Note on the task's framing: the statute's ②5 exception is triggered by "제공이 개시된 경우" (provision has begun), conditioned by ⑥ (clear advance notice); the text does not itself contain a separate "with the consumer's consent" element for 용역 — the "서면 동의" element appears only in 시행령 제21조 for ②6 (made-to-order goods). The 가분적 용역 proviso preserves withdrawal for the not-yet-provided part.

시행령 제21조 (청약철회등의 제한): "법 제17조제2항제6호에서 “대통령령으로 정하는 경우”란 소비자의 주문에 따라 개별적으로 생산되는 재화등 또는 이와 유사한 재화등에 대하여 … 청약철회등을 인정하는 경우 통신판매업자에게 회복할 수 없는 중대한 피해가 예상되는 경우로서 사전에 해당 거래에 대하여 별도로 그 사실을 고지하고 소비자의 서면(전자문서를 포함한다)에 의한 동의를 받은 경우를 말한다."

### 제18조 (청약철회등의 효과)
> ① … 이미 공급받은 재화등을 반환하여야 한다. 다만, 이미 공급받은 재화등이 용역 또는 디지털콘텐츠인 경우에는 그러하지 아니하다.
> ② 통신판매업자…는 다음 각 호의 어느 하나에 해당하는 날부터 **3영업일 이내에 이미 지급받은 재화등의 대금을 환급하여야 한다.** 이 경우 통신판매업자가 소비자에게 재화등의 대금 환급을 지연한 때에는 그 지연기간에 대하여 연 100분의 40 이내의 범위에서 … 대통령령으로 정하는 이율을 곱하여 산정한 지연이자(이하 “지연배상금”이라 한다)를 지급하여야 한다.
> 1. 통신판매업자가 재화를 공급한 경우에는 제1항 본문에 따라 재화를 반환받은 날
> **2. 통신판매업자가 용역 또는 디지털콘텐츠를 공급한 경우에는 제17조제1항 또는 제3항에 따라 청약철회등을 한 날**
> 3. 통신판매업자가 재화등을 공급하지 아니한 경우에는 제17조제1항 또는 제3항에 따라 청약철회등을 한 날
> ③ 통신판매업자는 … 신용카드나 그 밖에 대통령령으로 정하는 결제수단으로 재화등의 대금을 지급한 경우에는 지체 없이 해당 결제수단을 제공한 사업자(이하 “결제업자”라 한다)에게 재화등의 대금 청구를 정지하거나 취소하도록 요청하여야 한다. 다만, 통신판매업자가 결제업자로부터 해당 재화등의 대금을 이미 받은 때에는 지체 없이 그 대금을 결제업자에게 환급하고, 그 사실을 소비자에게 알려야 한다.
> ⑧ 제1항의 경우 통신판매업자는 이미 재화등이 일부 사용되거나 일부 소비된 경우에는 그 재화등의 일부 사용 또는 일부 소비에 의하여 소비자가 얻은 이익 또는 그 재화등의 공급에 든 비용에 상당하는 금액으로서 대통령령으로 정하는 범위의 금액을 소비자에게 청구할 수 있다.
> **⑨ 제17조제1항에 따른 청약철회등의 경우 공급받은 재화등의 반환에 필요한 비용은 소비자가 부담하며, 통신판매업자는 소비자에게 청약철회등을 이유로 위약금이나 손해배상을 청구할 수 없다.**
> ⑩ 제17조제3항에 따른 청약철회등의 경우 재화등의 반환에 필요한 비용은 통신판매업자가 부담한다.

The 시행령 article defining the ⑧ "대통령령으로 정하는 범위" and the ② 지연배상금 rate were not extracted — **UNVERIFIED** (commonly cited as 시행령 제21조의2/제24조; verify before quoting numbers).

Digital/service contracts: the Act treats 용역 and 디지털콘텐츠 together in 제17조②5, 제17조⑥, 제18조①/②2 as quoted. No separate "digital service" chapter exists in this version.

---

## 4. 약관의 규제에 관한 법률 — 법률 제20239호, 시행 2024. 8. 7.

Source: https://www.law.go.kr/법령/약관의규제에관한법률 (lsiSeq=260021). Accessed 2026-10-23.

### 제3조 (약관의 작성 및 설명의무 등)
> ① 사업자는 고객이 약관의 내용을 쉽게 알 수 있도록 한글로 작성하고, 표준화ㆍ체계화된 용어를 사용하며, 약관의 중요한 내용을 부호, 색채, 굵고 큰 문자 등으로 명확하게 표시하여 알아보기 쉽게 약관을 작성하여야 한다.
> ② 사업자는 계약을 체결할 때에는 고객에게 약관의 내용을 계약의 종류에 따라 일반적으로 예상되는 방법으로 분명하게 밝히고, 고객이 요구할 경우 그 약관의 사본을 고객에게 내주어 고객이 약관의 내용을 알 수 있게 하여야 한다. …
> ③ 사업자는 약관에 정하여져 있는 중요한 내용을 고객이 이해할 수 있도록 설명하여야 한다. 다만, 계약의 성질상 설명하는 것이 현저하게 곤란한 경우에는 그러하지 아니하다.
> ④ 사업자가 제2항 및 제3항을 위반하여 계약을 체결한 경우에는 해당 약관을 계약의 내용으로 주장할 수 없다.

Product requirement: the Korean text of the 이용약관 is the authoritative one (①: 한글로 작성); an English translation for international students is additional. Important clauses (refund/cancellation, 국외 이전, liability) should be visually emphasised; the full terms must be viewable and downloadable at signup/checkout (②), and the refund clause should be surfaced/explained at checkout (③), or it cannot be relied upon (④).

### 제6조–제14조 (불공정약관)
- 제6조 ① "신의성실의 원칙을 위반하여 공정성을 잃은 약관 조항은 무효이다." ② presumption of unfairness for: 1. 고객에게 부당하게 불리한 조항 2. 고객이 … 예상하기 어려운 조항 3. 계약의 목적을 달성할 수 없을 정도로 계약에 따르는 본질적 권리를 제한하는 조항.
- 제7조 (면책조항의 금지): void — 1. excluding liability for 사업자의 고의 또는 중대한 과실; 2. 상당한 이유 없이 손해배상 범위 제한 또는 위험 전가; 3. 상당한 이유 없이 담보책임 배제·제한; 4. excluding liability for 표시된 품질ㆍ성능.
- **제8조 (손해배상액의 예정): "고객에게 부당하게 과중한 지연 손해금 등의 손해배상 의무를 부담시키는 약관 조항은 무효로 한다."**
- **제9조 (계약의 해제ㆍ해지): void — 1. 법률에 따른 고객의 해제권 또는 해지권을 배제하거나 그 행사를 제한하는 조항; 2. 사업자에게 법률에서 규정하고 있지 아니하는 해제권 또는 해지권을 부여하여 고객에게 부당하게 불이익을 줄 우려가 있는 조항; 3. 사업자의 해제·해지 요건 완화; 4. 계약의 해제 또는 해지로 인한 원상회복의무를 상당한 이유 없이 고객에게 과중하게 부담시키거나 고객의 원상회복 청구권을 부당하게 포기하도록 하는 조항; 5. 사업자의 원상회복의무나 손해배상의무를 부당하게 경감하는 조항; 6. (계속적 계약) 존속기간 부당 단기/장기, 묵시적 갱신.**
- 제10조 (채무의 이행): void — 1. 상당한 이유 없이 급부의 내용을 사업자가 일방적으로 결정하거나 변경; 2. 상당한 이유 없이 일방적 이행 중지 또는 제3자 대행.
- 제11조 (고객의 권익 보호): void — 1. excluding 항변권/상계권 without reason; 2. 기한의 이익 박탈; 3. restricting contracts with third parties; 4. permitting disclosure of 고객의 비밀.
- 제12조 (의사표시의 의제): deemed-declaration clauses void unless separately and clearly notified with a reasonable period; unduly strict form requirements void; deemed-receipt of 사업자 notices void.
- 제13조 (대리인의 책임 가중): void.
- 제14조 (소송 제기의 금지 등): void — 1. 고객에게 부당하게 불리한 소송 제기 금지 조항 또는 재판관할의 합의 조항; 2. 상당한 이유 없이 고객에게 입증책임을 부담시키는 조항.

Product requirement for the refund article: a cancellation-fee ladder is a "손해배상액의 예정" (제8조) and a restriction of the statutory 해제권 (제9조1) — it must not undercut 전자상거래법 제17조/제18조 rights, and any retained percentage must be justifiable as 소비자가 얻은 이익/공급에 든 비용 (전자상거래법 제18조⑧) rather than a penalty (제18조⑨). An exclusive foreign-forum clause would risk 제14조1.

---

## 5. 정보통신망법 제50조 — 법률 제21988호, 시행 2026. 10. 2.

Source: https://www.law.go.kr/법령/정보통신망이용촉진및정보보호등에관한법률 (lsiSeq=290001); 시행령 lsiSeq=290483. Accessed 2026-10-23.

> 제50조(영리목적의 광고성 정보 전송 제한) ① 누구든지 전자적 전송매체를 이용하여 영리목적의 광고성 정보를 전송하려면 그 수신자의 명시적인 사전 동의를 받아야 한다. 다만, 다음 각 호의 어느 하나에 해당하는 경우에는 사전 동의를 받지 아니한다.
> 1. 재화등의 거래관계를 통하여 수신자로부터 직접 연락처를 수집한 자가 대통령령으로 정한 기간 이내에 자신이 처리하고 수신자와 거래한 것과 같은 종류의 재화등에 대한 영리목적의 광고성 정보를 전송하려는 경우
> 2. (전화권유판매 — n/a)
> ② … 수신자가 수신거부의사를 표시하거나 사전 동의를 철회한 경우에는 영리목적의 광고성 정보를 전송하여서는 아니 된다.
> ③ 오후 9시부터 그 다음 날 오전 8시까지의 시간에 전자적 전송매체를 이용하여 영리목적의 광고성 정보를 전송하려는 자는 제1항에도 불구하고 그 수신자로부터 별도의 사전 동의를 받아야 한다. 다만, 대통령령으로 정하는 매체의 경우에는 그러하지 아니하다.
> ④ … 다음 각 호의 사항 등을 광고성 정보에 구체적으로 밝혀야 한다. 1. 전송자의 명칭 및 연락처 2. 수신의 거부 또는 수신동의의 철회 의사표시를 쉽게 할 수 있는 조치 및 방법에 관한 사항
> ⑤ … 하여서는 아니 된다. 1. 수신거부 또는 수신동의의 철회를 회피ㆍ방해하는 행위 2. (자동 생성 연락처) 3. (자동 등록) 4. 전송자의 신원이나 광고 전송 출처를 감추기 위한 각종 행위 5. 기망하여 회신을 유도하는 행위
> ⑥ … 수신거부나 수신동의의 철회를 할 때 발생하는 전화요금 등의 금전적 비용을 수신자가 부담하지 아니하도록 … 필요한 조치를 하여야 한다.
> ⑦ … 수신동의, 수신거부 또는 수신동의 철회에 대한 처리 결과를 알려야 한다.
> ⑧ 제1항 또는 제3항에 따라 수신동의를 받은 자는 대통령령으로 정하는 바에 따라 정기적으로 광고성 정보 수신자의 수신동의 여부를 확인하여야 한다.

시행령 (대통령령 제36728호, 시행 2026. 10. 2.):
- 제61조 ① "대통령령으로 정한 기간" (법 제50조①1) = 해당 재화등의 거래가 종료된 날부터 6개월. ② "대통령령으로 정하는 매체" (법 제50조③ 단서, night-time exemption) = **전자우편**. ③ what must be shown in the ad and how = 별표 6 (**UNVERIFIED** — 별표 file not retrieved; commonly includes the "(광고)" prefix rule; verify before implementing).
- 제62조: 수신거부/철회용 무료전화서비스 등 per 별표 6.
- 제62조의2: result of 동의/거부/철회 to be notified within 14일.
- 제62조의3: re-confirm consent 2년마다.

Application:
- Transactional messages (OTP codes, email verification links, order confirmation, 계약내용 서면) are not "영리목적의 광고성 정보" by their function; the statute regulates advertising. (No statutory definition of 광고성 정보 was fetched; the KISA 불법스팸 방지 안내서 which draws this line was not fetched — **UNVERIFIED** as to its current edition.)
- Marketing SMS requires a **separate explicit opt-in** (제50조①), and SMS sent 21:00–08:00 requires **a further separate consent** (제50조③) — e-mail is exempt from the night rule (시행령 제61조②). Marketing consent is also a separately identified PIPA consent (PIPA 제22조①7) and must be refusable without losing service (PIPA 제22조⑤).
- Every marketing SMS/email must carry 전송자 명칭·연락처 and a free opt-out path (제50조④, ⑥); opt-out must be honoured (②) and acknowledged within 14 days (시행령 제62조의2); consent re-confirmed every 2 years (시행령 제62조의3).

---

## 6. Vendor facts

### (a) Twilio Inc. — Programmable Messaging (SMS)

| Fact | Value | Source (accessed 2026-10-23) |
|---|---|---|
| Legal entity / address | Twilio Inc., 101 Spear Street, 5th Floor, San Francisco, CA 94105, USA (worldwide HQ). EEA entity: Twilio Ireland Limited, 78 Sir John Rogerson's Quay, Dublin 2, D02 R296. | Twilio Privacy Notice, last updated April 09, 2026 — https://www.twilio.com/en-us/legal/privacy |
| Contracting entity for a Korean customer | Twilio Inc. (Delaware) for any country not otherwise listed (Ireland Ltd covers EEA/UK/CH etc.; Japan/Mexico/Brazil have local entities; Korea not listed → Twilio Inc.). Governing law table assigns Asia-Pacific (ex-Japan) to Singapore law — read directly before relying. | Twilio Terms of Service, effective July 16, 2026 — https://www.twilio.com/en-us/legal/tos |
| Twilio's role for end-user data | "We process personal data as directed by our customers" (processor); "If Twilio processes your data as a data processor on behalf of a customer, we will direct you to contact our customer to exercise your rights." | Privacy Notice (above) |
| Processing location | "While our primary processing facilities are in the U.S., …" (Privacy Notice). Default Region: "Twilio's default Region (US1) is located in the eastern United States." "Twilio stores most data generated by a workload in the same Region where the workload is processed." Caveat: "Twilio doesn't guarantee that all data will remain within your selected Region." Programmable Messaging (SMS) is also listed as available in IE1 (Ireland); not in AU1. | https://www.twilio.com/docs/global-infrastructure/understanding-twilio-regions (updated 2026-09-02); https://www.twilio.com/docs/global-infrastructure (2026-03-09); https://www.twilio.com/docs/global-infrastructure/regional-product-and-feature-availability (2026-10-08) |
| Sub-processors / hosting | AWS — "core cloud hosting and data storage for all services; USA*, EU, AU" (* with Regional Twilio, Customer Content is stored/processed in the selected region (Ireland or Australia)); "All other account data is processed in the United States." Adaptive Mobile (ENEA) — message safety/spam filtering, USA. Page last updated September 2026. | https://www.twilio.com/en-us/legal/sub-processors |
| DPA | Twilio Data Protection Addendum, Last Updated April 9, 2026; transfer mechanisms listed (DPF, BCRs, EU SCCs, UK IDTA, Brazil SCCs, Global CBPR/PRP); Korea not mentioned. | https://www.twilio.com/en-us/legal/data-protection-addendum |
| Message log retention | Changelog (Oct. 14, 2020): message logs in Console and /Messages API display "for thirteen months after the message is created"; shown as a Data Access Policy Setting of "400 days"; older records are backed up and retrievable via Bulk Export (media older than 13 months excluded). Twilio's support article "Twilio SMS message and traffic storage" (223181008) returned HTTP 403 to automated fetch — its text (incl. the configurable 7–400 day range cited in Twilio's 2020 blog "New Data Controls with Twilio Messaging") is **UNVERIFIED from primary**; verify in Console → Messaging → Settings. | https://www.twilio.com/en-us/changelog/messaging-data-availability-updated-to-13-months ; (403) https://support.twilio.com/hc/en-us/articles/223181008-Twilio-SMS-message-and-traffic-storage ; blog https://www.twilio.com/en-us/blog/new-data-controls-twilio-messaging |
| Redaction options | Message Redaction (docs updated 2026-08-20): body redaction removes the body from Console, APIs, internal support systems; phone number redaction masks the last four digits of non-Twilio-owned numbers as "XXXX". Enable account-wide in Console → Messaging → Settings → General → Message Redaction, or per message via `ContentRetention=discard` / `AddressRetention=obfuscate`. "Twilio maintains production access to messaging data for up to 24 hours", then limited-access storage for compliance. Caveats: incompatible with Studio/Flex/Conversations; Sticky Sender must be off; set webhooks to POST (GET params logged up to 7 days); inbound media deleted after 24 h. | https://www.twilio.com/docs/messaging/guides/privacy-message-redaction |
| Privacy contact | privacy@twilio.com; form https://www.twilio.com/en-us/help/privacy | Privacy Notice |

### (b) Twilio SendGrid (email)

| Fact | Value | Source (accessed 2026-10-23) |
|---|---|---|
| Legal entity | Twilio Inc. (same as above). sendgrid.com/en-us/policies/privacy and /policies/tos both 301-redirect to https://www.twilio.com/en-us/sendgrid; the Twilio Privacy Notice carries a SendGrid-specific notice ("The SendGrid Services also collect additional data through web beacons placed in the body of emails."). | https://sendgrid.com/en-us/policies/privacy (redirect observed); https://www.twilio.com/en-us/legal/privacy |
| Where email activity / recipient data is processed | "Twilio stores all Email Activity data in the United States." (docs updated 2026-01-22). Sub-processor list: AWS (Email, SendGrid) — routes/transmits email, USA, EU; Clickhouse — hosting/data storage, USA, EU; group hosting DataBank, Lumen (North America), Digital Realty (North America/EU). | https://www.twilio.com/docs/sendgrid/ui/analytics-and-reporting/email-activity-feed ; https://www.twilio.com/en-us/legal/sub-processors |
| Retention of recipient addresses / activity | "email message bodies are retained temporarily"; "most other personal data, including email recipient data, is kept for a maximum of 37 days"; "Events related to sent emails are stored for up to a year for security and fraud detection purposes" / "some email event data in pseudonymized form for up to a year"; random content samples may be held 7 days; Customer Account Data typically deleted 60 days after account closure. Email Activity Feed retains events up to 30 days with the Email Activity history add-on (default window not stated on that page). | https://support.sendgrid.com/hc/en-us/articles/18017175645595-Requesting-account-data-deletion ; email-activity-feed docs (above). Twilio's consolidated article "Data Retention and Deletion in Twilio Products" (4410585868443) returned HTTP 403 — not independently read. |
| DPA | Twilio Data Protection Addendum (April 9, 2026) — same URL as (a). | https://www.twilio.com/en-us/legal/data-protection-addendum |

### (c) Cloudflare Turnstile

| Fact | Value | Source (accessed 2026-10-23) |
|---|---|---|
| Legal entity / address | Cloudflare, Inc., 101 Townsend St., San Francisco, CA 94107, USA. | Cloudflare Privacy Policy, effective November 4, 2025 — https://www.cloudflare.com/privacypolicy/ ; Cloudflare DPA v6.4 (April 3, 2026) — https://www.cloudflare.com/cloudflare-customer-dpa/ |
| Data collected from end users ("Signals") | "client IP address, TLS Fingerprint, User-Agent Header and Sitekey and associated origin". "Cloudflare does not have the ability to directly identify any individuals". Roles: "Cloudflare is a data processor of Signals that we process to provide the Turnstile service to our customers"; "Cloudflare is a data controller of Signals that we process to improve Turnstile's bot detection capabilities." Last updated JUNE 18, 2025. Cookies: addendum points to Cloudflare's Cookie Policy; Turnstile docs mention an optional Pre-Clearance cookie. | https://www.cloudflare.com/turnstile-privacy-policy/ ; https://developers.cloudflare.com/turnstile/frequently-asked-questions/ (2026-08-14) |
| Docs statements | Turnstile "processes only the data strictly necessary to provide this security function" and "does not access, store, or transmit user communications, form entries, or other page inputs"; "can be embedded into any website without sending traffic through Cloudflare" (i.e., the site itself need not be proxied; the widget/challenge still talks to challenges.cloudflare.com). | https://developers.cloudflare.com/turnstile/ (2026-08-14) |
| Server-side validation | `POST https://challenges.cloudflare.com/turnstile/v0/siteverify` with `secret`, `response`; `remoteip` optional; `idempotency_key` optional; token valid 300 s, single-use (`timeout-or-duplicate`). (Sending `remoteip` means Hangyul transmits the user's IP to Cloudflare itself.) | https://developers.cloudflare.com/turnstile/get-started/server-side-validation/ (2026-10-22) |
| Processing location | **UNVERIFIED for Turnstile specifically.** Addendum states no location. Cloudflare Privacy Policy: "We primarily store your information in the United States and the European Economic Area"; Cloudflare "may transfer and access information from countries where its group operates". DPA 6.1: Cloudflare and sub-processors may process outside EEA/CH/UK. | privacy policy / DPA (above) |
| Retention | **UNVERIFIED** — not stated in the Turnstile addendum or docs read. | — |
| Sub-processors | Cloudflare Services sub-processor list (Last Updated October 1, 2025) lists affiliates incl. Cloudflare Korea LLC (South Korea), and third parties (Zendesk, Salesforce, Google, Oracle, AWS, …) — none Turnstile-specific. | https://www.cloudflare.com/gdpr/subprocessors/cloudflare-services/ |
| Privacy contact | dpo@cloudflare.com (DPO); privacyquestions@cloudflare.com; sar@cloudflare.com (rights requests). DPA Annex 1: DPO Emily Hancock, legal@cloudflare.com. | privacy policy; DPA |
| **Test keys (development)** | Sitekeys: `1x00000000000000000000AA` always passes (visible); `2x00000000000000000000AB` always fails (visible); `1x00000000000000000000BB` always passes (invisible); `2x00000000000000000000BB` always fails (invisible); `3x00000000000000000000FF` forces an interactive challenge (visible). Secret keys: `1x0000000000000000000000000000000AA` always passes siteverify; `2x0000000000000000000000000000000AA` always fails; `3x0000000000000000000000000000000AA` yields a "token already spent" error (`timeout-or-duplicate`). Page last updated Oct 20, 2026. | https://developers.cloudflare.com/turnstile/troubleshooting/testing/ |

---

## 7. 국외 이전 disclosure table (PIPA 제28조의8② items) per vendor

| 제28조의8② item | Twilio Programmable Messaging (SMS OTP) | Twilio SendGrid (email verification / transactional mail) | Cloudflare Turnstile |
|---|---|---|---|
| 국외 이전의 법적 근거 (시행령 제31조①2) | 제28조의8①3 (계약 체결·이행을 위한 처리위탁) via 처리방침 공개 — or ①1 별도 동의 (owner decision; see §8) | same | same |
| 1. 이전되는 개인정보 항목 | 휴대전화번호, 인증번호(SMS 본문), 발송·수신 시각, 전송 결과(메시지 로그) | 이메일 주소, 인증 링크/코드 및 메일 본문(일시 보관), 발송·수신 이벤트(열람·클릭 등 이벤트 로그) | 접속 IP 주소, TLS 핑거프린트, User-Agent(브라우저 정보), 사이트키·접속 도메인 (Cloudflare "Signals"); 서버 검증 시 `remoteip`를 전송하면 IP가 Hangyul→Cloudflare로도 전달됨 |
| 2. 이전되는 국가 | 미국 (default Region US1, eastern United States; sub-processor AWS "USA*", ENEA USA). Twilio does not guarantee all data stays in a Region. If IE1 is chosen instead: 아일랜드 — not the default. | 미국 ("Twilio stores all Email Activity data in the United States"); sub-processors AWS/Clickhouse listed USA, EU — so 미국 and possibly EU; list all (PIPC guide). | **UNVERIFIED** for Turnstile; Cloudflare Privacy Policy: primarily United States and EEA. State "미국 등 Cloudflare 글로벌 네트워크" only if owner accepts; otherwise obtain written confirmation from Cloudflare. |
| 2. 이전 시기 | 인증번호 발송 요청 시마다 (회원가입·로그인 시) | 인증 메일/거래 메일 발송 시마다 | 회원가입(및 Turnstile 적용 폼) 접속·검증 시마다 |
| 2. 이전 방법 | 정보통신망을 통한 암호화(TLS) API 전송 | 정보통신망을 통한 암호화(TLS) API 전송 | 이용자 브라우저가 Cloudflare 챌린지 서버(challenges.cloudflare.com)와 직접 통신; Hangyul 서버는 siteverify API로 토큰(및 선택적 IP) 전송 |
| 3. 이전받는 자의 명칭 및 연락처 | Twilio Inc., 101 Spear Street, 5th Floor, San Francisco, CA 94105, USA; privacy@twilio.com | Twilio Inc. (Twilio SendGrid), same address; privacy@twilio.com | Cloudflare, Inc., 101 Townsend St., San Francisco, CA 94107, USA; dpo@cloudflare.com / privacyquestions@cloudflare.com |
| 4. 이용목적 | 휴대전화 본인확인용 인증번호(OTP) 발송 (수탁 업무) | 이메일 인증 및 거래 관련 메일 발송 (수탁 업무) | 자동화 봇 차단 및 가입 보호 (수탁 업무); Cloudflare는 봇 탐지 개선 목적으로는 controller |
| 4. 보유·이용 기간 | 메시지 로그: 생성 후 기본 13개월(400일) Console/API 노출, 이후 백업(Bulk Export) 보관 — 단축 가능(Console 설정; 범위 UNVERIFIED from primary). 리댁션 적용 시 프로덕션 접근 24시간, 이후 제한적 컴플라이언스 보관. 메일 본문·번호 리댁션 설정 권장. | 메일 본문: 발송에 필요한 기간만 일시 보관; 수신자 데이터 등 대부분의 개인정보 최대 37일; 이벤트 데이터(익명/가명화) 최대 1년; Email Activity Feed 최대 30일(add-on) | **UNVERIFIED** (Cloudflare does not publish a Turnstile-specific retention period) |
| 5. 이전 거부 방법·절차 및 효과 | 국외 이전을 원치 않을 경우 가입 중단/회원 탈퇴 (고객센터 이메일·전화) — PIPC guide example wording: "국외 이전을 거부할 경우 서비스 이용이 불가능합니다." Effect: SMS 인증 불가 → 가입/구매 불가 (휴대전화 인증이 필수인 경우). Owner may alternatively offer an email-only path to soften the effect. | same; effect: 이메일 인증 불가 → 가입 불가 | same; effect: 가입 폼 제출 불가 |

---

## 8. What this means for the signup consent screen (reading of the texts)

Minimum separately identifiable items (PIPA 제22조① "각각의 동의 사항을 구분"; 시행령 제17조④ "동의 여부를 선택할 수 있다는 사실을 명확하게"):

Required (service cannot be provided without them):
1. **이용약관 동의** — 약관법 제3조②③ (명시·설명); 전자상거래법 제13조②9 (약관 and how to view it). Must be viewable in full and downloadable; important terms emphasised (제3조①).
2. **개인정보 수집·이용 (필수)** — items: 이름(if collected), 이메일, 휴대전화번호, 인증 기록; purposes: 회원 식별·본인확인, 계약 체결·이행·결제·고객응대; retention period; 거부권 및 불이익 (PIPA 제15조② 1–4). Alternative under the text: rely on 제15조①4 (계약 이행) without a consent checkbox, in which case 제22조③ requires that these items and the legal basis be published in the 처리방침 separately from consent-based items, with the burden of proof on Hangyul. The PIPC 2026 guide explicitly distinguishes 계약 체결·이행 items from consent items (revision summary) — either design is within the text; mixing both for the same item is what the text prohibits (구분).
3. **개인정보 국외 이전** — see below; whether this is a checkbox or a disclosure depends on the basis chosen.

Optional (declining must not block signup or purchase — PIPA 제22조⑤, 제16조③):
4. **마케팅 정보 수신 동의** (PIPA 제22조①7) — separate checkbox, with channel granularity (이메일 / SMS) advisable because 정보통신망법 제50조① requires 명시적 사전 동의 per 전자적 전송매체 and 시행령 제17조③1 requires emphasising the fact that contact details will be used for 홍보·판매 권유.
5. **야간(21:00–08:00) 광고성 SMS 수신 동의** — a further separate consent (정보통신망법 제50조③); e-mail is exempt (시행령 제61조②). Only needed if night-time SMS marketing is ever intended.
6. Any **선택 수집 항목** (e.g., 국적, 희망 학교) — separate optional consent (PIPA 제16조②③).

Age gate: 만 14세 미만 requires 법정대리인 동의 (PIPA 제22조의2①); 전자상거래법 제13조③ requires notifying minors that the contract can be cancelled absent 법정대리인 consent.

국외 이전 for identity verification — consent or another basis? The current text (제28조의8①, 법률 제21445호) reads:

> "다만, 다음 각 호의 어느 하나에 해당하는 경우에는 개인정보를 국외로 이전할 수 있다. 1. 정보주체로부터 국외 이전에 관한 별도의 동의를 받은 경우 … 3. 정보주체와의 계약의 체결 및 이행을 위하여 개인정보의 처리위탁ㆍ보관이 필요한 경우로서 다음 각 목의 어느 하나에 해당하는 경우 가. 제2항 각 호의 사항을 제30조에 따른 개인정보 처리방침에 공개한 경우 나. 전자우편 등 대통령령으로 정하는 방법에 따라 제2항 각 호의 사항을 정보주체에게 알린 경우"

So, on the text: sending the phone number/email to Twilio and the Turnstile signals to Cloudflare is 처리위탁 (the vendors act as processors per their own notices). If that outsourcing is "정보주체와의 계약의 체결 및 이행을 위하여 … 필요한", ①3 applies and **no separate consent is required**, provided all five ② items (plus the legal basis, 시행령 제31조①2) are published in the 처리방침 (가) or notified by 서면등의 방법 incl. 전자우편/문자 (나, 시행령 제29조의7). The PIPC 2026 guide's 작성 예시1 models exactly this ("제28조의8제1항제3호('계약 이행을 위한 국외 처리위탁·보관')"). If instead consent (①1) is used, the five items must be shown "미리" on the consent screen (②), any change needs fresh consent (③), and under 제22조⑤ a *refused* separate consent must not be used as grounds to refuse service unless the item is genuinely non-optional — which is why the PIPC example phrases the refusal effect as "서비스 이용이 불가능합니다" tied to withdrawal. Whether Hangyul's verification outsourcing is "필요한" for contract performance is a factual/legal judgment the text leaves to the controller; this document does not opine beyond the quoted text. Either way, 제28조의8④/시행령 제29조의10 require 안전조치, 고충처리·분쟁해결 arrangements agreed with the recipient "계약내용 등에 반영" (the Twilio DPA and Cloudflare DPA are the instruments to reference), and 제26조② requires the 수탁자 list on the website regardless.

Turnstile nuance: the end user's browser sends Signals directly to Cloudflare before any account exists. The 처리방침 (route 가) is therefore the practical vehicle; a link to the 처리방침 and a short notice next to the widget satisfies "공개" as the text requires nothing more specific. Not sending `remoteip` in siteverify limits what Hangyul itself transfers.

---

## 9. What this means for the refund/cancellation article

Statements that can be made now, directly from statute, without an owner-approved percentage ladder:

1. **7-day 청약철회** — "회원은 계약내용에 관한 서면(주문 확인 메일)을 받은 날부터 7일 이내에 청약철회를 할 수 있으며, 서비스 제공이 그보다 늦게 시작된 경우 제공이 시작된 날부터 7일 이내에 할 수 있습니다." (전자상거래법 제17조①1). A longer period may be granted by contract (①: "거래당사자가 … 긴 기간으로 약정한 경우에는 그 기간").
2. **Exception once service has begun** — may be stated only if the notice duty is honoured: "서비스(용역)의 제공이 개시된 경우에는 청약철회가 제한될 수 있습니다. 다만, 플랜이 가분적 용역으로 구성된 경우 제공이 개시되지 아니한 부분에 대하여는 청약철회가 가능합니다." (제17조②5) **and** this fact must be clearly displayed where the consumer can easily see it before purchase (제17조⑥); if not displayed, the exception cannot be invoked (제17조② 단서). The exception is about commencement + clear notice; the text does not add a consent element for 용역 (the 서면 동의 element exists only for 시행령 제21조 made-to-order goods).
3. **Non-conformity withdrawal** — "서비스 내용이 표시·광고 내용과 다르거나 계약내용과 다르게 이행된 경우 공급받은 날부터 3개월 이내, 그 사실을 안 날 또는 알 수 있었던 날부터 30일 이내에 청약철회할 수 있습니다." (제17조③); return cost on the seller (제18조⑩).
4. **Written withdrawal takes effect on dispatch** (제17조④) — accept e-mail/in-app withdrawal and record the timestamp; burden of proof on seller (제17조⑤).
5. **Refund timing** — "청약철회 시 회사는 청약철회를 한 날부터 3영업일 이내에 대금을 환급합니다; 지연 시 법정 지연배상금을 지급합니다." (제18조②2 for 용역; rate per 시행령 — UNVERIFIED number, so cite "법령이 정한 이율" rather than a figure). Card payments: request the 결제업자 to stop/cancel the charge 지체 없이 (제18조③) — relevant for the foreign-card key-in flow.
6. **No penalty for statutory withdrawal** — "제17조제1항에 따른 청약철회의 경우 회사는 위약금이나 손해배상을 청구하지 않습니다." (제18조⑨). Any deduction for partially consumed service must be framed as the 소비자가 얻은 이익 또는 공급에 든 비용 within the 시행령 range (제18조⑧) — the range itself is UNVERIFIED here, so do not publish a percentage until the owner approves and the 시행령 figure is checked.
7. **Terms-law guardrails** — the article must not exclude or restrict statutory 해제·해지 rights (약관법 제9조1), impose an excessive 손해배상 예정 (제8조), or shift 원상회복 unreasonably (제9조4); any such clause is void, and if the clause was not 명시·설명 at checkout it cannot be asserted at all (제3조④).
8. **Pre-contract disclosure hook** — the 청약철회 기한·행사방법·효과 and the refund/indemnity conditions must appear before purchase and in the 계약내용 서면 (제13조②5, ②6), so the same article text should be reused in the checkout summary and the confirmation e-mail (which is what SendGrid will deliver).

Items deliberately left open for the owner: the post-7-day refund ladder (percent retained per consultation delivered), whether plans are defined as 가분적 용역 (e.g., per-session units — this definition determines how much of ②5 bites), and the escrow/보험 option for 선지급식 sales (제13조②10 / 제24조).

---

## URLs used (all accessed 2026-10-23)

Statutes (국가법령정보센터):
- https://www.law.go.kr/법령/개인정보보호법 → https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=283839&efYd=20260911
- https://www.law.go.kr/법령/개인정보보호법시행령 → lsiSeq=289537
- https://www.law.go.kr/법령/전자상거래등에서의소비자보호에관한법률 → lsiSeq=282793
- https://www.law.go.kr/법령/전자상거래등에서의소비자보호에관한법률시행령 → lsiSeq=288143
- https://www.law.go.kr/법령/약관의규제에관한법률 → lsiSeq=260021
- https://www.law.go.kr/법령/정보통신망이용촉진및정보보호등에관한법률 → lsiSeq=290001
- https://www.law.go.kr/법령/정보통신망이용촉진및정보보호등에관한법률시행령 → lsiSeq=290483 (별표 6 not retrieved)

PIPC:
- https://pipc.go.kr/np/cop/bbs/selectBoardArticle.do?bbsId=BS217&mCode=D010030000&nttId=12018 (개인정보 처리방침 작성지침, 2026.4. 개정, PDF attachment FILE_000000000560753)
- https://www.pipc.go.kr/np/cop/bbs/selectBoardArticle.do?bbsId=BS217&mCode=D010030000&nttId=11134 (2025.4. version, superseded)

Twilio / SendGrid:
- https://www.twilio.com/en-us/legal/privacy
- https://www.twilio.com/en-us/legal/tos
- https://www.twilio.com/en-us/legal/data-protection-addendum
- https://www.twilio.com/en-us/legal/sub-processors
- https://www.twilio.com/docs/global-infrastructure
- https://www.twilio.com/docs/global-infrastructure/understanding-twilio-regions
- https://www.twilio.com/docs/global-infrastructure/regional-product-and-feature-availability
- https://www.twilio.com/docs/messaging/guides/privacy-message-redaction
- https://www.twilio.com/en-us/changelog/messaging-data-availability-updated-to-13-months
- https://www.twilio.com/en-us/blog/new-data-controls-twilio-messaging (secondary, Twilio-authored)
- https://support.twilio.com/hc/en-us/articles/223181008-Twilio-SMS-message-and-traffic-storage (HTTP 403 — not read)
- https://support.twilio.com/hc/en-us/articles/4410585868443-Data-Retention-and-Deletion-in-Twilio-Products (HTTP 403 — not read)
- https://sendgrid.com/en-us/policies/privacy and https://sendgrid.com/en-us/policies/tos (301 → https://www.twilio.com/en-us/sendgrid)
- https://www.twilio.com/docs/sendgrid/ui/analytics-and-reporting/email-activity-feed
- https://support.sendgrid.com/hc/en-us/articles/18017175645595-Requesting-account-data-deletion

Cloudflare:
- https://www.cloudflare.com/turnstile-privacy-policy/
- https://www.cloudflare.com/privacypolicy/
- https://www.cloudflare.com/cloudflare-customer-dpa/
- https://www.cloudflare.com/gdpr/subprocessors/ and https://www.cloudflare.com/gdpr/subprocessors/cloudflare-services/
- https://developers.cloudflare.com/turnstile/
- https://developers.cloudflare.com/turnstile/frequently-asked-questions/
- https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
- https://developers.cloudflare.com/turnstile/troubleshooting/testing/
