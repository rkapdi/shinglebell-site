(function () {
  var cfg = window.SITE || {};
  var qs = new URLSearchParams(location.search);
  var $ = function (id) { return document.getElementById(id); };

  function store(key, value) {
    try {
      if (value === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, value);
    } catch (e) { /* private mode: carry on without it */ }
    return null;
  }

  // ---- brand, year, demo line -------------------------------------------
  document.querySelectorAll("[data-brand]").forEach(function (el) { el.textContent = cfg.brand || "Shinglebell"; });
  if ($("year")) $("year").textContent = new Date().getFullYear();
  var spots = typeof cfg.foundingSpotsLeft === "number" ? cfg.foundingSpotsLeft : 3;
  document.querySelectorAll("[data-spots]").forEach(function (el) { el.textContent = spots; });
  document.querySelectorAll("[data-spots-word]").forEach(function (el) { el.textContent = spots === 1 ? "spot" : "spots"; });

  if (cfg.demoNumber && $("demo-line")) {
    $("demo-link").textContent = cfg.demoNumber;
    $("demo-link").href = "tel:" + cfg.demoNumber.replace(/[^\d+]/g, "");
    $("demo-line").hidden = false;
  }

  // ---- headline A/B -------------------------------------------------------
  var HEADLINES = {
    a: "Roofers: how many jobs did you lose last month to <em>calls nobody answered?</em>",
    b: "Find out in 5 days how much revenue your roofing company <em>is missing.</em> Free.",
  };
  var variant = (qs.get("h") || "").toLowerCase();
  if (!HEADLINES[variant]) {
    variant = "a";
    if (cfg.headlineTest) {
      variant = store("h");
      if (!HEADLINES[variant]) {
        variant = Math.random() < 0.5 ? "a" : "b";
        store("h", variant);
      }
    }
  }
  if ($("headline")) $("headline").innerHTML = HEADLINES[variant];

  // ---- Meta pixel (only when an ID is set) -------------------------------
  function track() {
    if (typeof window.fbq === "function") window.fbq.apply(null, arguments);
  }
  if (/^\d+$/.test(cfg.metaPixelId || "")) {
    /* eslint-disable */
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
    n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
    document,'script','https://connect.facebook.net/en_US/fbevents.js');
    /* eslint-enable */
    window.fbq("init", cfg.metaPixelId);
    window.fbq("track", "PageView");
  }

  // ---- sticky mobile button: visible between the hero and the booking form
  var dock = $("dock"), hero = document.querySelector(".hero"), book = $("book");
  if (dock && hero && book && "IntersectionObserver" in window) {
    var seen = { hero: true, book: false };
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { seen[e.target === hero ? "hero" : "book"] = e.isIntersecting; });
      dock.classList.toggle("show", !seen.hero && !seen.book);
    });
    io.observe(hero); io.observe(book);
  }

  // ---- revenue question, then the calendar -------------------------------
  var cal = $("cal");
  var picks = document.querySelectorAll(".pick");

  // Accepts "handle/event" or the full "https://cal.com/handle/event" link.
  function calLink() {
    var m = /^(?:https:\/\/(?:app\.)?cal\.com\/)?([\w.-]+\/[\w.-]+)\/?$/.exec((cfg.calLink || "").trim());
    return m ? m[1] : "";
  }

  // Cal.com's own embed loader. It queues calls until embed.js has loaded.
  function loadCal() {
    if (window.Cal) return;
    /* eslint-disable */
    (function (C, A, L) { var p = function (a, ar) { a.q.push(ar); }; var d = C.document; C.Cal = C.Cal || function () { var cal = C.Cal; var ar = arguments; if (!cal.loaded) { cal.ns = {}; cal.q = cal.q || []; var s = d.createElement("script"); s.src = A; s.onerror = function () { calFailed(); }; d.head.appendChild(s); cal.loaded = true; } if (ar[0] === L) { var api = function () { p(api, arguments); }; var namespace = ar[1]; api.q = api.q || []; if (typeof namespace === "string") { cal.ns[namespace] = cal.ns[namespace] || api; p(cal.ns[namespace], ar); p(cal, ["initNamespace", namespace]); } else p(cal, ar); return; } p(cal, ar); }; })(window, "https://app.cal.com/embed/embed.js", "init");
    /* eslint-enable */
    window.Cal("init", "audit", { origin: "https://app.cal.com" });
    // Booked: tell Meta. This is the event the campaign optimizes for.
    // Cal.com has sent this under two names; listen for both and count it once.
    ["bookingSuccessful", "bookingSuccessfulV2"].forEach(function (action) {
      window.Cal.ns.audit("on", { action: action, callback: booked });
    });
  }

  function calFailed() {
    window.Cal = undefined;
    cal.innerHTML = '<p class="notice"><b>The calendar didn\'t load.</b> Check your connection and tap your answer again.</p>';
  }

  var bookedSent = false;
  function booked() {
    if (bookedSent) return;
    bookedSent = true;
    track("track", "Schedule", { content_name: "Missed-Jobs Check", headline: variant });
  }

  function showCalendar(band) {
    cal.hidden = false;
    var link = calLink();
    if (!link) {
      cal.innerHTML = '<p class="notice"><b>Calendar not connected yet.</b><br>Set calLink in site/config.js and the booking calendar appears here. Answer recorded: ' + band + ".</p>";
      return;
    }
    cal.innerHTML = "";
    // Everything in config is passed to the Cal.com booking page.
    // - The revenue answer prefills the booking question with that identifier.
    // - utm_* and metadata[...] are saved on the booking, so every booking traces back to an
    //   ad and a headline.
    var config = { layout: "month_view" };
    config[cfg.revenueField || "revenue"] = band;
    var utm = {
      utm_source: qs.get("utm_source") || "direct",
      utm_medium: qs.get("utm_medium") || "",
      utm_campaign: qs.get("utm_campaign") || "",
      utm_content: qs.get("utm_content") || "",
      utm_term: "headline-" + variant,
    };
    Object.keys(utm).forEach(function (k) {
      if (!utm[k]) return;
      config[k] = utm[k];
      config["metadata[" + k + "]"] = utm[k];
    });
    loadCal();
    if (!window.Cal) return;
    window.Cal.ns.audit("inline", { elementOrSelector: cal, calLink: link, config: config });
    cal.scrollIntoView({ block: "nearest" });
  }

  picks.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var band = btn.getAttribute("data-band");
      if (btn.getAttribute("data-fit") === "no") {
        location.href = "not-a-fit.html";
        return;
      }
      picks.forEach(function (b) { b.setAttribute("aria-pressed", String(b === btn)); });
      track("trackCustom", "AuditQualified", { revenue: band, headline: variant });
      showCalendar(band);
    });
  });
})();
