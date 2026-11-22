// Everything that changes between "draft" and "live" is in this one file.
window.SITE = {
  // Business name. Shown in the header, footer and page titles.
  brand: "Shinglebell",

  // Cal.com event link, e.g. "https://cal.com/your-handle/missed-jobs-check" (or just
  // "your-handle/missed-jobs-check").
  // While this is empty the booking section shows a "not connected" notice instead of a calendar.
  calLink: "https://cal.com/declan-mercer-csek4v/missed-jobs-check",

  // Meta pixel ID (digits only). Empty = no pixel is loaded and nothing is tracked.
  metaPixelId: "",

  // Public demo line, e.g. "(813) 555-0100". Empty = the FAQ leaves out the "call our demo line" sentence.
  demoNumber: "",

  // Founding spots still open, out of 3. The page prints this number in two places, so it is
  // only ever what is true. When it reaches 0, remove the "Founding clients" section and the
  // line under the hero button from index.html.
  foundingSpotsLeft: 3,

  // Phase 2 headline test. false = everyone sees headline A.
  // true = visitors are split 50/50 between A and B and stay on the one they got.
  // Force one for a preview with ?h=a or ?h=b.
  headlineTest: false,

  // The revenue answer tapped on the page is prefilled into the Cal.com booking form so nobody
  // answers it twice. This is the "identifier" of the revenue question on the Cal.com event.
  // Make that question a short-text question: a dropdown only prefills on an exact match.
  revenueField: "revenue",
};
