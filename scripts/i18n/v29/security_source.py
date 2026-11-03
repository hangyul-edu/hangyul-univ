"""V29 source strings (ko + en) for staff two-step verification (TOTP) in the Agency and University consoles.

Run: python3 scripts/i18n/v29/security_source.py

Writes into packages/i18n/locales/{ko,en}/{agency,university}.json under `v29.security` (same shape and merge as
source.py, whose `apply` is reused). The two consoles carry the same copy in their own namespace, because each console
loads only its own namespace + `common`. The web components pass these English strings as `defaultValue`, so the UI
reads correctly before this has been run.
"""
import sys
from pathlib import Path

_KO = {
    "title": "2단계 인증",
    "sub": "비밀번호를 입력한 뒤 인증 앱의 코드를 한 번 더 확인합니다.",
    "status": {
        "label": "상태", "on": "사용 중", "off": "사용 안 함", "since": "{{date}}부터 사용 중",
        "codesLeft": "남은 복구 코드", "required": "이 계정은 2단계 인증이 필수입니다.",
        "notEligible": "이 계정에서는 2단계 인증을 사용할 수 없습니다.",
        "requiredOff": "조직 정책상 2단계 인증이 필요합니다. 지금 설정하지 않으면 다음 로그인 때 설정을 요청받게 됩니다.",
        "resetNote": "인증 앱을 잃어버렸다면 한귤 유니브 관리자에게 2단계 인증 초기화를 요청하세요.",
        "loadFailed": "2단계 인증 상태를 불러오지 못했습니다.",
    },
    "actions": {
        "setUp": "설정하기", "regenerate": "복구 코드 다시 만들기", "cancel": "취소", "copy": "복사", "copied": "복사했습니다",
        "copyAll": "모두 복사", "download": ".txt 파일로 저장", "continue": "계속", "back": "로그인으로 돌아가기", "done": "완료",
    },
    "challenge": {
        "title": "2단계 인증", "lede": "인증 앱에 표시된 6자리 코드를 입력하세요.", "code": "6자리 코드",
        "useRecovery": "복구 코드 사용하기", "useApp": "인증 앱 코드 사용하기",
        "recoveryLede": "2단계 인증을 설정할 때 저장한 복구 코드 중 하나를 입력하세요. 각 코드는 한 번만 사용할 수 있습니다.",
        "recovery": "복구 코드", "submit": "확인",
    },
    "enroll": {
        "title": "2단계 인증 설정", "lede": "로그인하려면 먼저 이 계정에 2단계 인증을 설정해야 합니다.",
        "step1": "1. 인증 앱에 이 계정을 추가하세요",
        "step1Hint": "Google Authenticator, Microsoft Authenticator, 1Password 같은 앱에서 계정 추가를 선택한 뒤 아래 설정 키를 입력하세요. 이 기기에 앱이 있다면 설정 링크를 열어도 됩니다.",
        "account": "계정", "secret": "설정 키", "uri": "설정 링크", "openApp": "인증 앱에서 열기",
        "step2": "2. 앱에 표시된 6자리 코드를 입력하세요", "activate": "사용 시작", "loading": "설정 키를 준비하고 있습니다…",
    },
    "codes": {
        "title": "복구 코드를 저장하세요",
        "lede": "인증 앱을 쓸 수 없을 때 각 코드로 한 번씩 로그인할 수 있습니다. 이 코드는 지금만 표시되니 비밀번호 관리자처럼 안전한 곳에 보관하세요.",
        "saved": "복구 코드를 안전한 곳에 저장했습니다",
        "fileHeader": "한귤 유니브 복구 코드 ({{account}})", "fileNote": "각 코드는 한 번만 사용할 수 있습니다.",
    },
    "regen": {
        "lede": "인증 앱의 현재 코드를 입력하세요. 기존 복구 코드는 더 이상 사용할 수 없게 됩니다.",
        "submit": "새 복구 코드 만들기",
    },
    "err": {
        "invalid": "코드가 올바르지 않습니다. 앱의 코드를 확인하고 다시 입력하세요.",
        "expired": "로그인 단계의 유효 시간이 지났습니다. 다시 로그인하세요.",
        "limited": "시도 횟수가 너무 많습니다. {{seconds}}초 후에 다시 시도하세요.",
        "limitedSoon": "시도 횟수가 너무 많습니다. 잠시 후 다시 시도하세요.",
        "already": "이 계정은 이미 2단계 인증을 사용하고 있습니다.",
        "format": "앱에 표시된 6자리 숫자를 입력하세요.", "recoveryFormat": "복구 코드를 입력하세요.",
        "generic": "문제가 발생했습니다. 다시 시도하세요.",
    },
}

