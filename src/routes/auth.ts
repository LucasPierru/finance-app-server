import { Router, type Request } from "express";
import { clearAuthCookies, getRefreshTokenFromCookies, setAuthCookies } from "@lib/auth-cookies";
import { getAuthenticatedUser, requireAuth } from "@middleware/auth";
import { logout, refreshSession, registerUser, requestEmailCode, verifyEmailCode } from "@services/auth";
import type {
  LogoutBody,
  RefreshBody,
  RegisterBody,
  RequestCodeBody,
  VerifyCodeBody,
} from "@app-types/auth";

const authRouter = Router();

authRouter.post("/register", async (req: Request<Record<string, string>, object, RegisterBody>, res, next) => {
  try {
    const { email, name, phone, birthDate } = req.body ?? {};

    const payload = await registerUser({
      email: String(email ?? ""),
      name: String(name ?? ""),
      phone: String(phone ?? ""),
      birthDate: String(birthDate ?? ""),
    });

    res.status(201).json(payload);
  } catch (error) {
    next(error);
  }
});

authRouter.post("/request-code", async (req: Request<Record<string, string>, object, RequestCodeBody>, res, next) => {
  try {
    const { email } = req.body ?? {};
    await requestEmailCode(String(email ?? ""));
    res.json({ message: "If the email address is valid, a sign-in code has been sent." });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/verify-code", async (req: Request<Record<string, string>, object, VerifyCodeBody>, res, next) => {
  try {
    const { email, code } = req.body ?? {};
    const session = await verifyEmailCode(String(email ?? ""), String(code ?? ""));
    setAuthCookies(res, session);
    res.json({ user: session.user });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/refresh", async (req: Request<Record<string, string>, object, RefreshBody>, res, next) => {
  try {
    const { refreshToken: bodyRefreshToken } = req.body ?? {};
    const refreshToken = String(bodyRefreshToken ?? getRefreshTokenFromCookies(req) ?? "");
    const session = await refreshSession(refreshToken);
    setAuthCookies(res, session);
    res.json({ user: session.user });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/logout", async (req: Request<Record<string, string>, object, LogoutBody>, res, next) => {
  try {
    const { refreshToken: bodyRefreshToken } = req.body ?? {};
    await logout(String(bodyRefreshToken ?? getRefreshTokenFromCookies(req) ?? ""));
    clearAuthCookies(res);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ user: getAuthenticatedUser(req) });
});

export { authRouter };
