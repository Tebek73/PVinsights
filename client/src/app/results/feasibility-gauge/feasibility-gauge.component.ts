import { Component, input, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { FeasibilityScore } from '../../simulate.service';
import { LanguageService } from '../../language.service';
import { InfoTooltipComponent } from '../../shared/info-tooltip/info-tooltip.component';
import { TranslatePipe } from '../../translate.pipe';

/** 270° arc, symmetric; `pathLength=100` for dash mapping */
const ARC_D = 'M 18 72 A 42 42 0 1 1 82 72';

const BAND_HEX: Record<FeasibilityScore['band'], string> = {
  poor: '#ef4444',
  marginal: '#f97316',
  acceptable: '#eab308',
  good: '#84cc16',
  excellent: '#22c55e'
};

@Component({
  selector: 'app-feasibility-gauge',
  standalone: true,
  imports: [CommonModule, InfoTooltipComponent, TranslatePipe],
  templateUrl: './feasibility-gauge.component.html',
  styleUrl: './feasibility-gauge.component.scss'
})
export class FeasibilityGaugeComponent {
  readonly feasibility = input.required<FeasibilityScore>();

  private readonly lang = inject(LanguageService);

  readonly arcPath = ARC_D;

  readonly bandColor = computed(() => BAND_HEX[this.feasibility().band]);

  readonly dashArray = computed(() => {
    const s = clampScore(this.feasibility().score);
    return `${s} ${100 - s}`;
  });

  ariaLabel(): string {
    const f = this.feasibility();
    const bandKeys: Record<FeasibilityScore['band'], string> = {
      poor: 'results.feasibilityBandPoor',
      marginal: 'results.feasibilityBandMarginal',
      acceptable: 'results.feasibilityBandAcceptable',
      good: 'results.feasibilityBandGood',
      excellent: 'results.feasibilityBandExcellent'
    };
    const band = this.lang.translate(bandKeys[f.band]);
    const prefix = this.lang.translate('results.feasibilityAriaPrefix');
    return `${prefix}: ${f.score}/100. ${band}`;
  }
}

function clampScore(s: number): number {
  return Math.min(100, Math.max(0, s));
}
