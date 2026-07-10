/**
 * Aetherwood Lunar System — lunar.js
 * ====================================
 * Pure JavaScript lunar phase calculator.
 * No dependencies. No API calls. No cost.
 *
 * Include this file in every portal page:
 *   <script src="lunar.js"></script>
 *
 * Then call LUNAR.getLunarState() anywhere to get the current phase.
 *
 * Reference: 6 January 2000, 18:14 UTC was a known New Moon (J2000 epoch).
 * Synodic period: 29.53059 days (time between two New Moons).
 */

const LUNAR = (() => {

  // ─── Constants ────────────────────────────────────────────────────────────

  const SYNODIC_PERIOD = 29.53059; // days
  const REFERENCE_NEW_MOON = new Date('2000-01-06T18:14:00Z').getTime();

  // ─── Phase Definitions ────────────────────────────────────────────────────
  //
  // Eight phases with Dark Moon as Ange's 8th (replaces Waning Crescent).
  // Each phase spans 1/8 of the synodic cycle (~3.69 days).
  // 'fraction' range: 0.0 = New Moon → 0.5 = Full Moon → 1.0 = back to New Moon.
  //
  // room: the portal page that activates for this phase.
  // All eight rooms are built and live. Keep these filenames in step with any
  // future renames, since features may trust this map for wayfinding.

  const PHASES = [
    {
      key:          'new-moon',
      name:         'New Moon',
      emoji:        '🌑',
      room:         'hearthfire.html',
      roomName:     'the Hearthfire',
      host:         'The Threadsingers',
      fractionStart: 0,
      fractionEnd:   0.125
    },
    {
      key:          'waxing-crescent',
      name:         'Waxing Crescent',
      emoji:        '🌒',
      room:         'apothecary.html',
      roomName:     'the Apothecary',
      host:         'The Apothecary',
      fractionStart: 0.125,
      fractionEnd:   0.25
    },
    {
      key:          'first-quarter',
      name:         'First Quarter',
      emoji:        '🌓',
      room:         'library.html',       // Eirik's lunar gate (Antechamber retired 7 Jul 2026, merged into the Library)
      roomName:     'the Library of Tales',
      host:         'Rotating Aetherwood characters',
      fractionStart: 0.25,
      fractionEnd:   0.375
    },
    {
      key:          'waxing-gibbous',
      name:         'Waxing Gibbous',
      emoji:        '🌔',
      room:         'library.html',       // same lunar gate as First Quarter, different activation (Lyra)
      roomName:     'the Library of Tales',
      host:         'Lyra',
      fractionStart: 0.375,
      fractionEnd:   0.5
    },
    {
      key:          'full-moon',
      name:         'Full Moon',
      emoji:        '🌕',
      room:         'compliance.html',    // always open; Full Moon is its rotation slot, not a gate
      roomName:     "Maureen's Compliance Office",
      host:         'Maureen',
      fractionStart: 0.5,
      fractionEnd:   0.625
    },
    {
      key:          'waning-gibbous',
      name:         'Waning Gibbous',
      emoji:        '🌖',
      room:         'memory-hall.html',   // always open; the grove and five chapter rooms
      roomName:     'Memory Hall',
      host:         'The Hall itself',
      fractionStart: 0.625,
      fractionEnd:   0.75
    },
    {
      key:          'last-quarter',
      name:         'Last Quarter',
      emoji:        '🌗',
      room:         'fountain.html',      // reached by Velin's key in the Whispered Archives
      roomName:     'the Secret Fountain',
      host:         'Velin (key held in the Whispered Archives)',
      fractionStart: 0.75,
      fractionEnd:   0.875
    },
    {
      key:          'dark-moon',
      name:         'Dark Moon',
      emoji:        '🌑',
      room:         'resonance_snug.html', // the warm snug (old resonance.html retired)
      roomName:     'the Resonance Chamber',
      host:         'Draven',
      fractionStart: 0.875,
      fractionEnd:   1.0
    }
  ];


  // ─── Core Calculation ─────────────────────────────────────────────────────

  /**
   * Returns where we are in the lunar cycle as a fraction from 0 to 1.
   * 0.0 = New Moon, 0.5 = Full Moon, approaching 1.0 = Dark Moon.
   */
  function getLunarFraction(date = new Date()) {
    const elapsedMs   = date.getTime() - REFERENCE_NEW_MOON;
    const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);
    const fraction    = ((elapsedDays % SYNODIC_PERIOD) + SYNODIC_PERIOD) % SYNODIC_PERIOD / SYNODIC_PERIOD;
    return fraction;
  }

  /**
   * Returns the phase object for a given date.
   */
  function getPhase(date = new Date()) {
    const fraction = getLunarFraction(date);
    return PHASES.find(p => fraction >= p.fractionStart && fraction < p.fractionEnd) || PHASES[0];
  }

  /**
   * Returns the date of the most recent New Moon before a given date.
   * Used to generate stable Airtable cycle IDs.
   */
  function getLastNewMoon(date = new Date()) {
    const elapsedMs        = date.getTime() - REFERENCE_NEW_MOON;
    const elapsedDays      = elapsedMs / (1000 * 60 * 60 * 24);
    const completedCycles  = Math.floor(elapsedDays / SYNODIC_PERIOD);
    const lastNewMoonMs    = REFERENCE_NEW_MOON + completedCycles * SYNODIC_PERIOD * 24 * 60 * 60 * 1000;
    return new Date(lastNewMoonMs);
  }

  /**
   * Returns a stable Airtable cycle identifier for the current lunar cycle.
   * Format: YYYY-MM-DD of the most recent New Moon.
   * e.g. "2026-06-25" — the same for every visitor in that cycle.
   *
   * Use this as the cycle_id when reading/writing to Airtable.
   */
  function getCycleId(date = new Date()) {
    return getLastNewMoon(date).toISOString().split('T')[0];
  }

  /**
   * Returns the complete lunar state for the current moment.
   * This is the main function — call this on every portal page.
   *
   * Returns:
   *   phase         — the full phase object (name, emoji, room, host, etc.)
   *   fraction      — 0–1 position in the cycle
   *   cycleId       — stable cycle key e.g. "2026-06-25"
   *   daysIntoPhase — how many days into the current phase
   *   daysUntilNext — how many days until the next phase begins
   *   testMode      — true if phase is being overridden via URL param
   *
   * TEST MODE: append ?phase=<key> to any URL to override the detected phase.
   * Valid keys: new-moon, waxing-crescent, first-quarter, waxing-gibbous,
   *             full-moon, waning-gibbous, last-quarter, dark-moon
   * Example: hearthfire.html?phase=new-moon
   */
  function getLunarState(date = new Date()) {
    // ── Test mode: ?phase=<key> overrides astronomical calculation ──
    const urlParams   = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    const phaseParam  = urlParams.get('phase');
    const testPhase   = phaseParam ? PHASES.find(function(p){ return p.key === phaseParam; }) : null;

    const fraction      = getLunarFraction(date);
    const phase         = testPhase || getPhase(date);
    const cycleId       = getCycleId(date);
    const daysIntoPhase = (fraction - phase.fractionStart) * SYNODIC_PERIOD;
    const daysUntilNext = (phase.fractionEnd - fraction) * SYNODIC_PERIOD;

    return {
      phase,
      fraction,
      cycleId,
      daysIntoPhase: Math.max(0, Math.floor(daysIntoPhase)),
      daysUntilNext: Math.max(1, Math.ceil(daysUntilNext)),
      testMode: !!testPhase
    };
  }


  // ─── Exposed API ──────────────────────────────────────────────────────────

  return {
    getLunarState,   // Main function — use this
    getPhase,        // Phase object only
    getLunarFraction,// Raw 0–1 fraction
    getCycleId,      // Airtable cycle key
    PHASES           // Full phase definitions array
  };

})();


