import { Router, type Request } from "express";
import { Products } from "plaid";
import { assertPlaidConfigured, normalizePlaidCountryCode, plaidClient } from "@lib/plaid";
import { getAuthenticatedUser } from "@middleware/auth";
import type { BankAccount, BankTransaction, StoredBankState } from "@lib/types";
import type { CreateLinkTokenBody, ExchangePublicTokenBody } from "@app-types/plaid";
import {
  clearStoredBankState,
  getBankConnectionState,
  getStoredBankState,
  replaceStoredBankState,
} from "@repositories/plaid";

const plaidRouter = Router();

function mapAccount(account: any): BankAccount {
  return {
    accountId: account.account_id,
    name: account.name,
    officialName: account.official_name,
    mask: account.mask,
    type: account.type,
    subtype: account.subtype,
    currentBalance: account.balances.current,
    availableBalance: account.balances.available,
    isoCurrencyCode: account.balances.iso_currency_code,
  };
}

function mapTransaction(transaction: any): BankTransaction {
  return {
    transactionId: transaction.transaction_id,
    accountId: transaction.account_id,
    date: transaction.date,
    name: transaction.name,
    merchantName: transaction.merchant_name,
    amount: transaction.amount,
    isoCurrencyCode: transaction.iso_currency_code,
    category: transaction.category ?? [],
    pending: transaction.pending,
  };
}

function upsertTransactions(existing: BankTransaction[], updates: BankTransaction[]): BankTransaction[] {
  const byId = new Map(existing.map((transaction) => [transaction.transactionId, transaction]));

  for (const transaction of updates) {
    byId.set(transaction.transactionId, transaction);
  }

  return [...byId.values()].sort((a, b) => b.date.localeCompare(a.date));
}

function removeTransactions(existing: BankTransaction[], removedIds: string[]): BankTransaction[] {
  const removedSet = new Set(removedIds);
  return existing.filter((transaction) => !removedSet.has(transaction.transactionId));
}

async function fetchTransactions(accessToken: string): Promise<{ cursor: string | null; transactions: BankTransaction[] }> {
  let cursor: string | null = null;
  let hasMore = true;
  let transactions: BankTransaction[] = [];

  while (hasMore) {
    const syncResponse = await plaidClient.transactionsSync({
      access_token: accessToken,
      cursor: cursor ?? undefined,
      count: 100,
    });

    transactions = transactions.concat(syncResponse.data.added.map(mapTransaction));
    cursor = syncResponse.data.next_cursor;
    hasMore = syncResponse.data.has_more;
  }

  return { cursor, transactions };
}

async function syncTransactionsForState(state: StoredBankState): Promise<StoredBankState> {
  let cursor = state.cursor;
  let hasMore = true;
  let nextTransactions = state.transactions;

  while (hasMore) {
    const response = await plaidClient.transactionsSync({
      access_token: state.accessToken,
      cursor: cursor ?? undefined,
      count: 100,
    });

    const added = response.data.added.map(mapTransaction);
    const modified = response.data.modified.map(mapTransaction);
    const removed = response.data.removed.map((entry) => entry.transaction_id);

    nextTransactions = upsertTransactions(nextTransactions, [...added, ...modified]);
    nextTransactions = removeTransactions(nextTransactions, removed);

    cursor = response.data.next_cursor;
    hasMore = response.data.has_more;
  }

  const accountsResponse = await plaidClient.accountsBalanceGet({
    access_token: state.accessToken,
  });

  return {
    ...state,
    cursor,
    accounts: accountsResponse.data.accounts.map(mapAccount),
    transactions: nextTransactions,
    lastSyncAt: new Date().toISOString(),
  };
}

plaidRouter.get("/state", async (req, res, next) => {
  try {
    const payload = await getBankConnectionState(getAuthenticatedUser(req).userId);
    res.json(payload);
  } catch (error) {
    next(error);
  }
});

plaidRouter.post("/link-token", async (req: Request<Record<string, string>, object, CreateLinkTokenBody>, res, next) => {
  try {
    assertPlaidConfigured();
    const { countryCode: bodyCountryCode } = req.body ?? {};
    const countryCode = normalizePlaidCountryCode(bodyCountryCode);
    const response = await plaidClient.linkTokenCreate({
      user: {
        client_user_id: getAuthenticatedUser(req).userId,
      },
      client_name: "WealthFlow",
      language: "en",
      country_codes: [countryCode],
      products: [Products.Transactions],
    });

    res.json({ linkToken: response.data.link_token });
  } catch (error) {
    next(error);
  }
});

plaidRouter.post("/exchange-public-token", async (req: Request<Record<string, string>, object, ExchangePublicTokenBody>, res, next) => {
  try {
    assertPlaidConfigured();
    const { publicToken: bodyPublicToken, institutionName: bodyInstitutionName } = req.body ?? {};

    const publicToken = String(bodyPublicToken ?? "").trim();
    const institutionName = bodyInstitutionName ? String(bodyInstitutionName) : null;

    if (!publicToken) {
      res.status(400).json({ message: "publicToken is required" });
      return;
    }

    const exchangeResponse = await plaidClient.itemPublicTokenExchange({
      public_token: publicToken,
    });

    const [{ cursor, transactions }, accountsResponse] = await Promise.all([
      fetchTransactions(exchangeResponse.data.access_token),
      plaidClient.accountsBalanceGet({ access_token: exchangeResponse.data.access_token }),
    ]);

    const state: StoredBankState = {
      accessToken: exchangeResponse.data.access_token,
      itemId: exchangeResponse.data.item_id,
      institutionName,
      cursor,
      lastSyncAt: new Date().toISOString(),
      accounts: accountsResponse.data.accounts.map(mapAccount),
      transactions,
    };

    await replaceStoredBankState(getAuthenticatedUser(req).userId, state);

    res.json({
      connected: true,
      institutionName: state.institutionName,
      lastSyncAt: state.lastSyncAt,
      accounts: state.accounts,
      recentTransactions: state.transactions.slice(0, 200),
    });
  } catch (error) {
    next(error);
  }
});

plaidRouter.post("/sync", async (req, res, next) => {
  try {
    assertPlaidConfigured();
    const state = await getStoredBankState(getAuthenticatedUser(req).userId);

    if (!state) {
      res.status(400).json({ message: "No bank account connected" });
      return;
    }

    const nextState = await syncTransactionsForState(state);
    await replaceStoredBankState(getAuthenticatedUser(req).userId, nextState);

    res.json({
      connected: true,
      institutionName: nextState.institutionName,
      accounts: nextState.accounts,
      recentTransactions: nextState.transactions.slice(0, 200),
      lastSyncAt: nextState.lastSyncAt,
    });
  } catch (error) {
    next(error);
  }
});

plaidRouter.delete("/connection", async (req, res, next) => {
  try {
    await clearStoredBankState(getAuthenticatedUser(req).userId);
    res.json({ connected: false });
  } catch (error) {
    next(error);
  }
});

export { plaidRouter };