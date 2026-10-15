const COLS = `o.id, o.listing_id AS "listingId", o.amount_usd::float8 AS "amountUsd", o.financing, o.contingencies,
  to_char(o.closing_date, 'YYYY-MM-DD') AS "closingDate", o.workflow_id AS "workflowId", o.created_at AS "createdAt"`;
const INSERT = `INSERT INTO offers (listing_id, user_id, amount_usd, financing, contingencies, closing_date) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`;
const BY_USER = `SELECT ${COLS}, l.address, l.city, l.price_usd::float8 AS "askingUsd" FROM offers o JOIN listings l ON l.id = o.listing_id WHERE o.user_id = $1 ORDER BY o.created_at DESC`;
const BY_ID = `SELECT ${COLS} FROM offers o WHERE o.id = $1 AND o.user_id = $2`;

export function makeOffersRepo(pool) {
  const rows = async (sql, params) => (await pool.query(sql, params)).rows;
  return {
    create: async (b) => (await rows(INSERT, [b.listingId, b.userId, b.amountUsd, b.financing, b.contingencies, b.closingDate ?? null]))[0].id,
    setWorkflow: (id, workflowId) => pool.query('UPDATE offers SET workflow_id = $2 WHERE id = $1', [id, workflowId]),
    remove: (id) => pool.query('DELETE FROM offers WHERE id = $1', [id]),
    byUser: (userId) => rows(BY_USER, [userId]),
    byId: async (id, userId) => (await rows(BY_ID, [id, userId]))[0] ?? null,
  };
}
