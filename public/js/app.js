(() => {
  'use strict';
  const API = '/api';
  const placementPoints = [12, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0, 0];
  const state = { squads: [], leaderboard: [], pin: sessionStorage.getItem('organizerPin') || '', unlocked: false, loading: false };
  const $ = (selector) => document.querySelector(selector);
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const toast = (message, error = false) => {
    const node = document.createElement('div'); node.className = `toast${error ? ' error' : ''}`; node.textContent = message;
    $('#toast-region').append(node); window.setTimeout(() => node.remove(), 4200);
  };
  async function request(url, options = {}) {
    const response = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
    return data;
  }
  function sortedLeaderboard(squads) {
    return squads.map((squad) => {
      const scores = squad.scores || [];
      const submitted = scores.filter(Boolean);
      return { ...squad, total_points: submitted.reduce((sum, score) => sum + placementPoints[Number(score.placement) - 1] + Number(score.kills), 0), total_booyahs: submitted.filter((score) => Number(score.placement) === 1).length, total_kills: submitted.reduce((sum, score) => sum + Number(score.kills), 0), match5_placement: Number(scores[4]?.placement || 13) };
    }).sort((a, b) => b.total_points - a.total_points || b.total_booyahs - a.total_booyahs || b.total_kills - a.total_kills || a.match5_placement - b.match5_placement || a.slot - b.slot);
  }
  function renderLeaderboard() {
    const rows = [...state.leaderboard].sort((a, b) => b.total_points - a.total_points || b.total_booyahs - a.total_booyahs || b.total_kills - a.total_kills || a.match5_placement - b.match5_placement || a.slot - b.slot);
    $('#leaderboard-body').innerHTML = rows.map((squad, index) => {
      const registered = Boolean(squad.team_name);
      const rankClass = ['gold', 'silver', 'bronze'][index] || '';
      const matchCells = Array.from({ length: 5 }, (_, i) => {
        const score = (squad.scores || [])[i];
        return `<td class="match-cell">${score ? `${escapeHtml(score.placement)}<em> / ${escapeHtml(score.kills)}k</em>` : '<em>—</em>'}</td>`;
      }).join('');
      return `<tr><td><span class="rank ${rankClass}">${String(index + 1).padStart(2, '0')}</span></td><td><span class="team-name">${registered ? escapeHtml(squad.team_name) : `<span class="empty-slot">Slot ${String(squad.slot).padStart(2, '0')} · Open</span>`}</span>${registered ? `<span class="team-dept">${escapeHtml(squad.department || '')}</span>` : ''}</td><td>${squad.total_booyahs || 0}</td><td>${squad.total_kills || 0}</td>${matchCells}<td><span class="points">${squad.total_points || 0}</span></td></tr>`;
    }).join('');
    const open = state.squads.filter((squad) => !squad.team_name);
    $('#slot-select').innerHTML = open.length ? '<option value="">Select an open slot</option>' + open.map((slot) => `<option value="${slot.slot}">Slot ${String(slot.slot).padStart(2, '0')}</option>`).join('') : '<option value="">All squad slots are registered</option>';
    $('#slot-select').disabled = open.length === 0;
  }
  async function loadTournament(showError = true) {
    if (state.loading) return; state.loading = true;
    try {
      const data = await request(`${API}/tournament`);
      state.squads = data.squads || [];
      // Recompute the public standings with the same points and tie-break rules as the API.
      state.leaderboard = sortedLeaderboard(state.squads);
      renderLeaderboard();
      $('#updated-label').textContent = `Updated ${new Date(data.updated_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      if (state.unlocked) renderScoreEntry();
    } catch (error) {
      $('#updated-label').textContent = 'Live data unavailable';
      $('#leaderboard-body').innerHTML = `<tr><td colspan="10" class="loading-cell">${escapeHtml(error.message)} — check database setup.</td></tr>`;
      if (showError) toast(error.message, true);
    } finally { state.loading = false; }
  }
  function renderScoreEntry() {
    const registered = state.squads.filter((squad) => squad.team_name);
    if (!registered.length) { $('#score-content').innerHTML = '<div class="score-lock"><h3>No registered squads yet</h3><p>Squads must register before match scores can be entered.</p></div>'; return; }
    const header = '<thead><tr><th>SQUAD</th>' + Array.from({ length: 5 }, (_, i) => `<th>MATCH ${i + 1}<br>PLACE / KILLS</th>`).join('') + '</tr></thead>';
    const rows = registered.map((squad) => `<tr><td>${escapeHtml(squad.team_name)}<br><span class="team-dept">SLOT ${String(squad.slot).padStart(2, '0')}</span></td>${Array.from({ length: 5 }, (_, i) => {
      const score = (squad.scores || [])[i] || {};
      return `<td><input aria-label="${escapeHtml(squad.team_name)} match ${i + 1} placement" type="number" min="1" max="12" step="1" required data-slot="${squad.slot}" data-match="${i + 1}" data-field="placement" value="${score.placement ?? ''}" placeholder="Place"><input aria-label="${escapeHtml(squad.team_name)} match ${i + 1} kills" type="number" min="0" step="1" required data-slot="${squad.slot}" data-match="${i + 1}" data-field="kills" value="${score.kills ?? ''}" placeholder="Kills"></td>`;
    }).join('')}</tr>`).join('');
    $('#score-content').innerHTML = `<form id="score-form"><div class="score-table-wrap"><table class="score-table">${header}<tbody>${rows}</tbody></table></div><div class="score-actions"><p>Placement: 1st = 12 pts · Kill = 1 pt · Only filled match results are saved.</p><button class="button button-primary" type="submit">Save match scores</button></div></form>`;
    $('#score-form').addEventListener('submit', saveScores);
  }
  async function saveScores(event) {
    event.preventDefault();
    const form = event.currentTarget; if (!form.reportValidity()) return;
    const inputs = [...form.querySelectorAll('input')]; const map = new Map();
    for (const input of inputs) {
      const key = `${input.dataset.slot}:${input.dataset.match}`;
      if (!map.has(key)) map.set(key, { slot: Number(input.dataset.slot), match_number: Number(input.dataset.match) });
      map.get(key)[input.dataset.field] = Number(input.value);
    }
    const entries = [...map.values()];
    if (entries.some((entry) => !Number.isInteger(entry.placement) || entry.placement < 1 || entry.placement > 12 || !Number.isInteger(entry.kills) || entry.kills < 0)) { toast('Enter a placement from 1–12 and a non-negative whole number of kills.', true); return; }
    const button = form.querySelector('button[type="submit"]'); button.disabled = true; button.textContent = 'Saving scores…';
    try {
      const data = await request(`${API}/scores`, { method: 'POST', headers: { 'admin-pin': state.pin }, body: JSON.stringify({ scores: entries }) });
      toast(data.message || 'Scores saved.'); await loadTournament(false);
    } catch (error) { toast(error.message, true); }
    finally { button.disabled = false; button.textContent = 'Save match scores'; }
  }
  function setUnlocked(value) {
    state.unlocked = value;
    $('#organizer-label').textContent = value ? 'Organizer unlocked' : 'Organizer login (PIN)';
    $('#score-content').innerHTML = value ? '' : '<div class="score-lock"><span class="lock-icon">⌑</span><h3>Organizer access required</h3><p>Unlock score entry to update results for Matches 1–5.</p><button class="button button-primary" type="button" id="unlock-button">Enter organizer PIN</button></div>';
    if (value) renderScoreEntry();
    else $('#unlock-button')?.addEventListener('click', () => $('#pin-dialog').showModal());
  }
  document.querySelectorAll('.tab').forEach((tab) => tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((item) => { item.classList.toggle('active', item === tab); item.setAttribute('aria-selected', String(item === tab)); });
    document.querySelectorAll('.panel').forEach((panel) => { const active = panel.id === `panel-${tab.dataset.tab}`; panel.classList.toggle('active', active); panel.hidden = !active; });
  }));
  $('#registration-form').addEventListener('submit', async (event) => {
    event.preventDefault(); const form = event.currentTarget; if (!form.reportValidity()) return;
    const button = form.querySelector('button[type="submit"]'); const values = Object.fromEntries(new FormData(form).entries()); button.disabled = true; button.textContent = 'Submitting…';
    try { const data = await request(`${API}/register`, { method: 'POST', body: JSON.stringify(values) }); toast(data.message || 'Squad registered!'); form.reset(); await loadTournament(false); }
    catch (error) { toast(error.message, true); }
    finally { button.disabled = false; button.innerHTML = 'Register squad <span>→</span>'; }
  });
  $('#refresh-button').addEventListener('click', () => loadTournament());
  $('#organizer-login').addEventListener('click', () => state.unlocked ? setUnlocked(false) : $('#pin-dialog').showModal());
  $('#unlock-button')?.addEventListener('click', () => $('#pin-dialog').showModal());
  $('#pin-form').addEventListener('submit', async (event) => {
    if (event.submitter?.value === 'cancel') return;
    event.preventDefault(); const pin = $('#pin-input').value.trim(); if (!pin) return;
    try {
      await request(`${API}/scores`, { method: 'POST', headers: { 'admin-pin': pin }, body: JSON.stringify({ scores: [] }) });
    } catch (error) {
      if (!/between 1 and 60/i.test(error.message)) { toast(error.message, true); return; }
    }
    state.pin = pin; sessionStorage.setItem('organizerPin', pin); $('#pin-dialog').close(); $('#pin-input').value = ''; setUnlocked(true); toast('Organizer score entry unlocked.');
  });
  $('#pin-dialog').addEventListener('close', () => { if (!state.unlocked) $('#pin-input').value = ''; });
  $('#refresh-button').addEventListener('click', () => { const icon = $('.refresh-icon'); icon.style.transform = 'rotate(360deg)'; setTimeout(() => { icon.style.transform = ''; }, 450); });
  setUnlocked(false);
  loadTournament();
  window.setInterval(() => loadTournament(false), 30000);
})();
