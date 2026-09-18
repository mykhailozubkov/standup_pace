export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  ROOM_SYNC?: DurableObjectNamespace;
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  SESSION_SECRET?: string;
  OPENROUTER_API_KEY?: string;
  OPENROUTER_MODEL?: string;
  PUBLIC_APP_URL?: string;
}
