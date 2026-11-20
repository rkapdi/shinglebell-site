// Shinglebell client dashboard. Reads the client's own rows from Supabase (row-level security
// does the scoping) or, with ?example=1, made-up example data under a banner.

import { dollars, eventLabel, guaranteeStatus, monthFigures, monthKey, openBookings, outcomeLabel, speed } from "./summary.js";

const $ = (id) => document.getElementById(id);
const show = (id, on = true) => { $(id).hidden = !on; };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const params = new URLSearchParams(location.search);

function tile({ label, value, sub = "", tone = "" }) {
  return `<div class="tile ${tone}"><div class="label">${esc(label)}</div><div class="value">${esc(value)}</div>${sub ? `<div class="sub">${sub}</div>` : ""}</div>`;
}

function render(data, month) {
  const { client, rows, events, recordings, progress } = data;
  const tz = client.timezone;
  const now = month === monthKey(new Date(), tz) ? new Date() : new Date(`${month}-28T12:00:00Z`);
  const m = monthFigures(rows, month);
  const g = guaranteeStatus(client, rows, now, progress);
  const monthName = new Date(`${month}-15T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  $("month-title").textContent = monthName;
  // The printable statement for the same month (and the same example or client).
  const q = new URLSearchParams({ month });
  if (params.get("example") === "1") q.set("example", "1");
  if (params.get("client")) q.set("client", params.get("client"));
  $("statement-link").href = `statement.html?${q}`;
  $("client-name").textContent = client.name;

  const l1 = g.layer1.state === "on_track"
    ? tile({ label: "Answered, or the month is free", value: "On track", sub: "No missed calls or late leads this month", tone: "good" })
    : tile({ label: "Answered, or the month is free", value: `${g.layer1.misses} missed`, sub: "This month's retainer is free", tone: "bad" });
  const l2s = g.layer2;
  const l2 = l2s.state === "not_live" ? tile({ label: "Booked inspections in 90 days", value: "Not live yet", tone: "wait" })
    : l2s.state === "no_target" ? tile({ label: "Booked inspections in 90 days", value: String(l2s.booked), sub: "Target not set yet", tone: "wait" })
    : tile({
      label: "Booked inspections in 90 days",
      value: `${l2s.booked} of ${l2s.target}`,
      sub: l2s.state === "met" ? "Target met" : l2s.state === "missed" ? "Below target: we keep working with no retainer" : `${l2s.daysLeft} days left`,
      tone: l2s.state === "met" ? "good" : l2s.state === "missed" ? "bad" : "wait",
    });
  const l3s = g.layer3;
  const l3 = l3s.state === "not_yet" ? tile({ label: "Stay because it pays", value: "From day 90", sub: "Recovered pipeline vs 3× retainer", tone: "wait" })
    : l3s.state === "not_set" ? tile({ label: "Stay because it pays", value: "Not set", sub: "Needs your job value, close rate and retainer", tone: "wait" })
    : tile({ label: "Stay because it pays", value: dollars(l3s.recoveredCents), sub: `From our calls, leads and follow-up this month · 3× retainer is ${dollars(l3s.thresholdCents)}`, tone: l3s.state === "above" ? "good" : "bad" });
  $("guarantee").innerHTML = l1 + l2 + l3;

  $("phones").innerHTML = [
    tile({ label: "Calls answered", value: m.callsAnswered }),
    tile({ label: "Calls missed", value: m.callsMissed, tone: m.callsMissed ? "bad" : "" }),
    tile({ label: "Messages taken", value: m.messagesTaken }),
    tile({ label: "Transferred to you", value: m.callsTransferred }),
  ].join("");
  $("leads").innerHTML = [
    tile({ label: "Leads received", value: m.leadsReceived }),
    tile({ label: "Reached by phone", value: m.leadsContacted }),
    tile({ label: "Median time to first call", value: speed(m.medianSecondsToFirstCall), sub: "Leads arriving after hours wait for 8 a.m." }),
    tile({ label: "Not reached after 3 tries", value: m.leadsUnreached }),
  ].join("");
  $("pipeline").innerHTML = [
    tile({ label: "Inspections booked", value: m.inspectionsBooked, sub: `${m.inspectionsStillBooked} still on the calendar · ${m.inspectionsRecovered} from our calls and leads` }),
    tile({ label: "Projected pipeline (estimate)", value: dollars(m.projectedPipelineCents), sub: m.hasRecovered && m.projectedPipelineCents !== null ? `${dollars(m.recoveredProjectedCents)} of it from our calls and leads` : "" }),
    tile({ label: "Signed revenue (confirmed)", value: dollars(m.wonRevenueCents), sub: m.hasRecovered ? `${dollars(m.recoveredWonCents)} of it from recovered work` : "" }),
  ].join("");
  $("pipeline-note").textContent = m.projectedPipelineCents === null
    ? "Projected pipeline needs your average job value and close rate."
    : `Projected pipeline is an estimate: the ${m.inspectionsOpen} booked inspection${m.inspectionsOpen === 1 ? "" : "s"} not yet won or lost × your average job value (${dollars(client.avg_job_value_cents)}) × your close rate (${Math.round(Number(client.close_rate) * 100)}%). Signed revenue counts only jobs you've told us you won. These tiles show your whole business; the guarantee above and the monthly statement count only what came through our calls, leads and follow-up.`;

  const inMonth = events.filter((e) => monthKey(new Date(e.occurred_at), tz) === month).slice(0, 30);
  $("activity").innerHTML = inMonth.length
    ? inMonth.map((e) => {
      const when = new Date(e.occurred_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: client.timezone });
      const d = e.details || {};
      const detail = [d.summary, d.message, d.attendee_name, d.start_time ? `for ${new Date(d.start_time).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", timeZone: client.timezone })}` : null]
        .filter(Boolean).map(esc).join(" · ");
      const rec = e.call_id && recordings[e.call_id] ? ` <a href="${esc(recordings[e.call_id])}" target="_blank" rel="noopener">Recording</a>` : "";
      return `<tr><td class="when">${esc(when)}</td><td>${esc(eventLabel(e.event_type))}</td><td>${esc(outcomeLabel(e.outcome))}</td><td>${detail}${rec}</td></tr>`;
    }).join("")
    : `<tr><td colspan="4">Nothing yet this month.</td></tr>`;
}

