import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export type ModelWarning = {
  code: string;
  severity: 'info' | 'warning';
  message: string;
};

export interface SimulateRequest {
  location: {
    lat: number;
    lon: number;
  };
  pv: {
    peakpower_kw: number;
    loss_percent: number;
    near_shading_loss_percent?: number;
    usehorizon: boolean;
    optimalangles: boolean;
    angle_deg: number | null;
    aspect_deg: number | null;
    pvtechchoice: string | null;
    mountingplace: string | null;
    raddatabase: string | null;
    /** 0 = off; max 20; requests per-calendar-year PVGIS monthly series for charts */
    monthly_history_years?: number;
  };
  economics: {
    currency?: 'EUR' | 'RON';
    capex: number;
    price_buy: number;
    self_consumption: number;
    price_sell: number;
    price_sell_escalation?: number;
    opex_yearly: number;
    opex_escalation?: number;
    degradation: number;
    analysis_years: number;
    discount_rate: number;
    price_escalation: number;
    subsidy_amount?: number;
    subsidy_percent_capex?: number;
    replacement_events?: { year: number; cost: number; label?: string }[];
  };
  cost_model?: { fixed_cost: number; cost_per_kwp: number };
  consumption?: {
    annual_kwh: number;
    daytime_fraction: number;
    monthly_load_profile?: number[];
    monthly_daytime_fraction?: number | number[];
  };
  kwp_range?: [number, number, number];
  kwp_constraints?: {
    max_roof_area_m2?: number;
    panel_power_wp?: number;
    panel_area_m2?: number;
    max_kwp?: number;
  };
  monte_carlo?: {
    n_trials?: number;
    target_payback_years?: number;
    seed?: number;
    uncertainty?: {
      capex_rel_std?: number;
      self_consumption_abs_std?: number;
      degradation_abs_std?: number;
      price_escalation_abs_std?: number;
      discount_rate_abs_std?: number;
      pv_yield_use_sd_y?: boolean;
      model_yield_uncertainty_rel_std?: number;
    };
  };
}

export type HorizonSource = 'pvgis_printhorizon' | 'pvgis_internal' | 'disabled_flat';

export interface MonthlyEnergyPoint {
  month: number;
  E_m: number;
  SD_m: number;
  H_i_m: number;
}

export interface EnergyTotals {
  E_y: number;
  SD_y: number;
  H_i_y: number;
  l_total: number;
  LCOE_pv?: number | null;
}

export type FeasibilityBand = 'poor' | 'marginal' | 'acceptable' | 'good' | 'excellent';

export interface FeasibilityScore {
  score: number;
  band: FeasibilityBand;
  methodology_version: string;
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
}

export interface SimulateResponse {
  model_warnings: ModelWarning[];
  model_assumptions: {
    energy_basis: string;
    cashflow_timing: 'end_of_year';
    capex_timing: 'year_0';
    cashflow_basis: 'nominal';
    discount_rate_basis: 'nominal';
  };
  pvgis: {
    inputs: unknown;
    raw: { monthly: MonthlyEnergyPoint[]; totals: EnergyTotals };
    adjusted: { monthly: MonthlyEnergyPoint[]; totals: EnergyTotals };
    meta: {
      horizon_requested: boolean;
      horizon_source: HorizonSource;
      horizon_warning: string | null;
      near_shading_loss_percent: number;
      near_shading_factor: number;
      near_shading_source: 'explicit_user_input' | 'none';
      adjustments_applied: string[];
    };
  };
  kpis: {
    annual_kwh: number;
    specific_yield_kwh_per_kwp: number;
    capacity_factor_pct: number;
    best_month: { month: number; kwh: number } | null;
    worst_month: { month: number; kwh: number } | null;
    seasonality_ratio: number | null;
    uncertainty_annual_kwh: number;
  };
  finance: {
    savings_year1: number;
    simple_payback_years: number | null;
    discounted_payback_years: number | null;
    roi_lifetime_undiscounted: number | null;
    npv: number | null;
    effective_capex: number;
    lcoe_currency_per_kwh: number | null;
    irr: number | null;
    irr_reason: string | null;
    cashflow_operating_yearly: number[];
    cashflow_net_yearly: number[];
    cashflow_cumulative_nominal: number[];
    payback_years: number | null;
    roi: number | null;
    cashflow_yearly: number[];
    cashflow_cumulative: number[];
  };
  charts: {
    monthly_energy_kwh: { month: number; kwh: number }[];
    cashflow_cumulative: { year: number; value: number }[];
    monthly_energy_by_year?: { calendar_year: number; months: { month: number; kwh: number }[] }[];
  };
  insights: { type: 'info' | 'warning'; text: string; key?: string }[];
  meta?: { currency?: 'EUR' | 'RON' };
  consumption_analysis?: {
    annual_self_consumed_kwh: number;
    annual_exported_kwh: number;
    self_consumption_ratio: number;
    monthly?: { month: number; pv_kwh: number; self_kwh: number; export_kwh: number }[];
  };
  scenarios?: {
    by_self_consumption: { self_consumption: number; payback_years: number | null; npv: number | null; savings_year1: number }[];
    by_price_buy: { price_buy: number; payback_years: number | null; npv: number | null; savings_year1: number }[];
  };
  sensitivity?: {
    one_d: { variable: 'price_buy'; values: number[]; payback_years: (number | null)[]; npv: (number | null)[] };
    two_d: {
      variable_x: 'price_buy';
      variable_y: 'self_consumption';
      x_axis: number[];
      y_axis: number[];
      payback_grid: (number | null)[][];
      npv_grid: (number | null)[][];
    };
  };
  monte_carlo?: {
    n_trials: number;
    target_payback_years?: number;
    yield_uncertainty_basis: string;
    payback: { p10: number | null; p50: number | null; p90: number | null; prob_under_target?: number };
    npv: { p10: number | null; p50: number | null; p90: number | null };
    prob_never_payback?: number;
    prob_payback_within_analysis?: number;
    prob_npv_positive?: number;
    valid_samples?: { payback: number; npv: number };
    histogram_bins?: {
      payback: {
        edges: number[];
        counts: number[];
        underflow: number;
        overflow: number;
        total_count: number;
        valid_count: number;
      };
      npv: {
        edges: number[];
        counts: number[];
        underflow: number;
        overflow: number;
        total_count: number;
        valid_count: number;
      };
    };
  };
  break_even?: {
    target_payback_years_simple: number;
    break_even_capex_simple_payback: { value: number | null; reason: string | null };
    break_even_price_buy_npv_zero: { value: number | null; reason: string | null };
  };
  kwp_optimization?: {
    recommended_kwp_npv: number;
    recommended_kwp_payback: number;
    curve: {
      kwp: number;
      annual_kwh: number;
      self_consumption_ratio: number;
      self_consumed_kwh: number;
      exported_kwh: number;
      capex: number;
      npv: number;
      simple_payback_years: number | null;
      discounted_payback_years: number | null;
      lcoe_currency_per_kwh: number | null;
    }[];
  };
  feasibility_score: FeasibilityScore;
}

@Injectable({ providedIn: 'root' })
export class SimulateService {
  constructor(private readonly http: HttpClient) {}

  simulate(body: SimulateRequest): Observable<SimulateResponse> {
    return this.http.post<SimulateResponse>('/api/simulate', body);
  }
}
