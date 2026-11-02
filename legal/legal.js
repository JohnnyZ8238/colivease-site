// Legal pages: Chinese / English switch. Opens in the language asked for (?lang=zh / ?lang=en, #zh / #en; the app
// always sends one), else the one the reader last picked here, else the browser's.
(function () {
  var buttons = document.querySelectorAll("nav button");
  function show(lang, picked) {
    document.querySelectorAll("article").forEach(function (a) { a.hidden = a.lang !== lang; });
    buttons.forEach(function (b) { b.classList.toggle("on", b.dataset.lang === lang); });
    document.documentElement.lang = lang;
    // The other legal page opens in the same language.
    document.querySelectorAll('a[href^="/legal/"]').forEach(function (a) { a.setAttribute("href", a.getAttribute("href").replace(/[?#].*$/, "") + "?lang=" + lang); });
    // Only a language the reader picks with the buttons is remembered: one a link asked for must not outlast it (a
    // Chinese reader opening the page again from the app would otherwise get the English of an earlier visit).
    if (picked) {
      try { localStorage.setItem("cv-legal-lang", lang); } catch (e) {}
    }
  }
  buttons.forEach(function (b) { b.addEventListener("click", function () { show(b.dataset.lang, true); }); });
  // Only an explicit ?lang=, #zh / #en or #lang= counts (not letters that happen to be in some other parameter).
  var asked = ((location.search.match(/[?&]lang=(zh|en)(?:&|$)/i) || location.hash.match(/(?:^#|&)(?:lang=)?(zh|en)(?:&|$)/i) || [])[1] || "").toLowerCase();
  var saved = null;
  try { saved = localStorage.getItem("cv-legal-lang"); } catch (e) {}
  show(asked || saved || (/^zh/i.test(navigator.language) ? "zh" : "en"));
})();
