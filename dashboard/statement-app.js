// The printable monthly statement. Reads the client's own events from Supabase (row-level
// security does the scoping) or, with ?example=1, made-up data under a banner.

import { buildStatement, multiple } from "./statement.js";
import { dollars, monthKey } from "./summary.js";

const $ = (id) => document.getElementById(id);
const show = (id, on = true) => { $(id).hidden = !on; };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const params = new URLSearchParams(location.search);

const tile = ({ label, value, sub = "", tone = "" }) =>
  `<div class="tile ${tone}"><div class="label">${esc(label)}</div><div class="value">${esc(value)}</div>${sub ? `<div class="sub">${esc(sub)}</div>` : ""}</div>`;

function render(data, month) {
  const { client, events, recordings } = data;
  const tz = client.timezone;
  const s = buildStatement(client, events, month);
  const t = s.totals;
  const day = (iso, withTime = false) => iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}), timeZone: tz }) : "";
  const rec = (callId) => callId && recordings[callId] ? ` · <a href="${esc(recordings[callId])}" target="_blank" rel="noopener">Recording</a>` : "";

  $("client-name").textContent = client.name;
  $("month-title").textContent = new Date(`${month}-15T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  document.title = `${client.name} · recovered revenue · ${month}`;

  $("totals").innerHTML = [
    tile({ label: "Signed from recovered work", value: dollars(t.signedCents), sub: `${s.signed.length} job${s.signed.length === 1 ? "" : "s"}, confirmed by you`, tone: t.signedCents ? "good" : "" }),
    tile({ label: "Inspections recovered", value: t.recoveredInspections, sub: `${t.open} not yet won or lost` }),
    tile({ label: "Projected from open inspections (estimate)", value: dollars(t.projectedCents), sub: t.projectedCents === null ? "Needs your job value and close rate" : `${t.open} × ${dollars(client.avg_job_value_cents)} × ${Math.round(Number(client.close_rate) * 100)}%` }),
    tile({ label: "Signed dollars per retainer dollar", value: multiple(t.signedMultiple), sub: t.retainerCents === null ? "Retainer not set" : `Retainer ${dollars(t.retainerCents)} · with the estimate: ${multiple(t.pipelineMultiple)}` }),
  ].join("");

  $("signed").innerHTML = s.signed.length
    ? s.signed.map((x) => `<tr><td class="when">${esc(day(x.signedAt))}</td><td>${esc(x.how)}${rec(x.callId)}</td><td>${esc(x.who)}</td><td class="when">${esc(day(x.bookedAt))}</td><td class="money">${esc(dollars(x.valueCents))}</td></tr>`).join("")
    : `<tr><td colspan="5">No recovered job has been marked signed this month.</td></tr>`;
  $("signed-foot").innerHTML = s.signed.length ? `<tr><td colspan="4">Total signed from recovered work</td><td class="money">${esc(dollars(t.signedCents))}</td></tr>` : "";

  const OUT = { open: "Open", won: "Signed", lost: "Lost" };
  $("inspections").innerHTML = s.inspections.length
    ? s.inspections.map((i) => `<tr><td class="when">${esc(day(i.bookedAt, true))}</td><td>${esc(i.how)}${rec(i.callId)}</td><td>${esc(i.who)}</td><td class="when">${esc(day(i.inspectionAt, true))}</td><td><span class="pill ${i.status}">${OUT[i.status]}</span>${i.valueCents ? ` ${esc(dollars(i.valueCents))}` : ""}</td></tr>`).join("")
    : `<tr><td colspan="5">No recovered inspections this month.</td></tr>`;

  const left = [];
  if (s.notCounted.bookings) left.push(`${s.notCounted.bookings} booking${s.notCounted.bookings === 1 ? "" : "s"} your office or website made without us`);
  if (s.notCounted.signedCents) left.push(`${dollars(s.notCounted.signedCents)} in signed jobs that didn't come through us`);
  $("method").textContent =
    "A line appears here only when it traces to something we did: a call your team didn't pick up that our line answered, a web or Facebook lead we called back, " +
    "a reactivation message, or an open quote we followed up. Signed amounts are the contract prices you marked won; nothing is signed here until you say so. " +
    "The projected figure is an estimate (open recovered inspections × your own average job value × your own close rate) and is kept apart from signed dollars. " +
    (left.length ? `Left out on purpose this month: ${left.join(" and ")}. ` : "") +
    "Each call line links to its recording.";
}

