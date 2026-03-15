import { Router } from "express";
import { getAuthenticatedUser, requireAuth } from "../middleware/auth.js";
import { logout, refreshSession, registerUser, requestEmailCode, verifyEmailCode } from "../services/auth.js";

const authRouter = Router();

authRouter.post("/register", async (req, res, next) => {
  try {
    const payload = await registerUser({
      email: String(req.body?.email ?? ""),
      name: String(req.body?.name ?? ""),
      phone: String(req.body?.phone ?? ""),
      birthDate: String(req.body?.birthDate ?? ""),
    });

    res.status(201).json(payload);
  } catch (error) {
    next(error);
  }
});

authRouter.post("/request-code", async (req, res, next) => {
  try {
    await requestEmailCode(String(req.body?.email ?? ""));
    res.json({ message: "If the email address is valid, a sign-in code has been sent." });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/verify-code", async (req, res, next) => {
  try {
    const session = await verifyEmailCode(String(req.body?.email ?? ""), String(req.body?.code ?? ""));
    res.json(session);
  } catch (error) {
    next(error);
  }
});

authRouter.post("/refresh", async (req, res, next) => {
  try {
    const session = await refreshSession(String(req.body?.refreshToken ?? ""));
    res.json(session);
  } catch (error) {
    next(error);
  }
});

authRouter.post("/logout", async (req, res, next) => {
  try {
    await logout(String(req.body?.refreshToken ?? ""));
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ user: getAuthenticatedUser(req) });
});

export { authRouter };
