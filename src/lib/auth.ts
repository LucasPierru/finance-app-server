import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { serverEnv } from "@config/env";
import { AppError } from "@lib/errors";
import type { User } from "@lib/types";

interface TokenPayload {
  sub: string;
  email: string;
  type: "access" | "refresh";
  jti: string;
}

export interface AuthenticatedUser {
  userId: string;
  email: string;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function generateVerificationCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function hashSecret(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function createToken(payload: TokenPayload, secret: string, expiresIn: string): string {
  return jwt.sign(payload, secret, {
    expiresIn: expiresIn as jwt.SignOptions["expiresIn"],
  });
}

function verifyToken(token: string, secret: string, expectedType: TokenPayload["type"]): AuthenticatedUser {
  try {
    const decoded = jwt.verify(token, secret);

    if (
      typeof decoded !== "object" ||
      decoded === null ||
      decoded.type !== expectedType ||
      typeof decoded.sub !== "string" ||
      typeof decoded.email !== "string"
    ) {
      throw new AppError(401, "Invalid or expired token");
    }

    return {
      userId: decoded.sub,
      email: decoded.email,
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(401, "Invalid or expired token");
  }
}

export function createAccessToken(user: User): string {
  return createToken(
    {
      sub: user.id,
      email: user.email,
      type: "access",
      jti: crypto.randomUUID(),
    },
    serverEnv.jwtAccessSecret,
    serverEnv.accessTokenTtl,
  );
}

export function createRefreshToken(user: User): string {
  return createToken(
    {
      sub: user.id,
      email: user.email,
      type: "refresh",
      jti: crypto.randomUUID(),
    },
    serverEnv.jwtRefreshSecret,
    serverEnv.refreshTokenTtl,
  );
}

export function verifyAccessToken(token: string): AuthenticatedUser {
  return verifyToken(token, serverEnv.jwtAccessSecret, "access");
}

export function verifyRefreshToken(token: string): AuthenticatedUser {
  return verifyToken(token, serverEnv.jwtRefreshSecret, "refresh");
}

export function extractBearerToken(headerValue: string | undefined): string | null {
  if (!headerValue) {
    return null;
  }

  const [scheme, token] = headerValue.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token.trim();
}
