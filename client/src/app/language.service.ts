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
  'wizard.areaTypeQuestion': {
    en: 'What best describes the installation site?',
    ro: 'Cum descrii cel mai bine locul de instalare?'
  },
  'wizard.areaTypeRural': {
    en: 'Rural (open land, few buildings/trees)',
    ro: 'Rural (teren deschis, puține clădiri/copaci)'
  },
  'wizard.areaTypeSuburban': {
    en: 'Suburban (houses, some trees)',
    ro: 'Suburban (case, câțiva copaci)'
  },
  'wizard.areaTypeUrban': {
    en: 'Urban (buildings, more shading)',
    ro: 'Urban (clădiri, mai multă umbrire)'
  },
  'wizard.areaTypePlaceholder': { en: 'Select...', ro: 'Alege...' },
  'wizard.location.hint': {
    en: 'Search for an address or place the pin on the map. The map and pin stay in sync.',
    ro: 'Caută o adresă sau plasează pinul pe hartă. Harta și pinul rămân sincronizate.'
  },
  'location.searchPlaceholder': { en: 'Search address or place...', ro: 'Caută adresă sau loc...' },
  'location.searching': { en: 'Searching...', ro: 'Se caută...' },
  'location.noResults': { en: 'No results. Try another search or place the pin on the map.', ro: 'Niciun rezultat. Încearcă altă căutare sau plasează pinul pe hartă.' },
  'location.orPlacePin': { en: 'Or click/drag the pin on the map', ro: 'Sau dă click / trage pinul pe hartă' },
  'location.selected': { en: 'Selected', ro: 'Selectat' },
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
  'results.npv': { en: 'NPV', ro: 'VAN' },
  'results.scenariosTitle': { en: 'Scenario comparison', ro: 'Comparare scenarii' },
  'results.scenariosDesc': { en: 'Same PV energy; varying self-consumption and electricity price.', ro: 'Aceeași energie PV; variind autoconsumul și prețul energiei.' },
  'results.scenariosBySelfConsumption': { en: 'By self-consumption (%)', ro: 'După autoconsum (%)' },
  'results.scenariosByPrice': { en: 'By electricity price (±20%)', ro: 'După preț energie (±20%)' },
  'results.scenarioSelfConsumption': { en: 'Self-consumption', ro: 'Autoconsum' },
  'results.scenarioPriceBuy': { en: 'Price (buy)', ro: 'Preț (cumpărare)' },
  'results.sensitivityTitle': { en: 'Sensitivity analysis', ro: 'Analiză de sensibilitate' },
  'results.sensitivityDesc': { en: 'Payback and NPV vs electricity price and self-consumption (same PV energy).', ro: 'Recuperare și VAN vs preț energie și autoconsum (aceeași energie PV).' },
  'results.sensitivity1D': { en: '1D: Payback & NPV vs electricity price', ro: '1D: Recuperare și VAN vs preț energie' },
  'results.sensitivity2D': { en: '2D heatmap', ro: 'Hartă 2D' },
  'results.sensitivity2DAxes': { en: 'Rows: self-consumption %. Columns: electricity price.', ro: 'Rânduri: autoconsum %. Coloane: preț energie.' },
  'results.monteCarloTitle': { en: 'Monte Carlo risk analysis', ro: 'Analiză risc Monte Carlo' },
  'results.monteCarloDesc': { en: 'Payback and NPV distribution using PVGIS yield uncertainty (SD_y).', ro: 'Distribuția recuperării și VAN folosind incertitudinea PVGIS (SD_y).' },
  'results.probPaybackUnderTarget': { en: 'P(payback ≤ target)', ro: 'P(recuperare ≤ țintă)' },
  'results.monteCarloN': { en: 'Trials', ro: 'Simulări' },
  'results.distribution': { en: 'distribution', ro: 'distribuție' },
  'results.breakEvenTitle': { en: 'Break-even metrics', ro: 'Metrici prag de rentabilitate' },
  'results.breakEvenDesc': { en: 'Decision boundaries for investment.', ro: 'Limite de decizie pentru investiție.' },
  'results.breakEvenCapexTitle': { en: 'Max CAPEX for target payback', ro: 'CAPEX max pentru recuperare țintă' },
  'results.breakEvenCapexMeta': { en: 'For', ro: 'Pentru' },
  'results.breakEvenPriceTitle': { en: 'Break-even electricity price (NPV=0)', ro: 'Preț energie prag (VAN=0)' },
  'results.breakEvenPriceMeta': { en: 'Price at which NPV is zero.', ro: 'Preț la care VAN este zero.' },
  'results.kwpOptTitle': { en: 'kWp optimization', ro: 'Optimizare kWp' },
  'results.kwpOptDesc': { en: 'Recommended system size by max NPV and min payback (with cost and consumption model).', ro: 'Putere recomandată după NPV max și recuperare min (cu model cost și consum).' },
  'results.kwpOptByNpv': { en: 'Recommended by max NPV', ro: 'Recomandat după NPV max' },
  'results.kwpOptByPayback': { en: 'Recommended by min payback', ro: 'Recomandat după recuperare min' },
  'results.insights': { en: 'Insights', ro: 'Recomandări' },
  'results.runNew': { en: 'Run new simulation', ro: 'Rulează o simulare nouă' },
  'results.empty': {
    en: 'No simulation data yet. Start from the wizard to run your first scenario.',
    ro: 'Nicio simulare încă. Pornește de la asistent pentru primul scenariu.'
  },
  'results.backToWizard': { en: 'Back to wizard', ro: 'Înapoi la asistent' },

  // Plain-language titles (accessible metrics)
  'results.annualEnergyPlain': { en: 'Electricity your panels produce per year', ro: 'Energia pe care panourile o produc pe an' },
  'results.specificYieldPlain': { en: 'How much electricity per kW of panels (how sunny your spot is)', ro: 'Câtă energie per kW de panouri (cât de însorit e locul)' },
  'results.capacityFactorPlain': { en: 'Share of the year panels run at full power (sunshine level)', ro: 'Cât din an panourile merg la putere maximă (nivel soare)' },
  'results.paybackPlain': { en: 'Time to recover your investment', ro: 'Timp până îți recuperezi investiția' },
  'results.year1SavingsPlain': { en: 'Money you save in the first year', ro: 'Bani pe care îi economisești în primul an' },
  'results.roiPlain': { en: 'Total return on investment over the period', ro: 'Randament total al investiției pe perioadă' },
  'results.npvPlain': { en: "Today's value of all future savings minus cost", ro: 'Valoarea actuală a tuturor economiilor viitoare minus cost' },
  'results.cumulativeCashflowPlain': { en: 'Running total of money in/out over the years', ro: 'Total cumulat bani în/afară pe ani' },
  'results.breakEvenCapexPlain': { en: 'Maximum system cost that still pays back in X years', ro: 'Cost maxim al sistemului care încă se recuperează în X ani' },
  'results.breakEvenPricePlain': { en: 'Electricity price above which the system becomes profitable', ro: 'Preț energie peste care sistemul devine profitabil' },
  'results.p10p50p90Plain': { en: 'Pessimistic / Typical / Optimistic outcome', ro: 'Rezultat pesimist / tipic / optimist' },

  // One-sentence explanations (tooltips)
  'results.explainAnnualEnergy': { en: 'Total kWh your system is expected to generate in one year.', ro: 'Total kWh pe care sistemul tău îl va produce într-un an.' },
  'results.explainSpecificYield': { en: 'How much electricity you get per kW of installed panels. Higher means a sunnier location.', ro: 'Câtă energie primești per kW panouri. Valori mari = loc mai însorit.' },
  'results.explainCapacityFactor': { en: 'What fraction of the time your panels would need to run at full power to make this much energy. Shows how sunny it is.', ro: 'Ce fracțiune din timp panourile ar trebui să meargă la putere maximă pentru această energie.' },
  'results.explainPayback': { en: 'Number of years until your total savings equal what you paid for the system.', ro: 'Numărul de ani până când economiile totale egalează ce ai plătit pentru sistem.' },
  'results.explainYear1Savings': { en: 'Net money you keep in year one: value of self-consumed and exported energy minus yearly costs.', ro: 'Bani net în anul 1: valoarea energiei consumate/exportate minus costuri anuale.' },
  'results.explainRoi': { en: 'Over the analysis period, how much you gain compared to what you spent (as a percentage).', ro: 'Pe perioada de analiză, cât câștigi față de ce ai cheltuit (în procente).' },
  'results.explainNpv': { en: "If you value future money at the discount rate you chose, this is the net gain (or loss) in today's money.", ro: 'Dacă actualizezi banii viitori la rata aleasă, acesta e câștigul (sau pierderea) netă în bani de azi.' },
  'results.explainCumulativeCashflow': { en: 'Starts negative (you paid). Each year adds your savings. When it crosses zero, you have broken even.', ro: 'Începe negativ (ai plătit). Fiecare an adaugă economiile. Când trece de zero, ai recuperat.' },
  'results.explainMonthlyProduction': { en: 'Energy produced each month (kWh). Summer is usually higher than winter.', ro: 'Energie produsă lunar (kWh). Vara e de obicei mai mult decât iarna.' },
  'results.explainScenarios': { en: 'Same solar production; we show how payback and profit change if you use more or less yourself, or if the electricity price is different.', ro: 'Aceeași producție solară; arătăm cum se schimbă recuperarea și profitul dacă consumi mai mult/mai puțin sau prețul energiei e diferit.' },
  'results.explainSensitivity': { en: 'Same solar production; we only change electricity price and how much you use yourself. Shows how sensitive your result is to these.', ro: 'Aceeași producție; schimbăm doar prețul energiei și cât consumi tu. Arată cât de sensibil e rezultatul.' },
  'results.explainMonteCarlo': { en: 'We simulate many possible years using weather uncertainty. You see the range of payback and profit, not just one number.', ro: 'Simulăm mulți ani posibili folosind incertitudinea vremii. Vezi intervalul de recuperare și profit, nu doar un număr.' },
  'results.explainBreakEven': { en: "Answers: 'How much could I pay at most?' and 'At what electricity price does this start to pay off?'", ro: "Răspunde: 'Cât pot plăti maxim?' și 'La ce preț al energiei începe să fie profitabil?'" },
  'results.explainP10P50P90': { en: 'We ran many random scenarios: pessimistic (P10), typical (P50), and optimistic (P90) outcomes.', ro: 'Am rulat multe scenarii aleatoare: pesimist (P10), tipic (P50), optimist (P90).' },
  'results.explainKwpOpt': { en: 'For a given cost and consumption, we compare different system sizes and suggest the one that maximizes profit or shortens payback.', ro: 'Pentru un cost și consum dat, comparăm dimensiuni și sugerăm cea care maximizează profitul sau scurtează recuperarea.' },

  // Section intros ("In plain words")
  'results.introOverall': { en: 'Below you see what your system produces, what it means for your money, and how results change if assumptions change.', ro: 'Mai jos vezi ce produce sistemul, ce înseamnă pentru buzunarul tău și cum se schimbă rezultatele dacă ipotezele se schimbă.' },
  'results.introFromSun': { en: 'What your system produces: energy per year and how it varies by month.', ro: 'Ce produce sistemul tău: energie pe an și cum variază pe lună.' },
  'results.introYourMoney': { en: 'What it means for your wallet: when you break even, how much you save, and total return.', ro: 'Ce înseamnă pentru buzunar: când recuperezi, cât economisești și randamentul total.' },
  'results.introScenarios': { en: 'Same solar production; we show how payback and profit change if you use more or less yourself, or if the electricity price is different.', ro: 'Aceeași producție solară; arătăm cum se schimbă recuperarea și profitul dacă consumi mai mult/mai puțin sau prețul energiei e diferit.' },
  'results.introSensitivity': { en: 'How payback and profit change when we vary electricity price and self-consumption (same production).', ro: 'Cum se schimbă recuperarea și profitul când variem prețul energiei și autoconsumul (aceeași producție).' },
  'results.introMonteCarlo': { en: 'Because weather varies, we ran thousands of possible outcomes. Here you see pessimistic, typical, and optimistic results.', ro: 'Pentru că vremea variază, am rulat mii de rezultate posibile. Aici vezi pesimist, tipic și optimist.' },
  'results.introBreakEven': { en: 'Useful limits: maximum system cost for a target payback, and the electricity price above which the system pays off.', ro: 'Limite utile: cost maxim pentru o recuperare țintă și prețul energiei peste care sistemul se amortizează.' },
  'results.introKwpOpt': { en: 'For a given cost and consumption, we compare different system sizes and suggest the one that maximizes profit or shortens payback.', ro: 'Pentru un cost și consum date, comparăm dimensiuni și sugerăm cea care maximizează profitul sau scurtează recuperarea.' },
  'results.introInsights': { en: 'Short notes about your setup and location (e.g. shading, losses, or how good the solar resource is).', ro: 'Note scurte despre configurație și locație (umbrire, pierderi, cât de bună e resursa solară).' },

  // Chart one-liners
  'results.chartMonthlyDesc': { en: 'Energy produced each month (kWh).', ro: 'Energie produsă în fiecare lună (kWh).' },
  'results.chartCashflowDesc': { en: 'Running total: negative at start (you paid), then grows as you save.', ro: 'Total cumulat: negativ la început (ai plătit), apoi crește pe măsură ce economisești.' },

  // Wizard hints (under or next to inputs)
  'wizard.hintSystemSize': { en: 'Total power of your panels in kW (e.g. 3–5 kW for a house).', ro: 'Puterea totală a panourilor în kW (ex. 3–5 kW pentru o casă).' },
  'wizard.hintSystemLosses': { en: 'Typical 10–15%. Cables, inverter, dirt, and shading reduce output.', ro: 'Tipic 10–15%. Cablurile, invertorul, murdăria și umbrirea reduc producția.' },
  'wizard.hintSelfConsumption': { en: 'Share of the solar energy you use at home (rest is exported or stored).', ro: 'Partea din energia solară pe care o folosești acasă (restul se exportă sau stochează).' },
  'wizard.hintCapex': { en: 'Total upfront cost of the system.', ro: 'Costul total inițial al sistemului.' },
  'wizard.hintPriceBuy': { en: 'What you pay per kWh from the grid (e.g. in currency per kWh).', ro: 'Cât plătești per kWh de la rețea (ex. în monedă per kWh).' },
  'wizard.hintDiscountRate': { en: 'How much you value money today vs in the future (e.g. 5–7%).', ro: 'Cât valorezi banii azi față de viitor (ex. 5–7%).' },
  'wizard.hintDiscountRateNpvOnly': { en: 'Only affects NPV. Use 5–6% if unsure, or leave default.', ro: 'Afectează doar VAN. Folosește 5–6% dacă ești nesigur, sau lasă implicit.' },
  'wizard.hintAnalysisYears': { en: 'Over how many years you want to look at savings and return.', ro: 'Pe câți ani vrei să vezi economiile și randamentul.' },
  'wizard.hintDegradation': { en: 'Panels produce a bit less each year (e.g. 0.5% per year is typical).', ro: 'Panourile produc puțin mai puțin în fiecare an (ex. 0,5% pe an e tipic).' },
  'wizard.hintOpex': { en: 'Yearly running costs (cleaning, insurance, etc.).', ro: 'Costuri anuale de exploatare (curățare, asigurare etc.).' },
  'wizard.hintPriceEscalation': { en: 'If you expect electricity prices to rise each year (e.g. 2%).', ro: 'Dacă te aștepți ca prețul energiei să crească anual (ex. 2%).' },

  // Accessibility: info icon label
  'aria.infoExplanation': { en: 'What does this mean?', ro: 'Ce înseamnă?' },

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
  },
  'insight.areaTypeShading': {
    en: 'Yield adjusted for urban/suburban shading (buildings/trees).',
    ro: 'Randament ajustat pentru umbrirea urbană/suburbană (clădiri/copaci).'
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
