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
      // Garde appelable is chosen purely by lowest running load across the
      // whole appelable pool, independent of who's on intervention that day —
      // this keeps the load roughly even across everyone instead of skewing
      // toward the 4 interventionnels.
      appel = pickLeastLoaded(
        appelablePool.filter((p) => !isRestricted(p, dow) && !isAbsent(p, iso)),
        ctx.appelLoad
      );
    } else if (dow === 4) {
      ctx.lastIntWeekend = nextRotation(intPool, 'intPtr', 'intLoad', ctx.lastIntWeekend, iso);
      interv = ctx.lastIntWeekend;
      // The Friday appelable pick also covers Saturday and Sunday (same
      // person all weekend) — stash it on ctx so dow 5/6 below can reuse it.
      ctx.currentWeekendAppel = pickLeastLoaded(
        appelablePool.filter((p) => !isRestricted(p, dow) && !isAbsent(p, iso)),
        ctx.appelLoad
      );
      appel = ctx.currentWeekendAppel;
    } else if (dow === 5) {
      interv = ctx.lastIntWeekend;
      ctx.lastTourWeekend = nextRotation(weekendPool, 'weekendPtr', 'weekendLoad', ctx.lastTourWeekend, iso);
      tour = ctx.lastTourWeekend;
      if (ctx.currentWeekendAppel && !isRestricted(ctx.currentWeekendAppel, dow) && !isAbsent(ctx.currentWeekendAppel, iso)) {
        appel = ctx.currentWeekendAppel;
        bump(ctx.appelLoad, appel);
      } else {
        // Friday's person can't cover this day (e.g. absent) — fall back to
        // the least-loaded option for just this day.
        appel = pickLeastLoaded(
          appelablePool.filter((p) => !isRestricted(p, dow) && !isAbsent(p, iso)),
          ctx.appelLoad
        );
      }
    } else {
      interv = ctx.lastIntWeekend;
      tour = ctx.lastTourWeekend;
      if (ctx.currentWeekendAppel && !isRestricted(ctx.currentWeekendAppel, dow) && !isAbsent(ctx.currentWeekendAppel, iso)) {
        appel = ctx.currentWeekendAppel;
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
  // If we're resuming mid-weekend (e.g. picking up on a Saturday or Sunday),
  // carry forward that Friday's appelable person so the "same person all
  // weekend" rule holds across the resume boundary too.
  const currentWeekendAppel = (state.assignments[lastFriday] && state.assignments[lastFriday].appelable) || null;

  const intIdx = state.pools.intervention.indexOf(lastIntWeekend);
  const weekendIdx = state.pools.weekend.indexOf(lastTourWeekend);

  return {
    appelLoad, weekendLoad, intLoad,
    intPtr: intIdx === -1 ? 0 : (intIdx + 1) % Math.max(state.pools.intervention.length, 1),
    weekendPtr: weekendIdx === -1 ? 0 : (weekendIdx + 1) % Math.max(state.pools.weekend.length, 1),
    lastIntWeekend,
    lastTourWeekend,
    currentWeekendAppel
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
