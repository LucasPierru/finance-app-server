import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { serverEnv } from "@config/env";
import { pool } from "@db/pool";
import { AppError } from "@lib/errors";
import { requireAuth } from "@middleware/auth";
import { authRouter } from "@routes/auth";
import { financeRouter } from "@routes/finance";
import { plaidRouter } from "@routes/plaid";

const app = express();

app.use(
  cors({
    origin: serverEnv.frontendOrigin,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  }),
);
app.use(express.json());

app.get("/health", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true });
  } catch (error) {
    console.error("Health check failed:", error);
    next(error);
  }
});

app.use("/api/auth", authRouter);
app.use("/api/finance", requireAuth, financeRouter);
app.use("/api/plaid", requireAuth, plaidRouter);

app.use((error: Error, req: Request, res: Response, _next: NextFunction) => {
  console.error(`[${req.method} ${req.path}] Error:`, error.message);
  const statusCode = error instanceof AppError ? error.statusCode : 500;
  res.status(statusCode).json({ message: error.message || "Internal server error" });
});

app.listen(serverEnv.port, () => {
  console.log(`Server listening on http://localhost:${serverEnv.port}`);
});