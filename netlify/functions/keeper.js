// Keeper's Console backend (DRAFT).
// Move this into your real Netlify functions folder (alongside submit.js / read.js)
// on the next push. It holds the Supabase service key server-side so the console
// page never carries it.
//
// Netlify env vars this needs:
//   SUPABASE_URL          (already set)
//   SUPABASE_SERVICE_KEY  (NEW: the sb_secret_... key. Do not reuse the anon key,
//                          it cannot read hidden rows or write display.)
//   KEEPER_TOKEN          (NEW: the "Keeper's word" typed on the console gate.
//                          Can reuse NOTIFY_ADMIN_TOKEN if you prefer one secret.)

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const GATE = process.env.KEEPER_TOKEN || process.env.NOTIFY_ADMIN_TOKEN;

const H = { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json" };

// The free-text rooms and how to read them.
const TABLES = [
  { table: "hearthfire_whispers",     label: "Hearthfire whispers",     text: "message",   extra: null,       extraLabel: null },
  { table: "new_moon_tapestry",       label: "New Moon tapestry",       text: "intention", extra: null,       extraLabel: null },
  { table: "waxing_gibbous_words",    label: "Waxing Gibbous words",    text: "word",      extra: null,       extraLabel: null },
  { table: "waning_gibbous_candles",  label: "Memory Hall candles",     text: "word",      extra: null,       extraLabel: null },
  { table: "memory_hall_leaves",      label: "Memory Hall leaves",      text: "message",   extra: "for_whom", extraLabel: "for" },
  { table: "memory_hall_stars",       label: "Memory Hall stars",       text: "text",      extra: "for_whom", extraLabel: "for" },
  { table: "whispered_archive_words", label: "Whispered Archive words", text: "message",   extra: "phase",    extraLabel: "phase" },
];

const json = (code, body) => ({
  statusCode: code,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

exports.handler = async (event) => {
  // auth gate
  const token = event.headers["x-keeper-token"] || "";
  if (!GATE || token !== GATE) return json(401, { error: "unauthorised" });

  const action = (event.queryStringParameters || {}).action || "";

  try {
    if (action === "counts") {
      const out = {};
      for (const t of TABLES) {
        const res = await fetch(`${URL}/rest/v1/${t.table}?select=id`, {
          headers: { ...H, Prefer: "count=exact", Range: "0-0" },
        });
        const cr = res.headers.get("content-range") || "*/0";
        out[t.table] = parseInt(cr.split("/")[1] || "0", 10);
      }
      // TODO: add a "visits" count here once visitor_paths is confirmed.
      return json(200, out);
    }

    if (action === "moderation") {
      const all = [];
      for (const t of TABLES) {
        const cols = ["id", t.text, "created_at", "display"].concat(t.extra ? [t.extra] : []).join(",");
        const res = await fetch(
          `${URL}/rest/v1/${t.table}?select=${cols}&order=created_at.desc&limit=100`,
          { headers: H }
        );
        if (!res.ok) continue;
        const rows = await res.json();
        for (const r of rows) {
          all.push({
            table: t.table, label: t.label,
            id: r.id, text: r[t.text],
            extra: t.extra ? r[t.extra] : null, extraLabel: t.extraLabel,
            display: r.display, created_at: r.created_at,
          });
        }
      }
      all.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      return json(200, all);
    }

    if (action === "set-display") {
      const b = JSON.parse(event.body || "{}");
      const t = TABLES.find((x) => x.table === b.table);
      if (!t) return json(400, { error: "unknown table" });
      const key = b.id != null ? "id" : "created_at";
      const val = b.id != null ? b.id : b.created_at;
      const res = await fetch(
        `${URL}/rest/v1/${t.table}?${key}=eq.${encodeURIComponent(val)}`,
        { method: "PATCH", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify({ display: !!b.display }) }
      );
      if (!res.ok) return json(500, { error: "update failed", status: res.status });
      return json(200, { ok: true });
    }

    // Panels awaiting a confirmed data source. Return empty for now so the
    // console shows a clean "nothing here" rather than an error.
    if (action === "support") {
      const res = await fetch(
        `${URL}/rest/v1/support_requests?select=id,message,contact,status,created_at&order=created_at.desc&limit=100`,
        { headers: H }
      );
      if (!res.ok) return json(200, []);
      return json(200, await res.json());
    }

    if (action === "support-status") {
      const b = JSON.parse(event.body || "{}");
      if (!b.id) return json(400, { error: "missing id" });
      const res = await fetch(
        `${URL}/rest/v1/support_requests?id=eq.${encodeURIComponent(b.id)}`,
        { method: "PATCH", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify({ status: b.status || "answered" }) }
      );
      if (!res.ok) return json(500, { error: "update failed", status: res.status });
      return json(200, { ok: true });
    }

    if (action === "orders") {
      // TODO: wire once we know where a "take it home" request lands
      // (email, Netlify Form, or a Supabase 'orders' table).
      return json(200, []);
    }

    if (action === "cloudinary") {
      const cn = process.env.CLOUDINARY_CLOUD_NAME;
      const ck = process.env.CLOUDINARY_API_KEY;
      const cs = process.env.CLOUDINARY_API_SECRET;
      if (!cn || !ck || !cs) return json(200, { unconfigured: true });
      const auth = Buffer.from(ck + ":" + cs).toString("base64");
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cn}/usage`, {
        headers: { Authorization: "Basic " + auth },
      });
      if (!res.ok) return json(200, { error: res.status });
      return json(200, await res.json());
    }

    return json(400, { error: "unknown action" });
  } catch (e) {
    return json(500, { error: String(e && e.message || e) });
  }
};
