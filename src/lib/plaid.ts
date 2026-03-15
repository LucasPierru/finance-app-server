import { Configuration, CountryCode, PlaidApi, PlaidEnvironments } from "plaid";
import { plaidCredentialsConfigured, serverEnv } from "@config/env";

const environment =
  serverEnv.plaidEnv === "production"
    ? PlaidEnvironments.production
    : serverEnv.plaidEnv === "development"
      ? PlaidEnvironments.development
      : PlaidEnvironments.sandbox;

const configuration = new Configuration({
  basePath: environment,
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": serverEnv.plaidClientId,
      "PLAID-SECRET": serverEnv.plaidSecret,
    },
  },
});

export const plaidClient = new PlaidApi(configuration);

const allowedCountryCodes = new Set<string>(Object.values(CountryCode));

export function normalizePlaidCountryCode(value: string | null | undefined): CountryCode {
  const normalized = value?.trim().toUpperCase();
  if (!normalized || !allowedCountryCodes.has(normalized)) {
    return CountryCode.Us;
  }

  return normalized as CountryCode;
}

export function assertPlaidConfigured(): void {
  if (!plaidCredentialsConfigured()) {
    throw new Error("Plaid credentials are missing on the backend");
  }
}