import type { FinanceEntryType, FinanceFrequency, InvestmentSettings } from "@lib/types";

export interface FinanceEntryItem {
  id?: string;
  name?: string;
  categoryId?: string;
  categoryName?: string;
  amount?: number;
  rawAmount?: string;
  frequency?: FinanceFrequency;
}

export interface CreateCategoryBody {
  type?: FinanceEntryType;
  name?: string;
}

export interface CreateEntryBody {
  type?: FinanceEntryType;
  id?: string;
  name?: string;
  categoryId?: string;
  categoryName?: string;
  amount?: number;
  rawAmount?: string;
  frequency?: FinanceFrequency;
}

export type ReplaceEntriesBody = FinanceEntryItem[];

export type UpdateSettingsBody = Partial<InvestmentSettings>;