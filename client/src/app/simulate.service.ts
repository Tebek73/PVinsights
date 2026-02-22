import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface SimulateRequest {
  location: {
    lat: number;
    lon: number;
    area_type?: 'rural' | 'suburban' | 'urban' | null;
  };
  pv: {
    peakpower_kw: number;
    loss_percent: number;
    usehorizon: boolean;
    optimalangles: boolean;
    angle_deg: number | null;
    aspect_deg: number | null;
    pvtechchoice: string | null;
    mountingplace: string | null;
    raddatabase: string | null;
  };
  economics: {
    capex: number;
    price_buy: number;
    self_consumption: number;
    price_sell: number;
    opex_yearly: number;
    degradation: number;
    analysis_years: number;
    discount_rate: number;
    price_escalation: number;
  };
  cost_model?: { fixed_cost: number; cost_per_kwp: number };
  consumption?: { annual_kwh: number; daytime_fraction: number };
  kwp_range?: [number, number, number];
}

export interface SimulateResponse {
  pvgis: {
    inputs: any;
    monthly: { month: number; E_m: number; SD_m: number; H_i_m: number }[];
    totals: {
      E_y: number;
      SD_y: number;
      H_i_y: number;
      l_total: number;
      LCOE_pv?: number | null;
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
    payback_years: number | null;
    roi: number | null;
    npv: number | null;
    cashflow_yearly: number[];
    cashflow_cumulative: number[];
  };
  charts: {
    monthly_energy_kwh: { month: number; kwh: number }[];
    cashflow_cumulative: { year: number; value: number }[];
  };
  insights: { type: 'info' | 'warning'; text: string; key?: string }[];
  meta?: { area_type_applied: 'rural' | 'suburban' | 'urban' | null };
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
    payback: { p10: number; p50: number; p90: number; prob_under_target?: number };
    npv: { p10: number; p50: number; p90: number };
    histogram_bins?: {
      payback: { edges: number[]; counts: number[] };
      npv: { edges: number[]; counts: number[] };
    };
  };
  break_even?: {
    target_payback_years?: number;
    break_even_capex: number | null;
    break_even_price_buy: number | null;
  };
  kwp_optimization?: {
    recommended_kwp_npv: number;
    recommended_kwp_payback: number;
    curve: { kwp: number; npv: number; payback_years: number | null }[];
  };
}

@Injectable({ providedIn: 'root' })
export class SimulateService {
  constructor(private readonly http: HttpClient) {}

  simulate(body: SimulateRequest): Observable<SimulateResponse> {
    return this.http.post<SimulateResponse>('/api/simulate', body);
  }
}

