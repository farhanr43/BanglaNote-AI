/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_EDGE_FUNCTION_URL?: string;
  readonly VITE_ADMIN_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
