import { Component, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SimulationStoreService } from '../simulation-store.service';

@Component({
  standalone: true,
  selector: 'app-results',
  imports: [CommonModule],
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
    private readonly router: Router
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
}

