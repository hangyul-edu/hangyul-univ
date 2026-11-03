/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STUDENT_APP_URL?: string;
  readonly VITE_AGENCY_APP_URL?: string;
  readonly VITE_UNIVERSITY_APP_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
