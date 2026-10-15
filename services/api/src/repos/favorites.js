const IDS = 'SELECT listing_id FROM favorites WHERE user_id = $1 ORDER BY created_at DESC';
const ADD = 'INSERT INTO favorites (user_id, listing_id) VALUES ($1, $2) ON CONFLICT DO NOTHING';
const REMOVE = 'DELETE FROM favorites WHERE user_id = $1 AND listing_id = $2';

export function makeFavoritesRepo(pool) {
  return {
    ids: async (userId) => (await pool.query(IDS, [userId])).rows.map((r) => r.listing_id),
    add: (userId, listingId) => pool.query(ADD, [userId, listingId]),
    remove: (userId, listingId) => pool.query(REMOVE, [userId, listingId]),
  };
}
