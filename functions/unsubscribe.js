// ============================================================================
// Netlify Function: unsubscribe
// ============================================================================
// Public GET endpoint, reached from the link at the bottom of every lunar or
// release email. Turns off both preference flags for the row matching the
// token, so no more sends reach that address. Uses the Supabase SERVICE
// ROLE key, same trust boundary as notify-send.js — the token itself is
// the credential here, there's nothing else to check it against.
//
// Call shape: GET /.netlify/functions/unsubscribe?token=<unsubscribe_token>
// ============================================================================

const SUPABASE_URL          = (process.env.SUPABASE_URL || '').replace(/\/+$/, '').replace(/\/rest\/v1$/, '');
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

exports.handler = async (event) => {
  const token = (event.queryStringParameters || {}).token;
  if (!token) return html(400, page('No token was given.'));

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    return html(500, page('Something went wrong. Write to portal@aetherwood.au and it will be fixed by hand.'));
  }

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/subscribers?unsubscribe_token=eq.${encodeURIComponent(token)}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_SERVICE_ROLE,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ wants_lunar: false, wants_releases: false }),
      }
    );
    if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
    return html(200, page('The Everflame no longer calls. You have been unsubscribed.'));
  } catch (err) {
    return html(502, page('Something went wrong. Write to portal@aetherwood.au and it will be fixed by hand.'));
  }
};

function page(message) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Aetherwood</title>
<style>
  body { background:#0e0c0a; color:#e8d296; font-family:Georgia,serif; display:flex;
         align-items:center; justify-content:center; min-height:100vh; margin:0; padding:32px; text-align:center; }
  p { font-style:italic; font-size:18px; line-height:1.8; max-width:420px; }
  a { color:#c9a24a; }
</style></head>
<body><p>${message}<br><br><a href="/">return to Aetherwood</a></p></body></html>`;
}

function html(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'text/html; charset=utf-8' }, body };
}
