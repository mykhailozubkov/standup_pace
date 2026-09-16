import { DatabaseSync } from "node:sqlite";
import { betterAuth } from "better-auth";

// This config exists only so the Better Auth CLI can generate a deterministic
// SQLite schema. Runtime configuration lives in src/auth.ts and uses Cloudflare D1.
export const auth = betterAuth({
  database: new DatabaseSync(":memory:"),
  secret: "schema-generation-only-not-a-runtime-secret",
  baseURL: "http://localhost:8787",
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
  },
  session: {
    expiresIn: 60 * 60 * 24,
    updateAge: 60 * 60,
  },
  rateLimit: {
    enabled: true,
    storage: "database",
  },
});
