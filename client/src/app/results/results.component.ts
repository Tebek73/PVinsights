import { Component, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SimulationStoreService } from '../simulation-store.service';
import { TranslatePipe } from '../translate.pipe';
import { LanguageService } from '../language.service';
import { InfoTooltipComponent } from '../shared/info-tooltip/info-tooltip.component';
import type { HorizonSource } from '../simulate.service';
import { FeasibilityGaugeComponent } from './feasibility-gauge/feasibility-gauge.component';

/** Fallback: map backend English text to translation key when API doesn't send key */
const INSIGHT_TEXT_TO_KEY: Record<string, string> = {
  'High system losses; check inverter sizing, cabling, and shading.': 'insight.highLosses',
  'Array orientation is far from south; expect reduced energy yield.': 'insight.orientationFarFromSouth',
  'Year-to-year variability of solar resource is relatively high (PVGIS SD_y).': 'insight.highVariability',
  'Year-to-year variability of solar resource is relatively high at this location.': 'insight.highVariability',
  'Great solar resource for PV at this location (high specific yield).': 'insight.greatSolarResource'
};

@Component({
  standalone: true,
  selector: 'app-results',
  imports: [CommonModule, TranslatePipe, InfoTooltipComponent, FeasibilityGaugeComponent],
  templateUrl: './results.component.html',
  styleUrl: './results.component.scss'
})
export class ResultsComponent {
  readonly monthlyEnergy = signal<{ month: number; kwh: number }[]>([]);
  readonly maxMonthlyEnergy = signal<number>(1);
  readonly monthlyEnergyByYear = signal<{ calendar_year: number; months: { month: number; kwh: number }[] }[]>([]);

  readonly cashflow = signal<{ year: number; value: number }[]>([]);
  readonly minCashflow = signal<number>(0);
  readonly maxCashflow = signal<number>(1);
  readonly Math = Math;

  currencyCode(): 'EUR' | 'RON' {
    const res = this.store.lastResponse();
    const fromRes = res?.meta?.currency;
    if (fromRes === 'EUR' || fromRes === 'RON') return fromRes;
    const fromReq = this.store.lastRequest()?.economics?.currency;
    if (fromReq === 'EUR' || fromReq === 'RON') return fromReq;
    return 'EUR';
  }

  currencySymbol(): string {
    return this.currencyCode() === 'RON' ? 'lei' : '€';
  }

  priceUnit(): string {
    return `${this.currencyCode()}/kWh`;
  }

  formatPrice(v: number): string {
    return `${v.toFixed(3)} ${this.priceUnit()}`;
  }

  formatMoney(v: number): string {
    const rounded = Math.round(v);
    // Locale: use UI language for separators; currency unit comes from currency selector.
    const txt = new Intl.NumberFormat(this.lang.currentLang() === 'ro' ? 'ro-RO' : 'en-GB', {
      maximumFractionDigits: 0
    }).format(rounded);
    return `${txt} ${this.currencySymbol()}`;
  }

  /** Compact NPV axis labels (Monte Carlo histogram bins). */
  formatMoneyCompactAxis(v: number): string {
    const rounded = Math.round(v);
    const locale = this.lang.currentLang() === 'ro' ? 'ro-RO' : 'en-GB';
    const txt = new Intl.NumberFormat(locale, {
      notation: 'compact',
      maximumFractionDigits: 1
    }).format(rounded);
    return `${txt} ${this.currencySymbol()}`;
  }

  /** Compact amount only (no currency), for interval notation like (−5k; −4k) €. */
  formatMoneyCompactAmountOnly(v: number): string {
    const rounded = Math.round(v);
    const locale = this.lang.currentLang() === 'ro' ? 'ro-RO' : 'en-GB';
    return new Intl.NumberFormat(locale, {
      notation: 'compact',
      maximumFractionDigits: 1
    }).format(rounded);
  }

  paybackBinLabel(edges: number[], i: number): string {
    const lo = edges[i];
    const hi = edges[i + 1];
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return '';
    const fmt = (x: number) => {
      const s = x.toFixed(1);
      return s.endsWith('.0') ? s.slice(0, -2) : s;
    };
    return `${fmt(lo)}–${fmt(hi)}`;
  }

  npvBinLabel(edges: number[], i: number): string {
    const lo = edges[i];
    const hi = edges[i + 1];
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return '';
    const a = Math.min(lo, hi);
    const b = Math.max(lo, hi);
    const sym = this.currencySymbol();
    return `(${this.formatMoneyCompactAmountOnly(a)}; ${this.formatMoneyCompactAmountOnly(b)}) ${sym}`;
  }

  monteCarloNpvHistogramBarTitle(
    edges: number[],
    i: number,
    count: number,
    totalCount: number,
    clippedGlobal: boolean
  ): string {
    const interval = this.npvBinLabel(edges, i);
    const pct = totalCount ? this.percent(count, totalCount).toFixed(1) : '0';
    let s = `${interval} • ${count.toFixed(0)} (${pct}%)`;
    if (clippedGlobal) s += ` • ${this.lang.translate('results.outliersClipped')}`;
    return s;
  }

