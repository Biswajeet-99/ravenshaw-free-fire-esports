const crypto = require('node:crypto');
const { getPool } = require('./_lib/db');

function authorized(provided, expected) {
  if (!provided || !expected) return false;
  const actualBuffer = Buffer.from(String(provided));
  const expectedBuffer = Buffer.from(String(expected));
  return actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }
  if (!process.env.ADMIN_PIN) return res.status(503).json({ error: 'Score entry is unavailable: configure ADMIN_PIN on the server.' });
  if (!authorized(req.headers['admin-pin'], process.env.ADMIN_PIN)) return res.status(401).json({ error: 'Organizer PIN is missing or incorrect.' });
  const scores = req.body && req.body.scores;
  if (!Array.isArray(scores) || scores.length < 1 || scores.length > 60) return res.status(400).json({ error: 'Send between 1 and 60 score entries.' });
  const seen = new Set();
  for (const item of scores) {
    const slot = Number(item && item.slot);
    const match = Number(item && item.match_number);
    const placement = Number(item && item.placement);
    const kills = Number(item && item.kills);
    const key = `${slot}:${match}`;
    if (!Number.isInteger(slot) || slot < 1 || slot > 12 || !Number.isInteger(match) || match < 1 || match > 5 ||
      !Number.isInteger(placement) || placement < 1 || placement > 12 || !Number.isInteger(kills) || kills < 0 || kills > 999) {
      return res.status(400).json({ error: 'Each score needs a valid slot (1–12), match (1–5), placement (1–12), and non-negative whole-number kills.' });
    }
    if (seen.has(key)) return res.status(400).json({ error: 'A score entry was included more than once.' });
    seen.add(key);
  }
  let client;
  try {
    const pool = getPool();
    client = await pool.connect();
    await client.query('BEGIN');
    for (const item of scores) {
      await client.query(
        `INSERT INTO match_scores (slot, match_number, placement, kills, updated_at)
         SELECT $1,$2,$3,$4,NOW() WHERE EXISTS (SELECT 1 FROM squads WHERE slot = $1)
         ON CONFLICT (slot, match_number) DO UPDATE SET placement = EXCLUDED.placement, kills = EXCLUDED.kills, updated_at = NOW()`,
        [Number(item.slot), Number(item.match_number), Number(item.placement), Number(item.kills)]
      );
    }
    const missingSquads = await client.query(
      'SELECT DISTINCT input.slot FROM unnest($1::int[]) AS input(slot) LEFT JOIN squads s ON s.slot = input.slot WHERE s.slot IS NULL',
      [Array.from(new Set(scores.map((item) => Number(item.slot))))]
    );
    if (missingSquads.rowCount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Register squad slot ${missingSquads.rows[0].slot} before entering scores.` });
    }
    await client.query('COMMIT');
    return res.status(200).json({ message: `Saved ${scores.length} score entr${scores.length === 1 ? 'y' : 'ies'}.` });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('POST /api/scores:', error);
    return res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'Unable to save scores. Check the database connection and try again.' });
  } finally {
    if (client) client.release();
  }
};
