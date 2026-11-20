// Everything that changes between "draft" and "live" is in this one file.
window.SITE = {
  // Business name. Shown in the header, footer and page titles.
  brand: "Shinglebell",

  // Calendly event link, e.g. "https://calendly.com/your-handle/missed-revenue-audit-review".
  // While this is empty the booking section shows a "not connected" notice instead of a calendar.
  calendlyUrl: "",

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

  // The revenue answer tapped on the page is prefilled into Calendly so nobody answers it twice.
  // "a3" means "the 3rd custom question on the Calendly event". Keep revenue as question 3,
  // or change this to match.
  revenueAnswerKey: "a3",
};
