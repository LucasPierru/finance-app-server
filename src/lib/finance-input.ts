import type { FinanceEntryType, FinanceItemInput, InvestmentSettings } from "@lib/types";
import type { z } from "zod";
import {
  categoryBodySchema,
  createEntrySchema,
  financeEntrySchema,
  settingsSchema,
  type ParsedCreateEntry,
} from "@schemas/finance";

function parseOrThrow<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, raw: unknown): T {
  const result = schema.safeParse(raw);
  if (!result.success) {
    const message = result.error.issues[0]?.message ?? "Invalid payload";
    throw new Error(message);
  }

  return result.data;
}

export function parseCategoryBody(raw: unknown): { type: FinanceEntryType; name: string } {
  return parseOrThrow<{ type: FinanceEntryType; name: string }>(categoryBodySchema, raw);
}

export function parseEntry(raw: unknown): FinanceItemInput {
  return parseOrThrow<FinanceItemInput>(financeEntrySchema, raw);
}

export function parseSettings(raw: unknown): InvestmentSettings {
  return parseOrThrow<InvestmentSettings>(settingsSchema, raw);
}

export function parseCreateEntry(raw: unknown): {
  type: FinanceEntryType;
  id?: string;
  name: string;
  categoryId?: string;
  categoryName?: string;
  amount: number;
  rawAmount: string;
  frequency: FinanceItemInput["frequency"];
} {
  return parseOrThrow<ParsedCreateEntry>(createEntrySchema, raw);
}

export function parseEntryTypeQuery(value: unknown): FinanceEntryType | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (value === "income" || value === "expense") {
    return value;
  }

  throw new Error("Query param type must be income or expense");
}
