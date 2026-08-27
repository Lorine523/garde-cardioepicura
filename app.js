/* ---------- pure scheduling logic (also runnable outside the browser) ---------- */

function pad2(n) { return String(n).padStart(2, '0'); }

function dateRange(startISO, endISO) {
  const res = [];
  let d = new Date(startISO + 'T00:00:00Z');
  const end = new Date(endISO + 'T00:00:00Z');
  while (d <= end) {
    const iso = d.toISOString().slice(0, 10);
    const jsDow = d.getUTCDay();
    const dow = (jsDow + 6) % 7;
    res.push({ iso, dow });
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return res;
}

function shiftDate(iso, deltaDays) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

function dowOf(iso) {
  const d = new Date(iso + 'T00:00:00Z');
  return (d.getUTCDay() + 6) % 7;
}

function lastDateWithDow(onOrBeforeIso, targetDow) {
  const delta = (dowOf(onOrBeforeIso) - targetDow + 7) % 7;
  return shiftDate(onOrBeforeIso, -delta);
}

/** Local "today" as an ISO date, in the viewer's own timezone. */
function todayISO() {
  const d = new Date();
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

/** How many months (including the current one) the schedule always keeps visible. */
const HORIZON_MONTHS = 6;

/** Rolling horizon: always the last day of (current month + HORIZON_MONTHS - 1). */
function computeHorizonEnd() {
  const d = new Date();
  const last = new Date(d.getFullYear(), d.getMonth() + HORIZON_MONTHS, 0);
  return last.getFullYear() + '-' + pad2(last.getMonth() + 1) + '-' + pad2(last.getDate());
}

function bump(map, name) {
  if (name != null) map[name] = (map[name] || 0) + 1;
}

/**
 * Runs the day-by-day assignment logic over `days`, continuing from the
 * supplied context (rotation pointers / running loads / last weekend
 * picks). Mutates `ctx` in place and returns the new assignments, keyed
 * by ISO date. Pure with respect to `state.assignments` — callers decide
 * how to merge the result in.
 */
function runGeneration(state, days, ctx) {
  const appelablePool = state.pools.appelable.slice();
  const weekendPool = state.pools.weekend.slice();
  const intPool = state.pools.intervention.slice();

  function isAbsent(name, iso) {
    return !!(state.absences[name] && state.absences[name].indexOf(iso) !== -1);
  }
  function isRestricted(name, dow) {
    return !!(state.restrictions[name] && state.restrictions[name].indexOf(dow) !== -1);
  }
  function pickLeastLoaded(candidates, loadMap) {
    if (!candidates.length) return null;
    let best = candidates[0];
    for (const c of candidates) if ((loadMap[c] || 0) < (loadMap[best] || 0)) best = c;
    bump(loadMap, best);
    return best;
  }
  function nextRotation(pool, ptrKey, loadKey, avoid, iso) {
    const n = pool.length;
    if (!n) return null;
    let choice = null;
    for (let attempt = 0; attempt < n; attempt++) {
      const cand = pool[(ctx[ptrKey] + attempt) % n];
      if (isAbsent(cand, iso)) continue;
      if (cand === avoid && attempt < n - 1) continue;
      choice = cand;
      ctx[ptrKey] = (ctx[ptrKey] + attempt + 1) % n;
      break;
    }
    if (choice === null) choice = pickLeastLoaded(pool, ctx[loadKey]);
    else bump(ctx[loadKey], choice);
    return choice;
  }

  const assignments = {};
  for (const { iso, dow } of days) {
    let appel = null, tour = null, interv = null;
    if (dow <= 3) {
      const fixed = state.interventionWeekday[dow];
      if (fixed && intPool.indexOf(fixed) !== -1 && !isAbsent(fixed, iso)) {
        interv = fixed;
        bump(ctx.intLoad, interv);
      } else {
        interv = pickLeastLoaded(intPool.filter((p) => !isAbsent(p, iso)), ctx.intLoad);
      }
      if (interv && !isRestricted(interv, dow) && !isAbsent(interv, iso)) {
        appel = interv;
        bump(ctx.appelLoad, appel);
      } else {
        appel = pickLeastLoaded(
          appelablePool.filter((p) => !isRestricted(p, dow) && !isAbsent(p, iso)),
          ctx.appelLoad
        );
      }
    } else if (dow === 4) {
      ctx.lastIntWeekend = nextRotation(intPool, 'intPtr', 'intLoad', ctx.lastIntWeekend, iso);
      interv = ctx.lastIntWeekend;
      appel = pickLeastLoaded(
        appelablePool.filter((p) => !isRestricted(p, dow) && !isAbsent(p, iso)),
        ctx.appelLoad
      );
    } else if (dow === 5) {
      interv = ctx.lastIntWeekend;
      ctx.lastTourWeekend = nextRotation(weekendPool, 'weekendPtr', 'weekendLoad', ctx.lastTourWeekend, iso);
      tour = ctx.lastTourWeekend;
      if (tour && appelablePool.indexOf(tour) !== -1 && !isRestricted(tour, dow) && !isAbsent(tour, iso)) {
        appel = tour;
        bump(ctx.appelLoad, appel);
      } else {
        appel = pickLeastLoaded(
          appelablePool.filter((p) => !isRestricted(p, dow) && !isAbsent(p, iso)),
          ctx.appelLoad
        );
      }
    } else {
      interv = ctx.lastIntWeekend;
      tour = ctx.lastTourWeekend;
      if (tour && appelablePool.indexOf(tour) !== -1 && !isRestricted(tour, dow) && !isAbsent(tour, iso)) {
        appel = tour;
        bump(ctx.appelLoad, appel);
      } else {
        appel = pickLeastLoaded(
          appelablePool.filter((p) => !isRestricted(p, dow) && !isAbsent(p, iso)),
          ctx.appelLoad
        );
      }
    }
    assignments[iso] = { appelable: appel, weekend: tour, intervention: interv };
  }
  return assignments;
}

/**
 * Builds a fresh generation context by reading the schedule's own history
 * up to and including `asOfIso`: running loads (for fairness), and the
 * last intervention/tour-weekend picks (so a fresh block continues the
 * rotation instead of restarting it).
 */
function buildContinuationContext(state, asOfIso) {
  const appelLoad = {}; state.pools.appelable.forEach((n) => (appelLoad[n] = 0));
  const weekendLoad = {}; state.pools.weekend.forEach((n) => (weekendLoad[n] = 0));
  const intLoad = {}; state.pools.intervention.forEach((n) => (intLoad[n] = 0));

  for (const iso of Object.keys(state.assignments)) {
    if (iso > asOfIso) continue;
    const a = state.assignments[iso];
    if (a.appelable != null && appelLoad[a.appelable] !== undefined) appelLoad[a.appelable]++;
    if (a.weekend != null && weekendLoad[a.weekend] !== undefined) weekendLoad[a.weekend]++;
    if (a.intervention != null && intLoad[a.intervention] !== undefined) intLoad[a.intervention]++;
  }

  const lastFriday = lastDateWithDow(asOfIso, 4);
  const lastSaturday = lastDateWithDow(asOfIso, 5);
  const lastIntWeekend = (state.assignments[lastFriday] && state.assignments[lastFriday].intervention) || null;
  const lastTourWeekend = (state.assignments[lastSaturday] && state.assignments[lastSaturday].weekend) || null;

  const intIdx = state.pools.intervention.indexOf(lastIntWeekend);
  const weekendIdx = state.pools.weekend.indexOf(lastTourWeekend);

  return {
    appelLoad, weekendLoad, intLoad,
    intPtr: intIdx === -1 ? 0 : (intIdx + 1) % Math.max(state.pools.intervention.length, 1),
    weekendPtr: weekendIdx === -1 ? 0 : (weekendIdx + 1) % Math.max(state.pools.weekend.length, 1),
    lastIntWeekend,
    lastTourWeekend
  };
}

/**
 * Silently tops up the schedule so it always reaches the rolling
 * horizon, appending to whatever has already been generated (never
 * touching past or already-generated days). Pure in-memory mutation of
 * `state` — callers decide whether/when to persist.
 */
function ensureHorizon(state) {
  const horizonEnd = computeHorizonEnd();
  const generatedThrough = state.generatedThrough || state.period.start;
  if (generatedThrough >= horizonEnd) return false;
  const startFrom = state.generatedThrough ? shiftDate(state.generatedThrough, 1) : state.period.start;
  if (startFrom > horizonEnd) return false;
  const ctx = buildContinuationContext(state, generatedThrough);
  const days = dateRange(startFrom, horizonEnd);
  const fresh = runGeneration(state, days, ctx);
  Object.assign(state.assignments, fresh);
  state.generatedThrough = horizonEnd;
  return true;
}

/**
 * Recomputes the UPCOMING roster (from today through the rolling
 * horizon) from scratch, continuing fairly from everything before today.
 * Past days are left untouched — this never rewrites history.
 */
function regenerateUpcoming(state) {
  const today = todayISO();
  const horizonEnd = computeHorizonEnd();
  const asOf = shiftDate(today, -1);
  const ctx = buildContinuationContext(state, asOf);
  const days = dateRange(today, horizonEnd);
  const fresh = runGeneration(state, days, ctx);
  Object.assign(state.assignments, fresh);
  state.generatedThrough = horizonEnd;
}

/* ---------------------------------- app ---------------------------------- */

function appMain() {
  const STATE_URL = '/api/state';
  const WEEKDAY_LABELS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
  const WEEKDAY_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  const MONTH_NAMES = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

  let state = null;
  let version = null;
  let netStatus = 'loading'; // loading | online | offline
  let currentMonth = null;

  const panelOpen = {};

  const root = document.getElementById('root');
  root.addEventListener('click', onRootClick);
  root.addEventListener('change', onRootChange);
  root.addEventListener('toggle', (e) => {
    const d = e.target;
    if (d.matches && d.matches('details.panel') && d.dataset.panel) {
      panelOpen[d.dataset.panel] = d.open;
    }
  }, true);

  /* ------------------------------ load / save ------------------------------ */

  async function loadState() {
    netStatus = 'loading';
    render();
    try {
      const res = await fetch(STATE_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const body = await res.json();
      state = body.state;
      version = body.version;
      netStatus = 'online';
      if (currentMonth === null) currentMonth = pickDefaultMonth();
    } catch (err) {
      console.error('Échec de chargement', err);
      netStatus = 'offline';
    }
    render();
  }

  async function persist() {
    if (!state) return;
    try {
      const res = await fetch(STATE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state, version })
      });
      if (res.status === 409) {
        const body = await res.json();
        state = body.state;
        version = body.version;
        netStatus = 'online';
        render();
        alert('Une autre personne vient de modifier le planning au même moment. Le planning affiché a été mis à jour avec sa version ; votre dernière modification n’a pas été enregistrée — merci de la refaire si besoin.');
        return;
      }
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const body = await res.json();
      version = body.version;
      netStatus = 'online';
    } catch (err) {
      console.error('Échec de sauvegarde', err);
      netStatus = 'offline';
      render();
    }
  }

  function isEditingLive() {
    const el = document.activeElement;
    if (!el || !root.contains(el)) return false;
    return !!(el.matches && el.matches('input, select, textarea'));
  }

  async function refreshIfIdle() {
    if (!state || isEditingLive()) return;
    try {
      const res = await fetch(STATE_URL, { cache: 'no-store' });
      if (!res.ok) return;
      const body = await res.json();
      if (body.version !== version) {
        state = body.state;
        version = body.version;
        netStatus = 'online';
        render();
      } else if (netStatus === 'offline') {
        netStatus = 'online';
        render();
      }
    } catch (err) {
      // transient — keep showing the last known state
    }
  }

  setInterval(refreshIfIdle, 20000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshIfIdle();
  });

  function pickDefaultMonth() {
    let stored = null;
    try { stored = localStorage.getItem('garde-cardio-month'); } catch (e) {}
    const months = monthList();
    if (stored && months.some((m) => m.key === stored)) return stored;
    const today = new Date();
    const todayKey = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0');
    if (months.some((m) => m.key === todayKey)) return todayKey;
    return months.length ? months[0].key : null;
  }

  function monthList() {
    const days = dateRange(state.period.start, state.generatedThrough);
    const seen = [];
    for (const d of days) {
      const key = d.iso.slice(0, 7);
      if (!seen.some((m) => m.key === key)) {
        const [y, m] = key.split('-').map(Number);
        seen.push({ key, label: MONTH_NAMES[m - 1] + ' ' + y });
      }
    }
    return seen;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function combinedNames() {
    const set = new Set([...state.pools.appelable, ...state.pools.weekend, ...state.pools.intervention]);
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'));
  }

  function formatShort(iso) {
    const [, m, d] = iso.split('-');
    return d + '/' + m;
  }

  function formatLogTime(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + '/' + d.getFullYear() + ' à ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  /** Asks once per browser who is acting, remembers it locally, for the change log. */
  function getAuthorName() {
    let name = null;
    try { name = localStorage.getItem('garde-cardio-author'); } catch (e) {}
    if (!name) {
      name = prompt('Votre nom (affiché dans le journal des modifications, pour la traçabilité) :', '');
      if (name && name.trim()) {
        name = name.trim();
        try { localStorage.setItem('garde-cardio-author', name); } catch (e) {}
      }
    }
    return name && name.trim() ? name.trim() : 'Anonyme';
  }

  /** Records a traceable, shared entry for a sensitive action (regenerate, remove a person). */
  function logChange(s, who, what) {
    if (!s.changeLog) s.changeLog = [];
    s.changeLog.unshift({ ts: new Date().toISOString(), who, what });
    if (s.changeLog.length > 20) s.changeLog.length = 20;
  }

  /* -------------------------------- mutation -------------------------------- */

  function mutate(fn) {
    fn(state);
    render();
    persist();
  }

  /* --------------------------------- actions --------------------------------- */

  function onRootClick(e) {
    const t = e.target.closest('[data-action]');
    if (!t) return;
    const action = t.dataset.action;
    if (action === 'retry-load') {
      loadState();
    } else if (action === 'regenerate') {
      if (confirm('Recalculer les gardes à venir, à partir d’aujourd’hui jusqu’à l’horizon de ' + HORIZON_MONTHS + ' mois ? Les jours déjà passés ne sont pas modifiés ; les modifications manuelles à venir seront remplacées.')) {
        const who = getAuthorName();
        mutate((s) => {
          regenerateUpcoming(s);
          logChange(s, who, 'a régénéré les gardes à venir (à partir d’aujourd’hui)');
        });
      }
    } else if (action === 'save-horizon') {
      // No-op mutation: render() always tops the horizon up first, so this
      // simply persists the current (already up to date) schedule for
      // everyone, without waiting for an incidental edit to trigger it.
      mutate(() => {});
    } else if (action === 'set-month') {
      currentMonth = t.dataset.month;
      try { localStorage.setItem('garde-cardio-month', currentMonth); } catch (err) {}
      render();
    } else if (action === 'remove-pool') {
      const pool = t.dataset.pool, name = t.dataset.name;
      if (confirm('Retirer ' + name + ' de la liste "' + poolLabel(pool) + '" ? Les gardes déjà attribuées restent inchangées.')) {
        const who = getAuthorName();
        mutate((s) => {
          s.pools[pool] = s.pools[pool].filter((n) => n !== name);
          if (pool === 'intervention') {
            for (const k of Object.keys(s.interventionWeekday)) {
              if (s.interventionWeekday[k] === name) s.interventionWeekday[k] = null;
            }
          }
          logChange(s, who, 'a retiré « ' + name + ' » de la liste « ' + poolLabel(pool) + ' »');
        });
      }
    } else if (action === 'add-pool') {
      const pool = t.dataset.pool;
      const input = document.getElementById('add-input-' + pool);
      const val = input.value.trim();
      if (!val) return;
      mutate((s) => {
        if (!s.pools[pool].includes(val)) s.pools[pool].push(val);
      });
      input.value = '';
    } else if (action === 'add-absence') {
      const name = document.getElementById('absence-name').value;
      const date = document.getElementById('absence-date').value;
      if (!name || !date) return;
      mutate((s) => {
        if (!s.absences[name]) s.absences[name] = [];
        if (!s.absences[name].includes(date)) { s.absences[name].push(date); s.absences[name].sort(); }
      });
    } else if (action === 'remove-absence') {
      const name = t.dataset.name, date = t.dataset.date;
      mutate((s) => {
        if (s.absences[name]) {
          s.absences[name] = s.absences[name].filter((d) => d !== date);
          if (!s.absences[name].length) delete s.absences[name];
        }
      });
    }
  }

  function onRootChange(e) {
    const t = e.target;
    if (t.matches('select.assign-select')) {
      const iso = t.dataset.date, col = t.dataset.col, val = t.value || null;
      mutate((s) => {
        if (!s.assignments[iso]) s.assignments[iso] = { appelable: null, weekend: null, intervention: null };
        s.assignments[iso][col] = val;
      });
    } else if (t.matches('input.holiday-check')) {
      const iso = t.dataset.date;
      mutate((s) => {
        const idx = s.holidays.indexOf(iso);
        if (t.checked && idx === -1) s.holidays.push(iso);
        else if (!t.checked && idx !== -1) s.holidays.splice(idx, 1);
      });
    } else if (t.matches('input.restriction-check')) {
      const name = t.dataset.name, dow = parseInt(t.dataset.dow, 10);
      mutate((s) => {
        if (!s.restrictions[name]) s.restrictions[name] = [];
        const idx = s.restrictions[name].indexOf(dow);
        if (t.checked && idx === -1) s.restrictions[name].push(dow);
        else if (!t.checked && idx !== -1) s.restrictions[name].splice(idx, 1);
      });
    } else if (t.matches('select.fixed-select')) {
      const dow = parseInt(t.dataset.dow, 10), val = t.value || null;
      mutate((s) => { s.interventionWeekday[dow] = val; });
    }
  }

  function poolLabel(pool) {
    return pool === 'appelable' ? 'Garde appelable' : pool === 'weekend' ? 'Tour week-end' : 'Garde interventionnelle';
  }

  /* --------------------------------- render --------------------------------- */

  function render() {
    if (!state) {
      root.innerHTML = renderLoadingOrOffline();
      return;
    }
    // Silently keep the schedule topped up to the rolling horizon.
    // This only mutates the in-memory `state` — it is not saved until a
    // viewer performs an actual action (mutate() persists afterwards).
    ensureHorizon(state);
    root.innerHTML = renderBadge() + renderTopbar() + renderToolbar() + renderLegend() +
      renderTable() + renderPanels() + renderStats() + renderChangeLog() + renderFootnote();
  }

  function renderLoadingOrOffline() {
    const title = '<div class="title-block"><h1>Rôle de garde — Cardiologie</h1>';
    if (netStatus === 'offline') {
      return '<div class="topbar">' + title +
        '<p>Impossible de charger le planning pour le moment. Vérifiez votre connexion et réessayez.</p></div></div>' +
        '<div style="padding:24px"><button class="btn" data-action="retry-load">↻ Réessayer</button></div>';
    }
    return '<div class="topbar">' + title + '<p>Chargement du planning…</p></div></div>';
  }

  function renderBadge() { return ''; }

  function renderTopbar() {
    const badge = {
      loading: { cls: '', label: 'Connexion…' },
      online: { cls: 'live', label: 'Partagé — synchronisé' },
      offline: { cls: 'readonly', label: 'Hors ligne' }
    }[netStatus];
    return '<div class="topbar">' +
      '<div class="title-block">' +
        '<h1>Rôle de garde — Cardiologie</h1>' +
        '<p>Planning permanent, maintenu ' + HORIZON_MONTHS + ' mois à l’avance : garde appelable, tour de week-end et garde interventionnelle. Modifiable par toute l’équipe.</p>' +
      '</div>' +
      '<span class="status-badge ' + badge.cls + '"><span class="dot"></span>' + badge.label + '</span>' +
    '</div>';
  }

  function renderToolbar() {
    const months = monthList();
    const tabs = months.map((m) =>
      '<button class="tab ' + (m.key === currentMonth ? 'active' : '') + '" data-action="set-month" data-month="' + m.key + '">' + esc(m.label) + '</button>'
    ).join('');
    return '<div class="toolbar">' +
      '<div class="tabs">' + tabs + '</div>' +
      '<div class="toolbar-actions">' +
        '<button class="btn" data-action="save-horizon"' + (isDisabled() ? ' disabled' : '') +
          ' title="Enregistre immédiatement le planning affiché (toujours ' + HORIZON_MONTHS + ' mois à l’avance) pour toute l’équipe, sans attendre qu’une autre modification le déclenche.">' +
          '💾 Partager l’horizon à jour</button>' +
        '<button class="btn" data-action="regenerate"' + (isDisabled() ? ' disabled' : '') + '>↻ Régénérer les gardes à venir</button>' +
      '</div>' +
    '</div>';
  }

  function renderLegend() {
    return '<div class="legend">' +
      '<span class="legend-item"><span class="legend-swatch" style="background:var(--weekend-tint)"></span>Week-end</span>' +
      '<span class="legend-item"><span class="legend-swatch" style="background:var(--holiday-tint)"></span>Jour férié</span>' +
      '<span class="legend-item"><span class="warn-icon">!</span>Combinaison inhabituelle (remplacement)</span>' +
      '<span class="legend-item"><span class="danger-icon">!</span>Personne indiquée absente ce jour</span>' +
    '</div>';
  }

  function isDisabled() { return netStatus === 'offline'; }

  function assignSelect(iso, col, pool, currentVal, dow) {
    const disabled = isDisabled() ? ' disabled' : '';
    const options = ['<option value="">—</option>'].concat(
      pool.map((name) => '<option value="' + esc(name) + '"' + (name === currentVal ? ' selected' : '') + '>' + esc(name) + '</option>')
    ).join('');
    let warn = '';
    if (currentVal) {
      const absent = !!(state.absences[currentVal] && state.absences[currentVal].includes(iso));
      const restricted = col === 'appelable' && state.restrictions[currentVal] && state.restrictions[currentVal].includes(dow);
      if (absent) warn = '<span class="danger-icon" title="' + esc(currentVal) + ' est indiqué(e) absent(e) ce jour">!</span>';
      else if (restricted) warn = '<span class="warn-icon" title="' + esc(currentVal) + ' est habituellement indisponible ce jour">!</span>';
    }
    return '<select class="assign-select" data-date="' + iso + '" data-col="' + col + '"' + disabled + '>' + options + '</select>' + warn;
  }

  function renderTable() {
    const days = dateRange(state.period.start, state.generatedThrough).filter((d) => d.iso.slice(0, 7) === currentMonth);
    const rows = days.map(({ iso, dow }) => {
      const a = state.assignments[iso] || { appelable: null, weekend: null, intervention: null };
      const isWeekend = dow === 5 || dow === 6;
      const isHoliday = state.holidays.includes(iso);
      const rowClasses = [isWeekend ? 'weekend-row' : '', isHoliday ? 'holiday-row' : ''].filter(Boolean).join(' ');
      const fixedNote = (dow <= 3 && a.intervention && a.intervention !== state.interventionWeekday[dow])
        ? '<span class="warn-icon" title="Remplacement du titulaire habituel (absence)">!</span>' : '';
      const disabled = isDisabled() ? ' disabled' : '';

      const tourCell = (dow === 5 || dow === 6)
        ? assignSelect(iso, 'weekend', state.pools.weekend, a.weekend, dow)
        : '<span class="no-slot">—</span>';

      return '<tr class="' + rowClasses + '">' +
        '<td class="day-cell">' +
          '<div class="day-label">' + WEEKDAY_LABELS[dow] + '</div>' +
          '<div class="day-date mono">' + formatShort(iso) + '</div>' +
          (isHoliday ? '<span class="holiday-badge">Férié</span>' : '') +
          '<label class="holiday-toggle"><input type="checkbox" class="holiday-check" data-date="' + iso + '"' + (isHoliday ? ' checked' : '') + disabled + '> Férié</label>' +
        '</td>' +
        '<td><div class="assign-cell">' + assignSelect(iso, 'appelable', state.pools.appelable, a.appelable, dow) + '</div></td>' +
        '<td><div class="assign-cell">' + tourCell + '</div></td>' +
        '<td><div class="assign-cell">' + assignSelect(iso, 'intervention', state.pools.intervention, a.intervention, dow) + fixedNote + '</div></td>' +
      '</tr>';
    }).join('');

    return '<div class="table-wrap"><table class="roster">' +
      '<thead><tr><th>Jour</th><th>Garde appelable</th><th>Tour week-end</th><th>Garde interventionnelle</th></tr></thead>' +
      '<tbody>' + rows + '</tbody>' +
    '</table></div>';
  }

  function renderPoolSection(pool, title) {
    const disabled = isDisabled() ? ' disabled' : '';
    const chips = state.pools[pool].map((name) =>
      '<span class="chip">' + esc(name) + (isDisabled() ? '' : '<button data-action="remove-pool" data-pool="' + pool + '" data-name="' + esc(name) + '" title="Retirer">×</button>') + '</span>'
    ).join('');
    return '<div class="panel-section">' +
      '<h3>' + title + ' (' + state.pools[pool].length + ')</h3>' +
      '<div class="chip-list">' + chips + '</div>' +
      (isDisabled() ? '' :
        '<div class="add-row"><input type="text" id="add-input-' + pool + '" placeholder="Nom à ajouter…"' + disabled + '>' +
        '<button class="btn" data-action="add-pool" data-pool="' + pool + '"' + disabled + '>Ajouter</button></div>') +
    '</div>';
  }

  function renderFixedGrid() {
    const disabled = isDisabled() ? ' disabled' : '';
    const cells = [0, 1, 2, 3].map((dow) => {
      const opts = ['<option value="">—</option>'].concat(
        state.pools.intervention.map((n) => '<option value="' + esc(n) + '"' + (state.interventionWeekday[dow] === n ? ' selected' : '') + '>' + esc(n) + '</option>')
      ).join('');
      return '<div><label>' + WEEKDAY_LABELS[dow] + '</label><select class="fixed-select" data-dow="' + dow + '"' + disabled + '>' + opts + '</select></div>';
    }).join('');
    return '<div class="panel-section"><h3>Garde interventionnelle — titulaires fixes (lun–jeu)</h3><div class="fixed-grid">' + cells + '</div></div>';
  }

  function renderRestrictionGrid() {
    const disabled = isDisabled() ? ' disabled' : '';
    const rows = state.pools.appelable.map((name) => {
      const cells = WEEKDAY_SHORT.map((_, dow) => {
        const checked = state.restrictions[name] && state.restrictions[name].includes(dow);
        return '<td><input type="checkbox" class="restriction-check" data-name="' + esc(name) + '" data-dow="' + dow + '"' + (checked ? ' checked' : '') + disabled + '></td>';
      }).join('');
      return '<tr><td>' + esc(name) + '</td>' + cells + '</tr>';
    }).join('');
    return '<div class="panel-section"><h3>Indisponibilités habituelles — garde appelable</h3>' +
      '<div class="restriction-table-wrap"><table class="restrictions"><thead><tr><th>Nom</th>' +
      WEEKDAY_SHORT.map((d) => '<th>' + d + '</th>').join('') + '</tr></thead><tbody>' + rows + '</tbody></table></div></div>';
  }

  function renderAbsences() {
    const disabled = isDisabled() ? ' disabled' : '';
    const names = combinedNames();
    const nameOpts = names.map((n) => '<option value="' + esc(n) + '">' + esc(n) + '</option>').join('');
    const groups = Object.keys(state.absences).filter((n) => state.absences[n].length).sort((a, b) => a.localeCompare(b, 'fr')).map((name) => {
      const dates = state.absences[name].map((d) =>
        '<span class="chip">' + formatShort(d) + (isDisabled() ? '' : '<button data-action="remove-absence" data-name="' + esc(name) + '" data-date="' + d + '" title="Retirer">×</button>') + '</span>'
      ).join('');
      return '<div class="absence-group"><span class="name">' + esc(name) + '</span>' + dates + '</div>';
    }).join('') || '<p class="footnote" style="margin-top:0">Aucune absence renseignée.</p>';

    return '<div class="panel-section"><h3>Absences ponctuelles</h3>' +
      (isDisabled() ? '' :
        '<div class="absence-form"><select id="absence-name"><option value="">Choisir un nom…</option>' + nameOpts + '</select>' +
        '<input type="date" id="absence-date">' +
        '<button class="btn" data-action="add-absence">Ajouter</button></div>') +
      '<div class="absence-groups">' + groups + '</div>' +
    '</div>';
  }

  function renderPanels() {
    return '<details class="panel" data-panel="effectifs"' + (panelOpen.effectifs ? ' open' : '') + '><summary><h2>Effectifs &amp; règles</h2><span class="hint">Ajouter / retirer une personne, indisponibilités, absences</span></summary>' +
      '<div class="panel-body">' +
        renderPoolSection('appelable', 'Garde appelable') +
        renderPoolSection('weekend', 'Tour week-end') +
        renderPoolSection('intervention', 'Garde interventionnelle') +
        renderFixedGrid() +
        renderRestrictionGrid() +
        renderAbsences() +
      '</div>' +
    '</details>';
  }

  function renderStats() {
    const days = dateRange(state.period.start, state.generatedThrough);
    const appelCount = {}, tourCount = {};
    for (const { iso } of days) {
      const a = state.assignments[iso];
      if (!a) continue;
      if (a.appelable) appelCount[a.appelable] = (appelCount[a.appelable] || 0) + 1;
      if (a.weekend) tourCount[a.weekend] = (tourCount[a.weekend] || 0) + 1;
    }
    function block(title, counts) {
      const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      const max = entries.length ? entries[0][1] : 1;
      const rowsHtml = entries.map(([name, n]) =>
        '<div class="stat-row"><span class="stat-name">' + esc(name) + '</span><span class="stat-count mono">' + n + '</span>' +
        '<div class="stat-bar-track"><div class="stat-bar-fill" style="width:' + Math.round((n / max) * 100) + '%"></div></div></div>'
      ).join('') || '<p class="footnote" style="margin-top:0">Pas encore de données.</p>';
      return '<div><h3 style="font-size:0.82rem;text-transform:uppercase;letter-spacing:0.04em;color:var(--text-muted);margin-bottom:10px">' + title + '</h3>' + rowsHtml + '</div>';
    }
    return '<details class="panel" data-panel="stats"' + (panelOpen.stats ? ' open' : '') + '><summary><h2>Charge de travail</h2><span class="hint">Répartition depuis le début du planning</span></summary>' +
      '<div class="panel-body"><div class="panel-section" style="border-top:none;padding-top:16px"><div class="stats-grid">' +
      block('Garde appelable — nombre de jours', appelCount) +
      block('Tour week-end — nombre de jours', tourCount) +
      '</div></div></div>' +
    '</details>';
  }

  function renderChangeLog() {
    const entries = state.changeLog || [];
    const rows = entries.map((e) =>
      '<div class="log-row"><span class="log-time mono">' + formatLogTime(e.ts) + '</span>' +
      '<span class="log-who">' + esc(e.who) + '</span>' +
      '<span class="log-what">' + esc(e.what) + '</span></div>'
    ).join('') || '<p class="footnote" style="margin-top:0">Aucune régénération ni suppression pour l’instant.</p>';
    return '<details class="panel" data-panel="log"' + (panelOpen.log ? ' open' : '') + '><summary><h2>Journal des modifications</h2><span class="hint">Qui a régénéré ou retiré un intervenant, et quand</span></summary>' +
      '<div class="panel-body"><div class="panel-section" style="border-top:none;padding-top:16px"><div class="log-list">' + rows + '</div></div></div>' +
    '</details>';
  }

  function renderFootnote() {
    const [sy, sm] = state.period.start.split('-');
    const [ey, em] = state.generatedThrough.split('-');
    return '<p class="footnote">Planning permanent, sans date de fin : dès qu’un membre de l’équipe ouvre la page ou fait une action, l’affichage se recalcule pour couvrir toujours ' + HORIZON_MONTHS + ' mois à l’avance (actuellement généré jusqu’en ' + MONTH_NAMES[+em - 1] + ' ' + ey + ', depuis ' + MONTH_NAMES[+sm - 1] + ' ' + sy + ')' +
      '. Le planning est généré automatiquement selon les règles du service (titulaires fixes, indisponibilités, rotations), puis peut être ajusté manuellement case par case. « Régénérer » recalcule les gardes à venir après un changement d’effectif important — les jours déjà passés ne sont jamais réécrits. « Partager l’horizon à jour » sauvegarde immédiatement, pour tout le monde, sans attendre une autre modification.</p>';
  }

  render();
  loadState();
}

appMain();
