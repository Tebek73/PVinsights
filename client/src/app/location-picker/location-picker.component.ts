import {
  Component,
  input,
  output,
  OnChanges,
  OnDestroy,
  AfterViewInit,
  SimpleChanges,
  signal,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../translate.pipe';
import { GeocodingService, type NominatimResult } from '../geocoding.service';
import { LanguageService } from '../language.service';
import * as L from 'leaflet';

@Component({
  standalone: true,
  selector: 'app-location-picker',
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './location-picker.component.html',
  styleUrl: './location-picker.component.scss'
})
export class LocationPickerComponent implements OnChanges, OnDestroy, AfterViewInit {
  private readonly geocoding = inject(GeocodingService);
  readonly lang = inject(LanguageService);

  lat = input.required<number>();
  lon = input.required<number>();
  readonly latLonChange = output<{ lat: number; lon: number }>();

  readonly searchQuery = signal('');
  readonly searchResults = signal<NominatimResult[]>([]);
  readonly searchLoading = signal(false);
  readonly selectedAddress = signal<string | null>(null);
  readonly reverseLoading = signal(false);

  private map: L.Map | null = null;
  private marker: L.Marker | null = null;
  private searchTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly MAP_ID = 'location-picker-map';

  ngAfterViewInit(): void {
    setTimeout(() => this.initMap(), 0);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['lat'] || changes['lon']) && this.map && this.marker) {
      const lat = this.lat();
      const lon = this.lon();
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        this.marker.setLatLng([lat, lon]);
        this.map.setView([lat, lon], this.map.getZoom());
      }
    }
  }

  ngOnDestroy(): void {
    if (this.searchTimeout) clearTimeout(this.searchTimeout);
    this.marker = null;
    this.map?.remove();
    this.map = null;
  }

  private initMap(): void {
    const lat = this.lat();
    const lon = this.lon();
    const center: [number, number] = [Number.isFinite(lat) ? lat : 44.43, Number.isFinite(lon) ? lon : 26.1];
    this.map = L.map(this.MAP_ID).setView(center, 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(this.map);

    this.marker = L.marker(center, { draggable: true }).addTo(this.map);
    this.marker.on('dragend', () => this.onMarkerMoved());
    this.map.on('click', (e: L.LeafletMouseEvent) => {
      this.marker?.setLatLng(e.latlng);
      this.onMarkerMoved();
    });
  }

  private onMarkerMoved(): void {
    if (!this.marker) return;
    const latlng = this.marker.getLatLng();
    const lat = latlng.lat;
    const lon = latlng.lng;
    this.selectedAddress.set(null);
    this.latLonChange.emit({ lat, lon });
    this.reverseLoading.set(true);
    this.geocoding.reverse(lat, lon).then((addr) => {
      this.reverseLoading.set(false);
      if (addr) this.selectedAddress.set(addr);
    });
  }

  onSearchInput(): void {
    if (this.searchTimeout) clearTimeout(this.searchTimeout);
    const q = this.searchQuery().trim();
    if (q.length < 2) {
      this.searchResults.set([]);
      return;
    }
    this.searchTimeout = setTimeout(() => {
      this.searchTimeout = null;
      this.searchLoading.set(true);
      this.searchResults.set([]);
      this.geocoding.search(q).then((results) => {
        this.searchLoading.set(false);
        this.searchResults.set(results);
      });
    }, 400);
  }

  selectResult(r: NominatimResult): void {
    const lat = parseFloat(r.lat);
    const lon = parseFloat(r.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    this.selectedAddress.set(r.display_name);
    this.searchQuery.set('');
    this.searchResults.set([]);
    this.latLonChange.emit({ lat, lon });
    if (this.marker) this.marker.setLatLng([lat, lon]);
    if (this.map) this.map.setView([lat, lon], 14);
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.searchResults.set([]);
  }
}
