"""Every outgoing identity message — verification emails and SMS — in one place.

Rules (docs/I18N_GLOSSARY.md, brief §8):
- Say why the person received the message and what to do next. Student messages are warm and second person; the
  administrator invitation is concise and operational.
- A code appears in the **body only**, never in a subject line (subjects show up in notifications, inbox lists and
  provider logs).
- SMS carries the brand, the purpose, the code, the validity and a do-not-share line — never an email address,
  a password or a name.
- Vocabulary: "sign up" / "sign in" (회원가입 / 로그인); never "log in" or "register".

Email is written in Korean and English; any other locale receives English. SMS is written in every locale the
sign-up screens offer.
"""
from __future__ import annotations

from html import escape

from app.core.config import get_settings

# ------------------------------------------------------------------------------------------------ email
# Each kind: subject, heading, intro (why you received this + what to do), whether the code block is shown, the lines
# after it (validity / what happens next), and the "didn't ask for this" line. `{org}` is the inviting organisation.
_EMAIL: dict[str, dict[str, dict]] = {
    "en": {
        "signup": {
            "subject": "Your Hangyul Univ sign-up code",
            "heading": "Confirm your email address",
            "intro": "You're signing up for Hangyul Univ with this email address. Enter this code on the sign-up screen to confirm it's yours:",
            "code": True,
            "after": ["The code expires in 5 minutes. If it does, you can request a new one on the same screen."],
            "ignore": "Didn't try to sign up? You can ignore this email. No account is created without this code.",
        },
        "contact_email": {
            "subject": "Confirm your new Hangyul Univ email address",
            "heading": "Confirm your new email address",
            "intro": "You asked to change the email address on your Hangyul Univ account to this one. Enter this code on the screen where you made the request:",
            "code": True,
            "after": ["The code expires in 5 minutes. Until you confirm, your account keeps its current email address."],
            "ignore": "Didn't ask for this? You can ignore this email. Nothing will change.",
        },
        "reset": {
            "subject": "Reset your Hangyul Univ password",
            "heading": "Reset your password",
            "intro": "We received a request to reset the password for the Hangyul Univ account that uses this email address. Enter this code on the password reset screen, then choose a new password:",
            "code": True,
            "after": ["The code expires in 5 minutes. Once your password is changed, you'll be signed out on every device. Sign in again with your new password."],
            "ignore": "Didn't ask to reset your password? You can ignore this email. Your password stays the same.",
        },
        "invite": {
            "subject": "You're invited to {org} on Hangyul Univ",
            "subject_no_org": "You're invited to the Hangyul Univ console",
            "heading": "Set up your administrator account",
            "intro": "{org} has added you as an administrator in the Hangyul Univ console. Use this code to set your password and activate your account:",
            "intro_no_org": "You've been added as an administrator in the Hangyul Univ console. Use this code to set your password and activate your account:",
            "code": True,
            "after": ["The code expires in 5 minutes. If it does, ask the person who invited you to send a new invitation."],
            "ignore": "Weren't expecting this? You can ignore this email. No one can sign in to this account until a password is set.",
        },
        "exists_signup": {
            "subject": "You already have a Hangyul Univ account",
            "heading": "You already have an account",
            "intro": "Someone just tried to sign up for Hangyul Univ with this email address, but it already belongs to an account. No new account was created, and nothing in your account has changed.",
            "code": False,
            "after": ["If that was you, sign in instead.{login}", "Forgot your password? You can reset it.{forgot}"],
            "ignore": "If it wasn't you, you can ignore this email. No one can sign in to your account without your password.",
        },
        "exists_contact": {
            "subject": "Your email address is already in use on Hangyul Univ",
            "heading": "This email address is already in use",
            "intro": "Someone signed in to another Hangyul Univ account tried to change its email address to this one. Because this address already belongs to your account, the change wasn't made, and nothing in your account has changed.",
            "code": False,
            "after": ["If you were trying to move this email address to another account, sign in to this account first and change its email address there.{login}"],
            "ignore": "If you don't recognize this, no action is needed.",
        },
    },
    "ko": {
        "signup": {
            "subject": "Hangyul Univ 회원가입 인증번호 안내",
            "heading": "이메일 주소를 인증해 주세요",
            "intro": "이 이메일 주소로 Hangyul Univ 회원가입을 진행하고 계십니다. 회원가입 화면에 아래 인증번호를 입력하면 이메일 인증이 완료됩니다.",
            "code": True,
            "after": ["인증번호는 5분 동안 유효합니다. 시간이 지나면 같은 화면에서 새 인증번호를 받으실 수 있습니다."],
            "ignore": "회원가입을 요청하지 않으셨다면 이 메일을 무시하셔도 됩니다. 인증번호 없이는 계정이 만들어지지 않습니다.",
        },
        "contact_email": {
            "subject": "Hangyul Univ 이메일 주소 변경 인증번호 안내",
            "heading": "새 이메일 주소를 인증해 주세요",
            "intro": "Hangyul Univ 계정의 이메일 주소를 이 주소로 바꾸는 요청이 접수되었습니다. 변경을 요청하신 화면에 아래 인증번호를 입력해 주세요.",
            "code": True,
            "after": ["인증번호는 5분 동안 유효합니다. 인증을 마치기 전까지는 기존 이메일 주소가 그대로 유지됩니다."],
            "ignore": "요청하신 적이 없다면 이 메일을 무시하셔도 됩니다. 아무것도 변경되지 않습니다.",
        },
        "reset": {
            "subject": "Hangyul Univ 비밀번호 재설정 안내",
            "heading": "비밀번호를 재설정해 주세요",
            "intro": "이 이메일 주소를 사용하는 Hangyul Univ 계정의 비밀번호 재설정 요청이 접수되었습니다. 비밀번호 재설정 화면에 아래 인증번호를 입력한 뒤 새 비밀번호를 정해 주세요.",
            "code": True,
            "after": ["인증번호는 5분 동안 유효합니다. 비밀번호가 바뀌면 모든 기기에서 로그아웃되니, 새 비밀번호로 다시 로그인해 주세요."],
            "ignore": "비밀번호 재설정을 요청하지 않으셨다면 이 메일을 무시하셔도 됩니다. 비밀번호는 바뀌지 않습니다.",
        },
        "invite": {
            "subject": "{org} 관리자 계정 초대 안내 (Hangyul Univ)",
            "subject_no_org": "Hangyul Univ 콘솔 관리자 계정 초대 안내",
            "heading": "관리자 계정을 설정해 주세요",
            "intro": "{org}에서 회원님을 Hangyul Univ 콘솔 관리자로 초대했습니다. 아래 인증번호로 비밀번호를 설정하면 계정을 사용하실 수 있습니다.",
            "intro_no_org": "Hangyul Univ 콘솔 관리자로 초대되었습니다. 아래 인증번호로 비밀번호를 설정하면 계정을 사용하실 수 있습니다.",
            "code": True,
            "after": ["인증번호는 5분 동안 유효합니다. 시간이 지났다면 초대한 담당자에게 초대를 다시 보내 달라고 요청해 주세요."],
            "ignore": "초대를 예상하지 못하셨다면 이 메일을 무시하셔도 됩니다. 비밀번호가 설정되기 전에는 누구도 이 계정으로 로그인할 수 없습니다.",
        },
        "exists_signup": {
            "subject": "이미 가입된 Hangyul Univ 계정이 있습니다",
            "heading": "이미 가입된 계정이 있습니다",
            "intro": "방금 이 이메일 주소로 Hangyul Univ 회원가입이 시도되었지만, 이 주소로 가입된 계정이 이미 있습니다. 새 계정은 만들어지지 않았고, 기존 계정에도 바뀐 내용은 없습니다.",
            "code": False,
            "after": ["본인이 시도하셨다면 회원가입 대신 로그인해 주세요.{login}", "비밀번호가 기억나지 않으면 재설정하실 수 있습니다.{forgot}"],
            "ignore": "본인이 시도하지 않으셨다면 이 메일을 무시하셔도 됩니다. 비밀번호 없이는 누구도 회원님 계정에 로그인할 수 없습니다.",
        },
        "exists_contact": {
            "subject": "Hangyul Univ에서 이미 사용 중인 이메일 주소입니다",
            "heading": "이미 사용 중인 이메일 주소입니다",
            "intro": "다른 Hangyul Univ 계정에서 이메일 주소를 이 주소로 바꾸려는 시도가 있었습니다. 이 주소는 이미 회원님 계정에서 사용 중이므로 변경되지 않았고, 회원님 계정에도 바뀐 내용은 없습니다.",
            "code": False,
            "after": ["이 주소를 다른 계정으로 옮기시려던 것이라면, 먼저 이 계정에 로그인해 이메일 주소를 바꿔 주세요.{login}"],
            "ignore": "본인이 시도하지 않으셨다면 따로 하실 일은 없습니다.",
        },
    },
}

