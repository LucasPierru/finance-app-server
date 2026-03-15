import type { Pool, PoolClient } from "pg";
import { pool } from "@db/pool";
import {
  createAccessToken,
  createRefreshToken,
  generateVerificationCode,
  hashSecret,
  normalizeEmail,
  verifyRefreshToken,
} from "@lib/auth";
import { AppError } from "@lib/errors";
import { sendVerificationCode } from "@lib/mailer";
import type { User } from "@lib/types";
import { serverEnv } from "@config/env";
import {
  consumeLoginCode,
  getActiveRefreshToken,
  getLatestActiveLoginCode,
  revokeRefreshToken,
  revokeRefreshTokenByHash,
  storeLoginCode,
  storeRefreshToken,
} from "@repositories/auth";
import { findOrCreateUserByEmail, getUserById, markUserEmailVerified, upsertUserProfileByEmail } from "@repositories/users";

interface AuthSession {
  user: User;
  accessToken: string;
  refreshToken: string;
}

type Queryable = Pool | PoolClient;

function getRefreshTokenExpiration(): Date {
  const durationMs = serverEnv.refreshTokenTtlDays * 24 * 60 * 60 * 1000;
  return new Date(Date.now() + durationMs);
}

function getLoginCodeExpiration(): Date {
  const durationMs = serverEnv.authCodeTtlMinutes * 60 * 1000;
  return new Date(Date.now() + durationMs);
}

async function issueSession(user: User, queryable: Queryable = pool): Promise<AuthSession> {
  const accessToken = createAccessToken(user);
  const refreshToken = createRefreshToken(user);
  await storeRefreshToken(queryable, user.id, hashSecret(refreshToken), getRefreshTokenExpiration());

  return {
    user,
    accessToken,
    refreshToken,
  };
}

export async function requestEmailCode(rawEmail: string): Promise<void> {
  const email = normalizeEmail(rawEmail);

  if (!email || !email.includes("@")) {
    throw new AppError(400, "A valid email address is required");
  }

  const user = await findOrCreateUserByEmail(email);
  const code = generateVerificationCode();
  await storeLoginCode(user.id, user.email, hashSecret(code), getLoginCodeExpiration());
  await sendVerificationCode(user.email, code);
}

function normalizeRegisterInput(input: { email: string; name: string; phone: string; birthDate: string }): {
  email: string;
  name: string;
  phone: string;
  birthDate: string;
} {
  const email = normalizeEmail(input.email);
  const name = input.name.trim();
  const phone = input.phone.trim();
  const birthDate = input.birthDate.trim();

  if (!email || !email.includes("@")) {
    throw new AppError(400, "A valid email address is required");
  }

  if (!name) {
    throw new AppError(400, "Name is required");
  }

  if (!phone) {
    throw new AppError(400, "Phone is required");
  }

  const parsedBirthDate = new Date(`${birthDate}T00:00:00.000Z`);
  const normalizedBirthDate = Number.isNaN(parsedBirthDate.getTime()) ? "" : parsedBirthDate.toISOString().slice(0, 10);

  if (!normalizedBirthDate || normalizedBirthDate !== birthDate) {
    throw new AppError(400, "birthDate must use YYYY-MM-DD format");
  }

  return {
    email,
    name,
    phone,
    birthDate: normalizedBirthDate,
  };
}

export async function registerUser(input: {
  email: string;
  name: string;
  phone: string;
  birthDate: string;
}): Promise<{ message: string }> {
  const normalized = normalizeRegisterInput(input);
  const user = await upsertUserProfileByEmail(normalized.email, {
    name: normalized.name,
    phone: normalized.phone,
    birthDate: normalized.birthDate,
  });

  const code = generateVerificationCode();
  await storeLoginCode(user.id, user.email, hashSecret(code), getLoginCodeExpiration());
  await sendVerificationCode(user.email, code);

  return {
    message: "Registration details saved. A sign-in code has been sent to your email.",
  };
}

export async function verifyEmailCode(rawEmail: string, rawCode: string): Promise<AuthSession> {
  const email = normalizeEmail(rawEmail);
  const code = rawCode.trim();

  if (!email || !code) {
    throw new AppError(400, "Email and code are required");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const loginCode = await getLatestActiveLoginCode(client, email);
    if (!loginCode || loginCode.codeHash !== hashSecret(code)) {
      throw new AppError(401, "Invalid or expired code");
    }

    await consumeLoginCode(client, loginCode.id);
    await markUserEmailVerified(client, loginCode.userId);

    const user = await getUserById(loginCode.userId, client);
    if (!user) {
      throw new AppError(404, "User not found");
    }

    const session = await issueSession(user, client);
    await client.query("COMMIT");
    return session;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function refreshSession(refreshToken: string): Promise<AuthSession> {
  const token = refreshToken.trim();
  if (!token) {
    throw new AppError(400, "refreshToken is required");
  }

  const payload = verifyRefreshToken(token);
  const storedToken = await getActiveRefreshToken(hashSecret(token));

  if (!storedToken || storedToken.userId !== payload.userId || storedToken.revokedAt !== null) {
    throw new AppError(401, "Invalid or expired refresh token");
  }

  if (new Date(storedToken.expiresAt).getTime() <= Date.now()) {
    throw new AppError(401, "Invalid or expired refresh token");
  }

  const user = await getUserById(payload.userId);
  if (!user) {
    throw new AppError(404, "User not found");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await revokeRefreshToken(client, storedToken.id);
    const session = await issueSession(user, client);
    await client.query("COMMIT");
    return session;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function logout(refreshToken: string): Promise<void> {
  const token = refreshToken.trim();
  if (!token) {
    return;
  }

  verifyRefreshToken(token);
  await revokeRefreshTokenByHash(hashSecret(token));
}
