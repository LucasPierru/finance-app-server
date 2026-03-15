export interface User {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  birthDate: string | null;
}

export type FinanceEntryType = "income" | "expense";

export type FinanceFrequency = "weekly" | "biweekly" | "monthly" | "yearly";

export interface FinanceCategory {
  id: string;
  type: FinanceEntryType;
  name: string;
  keywords: string[];
}

export interface FinanceItemInput {
  id: string;
  name: string;
  categoryId?: string;
  categoryName?: string;
  amount: number;
  rawAmount: string;
  frequency: FinanceFrequency;
}

export interface FinanceItem {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  amount: number;
  rawAmount: string;
  frequency: FinanceFrequency;
}

export interface FinanceEntry extends FinanceItem {
  type: FinanceEntryType;
}

export interface InvestmentSettings {
  annualReturn: number;
  years: number;
  initialAmount: number;
  dividendYield: number;
  incomeGrowth: number;
  expenseGrowth: number;
}

export interface FinanceState {
  revenues: FinanceItem[];
  costs: FinanceItem[];
  categories: FinanceCategory[];
  investmentSettings: InvestmentSettings;
}

export interface BankAccount {
  accountId: string;
  name: string;
  officialName: string | null;
  mask: string | null;
  type: string;
  subtype: string | null;
  currentBalance: number | null;
  availableBalance: number | null;
  isoCurrencyCode: string | null;
}

export interface BankTransaction {
  transactionId: string;
  accountId: string;
  date: string;
  name: string;
  merchantName: string | null;
  amount: number;
  isoCurrencyCode: string | null;
  category: string[];
  pending: boolean;
}

export interface BankConnectionState {
  connected: boolean;
  institutionName: string | null;
  lastSyncAt: string | null;
  accounts: BankAccount[];
  recentTransactions: BankTransaction[];
}

export interface StoredBankState {
  accessToken: string;
  itemId: string;
  institutionName: string | null;
  cursor: string | null;
  lastSyncAt: string | null;
  accounts: BankAccount[];
  transactions: BankTransaction[];
}