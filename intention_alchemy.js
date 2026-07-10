/**
 * Aetherwood Intention Alchemy — intention_alchemy.js
 * =====================================================
 * Maps words caught during the New Moon loom ritual to teas and crystals
 * with meaningful correspondence. Each word carries thematic resonance;
 * the system finds the best tea and crystal match across the entire offering.
 *
 * When multiple words are caught, all their themes are pooled and scored —
 * so "root · dream" finds something different than "root · searching".
 * The first word caught drives the personalised reading line.
 *
 * CUSTOMISING THIS FILE:
 *   WORD_THEMES         — what each loom word carries (edit freely)
 *   TEA_AFFINITIES      — which themes each tea resonates with
 *   CRYSTAL_AFFINITIES  — which themes each crystal resonates with
 *   READING_THREADS     — the word-specific third reading line (Ange's voice)
 *
 * Include in apothecary.html before the closing </body>:
 *   <script src="intention_alchemy.js"></script>
 *
 * Then call:
 *   var result = ALCHEMY.match(['root', 'dream']);
 *   // → { tea, crystal, readingThread }
 */

const ALCHEMY = (() => {

  // ─── Word Themes ──────────────────────────────────────────────────────────
  // What each loom word carries. A word can hold more than one theme —
  // all of them contribute to the matching score.
  //
  // Note: 'tend' was renamed 'nurture' and 'kindle' renamed 'searching'
  // to better reflect the intentions people actually bring.
  // Update LOOM_WORDS in hearthfire.html to match if not already done.

  const WORD_THEMES = {
    'begin':     ['threshold', 'initiation', 'new-start', 'vision', 'direction'],
    'nurture':   ['care', 'cultivation', 'self-care', 'patience', 'needs'],
    'seek':      ['quest', 'searching', 'clarity', 'discovery', 'direction'],
    'searching': ['quest', 'searching', 'spark', 'clarity', 'discovery', 'ignition'],
    'root':      ['grounding', 'earth', 'stability', 'foundation', 'belonging', 'grounded'],
    'dream':     ['vision', 'intuition', 'night', 'veil', 'possibility'],
    'hold':      ['steadiness', 'containment', 'strength', 'breath', 'gentleness'],
    'open':      ['expansion', 'vulnerability', 'invitation', 'space', 'arrival'],
    'still':     ['peace', 'silence', 'rest', 'presence', 'awareness'],
    'arrive':    ['homecoming', 'completion', 'belonging', 'presence', 'awareness'],
    'weave':     ['integration', 'creation', 'the-loom', 'craft', 'trust'],
    'breathe':   ['presence', 'release', 'rest', 'body', 'knowing', 'cycles'],
    'grow':      ['development', 'patience', 'expansion', 'cultivation', 'roots'],
    'gather':    ['community', 'harvest', 'belonging', 'abundance', 'foundation'],
    'become':    ['transformation', 'identity', 'change', 'possibility', 'threshold'],
    'listen':    ['receptivity', 'inner-voice', 'intuition', 'stillness', 'self-knowing'],
    'return':    ['cycles', 'memory', 'homecoming', 'change', 'knowing'],
    'trust':     ['faith', 'surrender', 'heart', 'faithfulness', 'threads'],
    'mend':      ['healing', 'repair', 'restoration', 'heart', 'slowness'],
    'rest':      ['regeneration', 'stillness', 'renewal', 'peace', 'blooming'],
    'release':   ['letting-go', 'freedom', 'surrender', 'transition', 'cycles', 'breath'],
    'remember':  ['ancestors', 'past', 'memory', 'veil', 'illumination', 'carrying'],
    'find':      ['discovery', 'revelation', 'searching', 'clarity', 'dark-moon'],
    'turn':      ['transition', 'cycles', 'change', 'threshold', 'courage', 'direction'],
  };


  // ─── Tea Affinities ───────────────────────────────────────────────────────
  // The themes each tea resonates with most strongly.
  // A visitor whose words score highest against a tea's themes receives it.
  //
  // !! ANGE: Review each entry. These are inferred from the world names
  //    and your tea descriptions. Adjust anything that feels wrong.

  const TEA_AFFINITIES = {
    'Threadwake':   ['threshold', 'new-start', 'initiation', 'homecoming', 'cycles', 'direction'],
    'Sunthread':    ['clarity', 'searching', 'quest', 'expansion', 'discovery', 'direction'],
    'Emberrest':    ['rest', 'peace', 'silence', 'regeneration', 'presence', 'stillness', 'blooming'],
    'Moonkiss':     ['vision', 'intuition', 'night', 'veil', 'inner-voice', 'memory', 'possibility'],
    'Root Song':    ['grounding', 'earth', 'stability', 'foundation', 'nurturing', 'care', 'body', 'belonging', 'grounded'],
    'Hearthbloom':  ['homecoming', 'belonging', 'community', 'harvest', 'cycles', 'abundance', 'self-care'],
    'Mindthread':   ['clarity', 'searching', 'quest', 'discovery', 'revelation', 'craft', 'self-knowing'],
    'Golden Veil':  ['expansion', 'invitation', 'transformation', 'change', 'transition', 'abundance', 'possibility'],
    'Heartthread':  ['heart', 'healing', 'restoration', 'faith', 'surrender', 'faithfulness', 'containment', 'gentleness'],
    'Enchantment':  ['memory', 'ancestors', 'veil', 'past', 'vision', 'identity', 'dark-moon'],
    'Duskweave':    ['transition', 'letting-go', 'change', 'cycles', 'surrender', 'threshold', 'carrying'],
    'Seedthread':   ['initiation', 'new-start', 'development', 'patience', 'cultivation', 'threshold', 'vision'],
    'Emberwake':    ['spark', 'ignition', 'expansion', 'development', 'passion', 'knowing'],
    'Loomflow':     ['integration', 'the-loom', 'creation', 'body', 'presence', 'craft', 'trust', 'threads'],
  };


  // ─── Crystal Affinities ───────────────────────────────────────────────────
  // The themes each crystal resonates with.
  //
  // !! ANGE: Review and correct the Aetherwood world names here.
  //    Several entries below are inferred from the name alone and may be wrong.
  //    Add any missing crystals from the grimoire, remove any that don't exist.

  const CRYSTAL_AFFINITIES = {
    'Veilwhisper':      ['threshold', 'initiation', 'new-start', 'intuition', 'faithfulness', 'preparation'],
    'Ravenglass':       ['memory', 'ancestors', 'veil', 'clarity', 'revelation', 'truth', 'dark-moon'],
    'Moonthread':       ['vision', 'cycles', 'inner-voice', 'intuition', 'night', 'stillness', 'possibility'],
    'Heartwood Stone':  ['heart', 'healing', 'restoration', 'grounding', 'earth', 'nurturing', 'gentleness'],
    'Emberheart':       ['spark', 'passion', 'ignition', 'development', 'expansion', 'knowing'],
    'Shadowguard':      ['faith', 'surrender', 'containment', 'steadiness', 'peace', 'protection', 'slowness'],
    'Veilstone':        ['transition', 'change', 'letting-go', 'surrender', 'veil', 'threshold', 'carrying'],
  };


  // ─── Reading Threads ──────────────────────────────────────────────────────
  // The word-specific third line of the reading.
  // Driven by the FIRST word caught at the New Moon (the primary intention).
  // Written by Ange — these are her words.

  const READING_THREADS = {
    'begin':
      'Beginning is the first step, a vision to be realised, a direction to unfold. The waxing moon is the time to nurture the direction.',

    'nurture':
      'To nurture is not selfish, it is understanding your needs. The crescent moon asks nothing more of you than this.',

    'seek':
      'Are you looking for the right thing, and in the right way? What you are seeking may yet be found.',

    'searching':
      'There is a spark that sits within you, waiting to be kindled. Shield the spark so that it may one day grow into a flame.',

    'root':
      'Once the seed is planted, it takes time to find its roots. Your seeds have been planted, the roots will soon follow beneath the glow of the crescent moon.',

    'dream':
      'Dreaming beneath the crescent moon is to make dreams become reality. What you dream of can be seen.',

    'hold':
      'By holding gently, you give the space for breath. By breathing into what you hold, you can see how to grow.',

    'open':
      'You have made room for what you seek. Stay within the glow of the crescent to witness its arrival.',

    'still':
      'By pausing we can notice. By being still, we can assess. This will allow you to act when the way is illuminated.',

    'arrive':
      'You have taken the steps that have led you to this time and place. You may be exactly where you need to be right now. Use the crescent to see.',

    'weave':
      'The loom feels the thread you made, the weaving has begun. Trust the crescent to show you how.',

    'breathe':
      'As you breathe, feel the crescent reminding you that you are already doing the hard work. Every exhale is a release, every inhale a knowing.',

    'grow':
      'The roots of the greatest tree are unseen as they find their way. Be patient, your roots will grow to blossom soon.',

    'gather':
      'By bringing what you need into your circle, you gather the foundations that will help you succeed. Be focused as you travel, choose wisely.',

    'become':
      'The crescent sees you for what you can be, not where you are now. You can grow and blossom if you believe in your own possibility.',

    'listen':
      'Taking the time to hear yourself, to truly listen is a skill. Give yourself the gift of time and hear what you need to tell yourself. Let the crescent moon show you how.',

    'return':
      'Returning happens with knowledge. This time you know more, you see more and you feel more. That is the change that takes you forward into the light of the crescent moon.',

    'trust':
      'The thread weaves a web that holds you, gently at first until it\'s firm. Trust in yourself as much as it trusts in you beneath the crescent moon.',

    'mend':
      'Healing is slow work that deserves the time and respect you give it. As the crescent slowly awakens the moon, let the honest work awaken within you.',

    'rest':
      'Calm your senses and release to the moment. Rest as the crescent moon prepares to grow. You will soon bloom.',

    'release':
      'Close your eyes. Let the crescent moon wash over you as surely as the sun will rise and the rivers will flow. Exhale softly and release. When you inhale, you start a new cycle, ready for whatever you choose to bring.',

    'remember':
      'What is the crescent moon asking you to remember? Do you need to carry it forward, or leave it here as you head towards illumination. Only you will know.',

    'find':
      'Did you find something that resonated during the dark moon? Follow the crescent to show you how to use what you found.',

    'turn':
      'Face a new direction, sense a new path, turn towards the crescent moon and be brave as you step forward into the unknown.',
  };


  // ─── Trauma-Aware Pathway ─────────────────────────────────────────────────
  // Some intentions carry more weight than the moon can hold alone.
  // Words that suggest someone may be in a tender or vulnerable place
  // receive a quiet additional note pointing toward the Whispered Archives.
  //
  // This does not break the reading — it appears below the CTA, gently,
  // after everything else has been said. In-world, unalarming, always there.
  //
  // Words that carry this pathway:
  //   mend, release, rest, remember, hold, still, trust, return, breathe
  //
  // The Archives link and copy are set in apothecary.html (populateTeaStage).
  // This array just marks which primary words activate it.

  const TENDER_WORDS = [
    'mend', 'release', 'rest', 'remember', 'hold',
    'still', 'trust', 'return', 'breathe',
  ];


  // ─── Scoring ──────────────────────────────────────────────────────────────

  function scoreMatch(wordThemes, affinities) {
    var scores = {};
    Object.keys(affinities).forEach(function(name) {
      var score = 0;
      wordThemes.forEach(function(theme) {
        if (affinities[name].indexOf(theme) > -1) score++;
      });
      scores[name] = score;
    });
    return scores;
  }

  function bestMatch(scores, fallback) {
    var best = fallback;
    var high = 0;
    Object.keys(scores).forEach(function(name) {
      if (scores[name] > high) { high = scores[name]; best = name; }
    });
    return best;
  }


  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Match an array of caught loom words to the most resonant tea and crystal.
   *
   * @param  {string[]} words  — loom words caught at the New Moon ritual
   * @returns {{
   *   tea:           string,
   *   crystal:       string,
   *   readingThread: string|null,
   *   primaryWord:   string,
   *   allThemes:     string[],
   *   tender:        boolean   — true if this reading warrants the gentle archive pathway
   * }}
   */
  function match(words) {
    if (!words || !words.length) {
      return {
        tea: 'Emberwake', crystal: 'Veilwhisper',
        readingThread: null, primaryWord: null,
        allThemes: [], tender: false,
      };
    }

    var normalised = words.map(function(w){ return w.trim().toLowerCase(); });
    var primaryWord = normalised[0];

    // Pool all themes from all caught words
    var allThemes = [];
    normalised.forEach(function(w) {
      var themes = WORD_THEMES[w] || [];
      themes.forEach(function(t) {
        if (allThemes.indexOf(t) === -1) allThemes.push(t);
      });
    });

    var teaScores     = scoreMatch(allThemes, TEA_AFFINITIES);
    var crystalScores = scoreMatch(allThemes, CRYSTAL_AFFINITIES);

    return {
      tea:           bestMatch(teaScores,     'Seedthread'),
      crystal:       bestMatch(crystalScores, 'Veilwhisper'),
      readingThread: READING_THREADS[primaryWord] || null,
      primaryWord:   primaryWord,
      allThemes:     allThemes,
      tender:        TENDER_WORDS.indexOf(primaryWord) > -1,
    };
  }

  return { match };

})();
