export interface Env {
  DB: D1Database;
  // TODO: Uncomment when R2 is enabled
  // STORAGE: R2Bucket;
  BASE_URL: string;
  BOOTSTRAP_ADMIN_EMAIL: string;
  BOOTSTRAP_ADMIN_PASSWORD: string;
}
