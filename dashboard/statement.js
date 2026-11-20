// The monthly recovered-revenue statement: every recovered inspection and every dollar signed
// from recovered work in one month, each traced to the call, lead or message it came from.
// Follows agreement section 7: only recovered contacts count. No DOM, no network; tested in
// statement_test.js.

import { monthKey } from "./summary.js";

// How a booking reached the calendar (events.details.origin). 'other' is not recovered: the
// office booked it by hand, or someone used the website button who was never a lead of ours.
export const ORIGINS = {
  call: "Call answered by your Shinglebell line",
  lead: "Web or Facebook lead we called back",
  reactivation: "Reactivation message",
  estimate_followup: "Estimate follow-up",
};

const cents = (v) => (v === null || v === undefined || v === "" ? 0 : Number(v));

export function buildStatement(client, events, month) {
  const tz = client.timezone;
  const inMonth = (e) => monthKey(new Date(e.occurred_at), tz) === month;
  const d = (e) => e.details || {};

  const cancelled = new Set(events.filter((e) => e.event_type === "inspection_cancelled")
    .map((e) => d(e).original_uid || e.external_id));
  const bookings = new Map();
  for (const e of events) if (e.event_type === "inspection_booked") bookings.set(e.external_id, e);

  // The latest outcome recorded against each booking.
  const outcome = new Map();
  const jobs = events.filter((e) => e.event_type === "job_won" || e.event_type === "job_lost")
    .sort((a, b) => new Date(a.occurred_at) - new Date(b.occurred_at));
  for (const j of jobs) if (d(j).booking_uid) outcome.set(d(j).booking_uid, j);

  const recovered = (b) => b && Object.hasOwn(ORIGINS, d(b).origin);

  const inspections = [...bookings.values()]
    .filter((b) => inMonth(b) && recovered(b) && !cancelled.has(b.external_id))
    .sort((a, b) => new Date(a.occurred_at) - new Date(b.occurred_at))
    .map((b) => {
      const o = outcome.get(b.external_id);
      return {
        bookedAt: b.occurred_at,
        how: ORIGINS[d(b).origin],
        who: d(b).attendee_name || "",
        inspectionAt: d(b).start_time || null,
        callId: d(b).origin_call_id || null,
        status: !o ? "open" : o.event_type === "job_won" ? "won" : "lost",
        valueCents: o && o.event_type === "job_won" ? cents(o.value_cents) : null,
      };
    });

  // Jobs signed this month that trace back to recovered work: through a recovered booking
  // (whenever it was booked), or because the estimate follow-up had re-engaged the quote.
  const signed = jobs.filter((j) => j.event_type === "job_won" && inMonth(j))
    .map((j) => {
      const b = bookings.get(d(j).booking_uid);
      const how = recovered(b) ? ORIGINS[d(b).origin] : d(j).recovered_by === "estimate_followup" ? "Open quote we followed up" : null;
      return how && {
        signedAt: j.occurred_at, how, who: b ? d(b).attendee_name || "" : "", bookedAt: b ? b.occurred_at : null,
        callId: b ? d(b).origin_call_id || null : null, valueCents: cents(j.value_cents),
      };
    }).filter(Boolean);

  const notCounted = {
    bookings: [...bookings.values()].filter((b) => inMonth(b) && !recovered(b) && !cancelled.has(b.external_id)).length,
    signedCents: jobs.filter((j) => j.event_type === "job_won" && inMonth(j)).reduce((s, j) => s + cents(j.value_cents), 0)
      - signed.reduce((s, x) => s + x.valueCents, 0),
  };

  const open = inspections.filter((i) => i.status === "open").length;
  const haveRates = client.avg_job_value_cents != null && client.close_rate != null;
  const projectedCents = haveRates ? Math.round(open * Number(client.avg_job_value_cents) * Number(client.close_rate)) : null;
  const signedCents = signed.reduce((s, x) => s + x.valueCents, 0);
  const retainerCents = client.monthly_retainer_cents != null ? Number(client.monthly_retainer_cents) : null;
  const recoveredPipelineCents = projectedCents === null ? null : signedCents + projectedCents;

  return {
    month, inspections, signed, notCounted,
    totals: {
      recoveredInspections: inspections.length, open, signedCents, projectedCents, recoveredPipelineCents, retainerCents,
      // Signed dollars only: the figure that needs no estimate.
      signedMultiple: retainerCents ? signedCents / retainerCents : null,
      pipelineMultiple: retainerCents && recoveredPipelineCents !== null ? recoveredPipelineCents / retainerCents : null,
    },
  };
}

export function multiple(x) {
  return x === null || x === undefined ? "—" : `${(Math.round(x * 10) / 10).toFixed(1)}×`;
}
