"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SimulateSchema = void 0;
// Zod schemas for backend API contracts
const zod_1 = require("zod");
exports.SimulateSchema = zod_1.z.object({
    location: zod_1.z.object({
        lat: zod_1.z
            .number()
            .min(-90, { message: 'Latitude must be at least -90 (south)' })
            .max(90, { message: 'Latitude must be at most 90 (north)' }),
        lon: zod_1.z
            .number()
            .min(-180, { message: 'Longitude must be at least -180 (west)' })
            .max(180, { message: 'Longitude must be at most 180 (east)' }),
        area_type: zod_1.z.enum(['rural', 'suburban', 'urban']).optional().nullable()
    }),
    pv: zod_1.z.object({
        peakpower_kw: zod_1.z
            .number()
            .positive({ message: 'System size must be greater than 0' })
            .max(1000, { message: 'System size must be at most 1000 kWp' }),
        loss_percent: zod_1.z
            .number()
            .min(0, { message: 'System losses must be at least 0%' })
            .max(80, { message: 'System losses must be at most 80%' })
            .default(14),
        usehorizon: zod_1.z.boolean().default(true),
        optimalangles: zod_1.z.boolean().default(true),
        angle_deg: zod_1.z
            .number()
            .min(0, { message: 'Tilt angle must be between 0 and 90°' })
            .max(90, { message: 'Tilt angle must be between 0 and 90°' })
            .nullable()
            .optional(),
        aspect_deg: zod_1.z
            .number()
            .min(-180, { message: 'Azimuth must be between -180 and 180 (0=South, 90=West, -90=East)' })
            .max(180, { message: 'Azimuth must be between -180 and 180' })
            .nullable()
            .optional(),
        pvtechchoice: zod_1.z
            .enum(['crystSi', 'crystSi2025', 'CIS', 'CdTe', 'Unknown'])
            .default('crystSi'),
        mountingplace: zod_1.z.enum(['free', 'building']).default('free'),
        raddatabase: zod_1.z.string().nullable().optional()
    }),
    economics: zod_1.z.object({
        capex: zod_1.z
            .number()
            .positive({ message: 'System cost must be greater than 0' }),
        price_buy: zod_1.z
            .number()
            .positive({ message: 'Electricity price must be greater than 0' }),
        self_consumption: zod_1.z
            .number()
            .min(0, { message: 'Self-consumption must be between 0 and 100%' })
            .max(1, { message: 'Self-consumption must be between 0 and 100%' })
            .default(0.5),
        price_sell: zod_1.z.number().min(0, { message: 'Export price cannot be negative' }).default(0),
        opex_yearly: zod_1.z.number().min(0, { message: 'Yearly OPEX cannot be negative' }).default(0),
        degradation: zod_1.z
            .number()
            .min(0, { message: 'Degradation rate must be between 0 and 10% per year' })
            .max(0.1, { message: 'Degradation rate must be between 0 and 10% per year' })
            .default(0.005),
        analysis_years: zod_1.z
            .number()
            .int({ message: 'Analysis period must be a whole number of years' })
            .min(1, { message: 'Analysis period must be at least 1 year' })
            .max(40, { message: 'Analysis period must be at most 40 years' })
            .default(25),
        discount_rate: zod_1.z
            .number()
            .min(0, { message: 'Discount rate must be between 0 and 100%' })
            .max(1, { message: 'Discount rate must be between 0 and 100%' })
            .default(0.06),
        price_escalation: zod_1.z
            .number()
            .min(0, { message: 'Price escalation cannot be negative' })
            .max(1, { message: 'Price escalation must be at most 100% per year' })
            .default(0)
    }),
    cost_model: zod_1.z
        .object({
        fixed_cost: zod_1.z.number().min(0),
        cost_per_kwp: zod_1.z.number().min(0)
    })
        .optional(),
    consumption: zod_1.z
        .object({
        annual_kwh: zod_1.z.number().min(0),
        daytime_fraction: zod_1.z.number().min(0).max(1)
    })
        .optional(),
    kwp_range: zod_1.z
        .tuple([zod_1.z.number().positive(), zod_1.z.number().positive(), zod_1.z.number().positive()])
        .optional()
});
