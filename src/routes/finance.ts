import { Router } from "express";
import {
  createFinanceCategory,
  defaultInvestmentSettings,
  getFinanceCategories,
  getFinanceState,
  replaceFinanceEntries,
  replaceInvestmentSettings,
} from "../repositories/finance.js";
import { getAuthenticatedUser } from "../middleware/auth.js";
import type { FinanceEntryKind, FinanceItemInput, InvestmentSettings } from "../lib/types.js";

const financeRouter = Router();

function isEntryKind(value: unknown): value is FinanceEntryKind {
  return value === "income" || value === "expense";
}

function isFrequency(value: unknown): value is FinanceItemInput["frequency"] {
  return value === "weekly" || value === "biweekly" || value === "monthly" || value === "yearly";
}

function normalizeFinanceItem(raw: unknown): FinanceItemInput {
  const value = raw as Partial<FinanceItemInput> & { category?: unknown };

  if (!value || typeof value !== "object") {
    throw new Error("Invalid finance item payload");
  }

  const categoryId = typeof value.categoryId === "string" ? value.categoryId.trim() : "";
  const categoryName =
    typeof value.categoryName === "string"
      ? value.categoryName.trim()
      : typeof value.category === "string"
        ? value.category.trim()
        : "";

  if (!value.id || !value.name || !value.rawAmount || !isFrequency(value.frequency) || (!categoryId && !categoryName)) {
    throw new Error("Finance item is missing required fields");
  }

  const amount = Number(value.amount);
  if (!Number.isFinite(amount)) {
    throw new Error("Finance item amount must be numeric");
  }

  return {
    id: String(value.id),
    name: String(value.name).trim(),
    categoryId: categoryId || undefined,
    categoryName: categoryName || undefined,
    amount,
    rawAmount: String(value.rawAmount).trim(),
    frequency: value.frequency,
  };
}

function normalizeSettings(raw: unknown): InvestmentSettings {
  const value = raw as Partial<InvestmentSettings>;
  const settings = {
    annualReturn: Number(value?.annualReturn),
    years: Number(value?.years),
    initialAmount: Number(value?.initialAmount),
    dividendYield: Number(value?.dividendYield),
    incomeGrowth: Number(value?.incomeGrowth),
    expenseGrowth: Number(value?.expenseGrowth),
  } satisfies InvestmentSettings;

  if (Object.values(settings).some((entry) => !Number.isFinite(entry))) {
    throw new Error("Investment settings must be numeric");
  }

  return settings;
}

financeRouter.get("/state", async (req, res, next) => {
  try {
    const state = await getFinanceState(getAuthenticatedUser(req).userId);
    res.json(state);
  } catch (error) {
    next(error);
  }
});

financeRouter.get("/categories", async (req, res, next) => {
  try {
    const categories = await getFinanceCategories(getAuthenticatedUser(req).userId);
    res.json(categories);
  } catch (error) {
    next(error);
  }
});

financeRouter.post("/categories", async (req, res, next) => {
  try {
    if (!isEntryKind(req.body?.kind)) {
      throw new Error("Category kind must be income or expense");
    }

    const category = await createFinanceCategory(
      getAuthenticatedUser(req).userId,
      req.body.kind,
      String(req.body?.name ?? ""),
    );

    res.status(201).json(category);
  } catch (error) {
    next(error);
  }
});

financeRouter.put("/revenues", async (req, res, next) => {
  try {
    const entries = Array.isArray(req.body) ? req.body.map(normalizeFinanceItem) : [];
    const saved = await replaceFinanceEntries(getAuthenticatedUser(req).userId, "income", entries);
    res.json(saved);
  } catch (error) {
    next(error);
  }
});

financeRouter.put("/costs", async (req, res, next) => {
  try {
    const entries = Array.isArray(req.body) ? req.body.map(normalizeFinanceItem) : [];
    const saved = await replaceFinanceEntries(getAuthenticatedUser(req).userId, "expense", entries);
    res.json(saved);
  } catch (error) {
    next(error);
  }
});

financeRouter.put("/settings", async (req, res, next) => {
  try {
    const settings = normalizeSettings(req.body ?? defaultInvestmentSettings);
    const saved = await replaceInvestmentSettings(getAuthenticatedUser(req).userId, settings);
    res.json(saved);
  } catch (error) {
    next(error);
  }
});

export { financeRouter };