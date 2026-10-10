/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** When both are set, carved names are stored in a shared Supabase table. */
  readonly VITE_SUPABASE_URL?: string;
  /** New-style publishable key (preferred). */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  /** Legacy anon key, still accepted as a fallback. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}