// The list of open inspections with a "won" amount box and "lost" button on each row.
// `save(uid, outcome, amount)` writes it (Supabase in live mode, nothing in example mode).
function renderJobs(data, save) {
  const open = openBookings(data.jobEvents || []).slice(0, 40);
  show("jobs-section", Boolean(data.jobEvents));
  const tz = data.client.timezone;
  const when = (iso) => iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", timeZone: tz }) : "";
  $("jobs").innerHTML = open.length
    ? open.map((b) => `<tr><td class="when">${esc(when(b.occurred_at))}</td><td>${esc((b.details || {}).attendee_name || "")}</td><td class="when">${esc(when((b.details || {}).start_time))}</td>
        <td><form class="job-form" data-uid="${esc(b.external_id)}"><label class="fine" for="amt-${esc(b.external_id)}">Contract $</label><input id="amt-${esc(b.external_id)}" name="amount" inputmode="decimal" placeholder="18,500"><button class="primary" type="submit" value="won">Won</button><button type="button" data-lost>Lost</button></form></td></tr>`).join("")
    : `<tr><td colspan="4">Every booked inspection has an outcome.</td></tr>`;
  const act = async (form, outcome) => {
    const amount = Number(String(form.elements.amount.value).replace(/[$,\s]/g, ""));
    if (outcome === "won" && !(amount > 0)) { $("jobs-msg").textContent = "Type the contract amount first."; return; }
    $("jobs-msg").textContent = "Saving…";
    try {
      await save(form.dataset.uid, outcome, outcome === "won" ? amount : null);
      $("jobs-msg").textContent = outcome === "won" ? `Marked won at ${dollars(Math.round(amount * 100))}. Reload to see the totals change.` : "Marked lost.";
      form.closest("tr").remove();
    } catch (err) {
      $("jobs-msg").textContent = err.message || String(err);
    }
  };
  $("jobs").querySelectorAll("form").forEach((form) => {
    form.onsubmit = (ev) => { ev.preventDefault(); act(form, "won"); };
    form.querySelector("[data-lost]").onclick = () => act(form, "lost");
  });
}

