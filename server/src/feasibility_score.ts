export const FEASIBILITY_METHODOLOGY_VERSION = 'pvinsights-feasibility-v1' as const;

export type FeasibilityBand = 'poor' | 'marginal' | 'acceptable' | 'good' | 'excellent';

export type FeasibilityKpisInput = {
  specific_yield_kwh_per_kwp: number;
  annual_kwh: number;
  uncertainty_annual_kwh: number;
};

export type FeasibilityFinanceInput = {
  npv: number | null;
  effective_capex: number;
  simple_payback_years: number | null;
  payback_years: number | null;
  irr: number | null;
};

export type FeasibilityMonteCarloInput = {
  prob_npv_positive?: number;
  prob_payback_within_analysis?: number;
};

export type FeasibilityScorePayload = {
  score: number;
  band: FeasibilityBand;
  methodology_version: typeof FEASIBILITY_METHODOLOGY_VERSION;
  components: {
    economics: {
      score: number;
      weight: number;
      detail: {
        used_metrics: ('npv_ratio' | 'payback_ratio' | 'irr_spread')[];
        npv_ratio?: number;
        payback_ratio?: number;
        irr_spread?: number;
      };
    };
    resource: {
      score: number;
      weight: number;
      detail: {
        specific_yield_kwh_per_kwp: number;
        volatility_penalty: number;
      };
    };
    risk?: {
      score: number;
      weight: number;
      detail: {
        prob_npv_positive: number;
        prob_payback_within_analysis: number;
      };
    };
  };
};

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

function linearMap(x: number, x0: number, x1: number, y0: number, y1: number): number {
  if (x0 === x1) return y0;
  const t = (x - x0) / (x1 - x0);
  return y0 + t * (y1 - y0);
}

function scoreNpvRatio(npv: number | null, effectiveCapex: number): number {
  const capex = Math.max(1e-9, effectiveCapex);
  const r = (npv ?? 0) / capex;
  if (r <= -0.5) return 0;
  if (r >= 0.5) return 100;
  return clamp(linearMap(r, -0.5, 0.5, 0, 100), 0, 100);
}

function scorePaybackRatio(simplePaybackYears: number | null, analysisYears: number): number {
  const horizon = Math.max(1, analysisYears);
  const p = simplePaybackYears == null ? 1.2 : simplePaybackYears / horizon;
  if (p >= 1) return 0;
  if (p <= 0.2) return 100;
  return clamp(linearMap(p, 1, 0.2, 0, 100), 0, 100);
}

function scoreIrrSpread(irr: number | null, discountRate: number): number | null {
  if (irr == null) return null;
  const s = irr - discountRate;
  if (s <= -0.05) return 0;
  if (s >= 0.15) return 100;
  return clamp(linearMap(s, -0.05, 0.15, 0, 100), 0, 100);
}

function scoreEconomics(
  finance: FeasibilityFinanceInput,
  analysisYears: number,
  discountRate: number
): { score: number; detail: FeasibilityScorePayload['components']['economics']['detail'] } {
  const parts: number[] = [];
  const used: ('npv_ratio' | 'payback_ratio' | 'irr_spread')[] = [];
  const detail: FeasibilityScorePayload['components']['economics']['detail'] = { used_metrics: [] };

  const payback = finance.simple_payback_years ?? finance.payback_years;

  const sNpv = scoreNpvRatio(finance.npv, finance.effective_capex);
  parts.push(sNpv);
  used.push('npv_ratio');
  detail.npv_ratio = (finance.npv ?? 0) / Math.max(1e-9, finance.effective_capex);

  const sPb = scorePaybackRatio(payback, analysisYears);
  parts.push(sPb);
  used.push('payback_ratio');
  detail.payback_ratio = payback == null ? 1.2 : payback / Math.max(1, analysisYears);

  const sIrr = scoreIrrSpread(finance.irr, discountRate);
  if (sIrr != null) {
    parts.push(sIrr);
    used.push('irr_spread');
    detail.irr_spread = (finance.irr ?? 0) - discountRate;
  }

  detail.used_metrics = used;
  const score = parts.reduce((a, b) => a + b, 0) / parts.length;
  return { score, detail };
}

function scoreSpecificYieldBase(y: number): number {
  if (y <= 600) return 0;
  if (y < 850) return linearMap(y, 600, 850, 0, 40);
  if (y < 1100) return linearMap(y, 850, 1100, 40, 70);
  if (y < 1300) return linearMap(y, 1100, 1300, 70, 90);
  if (y < 1600) return linearMap(y, 1300, 1600, 90, 100);
  return 100;
}

function scoreResource(kpis: FeasibilityKpisInput): {
  score: number;
  detail: FeasibilityScorePayload['components']['resource']['detail'];
} {
  const base = scoreSpecificYieldBase(kpis.specific_yield_kwh_per_kwp);
  const annual = Math.max(1e-9, kpis.annual_kwh);
  const c = kpis.uncertainty_annual_kwh / annual;
  let penalty = 0;
  if (c > 0.08) {
    penalty = Math.min(10, ((c - 0.08) / 0.12) * 10);
  }
  const score = Math.max(0, base - penalty);
  return {
    score: clamp(score, 0, 100),
    detail: {
      specific_yield_kwh_per_kwp: kpis.specific_yield_kwh_per_kwp,
      volatility_penalty: penalty
    }
  };
}

function scoreRisk(mc: FeasibilityMonteCarloInput): number {
  const pNpv = mc.prob_npv_positive ?? 0;
  const pPb = mc.prob_payback_within_analysis ?? 0;
  return clamp(100 * (0.6 * pNpv + 0.4 * pPb), 0, 100);
}

function bandFromScore(score: number): FeasibilityBand {
  if (score <= 39) return 'poor';
  if (score <= 54) return 'marginal';
  if (score <= 69) return 'acceptable';
  if (score <= 84) return 'good';
  return 'excellent';
}

export function buildFeasibilityScore(
  kpis: FeasibilityKpisInput,
  finance: FeasibilityFinanceInput,
  economics: { analysis_years: number; discount_rate: number },
  monteCarlo: FeasibilityMonteCarloInput | undefined,
  monteCarloRequested: boolean
): FeasibilityScorePayload {
  const econ = scoreEconomics(finance, economics.analysis_years, economics.discount_rate);
  const res = scoreResource(kpis);

  let wEcon: number;
  let wRes: number;
  let wRisk: number;

  if (monteCarloRequested && monteCarlo) {
    wEcon = 0.45;
    wRes = 0.25;
    wRisk = 0.3;
  } else {
    const s = 0.55 + 0.35;
    wEcon = 0.55 / s;
    wRes = 0.35 / s;
    wRisk = 0;
  }

  let total = wEcon * econ.score + wRes * res.score;
  const components: FeasibilityScorePayload['components'] = {
    economics: { score: econ.score, weight: wEcon, detail: econ.detail },
    resource: { score: res.score, weight: wRes, detail: res.detail }
  };

  if (monteCarloRequested && monteCarlo && wRisk > 0) {
    const r = scoreRisk(monteCarlo);
    total += wRisk * r;
    components.risk = {
      score: r,
      weight: wRisk,
      detail: {
        prob_npv_positive: monteCarlo.prob_npv_positive ?? 0,
        prob_payback_within_analysis: monteCarlo.prob_payback_within_analysis ?? 0
      }
    };
  }

  const score = Math.round(clamp(total, 0, 100));

  return {
    score,
    band: bandFromScore(score),
    methodology_version: FEASIBILITY_METHODOLOGY_VERSION,
    components
  };
}
