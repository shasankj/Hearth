const INSERT = 'INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING id, email, name';
const BY_EMAIL = 'SELECT id, email, name, password_hash AS "passwordHash" FROM users WHERE email = $1';
const BY_ID = 'SELECT id, email, name FROM users WHERE id = $1';

export function makeUsersRepo(pool) {
  const one = async (sql, params) => (await pool.query(sql, params)).rows[0] ?? null;
  return {
    create: ({ email, name, passwordHash }) => one(INSERT, [email, name, passwordHash]),
    byEmail: (email) => one(BY_EMAIL, [email]),
    byId: (id) => one(BY_ID, [id]),
  };
}