function start(data) {
  show("app");
  const tz = data.client.timezone;
  const months = new Set(data.events.map((e) => monthKey(new Date(e.occurred_at), tz)));
  months.add(monthKey(new Date(), tz));
  const sorted = [...months].sort().reverse();
  $("month").innerHTML = sorted.map((k) => `<option value="${k}">${new Date(`${k}-15T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}</option>`).join("");
  const wanted = sorted.includes(params.get("month")) ? params.get("month") : sorted[0];
  $("month").value = wanted;
  render(data, wanted);
  $("month").onchange = () => render(data, $("month").value);
  $("print").onclick = () => window.print();
}

function exampleData() {
  const now = new Date();
  const t = (daysAgo, h = 15) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), Math.max(1, now.getUTCDate() - daysAgo), h)).toISOString();
  const booked = (uid, daysAgo, origin, name) => ({ event_type: "inspection_booked", occurred_at: t(daysAgo), external_id: uid, details: { origin, attendee_name: name, start_time: t(daysAgo - 2, 14) } });
  return {
    client: { name: "Example Roofing Co.", timezone: "America/New_York", avg_job_value_cents: 1200000, close_rate: 0.35, monthly_retainer_cents: 250000 },
    events: [
      booked("e1", 16, "call", "Homeowner A"), booked("e2", 13, "lead", "Homeowner B"), booked("e3", 11, "call", "Homeowner C"),
      booked("e4", 8, "reactivation", "Homeowner D"), booked("e5", 5, "call", "Homeowner E"), booked("e6", 3, "other", "Homeowner F"),
      { event_type: "job_won", occurred_at: t(6), external_id: "x1", value_cents: 1640000, details: { booking_uid: "e1" } },
      { event_type: "job_lost", occurred_at: t(4), external_id: "x2", details: { booking_uid: "e2" } },
      { event_type: "job_won", occurred_at: t(2), external_id: "x3", value_cents: 930000, details: { recovered_by: "estimate_followup" } },
    ],
    recordings: {},
  };
}

async function live() {
  const cfg = window.SHINGLEBELL_DASHBOARD || {};
  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) throw new Error("This page has no database settings yet. Open it with ?example=1 to see an example.");
  const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm");
  const sb = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { show("need-signin"); return; }

  const clients = await sb.from("clients").select("id, slug, name, timezone, monthly_retainer_cents, avg_job_value_cents, close_rate").order("name");
  if (clients.error) throw clients.error;
  const client = clients.data.find((c) => c.slug === params.get("client")) || clients.data[0];
  if (!client) throw new Error("Your account isn't linked to a company yet. Ask us to link it.");
  $("back").href = `index.html${params.get("client") ? `?client=${encodeURIComponent(params.get("client"))}` : ""}`;

  const events = await sb.from("events").select("occurred_at, event_type, external_id, value_cents, details")
    .eq("client_id", client.id).in("event_type", ["inspection_booked", "inspection_cancelled", "job_won", "job_lost"]).order("occurred_at").limit(5000);
  if (events.error) throw events.error;
  const callIds = [...new Set(events.data.map((e) => e.details?.origin_call_id).filter(Boolean))];
  const recordings = {};
  for (let i = 0; i < callIds.length; i += 100) {
    const calls = await sb.from("calls").select("call_id, recording_url").in("call_id", callIds.slice(i, i + 100));
    for (const c of calls.data || []) if (c.recording_url) recordings[c.call_id] = c.recording_url;
  }
  start({ client, events: events.data, recordings });
}

(async () => {
  try {
    if (params.get("example") === "1") { show("example-banner"); $("back").href = "index.html?example=1"; start(exampleData()); }
    else await live();
  } catch (err) {
    $("error").textContent = err.message || String(err);
    show("error");
  }
})();
