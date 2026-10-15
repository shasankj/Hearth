const INSERT = `INSERT INTO inquiries (listing_id, user_id, name, email, phone, message) VALUES ($1, $2, $3, $4, $5, $6)
  RETURNING id, listing_id AS "listingId", created_at AS "createdAt"`;
const BY_USER = `SELECT i.id, i.listing_id AS "listingId", i.message, i.created_at AS "createdAt", l.address, l.city
  FROM inquiries i JOIN listings l ON l.id = i.listing_id WHERE i.user_id = $1 ORDER BY i.created_at DESC LIMIT 50`;

export function makeInquiriesRepo(pool) {
  return {
    create: async (userId, b) => (await pool.query(INSERT, [b.listingId, userId, b.name, b.email, b.phone, b.message])).rows[0],
    byUser: async (userId) => (await pool.query(BY_USER, [userId])).rows,
  };
}