#: The safety line under every message that carries a code.
_NEVER_ASK = {"en": "Hangyul will never ask you for this code by phone, chat or email. Don't share it with anyone.",
              "ko": "한귤은 전화, 채팅, 이메일로 인증번호를 묻지 않습니다. 누구에게도 알려주지 마세요."}


def email_kind(purpose: str, already_registered: bool) -> str:
    if already_registered:
        return "exists_contact" if purpose == "CONTACT_EMAIL" else "exists_signup"
    return {"SIGNUP_EMAIL": "signup", "CONTACT_EMAIL": "contact_email", "PASSWORD_RESET": "reset", "INVITE": "invite"}[purpose]


def _links() -> dict[str, str]:
    base = (get_settings().student_app_url or "").rstrip("/")
    return {"login": f"{base}/login", "forgot": f"{base}/forgot"} if base else {}


def email_content(purpose: str, code: str, locale: str, already_registered: bool, context: dict | None = None) -> tuple[str, str, str]:
    """(subject, plain text, html) for one verification email. The code is in the body only."""
    lang = "ko" if (locale or "").startswith("ko") else "en"
    kind = email_kind(purpose, already_registered)
    m = _EMAIL[lang][kind]
    org = ((context or {}).get("organization") or "").strip()
    subject = m["subject"].format(org=org) if org or "subject_no_org" not in m else m["subject_no_org"]
    intro = m["intro"].format(org=org) if org or "intro_no_org" not in m else m["intro_no_org"]
    links = _links()

    # `after` lines may end in {login}/{forgot}: a link when HG_STUDENT_APP_URL is set, nothing otherwise.
    after: list[tuple[str, str | None]] = []
    for line in m["after"]:
        url = next((links.get(k) for k in ("login", "forgot") if "{" + k + "}" in line), None)
        after.append((line.replace("{login}", "").replace("{forgot}", ""), url))

    text_parts = [m["heading"], "", intro]
    if m["code"]:
        text_parts += ["", f"    {code}", ""]
    text_parts += [f"{line} {url}" if url else line for line, url in after]
    text_parts += ["", m["ignore"]]
    if m["code"]:
        text_parts.append(_NEVER_ASK[lang])
    text_parts += ["", "— Hangyul Univ"]
    text = "\n".join(text_parts)

    p = 'style="margin:0 0 14px;line-height:1.6"'
    small = 'style="margin:0 0 10px;line-height:1.6;color:#6b6b6b;font-size:13px"'
    html_parts = [
        '<div style="font-family:Pretendard,\'Apple SD Gothic Neo\',\'Segoe UI\',sans-serif;color:#282828;max-width:520px;font-size:15px;word-break:keep-all;overflow-wrap:anywhere">',
        '<p style="color:#FF6700;font-weight:700;margin:0 0 20px">Hangyul Univ</p>',
        f'<h1 style="font-size:20px;line-height:1.4;margin:0 0 14px">{escape(m["heading"])}</h1>',
        f"<p {p}>{escape(intro)}</p>",
    ]
    if m["code"]:
        html_parts.append('<p style="font-size:30px;letter-spacing:8px;font-weight:700;margin:8px 0 20px;'
                          f'font-family:ui-monospace,Menlo,Consolas,monospace">{escape(code)}</p>')
    for line, url in after:
        link = f' <a href="{escape(url)}" style="color:#FF6700">{escape(url)}</a>' if url else ""
        html_parts.append(f"<p {p}>{escape(line)}{link}</p>")
    html_parts.append('<hr style="border:none;border-top:1px solid #eee;margin:20px 0">')
    html_parts.append(f"<p {small}>{escape(m['ignore'])}</p>")
    if m["code"]:
        html_parts.append(f"<p {small}>{escape(_NEVER_ASK[lang])}</p>")
    html_parts.append("</div>")
    return subject, text, "".join(html_parts)


