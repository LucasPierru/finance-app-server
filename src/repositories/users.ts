import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { pool } from "@db/pool";
import { normalizeEmail } from "@lib/auth";
import type { User } from "@lib/types";

type Queryable = Pool | PoolClient;

function mapUser(row: Record<string, unknown>): User {
  return {
    id: String(row.id),
    email: String(row.email),
    name: row.name ? String(row.name) : null,
    phone: row.phone ? String(row.phone) : null,
    birthDate: row.birth_date ? new Date(String(row.birth_date)).toISOString().slice(0, 10) : null,
  };
}

export async function getUserById(userId: string, queryable: Queryable = pool): Promise<User | null> {
  const result = await queryable.query(
    `SELECT id, email, name, phone, birth_date
     FROM users
     WHERE id = $1`,
    [userId],
  );

  return result.rowCount === 0 ? null : mapUser(result.rows[0]);
}

export async function findUserByEmail(email: string, queryable: Queryable = pool): Promise<User | null> {
  const result = await queryable.query(
    `SELECT id, email, name, phone, birth_date
     FROM users
     WHERE email = $1`,
    [normalizeEmail(email)],
  );

  return result.rowCount === 0 ? null : mapUser(result.rows[0]);
}

export async function createUser(email: string, queryable: Queryable = pool): Promise<User> {
  const result = await queryable.query(
    `INSERT INTO users (id, email, created_at, updated_at)
     VALUES ($1, $2, NOW(), NOW())
     RETURNING id, email, name, phone, birth_date`,
    [randomUUID(), normalizeEmail(email)],
  );

  return mapUser(result.rows[0]);
}

export async function findOrCreateUserByEmail(email: string, queryable: Queryable = pool): Promise<User> {
  const existingUser = await findUserByEmail(email, queryable);
  if (existingUser) {
    return existingUser;
  }

  return createUser(email, queryable);
}

export async function markUserEmailVerified(queryable: Queryable, userId: string): Promise<void> {
  await queryable.query(
    `UPDATE users
     SET email_verified_at = NOW(),
         updated_at = NOW()
     WHERE id = $1`,
    [userId],
  );
}

export async function upsertUserProfileByEmail(
  email: string,
  profile: { name: string; phone: string; birthDate: string },
  queryable: Queryable = pool,
): Promise<User> {
  const normalizedEmail = normalizeEmail(email);
  const result = await queryable.query(
    `INSERT INTO users (id, email, name, phone, birth_date, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
     ON CONFLICT (email) WHERE email IS NOT NULL DO UPDATE SET
       name = EXCLUDED.name,
       phone = EXCLUDED.phone,
       birth_date = EXCLUDED.birth_date,
       updated_at = NOW()
     RETURNING id, email, name, phone, birth_date`,
    [randomUUID(), normalizedEmail, profile.name, profile.phone, profile.birthDate],
  );

  return mapUser(result.rows[0]);
}