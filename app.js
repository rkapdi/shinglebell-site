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

  function loadCalendly(done) {
    if (window.Calendly) return done();
    var css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "https://assets.calendly.com/assets/external/widget.css";
    document.head.appendChild(css);
    var js = document.createElement("script");
    js.src = "https://assets.calendly.com/assets/external/widget.js";
    js.onload = done;
    js.onerror = function () {
      cal.innerHTML = '<p class="notice"><b>The calendar didn\'t load.</b> Check your connection and tap your answer again.</p>';
    };
    document.head.appendChild(js);
  }

  function showCalendar(band) {
    cal.hidden = false;
    if (!/^https:\/\/calendly\.com\//.test(cfg.calendlyUrl || "")) {
      cal.innerHTML = '<p class="notice"><b>Calendar not connected yet.</b><br>Set calendlyUrl in site/config.js and the booking calendar appears here. Answer recorded: ' + band + ".</p>";
      return;
    }
    cal.innerHTML = "";
    var answers = {};
    answers[cfg.revenueAnswerKey || "a3"] = band;
    loadCalendly(function () {
      window.Calendly.initInlineWidget({
        url: cfg.calendlyUrl + (cfg.calendlyUrl.indexOf("?") > -1 ? "&" : "?") + "hide_gdpr_banner=1",
        parentElement: cal,
        prefill: { customAnswers: answers },
        // Which ad and which headline sent this booking shows up on the Calendly invitee record.
        utm: {
          utmSource: qs.get("utm_source") || "direct",
          utmMedium: qs.get("utm_medium") || "",
          utmCampaign: qs.get("utm_campaign") || "",
          utmContent: qs.get("utm_content") || "",
          utmTerm: "headline-" + variant,
        },
      });
    });
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

  // ---- booked: tell Meta. This is the event the campaign optimizes for. ---
  window.addEventListener("message", function (e) {
    if (e.origin !== "https://calendly.com" || !e.data || e.data.event !== "calendly.event_scheduled") return;
    track("track", "Schedule", { content_name: "Missed-Revenue Audit", headline: variant });
  });
})();
