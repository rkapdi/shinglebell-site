// Turns the client row and monthly_summary rows into what the dashboard shows. No DOM, no
// network: tested in summary_test.js.

const DAY = 24 * 3600 * 1000;

// "YYYY-MM" for the month `d` falls in. With a time zone, on that zone's calendar (the summary
// view groups months on the client's clock, so the dashboard must too); without one, in UTC.
export function monthKey(d, timeZone) {
  if (!timeZone) return d.toISOString().slice(0, 7);
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit" })
    .formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}`;
}

const num = (v) => (v === null || v === undefined || v === "" ? null : Number(v));

// One month's figures, with every count defaulting to zero.
export function monthFigures(rows, month) {
  const r = rows.find((x) => String(x.month).slice(0, 7) === month) || {};
  const n = (k) => num(r[k]) ?? 0;
  return {
    callsAnswered: n("calls_answered"),
    callsMissed: n("calls_missed"),
    callsTransferred: n("calls_transferred"),
    messagesTaken: n("messages_taken"),
    inspectionsBooked: n("inspections_booked"),
    inspectionsStillBooked: n("inspections_still_booked"),
    inspectionsRecovered: n("inspections_recovered"),
    // Not yet won or lost. Older summaries without the column fall back to still booked.
    inspectionsOpen: num(r.inspections_open) ?? n("inspections_still_booked"),
    leadsReceived: n("leads_received"),
    leadsContacted: n("leads_contacted"),
    leadsUnreached: n("leads_unreached"),
    leadsLate: n("leads_late"),
    medianSecondsToFirstCall: num(r.median_seconds_to_first_call),
    // null when the client hasn't given a job value and close rate
    projectedPipelineCents: num(r.projected_pipeline_cents),
    wonRevenueCents: n("won_revenue_cents"),
    // Recovered work only (what guarantee layer 3 counts). hasRecovered is false for a summary
    // row from before these columns existed, or a month with no row at all.
    hasRecovered: r.recovered_won_cents !== undefined,
    recoveredOpen: n("recovered_open"),
    recoveredProjectedCents: num(r.recovered_projected_cents),
    recoveredWonCents: n("recovered_won_cents"),
  };
}

// The three guarantee layers (legal/guarantee.md), as statuses the page can show.
// `progress` is the client's row from the guarantee_progress view (recovered bookings between
// go-live and day 90, counted exactly). Without it, layer 2 falls back to whole months.
export function guaranteeStatus(client, rows, now, progress) {
  const month = monthKey(now, client.timezone);
  const m = monthFigures(rows, month);
  const misses = m.callsMissed + m.leadsLate;
  const layer1 = {
    misses,
    state: misses === 0 ? "on_track" : "breached",
  };

  const goLive = client.go_live_at ? new Date(client.go_live_at) : null;
  let layer2 = { state: "not_live" };
  let layer3 = { state: "not_yet" };
  if (goLive) {
    const daysLive = Math.floor((now - goLive) / DAY);
    // Months from go-live to now, and no later than the month the 90 days end (month-level:
    // the summary has no finer grain).
    const lastMonth = [month, monthKey(new Date(goLive.getTime() + 90 * DAY))].sort()[0];
    const sinceGoLive = rows.filter((r) => {
      const k = String(r.month).slice(0, 7);
      return k >= monthKey(goLive) && k <= lastMonth;
    });
    const exact = progress && num(progress.recovered_booked) !== null;
    const booked = exact
      ? num(progress.recovered_booked)
      : sinceGoLive.reduce((s, r) => s + (num(r.inspections_still_booked) ?? 0), 0);
    const target = num(client.guarantee_booked_target);
    layer2 = {
      booked,
      target,
      daysLeft: Math.max(0, 90 - daysLive),
      state: target === null ? "no_target" : booked >= target ? "met" : daysLive >= 90 ? "missed" : "in_progress",
    };
    if (daysLive >= 90) {
      const retainer = num(client.monthly_retainer_cents);
      // Recovered pipeline (agreement section 7): signed revenue plus projected pipeline, from
      // recovered work only. A month with no events at all has no row: that is zero, not unknown.
      const haveRates = client.avg_job_value_cents != null && client.close_rate != null;
      const projected = m.hasRecovered ? m.recoveredProjectedCents : m.projectedPipelineCents ?? (haveRates ? 0 : null);
      const won = m.hasRecovered ? m.recoveredWonCents : m.wonRevenueCents;
      const recovered = projected === null ? null : projected + won;
      layer3 = {
        recoveredCents: recovered,
        thresholdCents: retainer === null ? null : retainer * 3,
        state: recovered === null || retainer === null ? "not_set" : recovered >= retainer * 3 ? "above" : "below",
      };
    }
  }
  return { month, layer1, layer2, layer3 };
}

// Bookings still on the calendar with no won or lost job against them, newest first.
export function openBookings(events) {
  const d = (e) => e.details || {};
  const cancelled = new Set(events.filter((e) => e.event_type === "inspection_cancelled").map((e) => d(e).original_uid || e.external_id));
  const closed = new Set(events.filter((e) => e.event_type === "job_won" || e.event_type === "job_lost").map((e) => d(e).booking_uid).filter(Boolean));
  return events.filter((e) => e.event_type === "inspection_booked" && !cancelled.has(e.external_id) && !closed.has(e.external_id))
    .sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at));
}

export function dollars(cents) {
  if (cents === null || cents === undefined) return "Not set";
  return "$" + Math.round(cents / 100).toLocaleString("en-US");
}

export function speed(seconds) {
  if (seconds === null || seconds === undefined) return "No leads yet";
  if (seconds < 90) return `${Math.round(seconds)} s`;
  if (seconds < 5400) return `${Math.round(seconds / 60)} min`;
  return `${(seconds / 3600).toFixed(1)} h`;
}

const LABELS = {
  call_received: "Call answered",
  call_missed: "Call missed",
  call_ended: "Call ended",
  call_transferred: "Call transferred",
  message_taken: "Message taken",
  inspection_booked: "Inspection booked",
  inspection_cancelled: "Inspection cancelled",
  inspection_rescheduled: "Inspection moved",
  job_won: "Job won",
  job_lost: "Job lost",
  lead_received: "New lead",
  lead_call_placed: "Lead called",
  lead_contacted: "Lead reached",
  lead_unreached: "Lead not reached",
  lead_call_failed: "Call could not be placed",
  opt_out: "Asked not to be contacted",
  consent_captured: "Consent recorded",
  first_response: "First reply sent",
  followup_sent: "Follow-up sent",
  estimate_sent: "Estimate sent",
  review_requested: "Review requested",
  contact_excluded: "Left out of reactivation",
};

export function eventLabel(type) {
  return LABELS[type] || type;
}

const OUTCOMES = {
  booked: "Booked",
  message_taken: "Message taken",
  transferred: "Transferred",
  no_action_needed: "No action needed",
  abandoned: "Caller hung up",
  emergency: "Emergency",
  soon: "Soon",
  routine: "Routine",
  accepted: "Confirmed",
  cancelled: "Cancelled",
  queued: "Waiting for calling hours",
  no_consent: "Call by hand (no consent)",
  not_set_up: "Call by hand",
  no_phone: "No phone number",
  opted_out: "Opted out",
  duplicate: "Already being called",
  voice: "By phone",
  sms: "By text",
  email: "By email",
  ai_call: "AI call",
};

export function outcomeLabel(outcome) {
  if (!outcome) return "";
  return OUTCOMES[outcome] || outcome.replace(/_/g, " ");
}
