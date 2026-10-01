import { z } from "zod";

/**
 * The app refuses to boot with a missing/malformed required secret rather
 * than starting up in a silently-insecure state (docs/security.md "Secrets").
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  SESSION_SECRET: z.string().min(16, "SESSION_SECRET must be at least 16 characters"),
  SESSION_COOKIE_NAME: z.string().default("clientos_session"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  WEB_APP_URL: z.string().url().default("http://localhost:3000"),
  LOCAL_STORAGE_DIR: z.string().default("./.data/uploads"),
  // All optional: SmtpEmailProvider only activates when SMTP_HOST is set
  // (see email.module.ts); without it, email sends fall back to the
  // console/log provider rather than failing to boot over an unset secret
  // that isn't actually required to run the app.
  SMTP_HOST: z.string().optional(),
  // .env.example (and every environment copied from it) ships these as
  // empty strings, not unset — a bare z.coerce.number() turns "" into 0,
  // which then fails .positive(). Treat "" the same as unset.
  SMTP_PORT: z.preprocess((v) => (v === "" ? undefined : v), z.coerce.number().int().positive().optional()),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  EMAIL_FROM: z.string().default("ClientOS <notifications@example.com>"),
});

export type AppEnv = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): AppEnv {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return result.data;
}
