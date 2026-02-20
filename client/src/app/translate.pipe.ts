import { Pipe, PipeTransform } from '@angular/core';
import { LanguageService } from './language.service';

@Pipe({ name: 'translate', standalone: true, pure: false })
export class TranslatePipe implements PipeTransform {
  constructor(private readonly language: LanguageService) {}

  transform(key: string): string {
    this.language.currentLang(); // so template updates when language changes
    return this.language.translate(key);
  }
}
