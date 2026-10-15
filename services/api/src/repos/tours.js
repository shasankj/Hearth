// Read model only: the Java inspection service owns writes to `tours` (and its UNIQUE constraint).
const BY_USER = `SELECT t.id, t.listing_id AS "listingId", to_char(t.date, 'YYYY-MM-DD') AS date, l.address, l.city
  FROM tours t JOIN listings l ON l.id = t.listing_id WHERE t.user_id = $1 ORDER BY t.date`;

export function makeToursRepo(pool) {
  return { byUser: async (userId) => (await pool.query(BY_USER, [userId])).rows };
}
