import { getStore } from '@netlify/blobs';

const KEY = 'roster-state';

const DEFAULT_STATE = {"period":{"start":"2026-09-01"},"pools":{"appelable":["Djellal","Ariano","DeCubber","Amini","Sorgente","Marcon","Parisi","Kankwenda","Ebinger","Tran-Ngoc","Thayse","Viseur","Foldes","Kajingu","Yanni"],"weekend":["pg cardio 1","pg cardio 2","pg médecine interne 1","pg médecine interne 2","Djellal","Ariano","DeCubber","Amini","Sorgente","Marcon","Parisi","Kankwenda"],"intervention":["Ebinger","Tran-Ngoc","Ariano","Thayse"]},"interventionWeekday":{"0":"Ebinger","1":"Thayse","2":"Tran-Ngoc","3":"Ariano"},"restrictions":{"Amini":[2],"Ariano":[2],"DeCubber":[1,2],"Djellal":[2],"Ebinger":[1],"Foldes":[0,1],"Parisi":[0,2],"Tran-Ngoc":[0,3],"Thayse":[0]},"holidays":["2026-11-01","2026-11-11"],"absences":{},"assignments":{"2026-09-01":{"appelable":"Thayse","weekend":null,"intervention":"Thayse"},"2026-09-02":{"appelable":"Tran-Ngoc","weekend":null,"intervention":"Tran-Ngoc"},"2026-09-03":{"appelable":"Ariano","weekend":null,"intervention":"Ariano"},"2026-09-04":{"appelable":"Djellal","weekend":null,"intervention":"Ebinger"},"2026-09-05":{"appelable":"DeCubber","weekend":"pg cardio 1","intervention":"Ebinger"},"2026-09-06":{"appelable":"Amini","weekend":"pg cardio 1","intervention":"Ebinger"},"2026-09-07":{"appelable":"Ebinger","weekend":null,"intervention":"Ebinger"},"2026-09-08":{"appelable":"Thayse","weekend":null,"intervention":"Thayse"},"2026-09-09":{"appelable":"Tran-Ngoc","weekend":null,"intervention":"Tran-Ngoc"},"2026-09-10":{"appelable":"Ariano","weekend":null,"intervention":"Ariano"},"2026-09-11":{"appelable":"Sorgente","weekend":null,"intervention":"Tran-Ngoc"},"2026-09-12":{"appelable":"Marcon","weekend":"pg cardio 2","intervention":"Tran-Ngoc"},"2026-09-13":{"appelable":"Parisi","weekend":"pg cardio 2","intervention":"Tran-Ngoc"},"2026-09-14":{"appelable":"Ebinger","weekend":null,"intervention":"Ebinger"},"2026-09-15":{"appelable":"Thayse","weekend":null,"intervention":"Thayse"},"2026-09-16":{"appelable":"Tran-Ngoc","weekend":null,"intervention":"Tran-Ngoc"},"2026-09-17":{"appelable":"Ariano","weekend":null,"intervention":"Ariano"},"2026-09-18":{"appelable":"Kankwenda","weekend":null,"intervention":"Ariano"},"2026-09-19":{"appelable":"Viseur","weekend":"pg médecine interne 1","intervention":"Ariano"},"2026-09-20":{"appelable":"Foldes","weekend":"pg médecine interne 1","intervention":"Ariano"},"2026-09-21":{"appelable":"Ebinger","weekend":null,"intervention":"Ebinger"},"2026-09-22":{"appelable":"Thayse","weekend":null,"intervention":"Thayse"},"2026-09-23":{"appelable":"Tran-Ngoc","weekend":null,"intervention":"Tran-Ngoc"},"2026-09-24":{"appelable":"Ariano","weekend":null,"intervention":"Ariano"},"2026-09-25":{"appelable":"Kajingu","weekend":null,"intervention":"Thayse"},"2026-09-26":{"appelable":"Yanni","weekend":"pg médecine interne 2","intervention":"Thayse"},"2026-09-27":{"appelable":"Djellal","weekend":"pg médecine interne 2","intervention":"Thayse"},"2026-09-28":{"appelable":"Ebinger","weekend":null,"intervention":"Ebinger"},"2026-09-29":{"appelable":"Thayse","weekend":null,"intervention":"Thayse"},"2026-09-30":{"appelable":"Tran-Ngoc","weekend":null,"intervention":"Tran-Ngoc"},"2026-10-01":{"appelable":"Ariano","weekend":null,"intervention":"Ariano"},"2026-10-02":{"appelable":"DeCubber","weekend":null,"intervention":"Ebinger"},"2026-10-03":{"appelable":"Djellal","weekend":"Djellal","intervention":"Ebinger"},"2026-10-04":{"appelable":"Djellal","weekend":"Djellal","intervention":"Ebinger"},"2026-10-05":{"appelable":"Ebinger","weekend":null,"intervention":"Ebinger"},"2026-10-06":{"appelable":"Thayse","weekend":null,"intervention":"Thayse"},"2026-10-07":{"appelable":"Tran-Ngoc","weekend":null,"intervention":"Tran-Ngoc"},"2026-10-08":{"appelable":"Ariano","weekend":null,"intervention":"Ariano"},"2026-10-09":{"appelable":"Amini","weekend":null,"intervention":"Tran-Ngoc"},"2026-10-10":{"appelable":"Ariano","weekend":"Ariano","intervention":"Tran-Ngoc"},"2026-10-11":{"appelable":"Ariano","weekend":"Ariano","intervention":"Tran-Ngoc"},"2026-10-12":{"appelable":"Ebinger","weekend":null,"intervention":"Ebinger"},"2026-10-13":{"appelable":"Thayse","weekend":null,"intervention":"Thayse"},"2026-10-14":{"appelable":"Tran-Ngoc","weekend":null,"intervention":"Tran-Ngoc"},"2026-10-15":{"appelable":"Ariano","weekend":null,"intervention":"Ariano"},"2026-10-16":{"appelable":"Sorgente","weekend":null,"intervention":"Ariano"},"2026-10-17":{"appelable":"DeCubber","weekend":"DeCubber","intervention":"Ariano"},"2026-10-18":{"appelable":"DeCubber","weekend":"DeCubber","intervention":"Ariano"},"2026-10-19":{"appelable":"Ebinger","weekend":null,"intervention":"Ebinger"},"2026-10-20":{"appelable":"Thayse","weekend":null,"intervention":"Thayse"},"2026-10-21":{"appelable":"Tran-Ngoc","weekend":null,"intervention":"Tran-Ngoc"},"2026-10-22":{"appelable":"Ariano","weekend":null,"intervention":"Ariano"},"2026-10-23":{"appelable":"Marcon","weekend":null,"intervention":"Thayse"},"2026-10-24":{"appelable":"Amini","weekend":"Amini","intervention":"Thayse"},"2026-10-25":{"appelable":"Amini","weekend":"Amini","intervention":"Thayse"},"2026-10-26":{"appelable":"Ebinger","weekend":null,"intervention":"Ebinger"},"2026-10-27":{"appelable":"Thayse","weekend":null,"intervention":"Thayse"},"2026-10-28":{"appelable":"Tran-Ngoc","weekend":null,"intervention":"Tran-Ngoc"},"2026-10-29":{"appelable":"Ariano","weekend":null,"intervention":"Ariano"},"2026-10-30":{"appelable":"Parisi","weekend":null,"intervention":"Ebinger"},"2026-10-31":{"appelable":"Sorgente","weekend":"Sorgente","intervention":"Ebinger"},"2026-11-01":{"appelable":"Sorgente","weekend":"Sorgente","intervention":"Ebinger"},"2026-11-02":{"appelable":"Ebinger","weekend":null,"intervention":"Ebinger"},"2026-11-03":{"appelable":"Thayse","weekend":null,"intervention":"Thayse"},"2026-11-04":{"appelable":"Tran-Ngoc","weekend":null,"intervention":"Tran-Ngoc"},"2026-11-05":{"appelable":"Ariano","weekend":null,"intervention":"Ariano"},"2026-11-06":{"appelable":"Kankwenda","weekend":null,"intervention":"Tran-Ngoc"},"2026-11-07":{"appelable":"Marcon","weekend":"Marcon","intervention":"Tran-Ngoc"},"2026-11-08":{"appelable":"Marcon","weekend":"Marcon","intervention":"Tran-Ngoc"},"2026-11-09":{"appelable":"Ebinger","weekend":null,"intervention":"Ebinger"},"2026-11-10":{"appelable":"Thayse","weekend":null,"intervention":"Thayse"},"2026-11-11":{"appelable":"Tran-Ngoc","weekend":null,"intervention":"Tran-Ngoc"},"2026-11-12":{"appelable":"Ariano","weekend":null,"intervention":"Ariano"},"2026-11-13":{"appelable":"Viseur","weekend":null,"intervention":"Ariano"},"2026-11-14":{"appelable":"Parisi","weekend":"Parisi","intervention":"Ariano"},"2026-11-15":{"appelable":"Parisi","weekend":"Parisi","intervention":"Ariano"},"2026-11-16":{"appelable":"Ebinger","weekend":null,"intervention":"Ebinger"},"2026-11-17":{"appelable":"Thayse","weekend":null,"intervention":"Thayse"},"2026-11-18":{"appelable":"Tran-Ngoc","weekend":null,"intervention":"Tran-Ngoc"},"2026-11-19":{"appelable":"Ariano","weekend":null,"intervention":"Ariano"},"2026-11-20":{"appelable":"Foldes","weekend":null,"intervention":"Thayse"},"2026-11-21":{"appelable":"Kankwenda","weekend":"Kankwenda","intervention":"Thayse"},"2026-11-22":{"appelable":"Kankwenda","weekend":"Kankwenda","intervention":"Thayse"},"2026-11-23":{"appelable":"Ebinger","weekend":null,"intervention":"Ebinger"},"2026-11-24":{"appelable":"Thayse","weekend":null,"intervention":"Thayse"},"2026-11-25":{"appelable":"Tran-Ngoc","weekend":null,"intervention":"Tran-Ngoc"},"2026-11-26":{"appelable":"Ariano","weekend":null,"intervention":"Ariano"},"2026-11-27":{"appelable":"Kajingu","weekend":null,"intervention":"Ebinger"},"2026-11-28":{"appelable":"Yanni","weekend":"pg cardio 1","intervention":"Ebinger"},"2026-11-29":{"appelable":"Viseur","weekend":"pg cardio 1","intervention":"Ebinger"},"2026-11-30":{"appelable":"Ebinger","weekend":null,"intervention":"Ebinger"}},"generatedThrough":"2026-11-30","changeLog":[]};