function fillMonths(rows, tz) {
  const months = new Set(rows.map((r) => String(r.month).slice(0, 7)));
  months.add(monthKey(new Date(), tz));
  const sorted = [...months].sort().reverse();
  $("month").innerHTML = sorted.map((k) => `<option value="${k}">${new Date(`${k}-15T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}</option>`).join("");
  return sorted[0];
}

function start(data) {
  show("app");
  const first = fillMonths(data.rows, data.client.timezone);
  $("month").value = first;
  render(data, first);
  $("month").onchange = () => render(data, $("month").value);
  renderJobs(data, data.saveJob || (async () => {}));
}

// ---------- example mode ----------
function exampleData() {
  const now = new Date();
  const k = monthKey(now, "America/New_York");
  const prev = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 15));
  const t = (minsAgo) => new Date(now.getTime() - minsAgo * 60000).toISOString();
  return {
    client: {
      name: "Example Roofing Co.", timezone: "America/New_York",
      go_live_at: new Date(now.getTime() - 40 * 86400000).toISOString(),
      guarantee_booked_target: 12, monthly_retainer_cents: 250000, avg_job_value_cents: 1200000, close_rate: 0.35,
    },
    rows: [
      { month: `${prev}-01`, calls_answered: 96, calls_missed: 0, calls_transferred: 6, messages_taken: 21, inspections_booked: 7, inspections_still_booked: 6, inspections_recovered: 5, inspections_open: 4, recovered_open: 3, recovered_projected_cents: 1260000, recovered_won_cents: 1640000, leads_received: 18, leads_contacted: 13, leads_unreached: 2, leads_late: 0, median_seconds_to_first_call: 34, projected_pipeline_cents: 2520000, won_revenue_cents: 0 },
      { month: `${k}-01`, calls_answered: 58, calls_missed: 0, calls_transferred: 3, messages_taken: 12, inspections_booked: 5, inspections_still_booked: 5, inspections_recovered: 4, inspections_open: 5, recovered_open: 4, recovered_projected_cents: 1680000, recovered_won_cents: 0, leads_received: 11, leads_contacted: 8, leads_unreached: 1, leads_late: 0, median_seconds_to_first_call: 29, projected_pipeline_cents: 2100000, won_revenue_cents: 0 },
    ],
    events: [
      { occurred_at: t(18), event_type: "inspection_booked", outcome: "accepted", details: { attendee_name: "Homeowner A", start_time: t(-2880) } },
      { occurred_at: t(20), event_type: "call_ended", outcome: "booked", call_id: "ex1", details: { summary: "Leak over the garage after last night's storm. Booked Thursday." } },
      { occurred_at: t(23), event_type: "call_received", outcome: null, call_id: "ex1", details: {} },
      { occurred_at: t(95), event_type: "lead_contacted", outcome: null, details: {} },
      { occurred_at: t(96), event_type: "lead_call_placed", outcome: null, details: {} },
      { occurred_at: t(96), event_type: "lead_received", outcome: "queued", details: {} },
      { occurred_at: t(300), event_type: "message_taken", outcome: "routine", details: { message: "Supplier asking about a delivery window." } },
    ],
    recordings: {},
    progress: { recovered_booked: 9 },
    jobEvents: [
      { event_type: "inspection_booked", occurred_at: t(18), external_id: "ex-b1", details: { attendee_name: "Homeowner A", start_time: t(-2880) } },
      { event_type: "inspection_booked", occurred_at: t(4000), external_id: "ex-b2", details: { attendee_name: "Homeowner B", start_time: t(1200) } },
    ],
  };
}

// ---------- Supabase mode ----------
async function live() {
  const cfg = window.SHINGLEBELL_DASHBOARD || {};
  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) { show("setup"); return; }
  const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm");
  const sb = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);

  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    show("signin");
    $("signin-form").onsubmit = async (ev) => {
      ev.preventDefault();
      const { error } = await sb.auth.signInWithOtp({
        email: $("email").value.trim(),
        options: { shouldCreateUser: false, emailRedirectTo: location.href.split("#")[0] },
      });
      $("signin-msg").textContent = error ? "That email isn't set up yet. Ask us to add it." : "Check your email for the sign-in link.";
    };
    sb.auth.onAuthStateChange((event) => { if (event === "SIGNED_IN") location.reload(); });
    return;
  }
  show("sign-out");
  $("sign-out").onclick = async () => { await sb.auth.signOut(); location.reload(); };

  const clients = await sb.from("clients").select("id, slug, name, timezone, go_live_at, guarantee_booked_target, monthly_retainer_cents, avg_job_value_cents, close_rate").order("name");
  if (clients.error) throw clients.error;
  const client = clients.data.find((c) => c.slug === params.get("client")) || clients.data[0];
  if (!client) throw new Error("Your account isn't linked to a company yet. Ask us to link it.");

  // Routine follow-up sends are left out of the activity list so calls and bookings stay visible.
  const QUIET = "(followup_sent,first_response,consent_captured,contact_excluded,lead_call_failed)";
  const [rows, events, progress] = await Promise.all([
    sb.from("monthly_summary").select("*").eq("client_id", client.id).order("month"),
    sb.from("events").select("occurred_at, event_type, outcome, call_id, details").eq("client_id", client.id)
      .not("event_type", "in", QUIET).order("occurred_at", { ascending: false }).limit(300),
    sb.from("guarantee_progress").select("recovered_booked, all_booked, day_90_at").eq("client_id", client.id).maybeSingle(),
  ]);
  if (rows.error) throw rows.error;
  if (events.error) throw events.error;
  if (progress.error) throw progress.error;
  const callIds = [...new Set(events.data.map((e) => e.call_id).filter(Boolean))].slice(0, 100);
  const recordings = {};
  if (callIds.length) {
    const calls = await sb.from("calls").select("call_id, recording_url").in("call_id", callIds);
    for (const c of calls.data || []) if (c.recording_url) recordings[c.call_id] = c.recording_url;
  }
  const jobEvents = await sb.from("events").select("occurred_at, event_type, external_id, details").eq("client_id", client.id)
    .in("event_type", ["inspection_booked", "inspection_cancelled", "job_won", "job_lost"]).order("occurred_at", { ascending: false }).limit(2000);
  if (jobEvents.error) throw jobEvents.error;
  const saveJob = async (uid, outcome, amount) => {
    const { error } = await sb.rpc("mark_booking_outcome", { p_booking_uid: uid, p_outcome: outcome, p_amount_dollars: amount });
    if (error) throw error;
  };
  start({ client, rows: rows.data, events: events.data, recordings, progress: progress.data, jobEvents: jobEvents.data, saveJob });
}

(async () => {
  try {
    if (params.get("example") === "1") {
      show("example-banner");
      start(exampleData());
    } else {
      await live();
    }
  } catch (err) {
    $("error").textContent = err.message || String(err);
    show("error");
  }
})();
