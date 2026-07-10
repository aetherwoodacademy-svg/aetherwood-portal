// ============================================================================
// Netlify Function: submit
// ============================================================================
// One write endpoint for every portal touchpoint. The browser POSTs
//   { type, payload }
// and this function validates it, then writes to the right backend (Supabase
// for community data, Airtable for confessions) using credentials that live
// ONLY in Netlify environment variables. The browser never sees a key.
//
// Dependency-free: uses Node's built-in fetch. No npm install, no build step.
// ============================================================================

const SUPABASE_URL      = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const AIRTABLE_TOKEN    = process.env.AIRTABLE_TOKEN;     // confessions (added later)
const AIRTABLE_BASE_ID  = process.env.AIRTABLE_BASE_ID;   // confessions (added later)

// ── Touchpoint configuration ────────────────────────────────────────────────
// For each type: which backend, which table, and the fields accepted.
//   required = must be present and non-empty (value is the max length)
//   optional = kept if present (value is the max length)
//   choices  = if set, the named field must be one of these
const TOUCHPOINTS = {
  intention: {
    backend: 'supabase', table: 'new_moon_tapestry',
    required: { intention: 200, cycle_id: 40 },
  },
  first_quarter: {
    backend: 'supabase', table: 'first_quarter_responses',
    required: { challenge_id: 60, cycle_id: 40, choice: 1 },
    optional: { reasoning: 1000 },
    choices: { field: 'choice', values: ['a', 'b', 'c'] },
  },
  gibbous_word: {
    backend: 'supabase', table: 'waxing_gibbous_words',
    required: { word: 60, cycle_id: 40 },
  },
  candle: {
    backend: 'supabase', table: 'waning_gibbous_candles',
    required: { cycle_id: 40 },
    optional: { word: 120 },
  },
  leaf: {
    backend: 'supabase', table: 'memory_hall_leaves',
    required: { message: 1000 },
    optional: { for_whom: 120 },
  },
  memory_star: {
    backend: 'supabase', table: 'memory_hall_stars',
    required: { room: 20, text: 1000 },
    optional: { for_whom: 120, sx: 8, sy: 8 },
  },
  visitor_whisper: {
    backend: 'supabase', table: 'hearthfire_whispers',
    required: { message: 300 },
  },
  archive_word: {
    backend: 'supabase', table: 'whispered_archive_words',
    required: { message: 800 },
    optional: { phase: 40 },
  },
  release: {
    backend: 'supabase', table: 'fountain_releases',
    required: { release_text: 300, cycle_id: 40 },
    optional: { session_token: 40 },
  },
  path: {
    backend: 'supabase', table: 'visitor_paths',
    required: { session_id: 40, room: 60 },
  },
  confession: {
    backend: 'airtable', table: 'full_moon_confessions',
    required: { confession: 2000, cycle_id: 40 },
    defaults: { display: false },  // held for moderation — you tick display in Airtable to publish
  },
  planting: {
    backend: 'supabase', table: 'year_wheel_plantings',
    required: { token: 40, season: 20, kind: 10, body: 400 },
    optional: { hemisphere: 6 },
    booleans: { is_public: false },              // visitor's public/private choice
    choices: { field: 'kind', values: ['seed', 'wish'] },
  },
};

function clean(value, maxLen) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLen);
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return json(400, { error: 'Invalid JSON' }); }

  const config = TOUCHPOINTS[body.type];
  if (!config) return json(400, { error: 'Unknown touchpoint type' });

  const payload = body.payload || {};
  const record = {};

  for (const [field, maxLen] of Object.entries(config.required)) {
    const v = clean(payload[field], maxLen);
    if (v === null) return json(400, { error: `Missing or empty field: ${field}` });
    record[field] = v;
  }
  for (const [field, maxLen] of Object.entries(config.optional || {})) {
    const v = clean(payload[field], maxLen);
    if (v !== null) record[field] = v;
  }
  if (config.choices && !config.choices.values.includes(record[config.choices.field])) {
    return json(400, { error: `Invalid ${config.choices.field}` });
  }
  // Boolean fields (e.g. the visitor's public/private choice)
  if (config.booleans) {
    for (const [field, def] of Object.entries(config.booleans)) {
      const v = payload[field];
      record[field] = (v === true || v === 'true') ? true
                    : (v === false || v === 'false') ? false
                    : def;
    }
  }
  // Static defaults (e.g. the Airtable display flag, which has no column default)
  if (config.defaults) {
    for (const [field, value] of Object.entries(config.defaults)) {
      if (record[field] === undefined) record[field] = value;
    }
  }

  try {
    if (config.backend === 'supabase') await supabaseInsert(config.table, record);
    else await airtableInsert(config.table, record);
    return json(200, { ok: true });
  } catch (err) {
    return json(502, { error: 'Write failed', detail: String(err.message || err) });
  }
};

async function supabaseInsert(table, record) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Supabase env vars not set');
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(record),
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
}

async function airtableInsert(table, record) {
  if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID) throw new Error('Airtable env vars not set');
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(table)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${AIRTABLE_TOKEN}` },
    body: JSON.stringify({ fields: record }),
  });
  if (!res.ok) throw new Error(`Airtable ${res.status}: ${await res.text()}`);
}

function json(statusCode, obj) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) };
}