// Netlify Blobs has no built-in compare-and-swap (writes are "last write
// wins"), so optimistic concurrency is implemented at the app level: a
// version counter is stored inside the JSON blob itself. A write is only
// accepted when the client's known version still matches what's stored;
// otherwise the caller gets the current version back (409) to reconcile.
// There's a small race between the read and the write below — acceptable
// here given how infrequently two people save at the exact same instant,
// and the client already polls + shows a reconciliation message on 409.

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function readCurrent(store) {
  const stored = await store.get(KEY, { type: 'json' });
  if (stored == null) {
    const seeded = { ...DEFAULT_STATE, __version: 1 };
    await store.setJSON(KEY, seeded);
    return seeded;
  }
  return stored;
}

export default async (req) => {
  const store = getStore('garde-cardio', { consistency: 'strong' });

  if (req.method === 'GET') {
    const current = await readCurrent(store);
    const { __version, ...state } = current;
    return json(200, { state, version: __version });
  }

  if (req.method === 'POST') {
    let payload;
    try {
      payload = await req.json();
    } catch (e) {
      return json(400, { error: 'invalid_json' });
    }
    const { state, version } = payload || {};
    if (!state || typeof state !== 'object') {
      return json(400, { error: 'missing_state' });
    }
    const current = await readCurrent(store);
    if (version !== current.__version) {
      // Someone else saved first — hand back the current winning version so
      // the client can reconcile instead of silently losing the edit.
      const { __version, ...currentState } = current;
      return json(409, { state: currentState, version: __version });
    }
    const nextVersion = current.__version + 1;
    await store.setJSON(KEY, { ...state, __version: nextVersion });
    return json(200, { version: nextVersion });
  }

  return json(405, { error: 'method_not_allowed' });
};

export const config = { path: '/api/state' };
