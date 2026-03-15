import dotenv from "dotenv";

dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parsePort(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "true") {
    return true;
  }

  if (normalized === "false") {
    return false;
  }

  return fallback;
}

export const serverEnv = {
  port: parsePort(process.env.PORT, 4000),
  databaseUrl: requireEnv("DATABASE_URL"),
  frontendOrigin: process.env.FRONTEND_ORIGIN?.trim() || "http://localhost:5173",
  appName: process.env.APP_NAME?.trim() || "Finance App",
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET?.trim() || "dev-access-secret-change-me",
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET?.trim() || "dev-refresh-secret-change-me",
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL?.trim() || "15m",
  refreshTokenTtl: process.env.REFRESH_TOKEN_TTL?.trim() || "30d",
  refreshTokenTtlDays: parsePositiveInt(process.env.REFRESH_TOKEN_TTL_DAYS, 30),
  authCodeTtlMinutes: parsePositiveInt(process.env.AUTH_CODE_TTL_MINUTES, 10),
  emailFrom: process.env.EMAIL_FROM?.trim() || "",
  smtpHost: process.env.SMTP_HOST?.trim() || "",
  smtpPort: parsePort(process.env.SMTP_PORT, 587),
  smtpSecure: parseBoolean(process.env.SMTP_SECURE, false),
  smtpUser: process.env.SMTP_USER?.trim() || "",
  smtpPass: process.env.SMTP_PASS?.trim() || "",
  plaidClientId: process.env.PLAID_CLIENT_ID?.trim() || "",
  plaidSecret: process.env.PLAID_SECRET?.trim() || "",
  plaidEnv: process.env.PLAID_ENV?.trim().toLowerCase() || "sandbox",
};

export function plaidCredentialsConfigured(): boolean {
  return Boolean(serverEnv.plaidClientId && serverEnv.plaidSecret);
}