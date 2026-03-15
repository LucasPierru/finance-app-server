import type { Pool, PoolClient } from "pg";
import { pool } from "../db/pool.js";

interface LoginCodeRow {
  id: string;
  userId: string;
  email: string;
  codeHash: string;
}

interface RefreshTokenRow {
  id: string;
  userId: string;
  expiresAt: string;
  revokedAt: string | null;
}

type Queryable = Pool | PoolClient;

export async function storeLoginCode(userId: string, email: string, codeHash: string, expiresAt: Date): Promise<void> {
  await pool.query(
    `INSERT INTO login_codes (user_id, email, code_hash, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [userId, email, codeHash, expiresAt],
  );
}

export async function getLatestActiveLoginCode(client: PoolClient, email: string): Promise<LoginCodeRow | null> {
  const result = await client.query(
    `SELECT id, user_id, email, code_hash
     FROM login_codes
     WHERE email = $1
       AND consumed_at IS NULL
       AND expires_at > NOW()
     ORDER BY created_at DESC
     LIMIT 1
     FOR UPDATE`,
    [email],
  );

  if (result.rowCount === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: String(row.id),
    userId: String(row.user_id),
    email: String(row.email),
    codeHash: String(row.code_hash),
  };
}

export async function consumeLoginCode(client: PoolClient, loginCodeId: string): Promise<void> {
  await client.query(
    `UPDATE login_codes
     SET consumed_at = NOW()
     WHERE id = $1`,
    [loginCodeId],
  );
}

export async function storeRefreshToken(
  queryable: Queryable,
  userId: string,
  tokenHash: string,
  expiresAt: Date,
): Promise<void> {
  await queryable.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt],
  );
}

export async function getActiveRefreshToken(tokenHash: string): Promise<RefreshTokenRow | null> {
  const result = await pool.query(
    `SELECT id, user_id, expires_at, revoked_at
     FROM refresh_tokens
     WHERE token_hash = $1`,
    [tokenHash],
  );

  if (result.rowCount === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: String(row.id),
    userId: String(row.user_id),
    expiresAt: new Date(String(row.expires_at)).toISOString(),
    revokedAt: row.revoked_at ? new Date(String(row.revoked_at)).toISOString() : null,
  };
}

export async function revokeRefreshToken(queryable: Queryable, refreshTokenId: string): Promise<void> {
  await queryable.query(
    `UPDATE refresh_tokens
     SET revoked_at = NOW()
     WHERE id = $1
       AND revoked_at IS NULL`,
    [refreshTokenId],
  );
}

export async function revokeRefreshTokenByHash(tokenHash: string): Promise<void> {
  await pool.query(
    `UPDATE refresh_tokens
     SET revoked_at = NOW()
     WHERE token_hash = $1
       AND revoked_at IS NULL`,
    [tokenHash],
  );
}
