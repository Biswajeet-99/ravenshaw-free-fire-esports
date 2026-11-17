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

  let connection;
  try {
    const pool = getPool();
    connection = await pool.getConnection();
    await connection.beginTransaction();

    for (const item of scores) {
      await connection.execute(
        `INSERT INTO match_scores (slot, match_number, placement, kills, updated_at)
         VALUES (?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE placement = VALUES(placement), kills = VALUES(kills), updated_at = NOW()`,
        [Number(item.slot), Number(item.match_number), Number(item.placement), Number(item.kills)]
      );
    }

    const slotList = [...new Set(scores.map((item) => Number(item.slot)))];
    const placeholders = slotList.map(() => '?').join(', ');
    const [existingRows] = await connection.execute(
      `SELECT slot FROM squads WHERE slot IN (${placeholders})`,
      slotList
    );
    const existingSet = new Set(existingRows.map((row) => Number(row.slot)));
    const missing = slotList.filter((slot) => !existingSet.has(slot));

    if (missing.length) {
      await connection.rollback();
      return res.status(400).json({ error: `Register squad slot ${missing[0]} before entering scores.` });
    }

    await connection.commit();
    return res.status(200).json({ message: `Saved ${scores.length} score entr${scores.length === 1 ? 'y' : 'ies'}.` });
  } catch (error) {
    if (connection) await connection.rollback().catch(() => {});
    console.error('POST /api/scores:', error);
    return res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'Unable to save scores. Check the database connection and try again.' });
  } finally {
    if (connection) connection.release();
  }
};
