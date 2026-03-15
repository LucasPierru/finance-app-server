import { z } from "zod";
import type { FinanceEntryType, FinanceFrequency, FinanceItemInput, InvestmentSettings } from "@lib/types";

const entryTypeSchema = z.enum(["income", "expense"]);
const frequencySchema = z.enum(["weekly", "biweekly", "monthly", "yearly"]);

const nonEmptyString = z.string().trim().min(1);
const optionalNonEmptyString = nonEmptyString.optional();
const numericValue = z.preprocess((value) => (typeof value === "string" ? Number(value) : value), z.number().finite());

function requireCategory(value: { categoryId?: string; categoryName?: string }, ctx: z.RefinementCtx): void {
  if (!value.categoryId && !value.categoryName) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["categoryName"],
      message: "Either categoryId or categoryName is required",
    });
  }
}

export const categoryBodySchema = z.object({
  type: entryTypeSchema,
  name: nonEmptyString,
});

export const financeEntrySchema = z
  .object({
    id: nonEmptyString,
    name: nonEmptyString,
    categoryId: optionalNonEmptyString,
    categoryName: optionalNonEmptyString,
    amount: numericValue,
    rawAmount: nonEmptyString,
    frequency: frequencySchema,
  })
  .superRefine(requireCategory)
  .transform((value) => value);

export type ParsedCreateEntry = {
  type: FinanceEntryType;
  id?: string;
  name: string;
  categoryId?: string;
  categoryName?: string;
  amount: number;
  rawAmount: string;
  frequency: FinanceFrequency;
};

export const createEntrySchema = z
  .object({
    type: entryTypeSchema,
    id: optionalNonEmptyString,
    name: nonEmptyString,
    categoryId: optionalNonEmptyString,
    categoryName: optionalNonEmptyString,
    amount: numericValue,
    rawAmount: nonEmptyString,
    frequency: frequencySchema,
  })
  .superRefine(requireCategory)
  .transform((value) => value);

export const settingsSchema = z.object({
  annualReturn: numericValue,
  years: numericValue,
  initialAmount: numericValue,
  dividendYield: numericValue,
  incomeGrowth: numericValue,
  expenseGrowth: numericValue,
});