// ─── localStorage Utilities ───────────────────────────────────────────────────
//
// The visitor's New Moon intention travels with them across phases.
// It lives in localStorage only — private intentions never leave the device
// unless the visitor explicitly chooses to share on the public tapestry.
//
// Keys used across the portal:
//   aetherwood_trail        — Everflame navigation trail (already in use)
//   aetherwood_intention    — New Moon intention (set in Hearthfire)
//   aetherwood_fountain_token — Anonymous session token for fountain releases

const AETHERWOOD = (() => {

  const INTENTION_KEY     = 'aetherwood_intention';
  const FOUNTAIN_KEY      = 'aetherwood_fountain_token';

  // ─── Intention ────────────────────────────────────────────────────────────

  /**
   * Returns the stored New Moon intention, or null if none set.
   * Stored shape: { word, isPublic, cycleId, setAt }
   */
  function getIntention() {
    try {
      return JSON.parse(localStorage.getItem(INTENTION_KEY));
    } catch {
      return null;
    }
  }

  /**
   * Saves the visitor's New Moon intention.
   * Called from the Hearthfire when the visitor sets their thread.
   *
   * @param {string}  word      — the word or symbol chosen
   * @param {boolean} isPublic  — true if visitor chose to share on the tapestry
   * @param {string}  cycleId   — from LUNAR.getCycleId()
   */
  function setIntention(word, isPublic, cycleId) {
    const intention = {
      word,
      isPublic,
      cycleId,
      setAt: new Date().toISOString()
    };
    localStorage.setItem(INTENTION_KEY, JSON.stringify(intention));
    return intention;
  }

  /**
   * Returns the intention if it belongs to the current cycle.
   * If it's from a previous cycle, clears it and returns null.
   * Call this at the start of each phase experience.
   *
   * @param {string} currentCycleId — from LUNAR.getCycleId()
   */
  function getIntentionForCycle(currentCycleId) {
    const intention = getIntention();
    if (!intention) return null;
    if (intention.cycleId !== currentCycleId) {
      localStorage.removeItem(INTENTION_KEY);
      return null;
    }
    return intention;
  }

  // ─── Fountain Token ───────────────────────────────────────────────────────

  /**
   * Returns (or creates) an anonymous session token for the Secret Fountain.
   * Groups multiple releases from one visit without identifying the visitor.
   * Stored in localStorage — persists across page loads on the same device.
   */
  function getFountainToken() {
    let token = localStorage.getItem(FOUNTAIN_KEY);
    if (!token) {
      token = Math.random().toString(36).substr(2, 12);
      localStorage.setItem(FOUNTAIN_KEY, token);
    }
    return token;
  }

  // ─── Visitor Token ──────────────────────────────────────────────────────────
  // A persistent anonymous id for this device, so a returning visitor can find
  // what they planted in the Year Wheel (seeds + wishes). No login, no email —
  // it lives only in localStorage. Clearing the browser forgets the plantings.
  const VISITOR_KEY = 'aetherwood_visitor';
  function getVisitorToken() {
    let token = localStorage.getItem(VISITOR_KEY);
    if (!token) {
      token = Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
      localStorage.setItem(VISITOR_KEY, token);
    }
    return token;
  }

  // ─── Exposed API ──────────────────────────────────────────────────────────

  return {
    getIntention,
    setIntention,
    getIntentionForCycle,
    getFountainToken
  };

})();
