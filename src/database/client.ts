import { DB } from "@/types/database/db";
import { Kysely } from "kysely";
import { Database } from 'bun:sqlite';
import { BunSqliteDialect } from "kysely-bun-sqlite";

const dialect = new BunSqliteDialect({
    database: new Database('data.db'),
});
export const db = new Kysely<DB>({ dialect });