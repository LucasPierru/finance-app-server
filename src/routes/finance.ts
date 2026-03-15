import { Router, type Request } from "express";
import {
  createFinanceEntry,
  createFinanceCategory,
  defaultInvestmentSettings,
  getFinanceCategories,
  getFinanceEntries,
  getFinanceState,
  replaceFinanceEntries,
  replaceInvestmentSettings,
} from "@repositories/finance";
import { getAuthenticatedUser } from "@middleware/auth";
import {
  parseCategoryBody,
  parseCreateEntry,
  parseEntry,
  parseEntryTypeQuery,
  parseSettings,
} from "@lib/finance-input";
import type {
  CreateCategoryBody,
  CreateEntryBody,
  ReplaceEntriesBody,
  UpdateSettingsBody,
} from "@app-types/finance";

const financeRouter = Router();

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
    const categories = await getFinanceCategories();
    res.json(categories);
  } catch (error) {
    next(error);
  }
});

financeRouter.get("/entries", async (req: Request<Record<string, string>, object, object, { type?: string }>, res, next) => {
  try {
    const type = parseEntryTypeQuery(req.query?.type);
    const entries = await getFinanceEntries(getAuthenticatedUser(req).userId, type);
    res.json(entries);
  } catch (error) {
    next(error);
  }
});

financeRouter.post("/categories", async (req: Request<Record<string, string>, object, CreateCategoryBody>, res, next) => {
  try {
    const { type, name } = parseCategoryBody(req.body);

    const category = await createFinanceCategory(type, name);

    res.status(201).json(category);
  } catch (error) {
    next(error);
  }
});

financeRouter.post("/entries", async (req: Request<Record<string, string>, object, CreateEntryBody>, res, next) => {
  try {
    const {
      type,
      id,
      name,
      categoryId,
      categoryName,
      amount,
      rawAmount,
      frequency,
    } = parseCreateEntry(req.body);

    const created = await createFinanceEntry(getAuthenticatedUser(req).userId, type, {
      id,
      name,
      categoryId,
      categoryName,
      amount,
      rawAmount,
      frequency,
    });
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

financeRouter.put("/revenues", async (req: Request<Record<string, string>, object, ReplaceEntriesBody>, res, next) => {
  try {
    const entriesPayload = req.body;
    const entries = Array.isArray(entriesPayload) ? entriesPayload.map(parseEntry) : [];
    const saved = await replaceFinanceEntries(getAuthenticatedUser(req).userId, "income", entries);
    res.json(saved);
  } catch (error) {
    next(error);
  }
});

financeRouter.put("/costs", async (req: Request<Record<string, string>, object, ReplaceEntriesBody>, res, next) => {
  try {
    const entriesPayload = req.body;
    const entries = Array.isArray(entriesPayload) ? entriesPayload.map(parseEntry) : [];
    const saved = await replaceFinanceEntries(getAuthenticatedUser(req).userId, "expense", entries);
    res.json(saved);
  } catch (error) {
    next(error);
  }
});

financeRouter.put("/settings", async (req: Request<Record<string, string>, object, UpdateSettingsBody>, res, next) => {
  try {
    const settingsPayload = req.body ?? defaultInvestmentSettings;
    const settings = parseSettings(settingsPayload);
    const saved = await replaceInvestmentSettings(getAuthenticatedUser(req).userId, settings);
    res.json(saved);
  } catch (error) {
    next(error);
  }
});

export { financeRouter };