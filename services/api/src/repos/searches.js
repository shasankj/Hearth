const LIST = 'SELECT id, name, query, alerts, created_at AS "createdAt" FROM saved_searches WHERE user_id = $1 ORDER BY created_at DESC';
const INSERT = 'INSERT INTO saved_searches (user_id, name, query, alerts) VALUES ($1, $2, $3, $4) RETURNING id, name, query, alerts, created_at AS "createdAt"';
const REMOVE = 'DELETE FROM saved_searches WHERE user_id = $1 AND id = $2';
const ALERTS = 'UPDATE saved_searches SET alerts = $3 WHERE user_id = $1 AND id = $2';

export function makeSearchesRepo(pool) {
  return {
    list: async (userId) => (await pool.query(LIST, [userId])).rows,
    create: async (userId, { name, query, alerts }) => (await pool.query(INSERT, [userId, name, query, alerts])).rows[0],
    remove: async (userId, id) => (await pool.query(REMOVE, [userId, id])).rowCount > 0,
    setAlerts: async (userId, id, alerts) => (await pool.query(ALERTS, [userId, id, alerts])).rowCount > 0,
  };
}
