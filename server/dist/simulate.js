"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runSimulation = runSimulation;
const pvgis_1 = require("./pvgis");
const utils_1 = require("./utils");
async function runSimulation(input) {
    const { location, pv, economics } = input;
    const pvParams = {
        lat: location.lat,
        lon: location.lon,
        peakpower: pv.peakpower_kw,
        loss: pv.loss_percent,
        usehorizon: pv.usehorizon ? 1 : 0,
        pvtechchoice: pv.pvtechchoice,
        mountingplace: pv.mountingplace,
        optimalangles: pv.optimalangles ? 1 : 0
    };
    if (!pv.optimalangles && pv.angle_deg != null && pv.aspect_deg != null) {
        pvParams.angle = pv.angle_deg;
        pvParams.aspect = pv.aspect_deg;
    }
    const radiationDatabase = pv.raddatabase && pv.raddatabase.trim().length > 0 ? pv.raddatabase : undefined;
    const pvcalc = await (0, pvgis_1.callPVGIS)('PVcalc', pvParams, radiationDatabase);
    const monthly = parseMonthly(pvcalc);
    const totals = parseTotals(pvcalc);
    const kpis = computeKpis(totals, monthly, pv.peakpower_kw);
    const finance = computeFinance(totals, economics);
    const charts = buildCharts(monthly, economics.capex, finance.cashflow_cumulative);
    const insights = buildInsights(pv, totals, kpis);
    return {
        pvgis: {
            inputs: pvcalc?.inputs ?? null,
            monthly,
            totals
        },
        kpis,
        finance,
        charts,
        insights
    };
}
function parseMonthly(pvcalc) {
    const raw = (0, utils_1.getMonthlyArray)(pvcalc);
    if (!Array.isArray(raw))
        return [];
    const mapped = raw
        .map((row) => ({
        month: (0, utils_1.num)(row.month),
        E_m: (0, utils_1.num)(row['E_m'] ?? row.E_m),
        SD_m: (0, utils_1.num)(row['SD_m'] ?? row.SD_m),
        H_i_m: (0, utils_1.num)(row['H(i)_m'] ?? row['H(i)_m'] ?? row.H_i_m)
    }))
        .filter((p) => p.month >= 1 && p.month <= 12);
    mapped.sort((a, b) => a.month - b.month);
    return mapped;
}
function parseTotals(pvcalc) {
    const fixed = pvcalc?.outputs?.totals?.fixed ?? pvcalc?.outputs?.totals ?? {};
    const E_y = (0, utils_1.num)(fixed['E_y'] ?? fixed.E_y);
    const SD_y = (0, utils_1.num)(fixed['SD_y'] ?? fixed.SD_y);
    const H_i_y = (0, utils_1.num)(fixed['H(i)_y'] ?? fixed['H(i)_y'] ?? fixed.H_i_y);
    const l_total = (0, utils_1.num)(fixed['l_total'] ?? fixed.l_total);
    const LCOE_pvRaw = fixed['LCOE_pv'] ?? fixed.LCOE_pv;
    const LCOE_pv = LCOE_pvRaw == null ? null : (0, utils_1.num)(LCOE_pvRaw);
    return {
        E_y,
        SD_y,
        H_i_y,
        l_total,
        LCOE_pv
    };
}
function computeKpis(totals, monthly, peakpower_kw) {
    const E_y = totals.E_y;
    const P = peakpower_kw;
    const specific_yield_kwh_per_kwp = P > 0 ? E_y / P : 0;
    const capacity_factor = P > 0 ? E_y / (P * 8760) : 0;
    const capacity_factor_pct = capacity_factor * 100;
    let best_month = null;
    let worst_month = null;
    for (const m of monthly) {
        if (!best_month || m.E_m > best_month.kwh) {
            best_month = { month: m.month, kwh: m.E_m };
        }
        if (!worst_month || m.E_m < worst_month.kwh) {
            worst_month = { month: m.month, kwh: m.E_m };
        }
    }
    const seasonality_ratio = best_month && worst_month && worst_month.kwh > 0
        ? best_month.kwh / worst_month.kwh
        : null;
    const uncertainty_annual_kwh = totals.SD_y;
    return {
        annual_kwh: E_y,
        specific_yield_kwh_per_kwp,
        capacity_factor_pct,
        best_month,
        worst_month,
        seasonality_ratio,
        uncertainty_annual_kwh
    };
}
function computeFinance(totals, economics) {
    const { capex, price_buy, self_consumption, price_sell, opex_yearly, degradation, analysis_years, discount_rate, price_escalation } = economics;
    const E1 = totals.E_y;
    const N = analysis_years;
    const d = degradation;
    const g = price_escalation;
    const cashflow_yearly = [];
    const cashflow_cumulative = [];
    let cum = -capex;
    let sumSavings = 0;
    let npvSum = 0;
    let payback_years = null;
    for (let t = 1; t <= N; t++) {
        const E_t = E1 * Math.pow(1 - d, t - 1);
        const price_buy_t = price_buy * Math.pow(1 + g, t - 1);
        const E_self = E_t * self_consumption;
        const E_export = E_t - E_self;
        const savings = E_self * price_buy_t + E_export * price_sell - (opex_yearly ?? 0);
        sumSavings += savings;
        cashflow_yearly.push(savings);
        cum += savings;
        cashflow_cumulative.push(cum);
        if (payback_years === null && cum >= 0) {
            payback_years = t;
        }
        const r = discount_rate;
        if (r > 0) {
            npvSum += savings / Math.pow(1 + r, t);
        }
    }
    const roi = capex > 0
        ? (sumSavings - capex) / capex
        : null;
    const npv = discount_rate > 0 ? npvSum - capex : null;
    const savings_year1 = cashflow_yearly[0] ?? 0;
    return {
        savings_year1,
        payback_years,
        roi,
        npv,
        cashflow_yearly,
        cashflow_cumulative
    };
}
function buildCharts(monthly, capex, cashflow_cumulative) {
    const monthly_energy_kwh = monthly.map((m) => ({
        month: m.month,
        kwh: m.E_m
    }));
    const cashflowPoints = [
        { year: 0, value: -capex }
    ];
    cashflow_cumulative.forEach((value, index) => {
        cashflowPoints.push({ year: index + 1, value });
    });
    return {
        monthly_energy_kwh,
        cashflow_cumulative: cashflowPoints
    };
}
function buildInsights(pv, totals, kpis) {
    const insights = [];
    if (pv.loss_percent > 20) {
        insights.push({
            type: 'warning',
            text: 'High system losses; check inverter sizing, cabling, and shading.'
        });
    }
    if (!pv.optimalangles && pv.aspect_deg != null && Math.abs(pv.aspect_deg) > 90) {
        insights.push({
            type: 'warning',
            text: 'Array orientation is far from south; expect reduced energy yield.'
        });
    }
    if (totals.E_y > 0 && totals.SD_y / totals.E_y > 0.05) {
        insights.push({
            type: 'info',
            text: 'Year-to-year variability of solar resource is relatively high.'
        });
    }
    if (kpis.specific_yield_kwh_per_kwp > 1200) {
        insights.push({
            type: 'info',
            text: 'Great solar resource for PV at this location (high specific yield).'
        });
    }
    return insights;
}
