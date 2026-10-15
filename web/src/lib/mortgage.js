export const DEFAULT_TERMS = { downPct: 20, rate: 6.5, years: 30, taxPct: 1.1, insuranceYearly: 1400 };

// Standard amortization: P * r / (1 - (1 + r)^-n), r = monthly rate, n = months.
export function principalAndInterest(price, { downPct, rate, years }) {
  const principal = price * (1 - downPct / 100);
  const r = rate / 100 / 12;
  const n = years * 12;
  return r === 0 ? principal / n : (principal * r) / (1 - Math.pow(1 + r, -n));
}

// Full monthly cost: loan payment + property tax + insurance + HOA.
export function monthlyBreakdown(price, hoa = 0, terms = DEFAULT_TERMS) {
  const pi = principalAndInterest(price, terms);
  const tax = (price * terms.taxPct) / 100 / 12;
  const insurance = terms.insuranceYearly / 12;
  return { pi, tax, insurance, hoa, total: pi + tax + insurance + hoa };
}

export function termsReducer(terms, action) {
  return { ...terms, [action.key]: action.value };
}

// "How much home can I afford?" using the common 28% front-end ratio and the same loan terms.
export function affordablePrice(monthlyIncome, terms = DEFAULT_TERMS) {
  const budget = monthlyIncome * 0.28;
  const perDollar = monthlyBreakdown(1, 0, terms).total;
  return Math.round(budget / perDollar);
}
