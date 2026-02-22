import { Component, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../translate.pipe';

let tooltipIdCounter = 0;

@Component({
  standalone: true,
  selector: 'app-info-tooltip',
  imports: [CommonModule, TranslatePipe],
  templateUrl: './info-tooltip.component.html',
  styleUrl: './info-tooltip.component.scss'
})
export class InfoTooltipComponent {
  /** Translation key for the explanation text (e.g. results.explainPayback). */
  readonly explanationKey = input.required<string>();

  readonly visible = signal(false);
  readonly tooltipId = `info-tooltip-${++tooltipIdCounter}`;

  toggle(): void {
    this.visible.update((v) => !v);
  }

  open(): void {
    this.visible.set(true);
  }

  close(): void {
    this.visible.set(false);
  }
}
