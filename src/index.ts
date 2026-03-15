import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { serverEnv } from "./config/env.js";
import { pool } from "./db/pool.js";
import { AppError } from "./lib/errors.js";
import { requireAuth } from "./middleware/auth.js";
import { authRouter } from "./routes/auth.js";
import { financeRouter } from "./routes/finance.js";
import { plaidRouter } from "./routes/plaid.js";

const app = express();

app.use(
  cors({
    origin: serverEnv.frontendOrigin,
    credentials: false,
  }),
);
app.use(express.json());

app.get("/health", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.use("/api/auth", authRouter);
app.use("/api/finance", requireAuth, financeRouter);
app.use("/api/plaid", requireAuth, plaidRouter);

app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error);
  const statusCode = error instanceof AppError ? error.statusCode : 500;
  res.status(statusCode).json({ message: error.message || "Internal server error" });
});

app.listen(serverEnv.port, () => {
  console.log(`Backend listening on http://localhost:${serverEnv.port}`);
});