// Zod schemas for backend API contracts
import { z } from 'zod';

const monthly12 = z.array(z.number()).length(12);

export const SimulateSchema = z.object({
  location: z.object({
    lat: z
      .number()
      .min(-90, { message: 'Latitude must be at least -90 (south)' })
      .max(90, { message: 'Latitude must be at most 90 (north)' }),
    lon: z
      .number()
      .min(-180, { message: 'Longitude must be at least -180 (west)' })
      .max(180, { message: 'Longitude must be at most 180 (east)' })
  }),
  pv: z.object({
    peakpower_kw: z
      .number()
      .positive({ message: 'System size must be greater than 0' })
      .max(1000, { message: 'System size must be at most 1000 kWp' }),
    loss_percent: z
      .number()
      .min(0, { message: 'System losses must be at least 0%' })
      .max(80, { message: 'System losses must be at most 80%' })
      .default(14),
    /** User-assumed nearby-object shading loss (%); not inferred from location. */
    near_shading_loss_percent: z
      .number()
      .min(0, { message: 'Nearby shading loss must be between 0 and 80%' })
      .max(80, { message: 'Nearby shading loss must be between 0 and 80%' })
      .default(0),
    usehorizon: z.boolean().default(true),
    optimalangles: z.boolean().default(true),
    angle_deg: z
      .number()
      .min(0, { message: 'Tilt angle must be between 0 and 90°' })
      .max(90, { message: 'Tilt angle must be between 0 and 90°' })
      .nullable()
      .optional(),
    aspect_deg: z
      .number()
      .min(-180, { message: 'Azimuth must be between -180 and 180 (0=South, 90=West, -90=East)' })
      .max(180, { message: 'Azimuth must be between -180 and 180' })
      .nullable()
      .optional(),
    pvtechchoice: z
      .enum(['crystSi', 'crystSi2025', 'CIS', 'CdTe', 'Unknown'])
      .default('crystSi'),
    mountingplace: z.enum(['free', 'building']).default('free'),
    raddatabase: z.string().nullable().optional(),
    /**
     * Fetch per-calendar-year PVGIS monthly production (one PVcalc per year) for the chart.
     * 0 = off (single DB-average monthly profile). Max 20.
     */
    monthly_history_years: z.number().int().min(0).max(20).default(10)
  }),
  economics: z.object({
    currency: z.enum(['EUR', 'RON']).default('EUR'),
    capex: z.number().positive({ message: 'System cost must be greater than 0' }),
    price_buy: z.number().positive({ message: 'Electricity price must be greater than 0' }),
    self_consumption: z
      .number()
      .min(0, { message: 'Self-consumption must be between 0 and 100%' })
      .max(1, { message: 'Self-consumption must be between 0 and 100%' })
      .default(0.5),
    price_sell: z.number().min(0, { message: 'Export price cannot be negative' }).default(0),
    price_sell_escalation: z
      .number()
      .min(0, { message: 'Export price escalation cannot be negative' })
      .max(1, { message: 'Export price escalation must be at most 100% per year' })
      .default(0),
    opex_yearly: z.number().min(0, { message: 'Yearly OPEX cannot be negative' }).default(0),
    opex_escalation: z
      .number()
      .min(0, { message: 'OPEX escalation cannot be negative' })
      .max(1, { message: 'OPEX escalation must be at most 100% per year' })
      .default(0),
    degradation: z
      .number()
      .min(0, { message: 'Degradation rate must be between 0 and 10% per year' })
      .max(0.1, { message: 'Degradation rate must be between 0 and 10% per year' })
      .default(0.005),
    analysis_years: z
      .number()
      .int({ message: 'Analysis period must be a whole number of years' })
      .min(1, { message: 'Analysis period must be at least 1 year' })
      .max(40, { message: 'Analysis period must be at most 40 years' })
      .default(25),
    discount_rate: z
      .number()
      .min(0, { message: 'Discount rate must be between 0 and 100%' })
      .max(1, { message: 'Discount rate must be between 0 and 100%' })
      .default(0.06),
    price_escalation: z
      .number()
      .min(0, { message: 'Price escalation cannot be negative' })
      .max(1, { message: 'Price escalation must be at most 100% per year' })
      .default(0),
    subsidy_amount: z.number().min(0, { message: 'Subsidy amount cannot be negative' }).default(0),
    subsidy_percent_capex: z
      .number()
      .min(0, { message: 'Subsidy percent cannot be negative' })
      .max(1, { message: 'Subsidy percent must be at most 100%' })
      .default(0),
    replacement_events: z
      .array(
        z.object({
          year: z.number().int().min(1).max(40),
          cost: z.number().min(0),
          label: z.string().optional()
        })
      )
      .optional()
  }),
  monte_carlo: z
    .object({
      n_trials: z.number().int().min(100).max(20000).optional(),
      target_payback_years: z.number().min(1).max(40).optional(),
      seed: z.number().int().optional(),
      uncertainty: z
        .object({
          capex_rel_std: z.number().min(0).max(1).optional(),
          self_consumption_abs_std: z.number().min(0).max(0.5).optional(),
          degradation_abs_std: z.number().min(0).max(0.1).optional(),
          price_escalation_abs_std: z.number().min(0).max(1).optional(),
          discount_rate_abs_std: z.number().min(0).max(1).optional(),
          pv_yield_use_sd_y: z.boolean().optional(),
          /** Extra relative std dev on top of yield sampling (Monte Carlo only). */
          model_yield_uncertainty_rel_std: z.number().min(0).max(1).optional()
        })
        .optional()
    })
    .optional(),
  cost_model: z
    .object({
      fixed_cost: z.number().min(0),
      cost_per_kwp: z.number().min(0)
    })
    .optional(),
  consumption: z
    .object({
      annual_kwh: z.number().min(0),
      daytime_fraction: z.number().min(0).max(1),
      monthly_load_profile: monthly12.optional(),
      monthly_daytime_fraction: z.union([z.number().min(0).max(1), monthly12]).optional()
    })
    .optional(),
  kwp_range: z.tuple([z.number().positive(), z.number().positive(), z.number().positive()]).optional(),
  kwp_constraints: z
    .object({
      max_roof_area_m2: z.number().positive().optional(),
      panel_power_wp: z.number().positive().optional(),
      panel_area_m2: z.number().positive().optional(),
      max_kwp: z.number().positive().optional()
    })
    .optional()
});

export type SimulateInput = z.infer<typeof SimulateSchema>;
