import { Component, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SimulationStoreService } from '../simulation-store.service';
import { TranslatePipe } from '../translate.pipe';
import { LanguageService } from '../language.service';

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
  imports: [CommonModule, TranslatePipe],
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

