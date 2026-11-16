const { getPool } = require('./_lib/db');

const placementPoints = [12, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0, 0];

function buildLeaderboard(squads, scores) {
  const scoreMap = new Map();
  for (const score of scores) {
    if (!scoreMap.has(Number(score.slot))) scoreMap.set(Number(score.slot), []);
    scoreMap.get(Number(score.slot)).push({
      match_number: Number(score.match_number),
      placement: Number(score.placement),
      kills: Number(score.kills),
      points: placementPoints[Number(score.placement) - 1] + Number(score.kills)
    });
  }
  return squads.map((squad) => {
    const matchScores = scoreMap.get(squad.slot) || [];
    const placements = new Map(matchScores.map((item) => [item.match_number, item.placement]));
    return {
      ...squad,
      scores: Array.from({ length: 5 }, (_, i) => matchScores.find((item) => item.match_number === i + 1) || null),
      total_points: matchScores.reduce((total, item) => total + item.points, 0),
      total_booyahs: matchScores.filter((item) => item.placement === 1).length,
      total_kills: matchScores.reduce((total, item) => total + item.kills, 0),
      match5_placement: placements.get(5) || 13
    };
  }).sort((a, b) => b.total_points - a.total_points || b.total_booyahs - a.total_booyahs || b.total_kills - a.total_kills || a.match5_placement - b.match5_placement || a.slot - b.slot);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed.' });
  }
  try {
    const db = getPool();
    const [squadResult, scoreResult] = await Promise.all([
      db.query('SELECT slot, team_name, captain_name, department, whatsapp, player1, player2, player3, player4, substitute, created_at FROM squads ORDER BY slot'),
      db.query('SELECT slot, match_number, placement, kills, updated_at FROM match_scores ORDER BY slot, match_number')
    ]);
    const squadBySlot = new Map(squadResult.rows.map((squad) => [Number(squad.slot), squad]));
    const slots = Array.from({ length: 12 }, (_, i) => squadBySlot.get(i + 1) || {
      slot: i + 1, team_name: null, captain_name: null, department: null, whatsapp: null,
      player1: null, player2: null, player3: null, player4: null, substitute: null, created_at: null
    });
    return res.status(200).json({ squads: slots, leaderboard: buildLeaderboard(slots, scoreResult.rows), updated_at: new Date().toISOString() });
  } catch (error) {
    console.error('GET /api/tournament:', error);
    return res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'Unable to load tournament data. Check the database connection and schema.' });
  }
};
