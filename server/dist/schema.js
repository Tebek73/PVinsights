"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SimulateSchema = exports.AnalyzeSchema = void 0;
// Zod schemas for backend API contracts
const zod_1 = require("zod");
// Legacy /api/pv/analyze schema (direct PVGIS proxy with flat fields)
exports.AnalyzeSchema = zod_1.z.object({
    lat: zod_1.z.number().min(-90).max(90),
    lon: zod_1.z.number().min(-180).max(180),
    // Sistem PV
    peakpower_kwp: zod_1.z.number().positive().max(1000),
    loss_pct: zod_1.z.number().min(0).max(80).default(14),
    // Geometrie (ori tilt+azimuth, ori optimalangles)
    tilt_deg: zod_1.z.number().min(0).max(90).optional(),
    azimuth_from_north_deg: zod_1.z.number().min(0).max(360).optional(),
    optimalangles: zod_1.z.boolean().default(false),
    // Baza de radiatie + orizont
    usehorizon: zod_1.z.boolean().default(true),
    radiation_database: zod_1.z
        .enum(['PVGIS-SARAH3', 'PVGIS-ERA5', 'PVGIS-NSRDB', 'PVGIS-CMSAF'])
        .optional(),
    // Serii orare
    pv_timeseries: zod_1.z.boolean().default(true),
    components: zod_1.z.boolean().default(true),
    startyear: zod_1.z.number().int().min(2005).max(2020).optional(),
    endyear: zod_1.z.number().int().min(2005).max(2020).optional(),
    // Alte optiuni si seturi de date
    want_tmy: zod_1.z.boolean().default(true),
    want_monthly: zod_1.z.boolean().default(true),
    want_yearly: zod_1.z.boolean().default(false),
    want_daily: zod_1.z.boolean().default(false),
    want_horizon: zod_1.z.boolean().default(false)
});
// New /api/simulate schema matching PROJECT.md (nested location + pv + economics)
exports.SimulateSchema = zod_1.z.object({
    location: zod_1.z.object({
        lat: zod_1.z.number().min(-90).max(90),
        lon: zod_1.z.number().min(-180).max(180)
    }),
    pv: zod_1.z.object({
        peakpower_kw: zod_1.z.number().positive().max(1000),
        loss_percent: zod_1.z.number().min(0).max(80).default(14),
        usehorizon: zod_1.z.boolean().default(true),
        optimalangles: zod_1.z.boolean().default(true),
        angle_deg: zod_1.z.number().min(0).max(90).nullable().optional(),
        // PVGIS convention: 0=S, 90=W, -90=E
        aspect_deg: zod_1.z.number().min(-180).max(180).nullable().optional(),
        pvtechchoice: zod_1.z
            .enum(['crystSi', 'crystSi2025', 'CIS', 'CdTe', 'Unknown'])
            .default('crystSi'),
        mountingplace: zod_1.z.enum(['free', 'building']).default('free'),
        raddatabase: zod_1.z.string().nullable().optional()
    }),
    economics: zod_1.z.object({
        capex: zod_1.z.number().positive(),
        price_buy: zod_1.z.number().positive(),
        self_consumption: zod_1.z.number().min(0).max(1).default(0.5),
        price_sell: zod_1.z.number().min(0).default(0),
        opex_yearly: zod_1.z.number().min(0).default(0),
        degradation: zod_1.z.number().min(0).max(0.1).default(0.005),
        analysis_years: zod_1.z.number().int().min(1).max(40).default(25),
        discount_rate: zod_1.z.number().min(0).max(1).default(0.06),
        price_escalation: zod_1.z.number().min(0).max(1).default(0)
    })
});
