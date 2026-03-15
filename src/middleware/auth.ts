import type { NextFunction, Request, Response } from "express";
import { getAccessTokenFromCookies } from "@lib/auth-cookies";
import { extractBearerToken, type AuthenticatedUser, verifyAccessToken } from "@lib/auth";
import { AppError } from "@lib/errors";

export type AuthenticatedRequest = Request & {
  auth: AuthenticatedUser;
};

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = extractBearerToken(req.headers.authorization) ?? getAccessTokenFromCookies(req);

  if (!token) {
    next(new AppError(401, "Authentication required"));
    return;
  }

  try {
    (req as AuthenticatedRequest).auth = verifyAccessToken(token);
    next();
  } catch (error) {
    next(error);
  }
}

export function getAuthenticatedUser(req: Request): AuthenticatedUser {
  const auth = (req as AuthenticatedRequest).auth;

  if (!auth) {
    throw new AppError(401, "Authentication required");
  }

  return auth;
}
