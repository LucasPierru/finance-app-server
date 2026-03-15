import type { Request, Response } from "express";
import { serverEnv } from "@config/env";
import type { User } from "@lib/types";

const ACCESS_TOKEN_COOKIE = "finance_access_token";
const REFRESH_TOKEN_COOKIE = "finance_refresh_token";

interface AuthSessionCookies {
  user: User;
  accessToken: string;
  refreshToken: string;
}

function isSecureCookie(): boolean {
  return process.env.NODE_ENV === "production";
}

function parseCookieHeader(cookieHeader: string | undefined): Map<string, string> {
  const cookies = new Map<string, string>();

  if (!cookieHeader) {
    return cookies;
  }

  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rawValueParts] = part.trim().split("=");
    if (!rawName || rawValueParts.length === 0) {
      continue;
    }

    cookies.set(rawName, decodeURIComponent(rawValueParts.join("=")));
  }

  return cookies;
}

function getBaseCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isSecureCookie(),
    path: "/",
  };
}

export function setAuthCookies(res: Response, session: AuthSessionCookies): void {
  res.cookie(ACCESS_TOKEN_COOKIE, session.accessToken, {
    ...getBaseCookieOptions(),
  });

  res.cookie(REFRESH_TOKEN_COOKIE, session.refreshToken, {
    ...getBaseCookieOptions(),
    maxAge: serverEnv.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
  });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_TOKEN_COOKIE, getBaseCookieOptions());
  res.clearCookie(REFRESH_TOKEN_COOKIE, getBaseCookieOptions());
}

export function getAccessTokenFromCookies(req: Request): string | null {
  return parseCookieHeader(req.headers.cookie).get(ACCESS_TOKEN_COOKIE) ?? null;
}

export function getRefreshTokenFromCookies(req: Request): string | null {
  return parseCookieHeader(req.headers.cookie).get(REFRESH_TOKEN_COOKIE) ?? null;
}