interface CloudflareEnv {
  DB: D1Database;
  AUTH_SECRET: string;
  AUTH_RESEND_KEY: string;
  R2_ACCOUNT_ID: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_BUCKET: string;
  NEXT_PUBLIC_APP_URL: string;
  NEXT_PUBLIC_R2_PUBLIC_URL: string;
}
