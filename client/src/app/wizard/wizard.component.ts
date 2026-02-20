import { Component, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { SimulateService, type SimulateRequest } from '../simulate.service';
import { SimulationStoreService } from '../simulation-store.service';
import { TranslatePipe } from '../translate.pipe';

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

type WizardStep = 1 | 2 | 3;

@Component({
  standalone: true,
  selector: 'app-wizard',
  imports: [FormsModule, CommonModule, TranslatePipe],
  templateUrl: './wizard.component.html',
  styleUrl: './wizard.component.scss'
})
export class WizardComponent {
  readonly step = signal<WizardStep>(1);

  // Step 1: location
  lat = signal<number>(44.43);
  lon = signal<number>(26.1);

  // Step 2: PV
  peakpower_kw = signal<number>(3);
  loss_percent = signal<number>(14);
  usehorizon = signal<boolean>(true);
  optimalangles = signal<boolean>(true);
  angle_deg = signal<number | null>(null);
  aspect_deg = signal<number | null>(null);
  pvtechchoice = signal<string>('crystSi');
  mountingplace = signal<string>('free');
  raddatabase = signal<string | null>(null);

  // Step 3: economics
  capex = signal<number>(15000);
  price_buy = signal<number>(1.0);
  self_consumption = signal<number>(0.5);
  price_sell = signal<number>(0);
  opex_yearly = signal<number>(150);
  degradation = signal<number>(0.005);
  analysis_years = signal<number>(25);
  discount_rate = signal<number>(0.06);
  price_escalation = signal<number>(0);

  readonly canGoNext = computed(() => {
    const s = this.step();
    if (s === 1) {
      return Number.isFinite(this.lat()) && Number.isFinite(this.lon());
    }
    if (s === 2) {
      return this.peakpower_kw() > 0 && this.loss_percent() >= 0;
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

  submit(): void {
    const body: SimulateRequest = {
      location: {
        lat: this.lat(),
        lon: this.lon()
      },
      pv: {
        peakpower_kw: this.peakpower_kw(),
        loss_percent: this.loss_percent(),
        usehorizon: this.usehorizon(),
        optimalangles: this.optimalangles(),
        angle_deg: this.optimalangles() ? null : this.angle_deg(),
        aspect_deg: this.optimalangles() ? null : this.aspect_deg(),
        pvtechchoice: this.pvtechchoice(),
        mountingplace: this.mountingplace(),
        raddatabase: this.raddatabase()
      },
      economics: {
        capex: this.capex(),
        price_buy: this.price_buy(),
        self_consumption: this.self_consumption(),
        price_sell: this.price_sell(),
        opex_yearly: this.opex_yearly(),
        degradation: this.degradation(),
        analysis_years: this.analysis_years(),
        discount_rate: this.discount_rate(),
        price_escalation: this.price_escalation()
      }
    };

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

