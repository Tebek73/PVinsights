import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

/** Use relative URL so dev server proxy (proxy.conf.json) can forward and avoid CORS */
const NOMINATIM_URL = '/nominatim';
const USER_AGENT = 'SolarPVFeasibility/1.0 (Angular)';

export interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  place_id: string;
}

@Injectable({ providedIn: 'root' })
export class GeocodingService {
  constructor(private readonly http: HttpClient) {}

  async search(query: string): Promise<NominatimResult[]> {
    if (!query || query.trim().length < 2) return [];
    const params = {
      q: query.trim(),
      format: 'json',
      limit: '5',
      addressdetails: '0'
    };
    try {
      const r = await firstValueFrom(
        this.http.get<NominatimResult[]>(`${NOMINATIM_URL}/search`, {
          params,
          headers: { 'User-Agent': USER_AGENT }
        })
      );
      return r ?? [];
    } catch {
      return [];
    }
  }

  async reverse(lat: number, lon: number): Promise<string | null> {
    const params = { lat: String(lat), lon: String(lon), format: 'json' };
    try {
      const r = await firstValueFrom(
        this.http.get<{ display_name?: string }>(`${NOMINATIM_URL}/reverse`, {
          params,
          headers: { 'User-Agent': USER_AGENT }
        })
      );
      return r?.display_name ?? null;
    } catch {
      return null;
    }
  }
}
