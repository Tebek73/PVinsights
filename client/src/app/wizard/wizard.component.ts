import { Component, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { SimulateService, type SimulateRequest } from '../simulate.service';
import { SimulationStoreService } from '../simulation-store.service';
import { TranslatePipe } from '../translate.pipe';
import { LocationPickerComponent } from '../location-picker/location-picker.component';

function formatSimulationError(err: unknown): string {
  if (!err || typeof err !== 'object') return 'Simulation failed. Please try again.';
  const res = err as HttpErrorResponse;
  const body = res.error;
  if (body?.error) {
    if (typeof body.error === 'string') return body.error;
    return 'Invalid input: ' + formatZodLike(body.error);
  }
  if (res.status === 0)
    return 'Network error. Is the backend running? Start the server on port 3000 and ensure the proxy is used.';
  if (res.status === 400)
    return body?.error ? (typeof body.error === 'string' ? body.error : 'Invalid input: ' + formatZodLike(body.error)) : 'Invalid input. Check your values.';
  if (res.status === 502) return (body?.error as string) || 'Service temporarily unavailable. Try again in a moment.';
  return `Request failed (${res.status ?? 'unknown'}). Please try again.`;
}

function formatZodLike(obj: unknown, prefix = ''): string {
  if (obj === null || typeof obj !== 'object') return String(obj);
  const o = obj as Record<string, unknown>;
  const errs = o['_errors'];
  if (Array.isArray(errs) && errs.length) {
    const path = prefix ? prefix + ': ' : '';
    return path + errs.join(', ');
  }
  const parts: string[] = [];
  for (const [k, v] of Object.entries(o)) {
    if (k === '_errors') continue;
    const nextPrefix = prefix ? `${prefix}.${k}` : k;
    const sub = formatZodLike(v, nextPrefix);
    if (sub) parts.push(sub);
  }
  return parts.join('; ');
}

function parseMonthlyProfile12(text: string): number[] | null {
  const parts = text
    .trim()
    .split(/[\s,;]+/)
    .filter((x) => x.length > 0)
    .map(Number);
  if (parts.length !== 12 || parts.some((n) => !Number.isFinite(n) || n < 0)) return null;
  return parts;
}

type WizardStep = 1 | 2 | 3;

@Component({
  standalone: true,
  selector: 'app-wizard',
  imports: [FormsModule, CommonModule, TranslatePipe, LocationPickerComponent],
  templateUrl: './wizard.component.html',
  styleUrl: './wizard.component.scss'
})
export class WizardComponent {
  readonly step = signal<WizardStep>(1);

  lat = signal<number>(44.43);
  lon = signal<number>(26.1);

  peakpower_kw = signal<number>(3);
  loss_percent = signal<number>(14);
  near_shading_loss_percent = signal<number>(0);
  usehorizon = signal<boolean>(true);
  optimalangles = signal<boolean>(true);
  angle_deg = signal<number | null>(null);
  aspect_deg = signal<number | null>(null);
  pvtechchoice = signal<string>('crystSi');
  mountingplace = signal<string>('free');
  raddatabase = signal<string | null>(null);
  /** 0 = chart uses PVGIS DB-average 12 months only; up to 20 adds per-calendar-year PVGIS calls */
  monthly_history_years = signal<number>(10);

  currency = signal<'EUR' | 'RON'>('EUR');
  capex = signal<number>(15000);
  price_buy = signal<number>(1.0);
  self_consumption = signal<number>(0.5);
  price_sell = signal<number>(0);
  price_sell_escalation = signal<number>(0);
  opex_yearly = signal<number>(150);
  opex_escalation = signal<number>(0);
  degradation = signal<number>(0.005);
  analysis_years = signal<number>(25);
  discount_rate = signal<number>(0.06);
  price_escalation = signal<number>(0);
  subsidy_amount = signal<number>(0);
  subsidy_percent_capex = signal<number>(0);

  consumption_annual_kwh = signal<number>(0);
  consumption_daytime_pct = signal<number>(35);
  monthly_profile_text = signal<string>('');

  cost_fixed = signal<number>(0);
  cost_per_kwp = signal<number>(1200);
  kwp_min = signal<number>(1);
  kwp_max = signal<number>(10);
  kwp_step = signal<number>(0.5);

  monte_carlo_enabled = signal<boolean>(true);
  monte_carlo_trials = signal<number>(2000);
  monte_carlo_target_payback = signal<number | null>(null);

  onMonthlyHistoryYearsChange(v: unknown): void {
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isFinite(n)) {
      this.monthly_history_years.set(10);
      return;
    }
    this.monthly_history_years.set(Math.min(20, Math.max(0, Math.round(n))));
  }

  onMcTargetPaybackChange(v: unknown): void {
    if (v === '' || v === null || v === undefined) {
      this.monte_carlo_target_payback.set(null);
      return;
    }
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isFinite(n)) this.monte_carlo_target_payback.set(null);
    else this.monte_carlo_target_payback.set(n);
  }

  readonly canGoNext = computed(() => {
    const s = this.step();
    if (s === 1) {
      return Number.isFinite(this.lat()) && Number.isFinite(this.lon());
    }
    if (s === 2) {
      return (
        this.peakpower_kw() > 0 &&
        this.loss_percent() >= 0 &&
        this.near_shading_loss_percent() >= 0 &&
        this.near_shading_loss_percent() <= 80
      );
    }
    return true;
  });

  constructor(
    private readonly router: Router,
    private readonly api: SimulateService,
    public readonly store: SimulationStoreService
  ) {}

  setStep(step: WizardStep): void {
    this.step.set(step);
  }

  nextStep(): void {
    const current = this.step();
    if (current < 3 && this.canGoNext()) {
      this.step.set((current + 1) as WizardStep);
    }
  }

  prevStep(): void {
    const current = this.step();
    if (current > 1) {
      this.step.set((current - 1) as WizardStep);
    }
  }

  closeError(): void {
    this.store.errorMessage.set(null);
  }

  onLatLonChange(e: { lat: number; lon: number }): void {
    this.lat.set(e.lat);
    this.lon.set(e.lon);
  }

  submit(): void {
    const body: SimulateRequest = {
      location: {
        lat: this.lat(),
        lon: this.lon()
      },
      pv: {
        peakpower_kw: this.peakpower_kw(),
        loss_percent: this.loss_percent(),
        near_shading_loss_percent: this.near_shading_loss_percent(),
        usehorizon: this.usehorizon(),
        optimalangles: this.optimalangles(),
        angle_deg: this.optimalangles() ? null : this.angle_deg(),
        aspect_deg: this.optimalangles() ? null : this.aspect_deg(),
        pvtechchoice: this.pvtechchoice(),
        mountingplace: this.mountingplace(),
        raddatabase: this.raddatabase(),
        monthly_history_years: this.monthly_history_years()
      },
      economics: {
        currency: this.currency(),
        capex: this.capex(),
        price_buy: this.price_buy(),
        self_consumption: this.self_consumption(),
        price_sell: this.price_sell(),
        price_sell_escalation: this.price_sell_escalation(),
        opex_yearly: this.opex_yearly(),
        opex_escalation: this.opex_escalation(),
        degradation: this.degradation(),
        analysis_years: this.analysis_years(),
        discount_rate: this.discount_rate(),
        price_escalation: this.price_escalation(),
        subsidy_amount: this.subsidy_amount(),
        subsidy_percent_capex: this.subsidy_percent_capex()
      }
    };

    const annual = this.consumption_annual_kwh();
    const daytimePct = this.consumption_daytime_pct();
    if (annual > 0 && daytimePct >= 0 && daytimePct <= 100) {
      const cons: NonNullable<SimulateRequest['consumption']> = {
        annual_kwh: annual,
        daytime_fraction: daytimePct / 100
      };
      const mp = parseMonthlyProfile12(this.monthly_profile_text());
      if (mp) cons.monthly_load_profile = mp;
      body.consumption = cons;
    }

    if (body.consumption && this.cost_per_kwp() >= 0 && this.cost_fixed() >= 0) {
      body.cost_model = {
        fixed_cost: this.cost_fixed(),
        cost_per_kwp: this.cost_per_kwp()
      };
      const mn = this.kwp_min();
      const mx = this.kwp_max();
      const st = this.kwp_step();
      if (mn > 0 && mx >= mn && st > 0) {
        body.kwp_range = [mn, mx, st];
      }
    }

    if (this.monte_carlo_enabled()) {
      const mc: NonNullable<SimulateRequest['monte_carlo']> = {
        n_trials: Math.min(20000, Math.max(100, Math.round(this.monte_carlo_trials())))
      };
      const tgt = this.monte_carlo_target_payback();
      if (tgt != null && tgt >= 1 && tgt <= 40) mc.target_payback_years = tgt;
      body.monte_carlo = mc;
    }

    this.store.isLoading.set(true);
    this.store.errorMessage.set(null);
    this.store.lastRequest.set(body);

    this.api.simulate(body).subscribe({
      next: (response) => {
        this.store.lastResponse.set(response);
        this.store.isLoading.set(false);
        this.router.navigate(['/results']);
      },
      error: (err: unknown) => {
        this.store.isLoading.set(false);
        this.store.errorMessage.set(formatSimulationError(err));
      }
    });
  }
}
