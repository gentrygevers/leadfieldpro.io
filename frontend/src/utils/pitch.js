const BENCHMARKS = {
  hvac: { calls: 28, closeRate: 0.42, avgTicket: 485, answerRate: 0.78 },
  plumbing: { calls: 22, closeRate: 0.55, avgTicket: 310, answerRate: 0.80 },
  electrical: { calls: 18, closeRate: 0.48, avgTicket: 420, answerRate: 0.75 },
  roofing: { calls: 12, closeRate: 0.35, avgTicket: 8500, answerRate: 0.70 },
  landscaping: { calls: 35, closeRate: 0.60, avgTicket: 280, answerRate: 0.82 }
};

function fmt(n) {
  return '$' + Math.round(n).toLocaleString();
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

Here's what that's costing you every month based on your market:

  • Missed LSA calls/mo: ~${b.calls} calls × ${Math.round((1 - b.answerRate) * 100)}% missed = ${missedCalls} lost leads
  • At your close rate (~${Math.round(b.closeRate * 100)}%) that's ${missedLeads} jobs/mo
  • At ${fmt(b.avgTicket)}/job → ${fmt(monthly)}/month left on the table
  • Over a year: ${fmt(annual)} in missed revenue

LSA shows up above everything — above the map pack, above paid ads, above organic results. It's pay-per-lead, not pay-per-click.

If you're interested in seeing your exact numbers, I built a calculator for this:
${calcUrl}

Happy to do a quick 15-minute call to walk through what LSA would look like for ${lead.name} specifically. No obligation.

— Gentry
gentry.gevers@gmail.com`;

  return { subject, body };
}

export function buildGmailUrl(email, subject, body) {
  const params = new URLSearchParams({
    to: email,
    su: subject,
    body: body
  });
  return `https://mail.google.com/mail/?view=cm&fs=1&${params.toString()}`;
}
