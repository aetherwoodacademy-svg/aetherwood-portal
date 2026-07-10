/**
 * Aetherwood Portal — portal-data.js
 * ===================================
 * The browser's single doorway to the backend. Every room talks to the
 * Netlify proxy through these two helpers, never to Supabase or Airtable
 * directly, so no keys ever reach the page.
 *
 * Include after lunar.js on any room that reads or writes community data:
 *   <script src="portal-data.js"></script>
 *
 * Write:   await PortalData.submit('intention', { intention: 'root', cycle_id });
 * Read:    const data = await PortalData.read('tapestry', { cycle_id });
 *
 * Both fail quietly (return false / null) so a backend hiccup never breaks
 * the in-world experience. The room should always work even if a call fails.
 */
const PortalData = (() => {

  async function submit(type, payload) {
    try {
      const res = await fetch('/.netlify/functions/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, payload }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async function read(type, params = {}) {
    try {
      const qs = new URLSearchParams(Object.assign({ type }, params)).toString();
      const res = await fetch('/.netlify/functions/read?' + qs);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  return { submit, read };

})();