  mcHistogramPlotMinWidth(binCount: number): number {
    return Math.max(binCount * 28, 280);
  }

  /** Heatmap color 0..1 for value between min and max (null -> gray). */
  heatmapColor(value: number | null, min: number, max: number): string {
    if (value == null) return 'rgba(75, 85, 99, 0.5)';
    const r = max - min || 1;
    const t = (value - min) / r;
    const hue = 120 - t * 120;
    return `hsla(${hue}, 60%, 35%, 0.85)`;
  }

  /** Min/max NPV for kWp optimization curve (for bar scale). */
  minCurveNpv(): number {
    const res = this.store.lastResponse();
    const curve = res?.kwp_optimization?.curve;
    if (!curve?.length) return 0;
    return Math.min(...curve.map((p) => p.npv));
  }
  maxCurveNpv(): number {
    const res = this.store.lastResponse();
    const curve = res?.kwp_optimization?.curve;
    if (!curve?.length) return 0;
    return Math.max(...curve.map((p) => p.npv));
  }

  sumCounts(counts: number[]): number {
    return counts.reduce((a, b) => a + b, 0);
  }

  percent(count: number, total: number): number {
    if (!total) return 0;
    return (count / total) * 100;
  }

  npvZeroMarkerPct(edges: number[]): number | null {
    if (!edges || edges.length < 2) return null;
    const min = edges[0];
    const max = edges[edges.length - 1];
    const r = max - min;
    if (!Number.isFinite(min) || !Number.isFinite(max) || r <= 0) return null;
    if (0 < min || 0 > max) return null;
    return ((0 - min) / r) * 100;
  }

  /** Min/max of 2D grid for color scale (excluding nulls). */
  gridMinMax(grid: (number | null)[][]): { min: number; max: number } {
    let min = Infinity;
    let max = -Infinity;
    for (const row of grid) {
      for (const v of row) {
        if (v != null) {
          min = Math.min(min, v);
          max = Math.max(max, v);
        }
      }
    }
    return { min: Number.isFinite(min) ? min : 0, max: Number.isFinite(max) ? max : 0 };
  }

  constructor(
    public readonly store: SimulationStoreService,
    private readonly router: Router,
    private readonly lang: LanguageService
  ) {
    effect(() => {
      const res = this.store.lastResponse();
      if (!res) {
        this.monthlyEnergy.set([]);
        this.monthlyEnergyByYear.set([]);
        this.maxMonthlyEnergy.set(1);
        this.cashflow.set([]);
        this.minCashflow.set(0);
        this.maxCashflow.set(1);
        return;
      }

      const monthly = res.charts.monthly_energy_kwh;
      this.monthlyEnergy.set(monthly);

      const byYear = res.charts.monthly_energy_by_year;
      if (byYear && byYear.length > 0) {
        this.monthlyEnergyByYear.set(byYear);
        let maxAll = monthly.length > 0 ? Math.max(...monthly.map((m) => m.kwh)) : 1;
        for (const block of byYear) {
          for (const m of block.months) maxAll = Math.max(maxAll, m.kwh);
        }
        this.maxMonthlyEnergy.set(maxAll || 1);
      } else {
        this.monthlyEnergyByYear.set([]);
        const maxMonthly =
          monthly.length > 0 ? Math.max(...monthly.map((m) => m.kwh)) : 1;
        this.maxMonthlyEnergy.set(maxMonthly || 1);
      }

      const cashflowPoints = res.charts.cashflow_cumulative;
      this.cashflow.set(cashflowPoints);
      if (cashflowPoints.length > 0) {
        const values = cashflowPoints.map((p) => p.value);
        this.minCashflow.set(Math.min(...values));
        this.maxCashflow.set(Math.max(...values));
      } else {
        this.minCashflow.set(0);
        this.maxCashflow.set(1);
      }
    });
  }

  backToWizard(): void {
    this.router.navigate(['/']);
  }

  calendarYearHeading(year: number): string {
    return this.lang.translate('results.calendarYearSection').replace(/\{year\}/g, String(year));
  }

  horizonSourceLabel(source: HorizonSource): string {
    const keys: Record<HorizonSource, string> = {
      pvgis_printhorizon: 'results.horizonSourcePrinthorizon',
      pvgis_internal: 'results.horizonSourceInternal',
      disabled_flat: 'results.horizonSourceDisabled'
    };
    return this.lang.translate(keys[source] ?? source);
  }

  simplePaybackYears(res: { finance: { simple_payback_years: number | null; payback_years: number | null } }): number | null {
    return res.finance.simple_payback_years ?? res.finance.payback_years;
  }

  /** Returns translated insight text (uses key from API or fallback map from English text). */
  getInsightText(insight: { type: string; text: string; key?: string }): string {
    const key = insight.key ?? INSIGHT_TEXT_TO_KEY[insight.text];
    if (key) return this.lang.translate(key);
    return insight.text;
  }
}

