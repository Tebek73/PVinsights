import { Injectable, signal } from '@angular/core';
import type { SimulateRequest, SimulateResponse } from './simulate.service';

@Injectable({ providedIn: 'root' })
export class SimulationStoreService {
  readonly lastRequest = signal<SimulateRequest | null>(null);
  readonly lastResponse = signal<SimulateResponse | null>(null);
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);
}

