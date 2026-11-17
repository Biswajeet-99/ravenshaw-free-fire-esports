const { getPool } = require('./_lib/db');

const requiredText = ['team_name', 'captain_name', 'department', 'whatsapp', 'player1', 'player2', 'player3', 'player4'];

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const body = req.body || {};
  const slot = Number(body.slot);
  if (!Number.isInteger(slot) || slot < 1 || slot > 12) return res.status(400).json({ error: 'Choose a valid squad slot (1–12).' });

  for (const field of requiredText) {
    if (typeof body[field] !== 'string' || !body[field].trim()) return res.status(400).json({ error: `${field.replaceAll('_', ' ')} is required.` });
    if (body[field].trim().length > 120) return res.status(400).json({ error: `${field.replaceAll('_', ' ')} must be 120 characters or fewer.` });
  }

  if (typeof body.substitute !== 'undefined' && (typeof body.substitute !== 'string' || body.substitute.trim().length > 120)) {
    return res.status(400).json({ error: 'Substitute must be 120 characters or fewer.' });
  }

  try {
    const values = [
      slot,
      ...requiredText.map((field) => body[field].trim()),
      (body.substitute || '').trim()
    ];

    const [result] = await getPool().execute(
      `INSERT IGNORE INTO squads (slot, team_name, captain_name, department, whatsapp, player1, player2, player3, player4, substitute)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      values
    );

    if (!result.affectedRows) {
      return res.status(409).json({ error: 'That squad slot has already been registered. Please choose an open slot.' });
    }

    return res.status(201).json({ message: 'Squad registered successfully.', slot });
  } catch (error) {
    console.error('POST /api/register:', error);
    return res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'Unable to save registration. Please try again later.' });
  }
};
