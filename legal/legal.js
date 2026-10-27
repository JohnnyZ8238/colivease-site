// Legal pages: Chinese / English switch. Opens in the language asked for (?lang=en, #en), else the browser's.
(function () {
  var buttons = document.querySelectorAll("nav button");
  function show(lang) {
    document.querySelectorAll("article").forEach(function (a) { a.hidden = a.lang !== lang; });
    buttons.forEach(function (b) { b.classList.toggle("on", b.dataset.lang === lang); });
    document.documentElement.lang = lang;
    try { localStorage.setItem("cv-legal-lang", lang); } catch (e) {}
  }
  buttons.forEach(function (b) { b.addEventListener("click", function () { show(b.dataset.lang); }); });
  var asked = (location.search.match(/lang=(zh|en)/) || location.hash.match(/(zh|en)/) || [])[1];
  var saved = null;
  try { saved = localStorage.getItem("cv-legal-lang"); } catch (e) {}
  show(asked || saved || (/^zh/i.test(navigator.language) ? "zh" : "en"));
})();