_EN = {
    "title": "Two-step verification",
    "sub": "After your password, you also enter a code from an authenticator app.",
    "status": {
        "label": "Status", "on": "On", "off": "Off", "since": "On since {{date}}",
        "codesLeft": "Recovery codes left", "required": "Two-step verification is required for this account.",
        "notEligible": "Two-step verification isn't available for this account.",
        "requiredOff": "Your organisation requires two-step verification. If you don't set it up now, you'll be asked to at your next sign-in.",
        "resetNote": "Lost your authenticator? Ask a Hangyul Univ administrator to reset two-step verification for you.",
        "loadFailed": "Couldn't load your two-step verification status.",
    },
    "actions": {
        "setUp": "Set up", "regenerate": "Regenerate recovery codes", "cancel": "Cancel", "copy": "Copy", "copied": "Copied",
        "copyAll": "Copy all", "download": "Download as .txt", "continue": "Continue", "back": "Back to sign-in", "done": "Done",
    },
    "challenge": {
        "title": "Two-step verification", "lede": "Enter the 6-digit code from your authenticator app.", "code": "6-digit code",
        "useRecovery": "Use a recovery code", "useApp": "Use your authenticator app",
        "recoveryLede": "Enter one of the recovery codes you saved when you set up two-step verification. Each code works once.",
        "recovery": "Recovery code", "submit": "Verify",
    },
    "enroll": {
        "title": "Set up two-step verification", "lede": "Your account needs two-step verification before you can sign in.",
        "step1": "1. Add this account to your authenticator app",
        "step1Hint": "In Google Authenticator, Microsoft Authenticator, 1Password or similar, choose to add an account and enter the setup key below — or open the setup link if the app is on this device.",
        "account": "Account", "secret": "Setup key", "uri": "Setup link", "openApp": "Open in authenticator app",
        "step2": "2. Enter the 6-digit code the app shows", "activate": "Turn on", "loading": "Preparing your setup key…",
    },
    "codes": {
        "title": "Save your recovery codes",
        "lede": "If you can't use your authenticator, each code signs you in once. They're shown only now — keep them somewhere safe, such as a password manager.",
        "saved": "I've saved these recovery codes somewhere safe",
        "fileHeader": "Hangyul Univ recovery codes ({{account}})", "fileNote": "Each code can be used once.",
    },
    "regen": {
        "lede": "Enter a current code from your authenticator app. Your old recovery codes will stop working.",
        "submit": "Generate new codes",
    },
    "err": {
        "invalid": "That code isn't right. Check the code in your app and try again.",
        "expired": "This sign-in step has timed out. Please sign in again.",
        "limited": "Too many attempts. Try again in {{seconds}} seconds.",
        "limitedSoon": "Too many attempts. Please wait a moment and try again.",
        "already": "Two-step verification is already on for this account.",
        "format": "Enter the 6 digits from your app.", "recoveryFormat": "Enter a recovery code.",
        "generic": "Something went wrong. Please try again.",
    },
}

KO = {"agency": {"v29.security": _KO}, "university": {"v29.security": _KO}}
EN = {"agency": {"v29.security": _EN}, "university": {"v29.security": _EN}}


if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).parent))
    from source import apply

    apply("ko", KO)
    apply("en", EN)
    print("v29 security strings written")
