import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { pool } from "../db/pool.js";
import { AppError } from "../lib/errors.js";
import type {
  FinanceCategory,
  FinanceEntryKind,
  FinanceItem,
  FinanceItemInput,
  FinanceState,
  InvestmentSettings,
} from "../lib/types.js";

const defaultInvestmentSettings: InvestmentSettings = {
  annualReturn: 7,
  years: 20,
  initialAmount: 0,
  dividendYield: 2,
  incomeGrowth: 2,
  expenseGrowth: 2,
};

function mapFinanceCategory(row: Record<string, unknown>): FinanceCategory {
  return {
    id: String(row.id),
    kind: row.kind as FinanceEntryKind,
    name: String(row.name),
  };
}

function mapFinanceItem(row: Record<string, unknown>): FinanceItem {
  return {
    id: String(row.id),
    name: String(row.name),
    categoryId: String(row.category_id),
    categoryName: String(row.category_name),
    amount: Number(row.amount),
    rawAmount: String(row.raw_amount),
    frequency: row.frequency as FinanceItem["frequency"],
  };
}

async function resolveCategory(
  userId: string,
  kind: FinanceEntryKind,
  entry: FinanceItemInput,
  cache: Map<string, FinanceCategory>,
  client: PoolClient,
): Promise<FinanceCategory> {
  const categoryName = entry.categoryName?.trim();

  if (entry.categoryId) {
    const cacheKey = `id:${entry.categoryId}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const result = await client.query(
      `SELECT id, kind, name
       FROM entry_categories
       WHERE id = $1 AND user_id = $2 AND kind = $3`,
      [entry.categoryId, userId, kind],
    );

    if (result.rowCount === 0) {
      throw new AppError(400, "Unknown categoryId for finance item");
    }

    const category = mapFinanceCategory(result.rows[0]);
    cache.set(cacheKey, category);
    cache.set(`name:${kind}:${category.name.toLowerCase()}`, category);
    return category;
  }

  if (!categoryName) {
    throw new AppError(400, "Finance item category is required");
  }

  const cacheKey = `name:${kind}:${categoryName.toLowerCase()}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const existingResult = await client.query(
    `SELECT id, kind, name
     FROM entry_categories
     WHERE user_id = $1 AND kind = $2 AND LOWER(name) = LOWER($3)
     LIMIT 1`,
    [userId, kind, categoryName],
  );

  if ((existingResult.rowCount ?? 0) > 0) {
    const existingCategory = mapFinanceCategory(existingResult.rows[0]);
    cache.set(cacheKey, existingCategory);
    cache.set(`id:${existingCategory.id}`, existingCategory);
    return existingCategory;
  }

  const createdResult = await client.query(
    `INSERT INTO entry_categories (id, user_id, kind, name)
     VALUES ($1, $2, $3, $4)
     RETURNING id, kind, name`,
    [randomUUID(), userId, kind, categoryName],
  );

  const createdCategory = mapFinanceCategory(createdResult.rows[0]);
  cache.set(cacheKey, createdCategory);
  cache.set(`id:${createdCategory.id}`, createdCategory);
  return createdCategory;
}

function mapSettings(row: Record<string, unknown> | undefined): InvestmentSettings {
  if (!row) {
    return defaultInvestmentSettings;
  }

  return {
    annualReturn: Number(row.annual_return),
    years: Number(row.years),
    initialAmount: Number(row.initial_amount),
    dividendYield: Number(row.dividend_yield),
    incomeGrowth: Number(row.income_growth),
    expenseGrowth: Number(row.expense_growth),
  };
}

export async function getFinanceState(userId: string): Promise<FinanceState> {
  const [entriesResult, settingsResult, categoriesResult] = await Promise.all([
    pool.query(
      `SELECT e.id, e.kind, e.name, e.category_id, c.name AS category_name, e.amount, e.raw_amount, e.frequency
       FROM entries e
       JOIN entry_categories c ON c.id = e.category_id
       WHERE e.user_id = $1
       ORDER BY e.created_at ASC`,
      [userId],
    ),
    pool.query(
      `SELECT annual_return, years, initial_amount, dividend_yield, income_growth, expense_growth
       FROM investment_settings
       WHERE user_id = $1`,
      [userId],
    ),
    pool.query(
      `SELECT id, kind, name
       FROM entry_categories
       WHERE user_id = $1
       ORDER BY kind ASC, name ASC`,
      [userId],
    ),
  ]);

  const revenues = entriesResult.rows
    .filter((row: { kind: string }) => row.kind === "income")
    .map(mapFinanceItem);
  const costs = entriesResult.rows
    .filter((row: { kind: string }) => row.kind === "expense")
    .map(mapFinanceItem);

  return {
    revenues,
    costs,
    categories: categoriesResult.rows.map(mapFinanceCategory),
    investmentSettings: mapSettings(settingsResult.rows[0]),
  };
}

export async function getFinanceCategories(userId: string): Promise<FinanceCategory[]> {
  const result = await pool.query(
    `SELECT id, kind, name
     FROM entry_categories
     WHERE user_id = $1
     ORDER BY kind ASC, name ASC`,
    [userId],
  );

  return result.rows.map(mapFinanceCategory);
}

export async function createFinanceCategory(
  userId: string,
  kind: FinanceEntryKind,
  name: string,
): Promise<FinanceCategory> {
  const categoryName = name.trim();
  if (!categoryName) {
    throw new AppError(400, "Category name is required");
  }

  const existingResult = await pool.query(
    `SELECT id, kind, name
     FROM entry_categories
     WHERE user_id = $1 AND kind = $2 AND LOWER(name) = LOWER($3)
     LIMIT 1`,
    [userId, kind, categoryName],
  );

  if ((existingResult.rowCount ?? 0) > 0) {
    return mapFinanceCategory(existingResult.rows[0]);
  }

  const result = await pool.query(
    `INSERT INTO entry_categories (id, user_id, kind, name)
     VALUES ($1, $2, $3, $4)
     RETURNING id, kind, name`,
    [randomUUID(), userId, kind, categoryName],
  );

  return mapFinanceCategory(result.rows[0]);
}

export async function replaceFinanceEntries(
  userId: string,
  kind: FinanceEntryKind,
  entries: FinanceItemInput[],
): Promise<FinanceItem[]> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM entries WHERE user_id = $1 AND kind = $2`, [userId, kind]);

    const categoryCache = new Map<string, FinanceCategory>();
    const savedEntries: FinanceItem[] = [];

    for (const entry of entries) {
      const category = await resolveCategory(userId, kind, entry, categoryCache, client);

      await client.query(
        `INSERT INTO entries (id, user_id, kind, name, category_id, amount, raw_amount, frequency)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [entry.id, userId, kind, entry.name, category.id, entry.amount, entry.rawAmount, entry.frequency],
      );

      savedEntries.push({
        id: entry.id,
        name: entry.name,
        categoryId: category.id,
        categoryName: category.name,
        amount: entry.amount,
        rawAmount: entry.rawAmount,
        frequency: entry.frequency,
      });
    }

    await client.query("COMMIT");
    return savedEntries;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function replaceInvestmentSettings(
  userId: string,
  settings: InvestmentSettings,
): Promise<InvestmentSettings> {
  await pool.query(
    `INSERT INTO investment_settings (
      user_id,
      annual_return,
      years,
      initial_amount,
      dividend_yield,
      income_growth,
      expense_growth,
      updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      annual_return = EXCLUDED.annual_return,
      years = EXCLUDED.years,
      initial_amount = EXCLUDED.initial_amount,
      dividend_yield = EXCLUDED.dividend_yield,
      income_growth = EXCLUDED.income_growth,
      expense_growth = EXCLUDED.expense_growth,
      updated_at = NOW()`,
    [
      userId,
      settings.annualReturn,
      settings.years,
      settings.initialAmount,
      settings.dividendYield,
      settings.incomeGrowth,
      settings.expenseGrowth,
    ],
  );

  return settings;
}

export { defaultInvestmentSettings };