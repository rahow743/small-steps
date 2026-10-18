declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    SMALL_STEPS_OWNER_EMAIL?: string;
    BUCKET?: R2Bucket;
  }
}
