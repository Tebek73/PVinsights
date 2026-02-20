import { Injectable, signal } from '@angular/core';

export type Lang = 'en' | 'ro';

const TRANSLATIONS: Record<string, { en: string; ro: string }> = {
  // App shell
  'app.title': { en: 'Solar PV Feasibility', ro: 'Fezabilitate PV solar' },
  'app.subtitle': {
    en: 'Estimate solar production, savings, and payback for your location.',
    ro: 'Estimează producția solară, economiile și recuperarea investiției pentru locația ta.'
  },
  'app.mvp': { en: 'MVP', ro: 'MVP' },
  'app.pvgis': { en: 'PVGIS PVcalc', ro: 'PVGIS PVcalc' },
  'lang.en': { en: 'EN', ro: 'EN' },
  'lang.ro': { en: 'RO', ro: 'RO' },

  // Wizard
  'wizard.title': { en: 'Solar PV feasibility wizard', ro: 'Asistent fezabilitate PV solar' },
  'wizard.subtitle': { en: 'Follow the 3 steps to run a PVGIS-based simulation.', ro: 'Urmează cei 3 pași pentru a rula o simulare bazată pe PVGIS.' },
  'wizard.step1': { en: '1. Location', ro: '1. Locație' },
  'wizard.step2': { en: '2. PV system', ro: '2. Sistem PV' },
  'wizard.step3': { en: '3. Economics', ro: '3. Economie' },
  'wizard.location.hint': {
    en: 'For now, enter latitude and longitude manually. Later you can connect these fields to a map pin.',
    ro: 'Introdu latitudinea și longitudinea manual. Mai târziu le poți conecta la un pin pe hartă.'
  },
  'wizard.latitude': { en: 'Latitude (°)', ro: 'Latitudine (°)' },
  'wizard.longitude': { en: 'Longitude (°)', ro: 'Longitudine (°)' },
  'wizard.pv.hint': {
    en: 'Define the PV system size and basic configuration. Advanced options are optional.',
    ro: 'Definește puterea sistemului PV și configurația de bază. Opțiunile avansate sunt opționale.'
  },
  'wizard.systemSize': { en: 'System size (kWp)', ro: 'Putere (kWp)' },
  'wizard.systemLosses': { en: 'System losses (%)', ro: 'Pierderi sistem (%)' },
  'wizard.useHorizon': { en: 'Include terrain horizon shading', ro: 'Include umbrirea orizontului teren' },
  'wizard.optimalAngles': { en: 'Optimize tilt and azimuth automatically', ro: 'Optimizează înclinarea și azimutul automat' },
  'wizard.advancedPv': { en: 'Advanced PV settings', ro: 'Setări PV avansate' },
  'wizard.tiltAngle': { en: 'Tilt angle (°)', ro: 'Unghi înclinare (°)' },
  'wizard.azimuth': { en: 'Azimuth (0=S, 90=W, -90=E)', ro: 'Azimut (0=S, 90=V, -90=E)' },
  'wizard.pvTech': { en: 'PV technology', ro: 'Tehnologie PV' },
  'pvTech.crystSi': { en: 'crystSi (default)', ro: 'crystSi (implicit)' },
  'pvTech.crystSi2025': { en: 'crystSi2025', ro: 'crystSi2025' },
  'pvTech.CIS': { en: 'CIS', ro: 'CIS' },
  'pvTech.CdTe': { en: 'CdTe', ro: 'CdTe' },
  'pvTech.Unknown': { en: 'Unknown', ro: 'Necunoscut' },
  'wizard.mounting': { en: 'Mounting', ro: 'Montaj' },
  'wizard.mountingFree': { en: 'Free-standing', ro: 'Pe structură' },
  'wizard.mountingBuilding': { en: 'Building', ro: 'Pe clădire' },
  'wizard.radDatabase': { en: 'Radiation database (optional)', ro: 'Bază radiație (opțional)' },
  'wizard.radPlaceholder': { en: 'leave empty for default', ro: 'lasă gol pentru implicit' },
  'wizard.economics.hint': {
    en: 'Provide basic economic assumptions. The backend will compute savings, payback, and cashflow.',
    ro: 'Introdu ipotezele economice de bază. Serverul va calcula economiile, recuperarea și fluxul de numerar.'
  },
  'wizard.capex': { en: 'System cost (CAPEX)', ro: 'Cost sistem (CAPEX)' },
  'wizard.priceBuy': { en: 'Electricity price (buy)', ro: 'Preț energie (cumpărare)' },
  'wizard.selfConsumption': { en: 'Self-consumption (%)', ro: 'Autoconsum (%)' },
  'wizard.priceSell': { en: 'Export price (optional)', ro: 'Preț export (opțional)' },
  'wizard.advancedEconomics': { en: 'Advanced economics', ro: 'Economie avansată' },
  'wizard.opex': { en: 'OPEX yearly', ro: 'OPEX anual' },
  'wizard.degradation': { en: 'Degradation (%/year)', ro: 'Degradare (%/an)' },
  'wizard.analysisYears': { en: 'Analysis years', ro: 'Ani analiză' },
  'wizard.discountRate': { en: 'Discount rate (%/year)', ro: 'Rată actualizare (%/an)' },
  'wizard.priceEscalation': { en: 'Price escalation (%/year)', ro: 'Creștere preț (%/an)' },
  'wizard.back': { en: 'Back', ro: 'Înapoi' },
  'wizard.next': { en: 'Next', ro: 'Înainte' },
  'wizard.runSimulation': { en: 'Run simulation', ro: 'Rulează simularea' },
  'wizard.running': { en: 'Running...', ro: 'Se rulează...' },
  'wizard.errorTitle': { en: 'Simulation failed', ro: 'Simularea a eșuat' },
  'wizard.close': { en: 'Close', ro: 'Închide' },

  // Results
  'results.title': { en: 'Simulation results', ro: 'Rezultate simulare' },
  'results.subtitle': {
    en: 'Review PV yield, key KPIs, cashflow, and insights for your scenario.',
    ro: 'Revizuiește producția PV, KPI-urile, fluxul de numerar și recomandările pentru scenariul tău.'
  },
  'results.annualEnergy': { en: 'Annual energy', ro: 'Energie anuală' },
  'results.specificYield': { en: 'Specific yield', ro: 'Randament specific' },
  'results.capacityFactor': { en: 'Capacity factor', ro: 'Factor capacitate' },
  'results.payback': { en: 'Payback', ro: 'Recuperare' },
  'results.year1Savings': { en: 'Year 1 savings', ro: 'Economii an 1' },
  'results.roi': { en: 'ROI (simple)', ro: 'ROI (simplu)' },
  'results.years': { en: 'years', ro: 'ani' },
  'results.unitKwhYear': { en: 'kWh/year', ro: 'kWh/an' },
  'results.unitKwhKwpYear': { en: 'kWh/kWp·year', ro: 'kWh/kWp·an' },
  'results.monthlyProduction': { en: 'Monthly PV production', ro: 'Producție PV lunară' },
  'results.cumulativeCashflow': { en: 'Cumulative cashflow', ro: 'Flux numerar cumulat' },
  'results.insights': { en: 'Insights', ro: 'Recomandări' },
  'results.runNew': { en: 'Run new simulation', ro: 'Rulează o simulare nouă' },
  'results.empty': {
    en: 'No simulation data yet. Start from the wizard to run your first scenario.',
    ro: 'Nicio simulare încă. Pornește de la asistent pentru primul scenariu.'
  },
  'results.backToWizard': { en: 'Back to wizard', ro: 'Înapoi la asistent' },

  // Insight keys (from backend)
  'insight.highLosses': {
    en: 'High system losses; check inverter sizing, cabling, and shading.',
    ro: 'Pierderi mari ale sistemului; verifică dimensionarea invertorului, cablajul și umbrirea.'
  },
  'insight.orientationFarFromSouth': {
    en: 'Array orientation is far from south; expect reduced energy yield.',
    ro: 'Orientarea panourilor este departe de sud; randamentul va fi redus.'
  },
  'insight.highVariability': {
    en: 'Year-to-year variability of solar resource is relatively high.',
    ro: 'Variabilitatea resursei solare de la an la an este relativ mare.'
  },
  'insight.greatSolarResource': {
    en: 'Great solar resource for PV at this location (high specific yield).',
    ro: 'Resursă solară foarte bună pentru PV la această locație (randament specific ridicat).'
  }
};

@Injectable({ providedIn: 'root' })
export class LanguageService {
  readonly currentLang = signal<Lang>(this.loadStored());

  private loadStored(): Lang {
    try {
      const stored = localStorage.getItem('solar-lang');
      if (stored === 'en' || stored === 'ro') return stored;
    } catch {}
    return 'en';
  }

  setLanguage(lang: Lang): void {
    this.currentLang.set(lang);
    try {
      localStorage.setItem('solar-lang', lang);
    } catch {}
  }

  translate(key: string): string {
    const entry = TRANSLATIONS[key];
    if (!entry) return key;
    const lang = this.currentLang();
    return entry[lang] ?? entry.en ?? key;
  }
}
