/* ---------------------------------------------------------------------------
   Aetherwood — global sound control
   One always-visible mute, identical in every room, top-right. It is a hard
   kill switch across ALL audio in the room, however that audio is made:
     - plain <audio> elements in the page
     - detached  new Audio()  clips (fire crackle, voices, sfx)
     - Web Audio graphs (element -> GainNode -> destination), which ignore the
       element's own muted/volume, so we suspend their AudioContext instead
   The choice is remembered, so it follows the visitor room to room. This never
   STARTS audio, it only silences. Nobody should be surprised by sound.
   Include once per room:  <script src="sound-control.js"></script>
--------------------------------------------------------------------------- */
(function () {
  var KEY = 'aetherwood.muted';
  function muted()    { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } }
  function persist(m) { try { localStorage.setItem(KEY, m ? '1' : '0'); } catch (e) {} }

  var audios   = [];   // every Audio() instance we see, in DOM or not
  var contexts = [];   // every AudioContext created

  /* ---- 1. plain elements + detached Audio() clips: element.muted ---- */
  var NativeAudio = window.Audio;
  if (NativeAudio) {
    var WrappedAudio = function (src) {
      var a = (src === undefined) ? new NativeAudio() : new NativeAudio(src);
      audios.push(a);
      if (muted()) { try { a.muted = true; } catch (e) {} }
      return a;
    };
    WrappedAudio.prototype = NativeAudio.prototype;
    try { window.Audio = WrappedAudio; } catch (e) {}
  }

  /* ---- 2. Web Audio graphs: suspend the whole context ---- */
  function trackContext(ctx) {
    if (!ctx || contexts.indexOf(ctx) !== -1) return ctx;
    contexts.push(ctx);
    try {
      ctx.addEventListener('statechange', function () {
        // if a room resumes its context while we are muted, put it back to sleep
        if (muted() && ctx.state === 'running') { try { ctx.suspend(); } catch (e) {} }
      });
    } catch (e) {}
    if (muted()) { try { ctx.suspend(); } catch (e) {} }
    return ctx;
  }
  function wrapAC(Native) {
    if (!Native) return Native;
    var Wrapped = function () { return trackContext(new Native()); };
    Wrapped.prototype = Native.prototype;
    return Wrapped;
  }
  try { if (window.AudioContext)       window.AudioContext       = wrapAC(window.AudioContext); } catch (e) {}
  try { if (window.webkitAudioContext) window.webkitAudioContext = wrapAC(window.webkitAudioContext); } catch (e) {}

  /* ---- apply the current state to everything we know about ----
     Mute also PAUSES whatever is playing (so the tale stops where it is), and
     unmute resumes exactly those clips. ---- */
  var pausedByUs = [];
  function applyAll() {
    var m = muted();
    var known = [];
    var domEls = document.querySelectorAll('audio, video');
    for (var i = 0; i < domEls.length; i++) known.push(domEls[i]);
    for (var j = 0; j < audios.length; j++) { if (known.indexOf(audios[j]) === -1) known.push(audios[j]); }

    if (m) {
      for (var a = 0; a < known.length; a++) {
        var el = known[a];
        try { el.muted = true; } catch (e) {}
        try { if (!el.paused && pausedByUs.indexOf(el) === -1) { pausedByUs.push(el); el.pause(); } } catch (e) {}
      }
      for (var c = 0; c < contexts.length; c++) { try { contexts[c].suspend(); } catch (e) {} }
    } else {
      for (var c2 = 0; c2 < contexts.length; c2++) { try { contexts[c2].resume(); } catch (e) {} }
      for (var a2 = 0; a2 < known.length; a2++) { try { known[a2].muted = false; } catch (e) {} }
      for (var p = 0; p < pausedByUs.length; p++) {
        try { var pr = pausedByUs[p].play(); if (pr && pr.catch) pr.catch(function () {}); } catch (e) {}
      }
      pausedByUs = [];
    }
  }

  /* catch <audio>/<video> added to the DOM later */
  try {
    new MutationObserver(function () { if (muted()) applyAll(); })
      .observe(document.documentElement, { childList: true, subtree: true });
  } catch (e) {}

  /* ---- the button ---- */
  var SVG_ON =
    '<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.8a4.5 4.5 0 0 1 0 6.4"/><path d="M19 6.5a8 8 0 0 1 0 11"/></svg>';
  var SVG_OFF =
    '<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 9.5l4 5M21 9.5l-4 5"/></svg>';

  function render() {
    var b = document.getElementById('aetherMute');
    if (!b) return;
    var m = muted();
    b.innerHTML = m ? SVG_OFF : SVG_ON;
    b.classList.toggle('is-muted', m);
    b.setAttribute('aria-label', m ? 'Sound is muted. Tap to allow sound.' : 'Mute all sound');
    b.setAttribute('aria-pressed', m ? 'true' : 'false');
    b.setAttribute('title', m ? 'Muted' : 'Mute sound');
  }

  function build() {
    if (document.getElementById('aetherMute')) return;
    var css = document.createElement('style');
    css.textContent =
      '#aetherMute{position:fixed;top:3.4vmin;right:3.4vmin;z-index:260;width:42px;height:42px;' +
      'display:flex;align-items:center;justify-content:center;padding:7px;background:none;border:none;' +
      'cursor:pointer;color:rgba(232,216,182,0.5);-webkit-tap-highlight-color:transparent;' +
      'filter:drop-shadow(0 1px 5px rgba(0,0,0,0.95));opacity:.72;' +
      'transition:color .4s ease,opacity .4s ease;}' +
      '#aetherMute:hover,#aetherMute:focus{color:rgba(245,224,175,0.95);opacity:1;outline:none;}' +
      '#aetherMute.is-muted{color:rgba(214,150,120,0.72);}' +
      '@media (max-width:600px){#aetherMute{top:2.6vmin;right:2.6vmin;}}';
    (document.head || document.documentElement).appendChild(css);

    var b = document.createElement('button');
    b.id = 'aetherMute';
    b.type = 'button';
    b.addEventListener('click', function () {
      persist(!muted());
      applyAll();
      render();
    });
    document.body.appendChild(b);
    render();
    applyAll();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
