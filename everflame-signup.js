/**
 * Aetherwood — Everflame signup ritual
 * =====================================
 * Shared behaviour for the "leave your name with the flame" capture point,
 * reused across Hearthfire, Lost Soul, and Silver Beast (11 Jul 2026). Each
 * room keeps its own HTML and palette (see each page's <style> block for
 * .ef-path / .ef-paths / .ef-hint), this file just wires the interaction:
 * toggle the two paths, require at least one, submit through PortalData to
 * the `subscribers` table, show the thanks line.
 *
 * Requires portal-data.js to be included first.
 *
 * Expects, inside one <form id="everflameForm">:
 *   #efEmail   — the email input
 *   #efBot     — honeypot input, left empty by real visitors
 *   any number of .ef-path buttons, each with data-path="lunar" or "release"
 *   .ef-hint   — optional nudge line shown if nothing was chosen
 * and, as a sibling of the form:
 *   #everflameThanks — shown after a successful submit
 */
(function () {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init(); // script included after the form already parsed — run right away
  }

  function init() {
  var form = document.getElementById('everflameForm');
  if (!form) return;

  var email  = document.getElementById('efEmail');
  var bot    = document.getElementById('efBot');
  var thanks = document.getElementById('everflameThanks');
  var paths  = form.querySelectorAll('.ef-path');
  var hint   = form.querySelector('.ef-hint');
  var chosen = {};

  for (var i = 0; i < paths.length; i++) {
    (function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-path');
        chosen[key] = !chosen[key];
        btn.classList.toggle('is-chosen', !!chosen[key]);
        btn.setAttribute('aria-pressed', chosen[key] ? 'true' : 'false');
        if (hint) hint.classList.remove('show');
      });
    })(paths[i]);
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (bot && bot.value) return; // spam trap tripped — fail silently, no error shown

    if (!chosen.lunar && !chosen.release) {
      if (hint) hint.classList.add('show');
      return;
    }
    if (!email || !email.value) return;

    var submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    PortalData.submit('subscribe', {
      email: email.value,
      wants_lunar: !!chosen.lunar,
      wants_releases: !!chosen.release,
    }).then(function (ok) {
      if (ok) {
        form.style.display = 'none';
        if (thanks) thanks.classList.add('show');
      } else if (submitBtn) {
        submitBtn.disabled = false;
      }
    });
  });
  }
})();
