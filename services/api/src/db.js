import pg from 'pg';

// One pool per process. Works unchanged against AWS RDS: set DATABASE_URL=postgres://user:pass@host:5432/db?sslmode=require
export function makePool(url) {
  return new pg.Pool({ connectionString: url, max: 10, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 5_000 });
}

export const PG_UNIQUE_VIOLATION = '23505';
export const PG_FOREIGN_KEY_VIOLATION = '23503';
