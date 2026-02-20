import { Routes } from '@angular/router';
import { WizardComponent } from './wizard/wizard.component';
import { ResultsComponent } from './results/results.component';

export const routes: Routes = [
  { path: '', component: WizardComponent },
  { path: 'results', component: ResultsComponent },
  { path: '**', redirectTo: '' }
];
