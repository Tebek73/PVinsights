import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface SimulateRequest {
  location: {
    lat: number;
    lon: number;
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
}

@Injectable({ providedIn: 'root' })
export class SimulateService {
  constructor(private readonly http: HttpClient) {}

  simulate(body: SimulateRequest): Observable<SimulateResponse> {
    return this.http.post<SimulateResponse>('/api/simulate', body);
  }
}

