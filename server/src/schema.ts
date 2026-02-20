// Zod schemas for backend API contracts
import { z } from 'zod';

// Legacy /api/pv/analyze schema (direct PVGIS proxy with flat fields)
export const AnalyzeSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),

  // Sistem PV
  peakpower_kwp: z.number().positive().max(1000),
  loss_pct: z.number().min(0).max(80).default(14),

  // Geometrie (ori tilt+azimuth, ori optimalangles)
  tilt_deg: z.number().min(0).max(90).optional(),
  azimuth_from_north_deg: z.number().min(0).max(360).optional(),
  optimalangles: z.boolean().default(false),

  // Baza de radiatie + orizont
  usehorizon: z.boolean().default(true),
  radiation_database: z
    .enum(['PVGIS-SARAH3', 'PVGIS-ERA5', 'PVGIS-NSRDB', 'PVGIS-CMSAF'])
    .optional(),

  // Serii orare
  pv_timeseries: z.boolean().default(true),
  components: z.boolean().default(true),
  startyear: z.number().int().min(2005).max(2020).optional(),
  endyear: z.number().int().min(2005).max(2020).optional(),

  // Alte optiuni si seturi de date
  want_tmy: z.boolean().default(true),
  want_monthly: z.boolean().default(true),
  want_yearly: z.boolean().default(false),
  want_daily: z.boolean().default(false),
  want_horizon: z.boolean().default(false)
});

// New /api/simulate schema matching PROJECT.md (nested location + pv + economics)
export const SimulateSchema = z.object({
  location: z.object({
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180)
  }),
  pv: z.object({
    peakpower_kw: z.number().positive().max(1000),
    loss_percent: z.number().min(0).max(80).default(14),
    usehorizon: z.boolean().default(true),
    optimalangles: z.boolean().default(true),
    angle_deg: z.number().min(0).max(90).nullable().optional(),
    // PVGIS convention: 0=S, 90=W, -90=E
    aspect_deg: z.number().min(-180).max(180).nullable().optional(),
    pvtechchoice: z
      .enum(['crystSi', 'crystSi2025', 'CIS', 'CdTe', 'Unknown'])
      .default('crystSi'),
    mountingplace: z.enum(['free', 'building']).default('free'),
    raddatabase: z.string().nullable().optional()
  }),
  economics: z.object({
    capex: z.number().positive(),
    price_buy: z.number().positive(),
    self_consumption: z.number().min(0).max(1).default(0.5),
    price_sell: z.number().min(0).default(0),
    opex_yearly: z.number().min(0).default(0),
    degradation: z.number().min(0).max(0.1).default(0.005),
    analysis_years: z.number().int().min(1).max(40).default(25),
    discount_rate: z.number().min(0).max(1).default(0.06),
    price_escalation: z.number().min(0).max(1).default(0)
  })
});

export type SimulateInput = z.infer<typeof SimulateSchema>;
