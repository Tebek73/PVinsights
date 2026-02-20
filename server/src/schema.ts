// Zod schemas for backend API contracts
import { z } from 'zod';

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
    raddatabase: z.string().nullable().optional()
  }),
  economics: z.object({
    capex: z
      .number()
      .positive({ message: 'System cost must be greater than 0' }),
    price_buy: z
      .number()
      .positive({ message: 'Electricity price must be greater than 0' }),
    self_consumption: z
      .number()
      .min(0, { message: 'Self-consumption must be between 0 and 100%' })
      .max(1, { message: 'Self-consumption must be between 0 and 100%' })
      .default(0.5),
    price_sell: z.number().min(0, { message: 'Export price cannot be negative' }).default(0),
    opex_yearly: z.number().min(0, { message: 'Yearly OPEX cannot be negative' }).default(0),
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
      .default(0)
  })
});

export type SimulateInput = z.infer<typeof SimulateSchema>;
