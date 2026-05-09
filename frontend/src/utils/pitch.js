const BENCHMARKS = {
  hvac:        { calls: 28, closeRate: 0.42, avgTicket: 485,  answerRate: 0.78 },
  plumbing:    { calls: 22, closeRate: 0.55, avgTicket: 310,  answerRate: 0.80 },
  electrical:  { calls: 18, closeRate: 0.48, avgTicket: 420,  answerRate: 0.75 },
  roofing:     { calls: 12, closeRate: 0.35, avgTicket: 8500, answerRate: 0.70 },
  landscaping: { calls: 35, closeRate: 0.60, avgTicket: 280,  answerRate: 0.82 },
};

function fmt(n) { return '$' + Math.round(n).toLocaleString(); }

// Stage = the next email to send (0 = initial pitch, 1 = FU1, 2 = FU2, 3 = break-up)
export const SEQUENCE_LABELS = ['Initial Pitch', 'Follow-up 1', 'Follow-up 2', 'Break-up'];
const SEQUENCE_DELAYS = [3, 7, 7, null]; // days until next follow-up after sending each stage

export function advanceSequence(lead) {
  const stage = lead.followUpStage || 0;
  const delay = SEQUENCE_DELAYS[stage];
  let followUpDate = null;
  if (delay) {
    const d = new Date();
    d.setDate(d.getDate() + delay);
    followUpDate = d.toISOString().slice(0, 10);
  }
  return {
    followUpStage: stage + 1,
    followUpDate,
    lastContactedAt: new Date().toISOString(),
  };
}

export function buildPitchEmail(lead) {
  const b = BENCHMARKS[lead.vertical] || BENCHMARKS.hvac;
  const missedCalls = Math.round(b.calls * (1 - b.answerRate));
  const missedLeads = Math.round(missedCalls * b.closeRate);
  const monthly = missedLeads * b.avgTicket;
  const annual = monthly * 12;
  const calcUrl = import.meta.env.VITE_CALCULATOR_URL || 'https://leadfieldpro.vercel.app/lsa-calculator.html';

  const subject = `${lead.name} — you're missing ${fmt(monthly)}/mo in ${lead.city}`;
  const body = `Hi there,

I was researching ${lead.vertical?.toUpperCase() || 'home service'} businesses in ${lead.city} and noticed ${lead.name} isn't showing up in Google's Local Service Ads (LSA) section.

Here's what that's costing you every month:

  • Missed LSA calls/mo: ~${b.calls} calls × ${Math.round((1 - b.answerRate) * 100)}% missed = ${missedCalls} lost leads
  • At your close rate (~${Math.round(b.closeRate * 100)}%) that's ${missedLeads} jobs/mo
  • At ${fmt(b.avgTicket)}/job → ${fmt(monthly)}/month left on the table
  • Over a year: ${fmt(annual)} in missed revenue

LSA shows up above everything — above the map pack, above paid ads, above organic. It's pay-per-lead, not pay-per-click.

See your exact numbers here: ${calcUrl}

Happy to do a quick 15-minute call. No obligation.

— Gentry
gentry.gevers@gmail.com`;

  return { subject, body };
}

export function buildFollowUpEmail(lead, stage) {
  const b = BENCHMARKS[lead.vertical] || BENCHMARKS.hvac;
  const missedLeads = Math.round(b.calls * (1 - b.answerRate) * b.closeRate);
  const monthly = missedLeads * b.avgTicket;

  if (stage === 1) {
    return {
      subject: `Re: ${lead.name} — quick follow-up`,
      body: `Hi there,

Just bumping my note from a few days ago in case it got buried.

${lead.name} still isn't showing in Google's Local Service Ads for ${lead.city} — that's roughly ${fmt(monthly)}/mo in high-intent calls going to whoever is showing up there.

LSA is pay-per-lead. You only pay when a qualified customer calls you directly.

Worth a 10-minute call to walk through the numbers?

— Gentry
gentry.gevers@gmail.com`,
    };
  }

  if (stage === 2) {
    return {
      subject: `${lead.name} — one more note on LSA`,
      body: `Hi,

One more follow-up before I stop cluttering your inbox.

The businesses running LSA in ${lead.city} right now are locking in the top of the Google results — above the map pack, above paid ads. Customers searching for ${lead.vertical || 'your service'} see them first, every time.

If the timing isn't right, no worries at all. Just wanted to make sure you had the full picture.

— Gentry
gentry.gevers@gmail.com`,
    };
  }

  if (stage === 3) {
    return {
      subject: `Closing the loop — ${lead.name}`,
      body: `Hi,

Last follow-up from me, I promise.

I'll take the silence as "not right now" — totally understand. I'll leave the door open.

If you ever want to talk through LSA or see what's happening in ${lead.city}, just reply and I'll set something up.

Take care,
Gentry
gentry.gevers@gmail.com`,
    };
  }

  return buildPitchEmail(lead);
}

export function buildEmailForStage(lead) {
  const stage = lead.followUpStage || 0;
  return stage === 0 ? buildPitchEmail(lead) : buildFollowUpEmail(lead, stage);
}

export function buildGmailUrl(email, subject, body) {
  const params = new URLSearchParams({ to: email, su: subject, body });
  return `https://mail.google.com/mail/?view=cm&fs=1&${params.toString()}`;
}
