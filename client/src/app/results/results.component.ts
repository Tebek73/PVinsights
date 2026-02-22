import { Component, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SimulationStoreService } from '../simulation-store.service';
import { TranslatePipe } from '../translate.pipe';
import { LanguageService } from '../language.service';
import { InfoTooltipComponent } from '../shared/info-tooltip/info-tooltip.component';

/** Fallback: map backend English text to translation key when API doesn't send key */
const INSIGHT_TEXT_TO_KEY: Record<string, string> = {
  'High system losses; check inverter sizing, cabling, and shading.': 'insight.highLosses',
  'Array orientation is far from south; expect reduced energy yield.': 'insight.orientationFarFromSouth',
  'Year-to-year variability of solar resource is relatively high.': 'insight.highVariability',
  'Great solar resource for PV at this location (high specific yield).': 'insight.greatSolarResource'
};
// Backend may send "Yield adjusted for urban/suburban shading (buildings/trees)." with key insight.areaTypeShading

@Component({
  standalone: true,
  selector: 'app-results',
  imports: [CommonModule, TranslatePipe, InfoTooltipComponent],
  templateUrl: './results.component.html',
  styleUrl: './results.component.scss'
})
export class ResultsComponent {
  readonly monthlyEnergy = signal<{ month: number; kwh: number }[]>([]);
  readonly maxMonthlyEnergy = signal<number>(1);

  readonly cashflow = signal<{ year: number; value: number }[]>([]);
  readonly minCashflow = signal<number>(0);
  readonly maxCashflow = signal<number>(1);
  readonly Math = Math;

  /** For 1D sensitivity: points for SVG (x 0..1, y 0..1 normalized). */
  sensitivity1DPoints(
    sens: NonNullable<NonNullable<import('../simulate.service').SimulateResponse['sensitivity']>['one_d']>
  ): { payback: string; npv: string } {
    const n = sens.values.length;
    if (n === 0) return { payback: '', npv: '' };
    const paybackNums = sens.payback_years.map((p) => (p != null ? p : 0));
    const npvNums = sens.npv.map((v) => (v != null ? v : 0));
    const minP = Math.min(...paybackNums);
    const maxP = Math.max(...paybackNums);
    const minN = Math.min(...npvNums);
    const maxN = Math.max(...npvNums);
    const rangeP = maxP - minP || 1;
    const rangeN = maxN - minN || 1;
    const x = (i: number) => (i / (n - 1)) * 100;
    const paybackPath = paybackNums.map((p, i) => `${x(i)},${100 - ((p - minP) / rangeP) * 100}`).join(' ');
    const npvPath = npvNums.map((v, i) => `${x(i)},${100 - ((v - minN) / rangeN) * 100}`).join(' ');
    return { payback: paybackPath, npv: npvPath };
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
        this.maxMonthlyEnergy.set(1);
        this.cashflow.set([]);
        this.minCashflow.set(0);
        this.maxCashflow.set(1);
        return;
      }

      const monthly = res.charts.monthly_energy_kwh;
      this.monthlyEnergy.set(monthly);
      const maxMonthly =
        monthly.length > 0 ? Math.max(...monthly.map((m) => m.kwh)) : 1;
      this.maxMonthlyEnergy.set(maxMonthly || 1);

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

  /** Returns translated insight text (uses key from API or fallback map from English text). */
  getInsightText(insight: { type: string; text: string; key?: string }): string {
    const key = insight.key ?? INSIGHT_TEXT_TO_KEY[insight.text];
    if (key) return this.lang.translate(key);
    return insight.text;
  }
}

