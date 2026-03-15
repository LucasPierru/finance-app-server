import { Pool } from "pg";
import { serverEnv } from "@config/env";

export const pool = new Pool({
  connectionString: serverEnv.databaseUrl,
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL client error", error);
});