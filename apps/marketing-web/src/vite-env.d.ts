/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STUDENT_APP_URL?: string;
  readonly VITE_AGENCY_APP_URL?: string;
  readonly VITE_UNIVERSITY_APP_URL?: string;
  /** Channel Talk public plugin key (same workspace as talkhangyul.com). Unset: no chat widget. */
  readonly VITE_CHANNEL_IO_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