# ------------------------------------------------------------------------------------------------ SMS
# (sign-up, phone number change) per locale. Short enough for one or two segments; the purpose comes first so the
# notification preview says why the text arrived.
_SMS: dict[str, tuple[str, str]] = {
    "ko": ("[Hangyul Univ] 회원가입 인증번호는 {code}입니다. 5분 안에 입력해 주세요. 타인에게 알려주지 마세요.",
           "[Hangyul Univ] 전화번호 변경 인증번호는 {code}입니다. 5분 안에 입력해 주세요. 타인에게 알려주지 마세요."),
    "en": ("[Hangyul Univ] Your sign-up code is {code}. It expires in 5 minutes. Don't share it with anyone.",
           "[Hangyul Univ] Your code to change your phone number is {code}. It expires in 5 minutes. Don't share it with anyone."),
    "vi": ("[Hangyul Univ] Mã đăng ký của bạn là {code}. Mã có hiệu lực trong 5 phút. Không chia sẻ mã này với bất kỳ ai.",
           "[Hangyul Univ] Mã xác nhận đổi số điện thoại của bạn là {code}. Mã có hiệu lực trong 5 phút. Không chia sẻ mã này với bất kỳ ai."),
    "ne": ("[Hangyul Univ] तपाईंको साइन अप कोड {code} हो। यो ५ मिनेटसम्म मान्य हुन्छ। यो कोड कसैलाई नदिनुहोस्।",
           "[Hangyul Univ] फोन नम्बर परिवर्तनका लागि तपाईंको कोड {code} हो। यो ५ मिनेटसम्म मान्य हुन्छ। यो कोड कसैलाई नदिनुहोस्।"),
    "my": ("[Hangyul Univ] အကောင့်ဖွင့်ရန် သင်၏ကုဒ်မှာ {code} ဖြစ်သည်။ ၅ မိနစ်အတွင်း အသုံးပြုပါ။ ဤကုဒ်ကို မည်သူ့ကိုမျှ မပေးပါနှင့်။",
           "[Hangyul Univ] ဖုန်းနံပါတ်ပြောင်းရန် သင်၏ကုဒ်မှာ {code} ဖြစ်သည်။ ၅ မိနစ်အတွင်း အသုံးပြုပါ။ ဤကုဒ်ကို မည်သူ့ကိုမျှ မပေးပါနှင့်။"),
    "uz": ("[Hangyul Univ] Ro'yxatdan o'tish kodingiz: {code}. Kod 5 daqiqa amal qiladi. Uni hech kimga bermang.",
           "[Hangyul Univ] Telefon raqamini o'zgartirish kodingiz: {code}. Kod 5 daqiqa amal qiladi. Uni hech kimga bermang."),
    "mn": ("[Hangyul Univ] Таны бүртгүүлэх код: {code}. Код 5 минутын турш хүчинтэй. Үүнийг хэнд ч бүү хэлээрэй.",
           "[Hangyul Univ] Утасны дугаар солих таны код: {code}. Код 5 минутын турш хүчинтэй. Үүнийг хэнд ч бүү хэлээрэй."),
    "zh-Hans": ("[Hangyul Univ] 您的注册验证码是 {code}，5 分钟内有效。请勿将验证码告诉任何人。",
                "[Hangyul Univ] 您更换手机号码的验证码是 {code}，5 分钟内有效。请勿将验证码告诉任何人。"),
    "ja": ("[Hangyul Univ] 会員登録の認証番号は {code} です。有効期限は5分です。この番号は誰にも教えないでください。",
           "[Hangyul Univ] 電話番号変更の認証番号は {code} です。有効期限は5分です。この番号は誰にも教えないでください。"),
    "th": ("[Hangyul Univ] รหัสสมัครสมาชิกของคุณคือ {code} ใช้ได้ภายใน 5 นาที ห้ามบอกรหัสนี้กับผู้อื่น",
           "[Hangyul Univ] รหัสสำหรับเปลี่ยนหมายเลขโทรศัพท์ของคุณคือ {code} ใช้ได้ภายใน 5 นาที ห้ามบอกรหัสนี้กับผู้อื่น"),
    "id": ("[Hangyul Univ] Kode pendaftaran Anda adalah {code}. Berlaku selama 5 menit. Jangan bagikan kode ini kepada siapa pun.",
           "[Hangyul Univ] Kode untuk mengganti nomor telepon Anda adalah {code}. Berlaku selama 5 menit. Jangan bagikan kode ini kepada siapa pun."),
    "fil": ("[Hangyul Univ] Ang iyong sign-up code ay {code}. Valid ito nang 5 minuto. Huwag itong ibahagi kaninuman.",
            "[Hangyul Univ] Ang code para palitan ang iyong phone number ay {code}. Valid ito nang 5 minuto. Huwag itong ibahagi kaninuman."),
    "hi": ("[Hangyul Univ] आपका साइन-अप कोड {code} है। यह 5 मिनट तक मान्य है। इसे किसी के साथ साझा न करें।",
           "[Hangyul Univ] फ़ोन नंबर बदलने के लिए आपका कोड {code} है। यह 5 मिनट तक मान्य है। इसे किसी के साथ साझा न करें।"),
    "bn": ("[Hangyul Univ] আপনার সাইন-আপ কোড {code}। এটি ৫ মিনিট পর্যন্ত বৈধ। কোডটি কাউকে জানাবেন না।",
           "[Hangyul Univ] ফোন নম্বর পরিবর্তনের জন্য আপনার কোড {code}। এটি ৫ মিনিট পর্যন্ত বৈধ। কোডটি কাউকে জানাবেন না।"),
    "kk": ("[Hangyul Univ] Тіркелу кодыңыз: {code}. Код 5 минут жарамды. Оны ешкімге айтпаңыз.",
           "[Hangyul Univ] Телефон нөмірін өзгерту кодыңыз: {code}. Код 5 минут жарамды. Оны ешкімге айтпаңыз."),
    "ky": ("[Hangyul Univ] Катталуу кодуңуз: {code}. Код 5 мүнөт жарактуу. Аны эч кимге айтпаңыз.",
           "[Hangyul Univ] Телефон номерин өзгөртүү кодуңуз: {code}. Код 5 мүнөт жарактуу. Аны эч кимге айтпаңыз."),
    "ar": ("[Hangyul Univ] رمز التسجيل الخاص بك هو {code}. صالح لمدة 5 دقائق. لا تشاركه مع أي شخص.",
           "[Hangyul Univ] رمز تغيير رقم هاتفك هو {code}. صالح لمدة 5 دقائق. لا تشاركه مع أي شخص."),
    "tr": ("[Hangyul Univ] Kayıt kodunuz: {code}. 5 dakika geçerlidir. Bu kodu kimseyle paylaşmayın.",
           "[Hangyul Univ] Telefon numarası değiştirme kodunuz: {code}. 5 dakika geçerlidir. Bu kodu kimseyle paylaşmayın."),
    "ru": ("[Hangyul Univ] Код для регистрации: {code}. Он действует 5 минут. Никому его не сообщайте.",
           "[Hangyul Univ] Код для смены номера телефона: {code}. Он действует 5 минут. Никому его не сообщайте."),
    "uk": ("[Hangyul Univ] Код для реєстрації: {code}. Він дійсний 5 хвилин. Нікому його не повідомляйте.",
           "[Hangyul Univ] Код для зміни номера телефону: {code}. Він дійсний 5 хвилин. Нікому його не повідомляйте."),
    "pl": ("[Hangyul Univ] Twój kod rejestracji: {code}. Jest ważny przez 5 minut. Nie udostępniaj go nikomu.",
           "[Hangyul Univ] Twój kod do zmiany numeru telefonu: {code}. Jest ważny przez 5 minut. Nie udostępniaj go nikomu."),
    "cs": ("[Hangyul Univ] Váš registrační kód je {code}. Platí 5 minut. Nikomu ho nesdělujte.",
           "[Hangyul Univ] Váš kód pro změnu telefonního čísla je {code}. Platí 5 minut. Nikomu ho nesdělujte."),
    "hu": ("[Hangyul Univ] A regisztrációs kódod: {code}. 5 percig érvényes. Ne add meg senkinek.",
           "[Hangyul Univ] A telefonszám-módosítási kódod: {code}. 5 percig érvényes. Ne add meg senkinek."),
    "ro": ("[Hangyul Univ] Codul tău de înregistrare este {code}. Este valabil 5 minute. Nu îl comunica nimănui.",
           "[Hangyul Univ] Codul tău pentru schimbarea numărului de telefon este {code}. Este valabil 5 minute. Nu îl comunica nimănui."),
    "sr": ("[Hangyul Univ] Vaš kod za registraciju je {code}. Važi 5 minuta. Ne delite ga ni sa kim.",
           "[Hangyul Univ] Vaš kod za promenu broja telefona je {code}. Važi 5 minuta. Ne delite ga ni sa kim."),
    "el": ("[Hangyul Univ] Ο κωδικός εγγραφής σας είναι {code}. Ισχύει για 5 λεπτά. Μην τον δώσετε σε κανέναν.",
           "[Hangyul Univ] Ο κωδικός για την αλλαγή του αριθμού τηλεφώνου σας είναι {code}. Ισχύει για 5 λεπτά. Μην τον δώσετε σε κανέναν."),
    "it": ("[Hangyul Univ] Il tuo codice di registrazione è {code}. È valido per 5 minuti. Non condividerlo con nessuno.",
           "[Hangyul Univ] Il tuo codice per cambiare numero di telefono è {code}. È valido per 5 minuti. Non condividerlo con nessuno."),
    "es": ("[Hangyul Univ] Tu código de registro es {code}. Es válido durante 5 minutos. No lo compartas con nadie.",
           "[Hangyul Univ] Tu código para cambiar el número de teléfono es {code}. Es válido durante 5 minutos. No lo compartas con nadie."),
    "pt": ("[Hangyul Univ] O seu código de registo é {code}. É válido durante 5 minutos. Não o partilhe com ninguém.",
           "[Hangyul Univ] O seu código para alterar o número de telefone é {code}. É válido durante 5 minutos. Não o partilhe com ninguém."),
    "fr": ("[Hangyul Univ] Votre code d'inscription est {code}. Il est valable 5 minutes. Ne le communiquez à personne.",
           "[Hangyul Univ] Votre code pour changer de numéro de téléphone est {code}. Il est valable 5 minutes. Ne le communiquez à personne."),
    "de": ("[Hangyul Univ] Dein Code für die Registrierung lautet {code}. Er ist 5 Minuten gültig. Gib ihn an niemanden weiter.",
           "[Hangyul Univ] Dein Code zum Ändern deiner Telefonnummer lautet {code}. Er ist 5 Minuten gültig. Gib ihn an niemanden weiter."),
    "nl": ("[Hangyul Univ] Je registratiecode is {code}. Deze is 5 minuten geldig. Deel hem met niemand.",
           "[Hangyul Univ] Je code om je telefoonnummer te wijzigen is {code}. Deze is 5 minuten geldig. Deel hem met niemand."),
    "sv": ("[Hangyul Univ] Din registreringskod är {code}. Den gäller i 5 minuter. Dela den inte med någon.",
           "[Hangyul Univ] Din kod för att byta telefonnummer är {code}. Den gäller i 5 minuter. Dela den inte med någon."),
}
SMS_LOCALES = tuple(_SMS)


def sms_text(purpose: str, code: str, locale: str) -> str:
    """The verification SMS for SIGNUP_PHONE or CONTACT_PHONE in the person's locale (English when unknown)."""
    loc = locale or "en"
    pair = _SMS.get(loc) or _SMS.get(loc.split("-")[0]) or _SMS["en"]
    return pair[1 if purpose == "CONTACT_PHONE" else 0].format(code=code)
