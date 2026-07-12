// ============================================================================
// Netlify Function: notify-send
// ============================================================================
// Admin-only. Sends a one-line email to everyone subscribed to a segment
// ("lunar" or "release"). This is never called by a visitor's browser —
// there is no button in the portal that reaches it. Ange (or whoever is
// helping her) calls it by hand when a gate opens or a chapter releases.
//
// Protected by NOTIFY_ADMIN_TOKEN, a shared secret set only in Netlify env
// vars, checked against an X-Admin-Token header. Uses the Supabase SERVICE
// ROLE key to read real email addresses — this key bypasses RLS by design,
// which is exactly why this function must stay admin-only. See
// supabase_schema.sql §8 and submit.js's handleSubscribe for the write side.
//
// Sends through Resend (RESEND_API_KEY, SEND_EMAIL_FROM). Free tier is
// 3,000 emails/month — comfortable while the list is small, worth
// re-checking once the subscriber count climbs, since "lunar" sends happen
// roughly 8x a month.
//
// Call shape:
//   POST /.netlify/functions/notify-send
//   headers: { 'X-Admin-Token': '<NOTIFY_ADMIN_TOKEN>' }
//   body: { segment: 'lunar' | 'release', subject: '...', message: '...' }
// ============================================================================

const SUPABASE_URL          = (process.env.SUPABASE_URL || '').replace(/\/+$/, '').replace(/\/rest\/v1$/, '');
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY        = process.env.RESEND_API_KEY;
const SEND_EMAIL_FROM       = process.env.SEND_EMAIL_FROM;   // e.g. "The Everflame <hello@aetherwood.au>"
const NOTIFY_ADMIN_TOKEN    = process.env.NOTIFY_ADMIN_TOKEN;
const SITE_URL              = process.env.URL || 'https://aetherwood.au';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const givenToken = event.headers['x-admin-token'] || event.headers['X-Admin-Token'];
  if (!NOTIFY_ADMIN_TOKEN || givenToken !== NOTIFY_ADMIN_TOKEN) {
    return json(401, { error: 'Unauthorized' });
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return json(400, { error: 'Invalid JSON' }); }

  const segment = body.segment;
  const subject = String(body.subject || '').trim();
  const message = String(body.message || '').trim();

  if (!['lunar', 'release'].includes(segment)) return json(400, { error: 'segment must be "lunar" or "release"' });
  if (!subject) return json(400, { error: 'subject is required' });
  if (!message) return json(400, { error: 'message is required' });

  const column = segment === 'lunar' ? 'wants_lunar' : 'wants_releases';

  let subscribers;
  try {
    subscribers = await fetchSubscribers(column);
  } catch (err) {
    return json(502, { error: 'Could not read subscribers', detail: String(err.message || err) });
  }

  if (!subscribers.length) return json(200, { ok: true, sent: 0 });

  try {
    const sent = await sendBatch(subscribers, subject, message);
    return json(200, { ok: true, sent });
  } catch (err) {
    return json(502, { error: 'Send failed', detail: String(err.message || err) });
  }
};

async function fetchSubscribers(column) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) throw new Error('Supabase service role key not set');
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/subscribers?select=email,unsubscribe_token&${column}=eq.true`,
    { headers: { apikey: SUPABASE_SERVICE_ROLE, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}` } }
  );
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res.json();
}

async function sendBatch(subscribers, subject, message) {
  if (!RESEND_API_KEY || !SEND_EMAIL_FROM) throw new Error('Resend env vars not set');
  let sent = 0;
  // Resend's batch endpoint accepts up to 100 emails per call.
  for (let i = 0; i < subscribers.length; i += 100) {
    const chunk = subscribers.slice(i, i + 100);
    const payload = chunk.map((s) => ({
      from: SEND_EMAIL_FROM,
      to: [s.email],
      subject,
      html: renderEmail(message, s.unsubscribe_token),
    }));
    const res = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
    sent += chunk.length;
  }
  return sent;
}

function renderEmail(message, token) {
  const unsubUrl = `${SITE_URL}/.netlify/functions/unsubscribe?token=${encodeURIComponent(token)}`;
  return `<div style="background:#0e0c0a;color:#e8d296;font-family:Georgia,serif;padding:32px;">
    <p style="font-style:italic;font-size:16px;line-height:1.8;margin:0 0 28px;">${escapeHtml(message)}</p>
    <p style="margin:0 0 20px;"><a href="${SITE_URL}" style="color:#c9a24a;">return to Aetherwood</a></p>
    <p style="margin:0;font-size:11px;color:rgba(200,170,110,0.45);"><a href="${unsubUrl}" style="color:rgba(200,170,110,0.55);">stop these letters</a></p>
  </div>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function json(statusCode, obj) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) };
}
