// ============================================================================
// Netlify Function: read
// ============================================================================
// One read endpoint. The browser GETs  ?type=...&cycle_id=...
// Returns only what each room needs to display. Private data (fountain
// releases, visitor paths) is never returned as content — only counts, and
// only where the database explicitly allows it.
//
// Dependency-free: uses Node's built-in fetch.
// ============================================================================

const SUPABASE_URL      = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const AIRTABLE_TOKEN    = process.env.AIRTABLE_TOKEN;     // confessions archive
const AIRTABLE_BASE_ID  = process.env.AIRTABLE_BASE_ID;   // confessions archive

exports.handler = async (event) => {
  const q       = event.queryStringParameters || {};
  const type    = q.type;
  const cycleId = q.cycle_id || '';

  try {
    switch (type) {
      case 'tapestry':
        return json(200, { items: await sbSelect('new_moon_tapestry',
          `cycle_id=eq.${enc(cycleId)}&display=eq.true&select=intention,created_at&order=created_at.desc`) });

      case 'gibbous_words':
        return json(200, { items: await sbSelect('waxing_gibbous_words',
          `cycle_id=eq.${enc(cycleId)}&display=eq.true&select=word,created_at&order=created_at.desc`) });

      case 'leaves':
        return json(200, { items: await sbSelect('memory_hall_leaves',
          `display=eq.true&select=message,for_whom,created_at&order=created_at.desc&limit=100`) });

      case 'whispers':
        return json(200, { items: await sbSelect('hearthfire_whispers',
          `display=eq.true&select=message,created_at&order=created_at.desc&limit=100`) });

      case 'archive_words':
        return json(200, { items: await sbSelect('whispered_archive_words',
          `display=eq.true&select=message,phase,created_at&order=created_at.desc&limit=100`) });

      case 'faculty_notices':
        return json(200, { items: await airtableFacultyNotices() });

      case 'memory_stars':
        return json(200, { items: await sbSelect('memory_hall_stars',
          `room=eq.${enc(q.room || '')}&display=eq.true&select=text,for_whom,sx,sy,created_at&order=created_at.desc&limit=300`) });

      case 'first_quarter_tally': {
        const rows = await sbSelect('first_quarter_responses',
          `cycle_id=eq.${enc(cycleId)}&display=eq.true&select=choice`);
        const tally = { a: 0, b: 0, c: 0, total: rows.length };
        rows.forEach(r => { if (tally[r.choice] !== undefined) tally[r.choice]++; });
        return json(200, { tally });
      }

      case 'candle_count':
        // Uses the security-definer RPC, not a plain select, so the count stays
        // live regardless of word moderation (display gates the word, not the count).
        return json(200, { count: await sbRpc('candle_count', { p_cycle_id: cycleId }) });

      case 'candles':
        return json(200, { items: await sbSelect('waning_gibbous_candles',
          `cycle_id=eq.${enc(cycleId)}&display=eq.true&select=word,created_at&order=created_at.desc&limit=200`) });

      case 'release_count':
        return json(200, { count: await sbRpc('fountain_release_count', { p_cycle_id: cycleId }) });

      case 'confessions':
        return json(200, { items: await airtableConfessions(cycleId) });

      // A visitor's own plantings (seeds + wishes), by their device token.
      case 'my_plantings':
        return json(200, { items: await sbSelect('year_wheel_plantings',
          'token=eq.' + enc(q.token || '') +
          '&select=season,kind,body,is_public,planted_at&order=planted_at.desc&limit=50') });

      // The shared field — only plantings the visitor chose to make public. Anonymous.
      case 'shared_plantings': {
        let query = 'is_public=eq.true';
        if (q.season) query += '&season=eq.' + enc(q.season);
        query += '&select=season,kind,body,planted_at&order=planted_at.desc&limit=200';
        return json(200, { items: await sbSelect('year_wheel_plantings', query) });
      }

      default:
        return json(400, { error: 'Unknown read type' });
    }
  } catch (err) {
    return json(502, { error: 'Read failed', detail: String(err.message || err) });
  }
};

function sbHeaders() {
  return { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` };
}

async function sbSelect(table, query) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Supabase env vars not set');
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, { headers: sbHeaders() });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res.json();
}

// Counts via the Content-Range header, fetching only one row.
async function sbCount(table, filter) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Supabase env vars not set');
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}&select=id&limit=1`, {
    headers: { ...sbHeaders(), Prefer: 'count=exact' },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  const range = res.headers.get('content-range') || '*/0';
  return parseInt(range.split('/')[1], 10) || 0;
}

async function sbRpc(fn, args) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Supabase env vars not set');
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { ...sbHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`Supabase RPC ${res.status}: ${await res.text()}`);
  return res.json();
}

// Confessions live in Airtable. Return this cycle's visible ones, with
// Maureen's note where she's added one, newest first.
async function airtableConfessions(cycleId) {
  if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID) throw new Error('Airtable env vars not set');
  const safe    = String(cycleId).replace(/['"\\]/g, '');
  const formula = "AND({cycle_id}='" + safe + "',{display})";
  const url = 'https://api.airtable.com/v0/' + AIRTABLE_BASE_ID +
              '/full_moon_confessions?filterByFormula=' + encodeURIComponent(formula) + '&pageSize=100';
  const res = await fetch(url, { headers: { Authorization: 'Bearer ' + AIRTABLE_TOKEN } });
  if (!res.ok) throw new Error('Airtable ' + res.status + ': ' + await res.text());
  const data = await res.json();
  return (data.records || []).map(function (r) {
    return {
      confession:   (r.fields && r.fields.confession) || '',
      maureen_note: (r.fields && r.fields.maureen_note) || '',
      created_at:   r.createdTime,
    };
  }).sort(function (a, b) { return a.created_at < b.created_at ? 1 : -1; });
}

// Faculty notices for the Hearthfire noticeboard live in Airtable — Ange
// writes/edits these directly in the Airtable UI, no deploy needed. Only
// rows with display checked come back, newest first.
async function airtableFacultyNotices() {
  if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID) throw new Error('Airtable env vars not set');
  const url = 'https://api.airtable.com/v0/' + AIRTABLE_BASE_ID +
              '/faculty_notices?filterByFormula=' + encodeURIComponent('{display}') + '&pageSize=100';
  const res = await fetch(url, { headers: { Authorization: 'Bearer ' + AIRTABLE_TOKEN } });
  if (!res.ok) throw new Error('Airtable ' + res.status + ': ' + await res.text());
  const data = await res.json();
  return (data.records || []).map(function (r) {
    return {
      body:       (r.fields && r.fields.body) || '',
      signature:  (r.fields && r.fields.signature) || '',
      created_at: r.createdTime,
    };
  }).sort(function (a, b) { return a.created_at < b.created_at ? 1 : -1; });
}

function enc(s) { return encodeURIComponent(s); }

function json(statusCode, obj) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) };
}
