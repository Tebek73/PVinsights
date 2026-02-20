import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TranslatePipe } from './translate.pipe';
import { LanguageService, type Lang } from './language.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, TranslatePipe],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  constructor(public readonly lang: LanguageService) {}

  setLang(l: Lang): void {
    this.lang.setLanguage(l);
  }
}
