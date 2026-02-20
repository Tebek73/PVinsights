"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const schema_1 = require("./schema");
const pvgis_1 = require("./pvgis");
const utils_1 = require("./utils");
const simulate_1 = require("./simulate");
dotenv_1.default.config(); //incarca variabilele din .env in process.env
const app = (0, express_1.default)(); // creeaza aplicatia express
app.use((0, cors_1.default)()); // permite trafic cross-origin
app.use(express_1.default.json()); // parseaza corpul request-urilor ca JSON
app.get('/api/health', (req, res) => {
    res.json({ ok: true });
});
const port = process.env.PORT || 3000;
app.post('/api/pv/analyze', async (req, res) => {
    const parsed = schema_1.AnalyzeSchema.safeParse(req.body); // valideaza inputul cu zod
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.format() });
    }
    const input = parsed.data;
    try {
        const pvcalcParams = {
            lat: input.lat,
            lon: input.lon,
            peakpower: input.peakpower_kwp,
            loss: input.loss_pct,
            usehorizon: input.usehorizon ? 1 : 0
        };
        if (input.optimalangles || input.tilt_deg === undefined || input.azimuth_from_north_deg === undefined) {
            pvcalcParams.optimalangles = 1;
        }
        else {
            pvcalcParams.angle = input.tilt_deg;
            pvcalcParams.aspect = (0, utils_1.azimuthFromNorthToPVGISAspect)((0, utils_1.num)(input.azimuth_from_north_deg));
        }
        const pvcalc = await (0, pvgis_1.callPVGIS)('PVcalc', pvcalcParams, input.radiation_database);
        res.json({ inputs: input, results: pvcalc });
    }
    catch (error) {
        console.error('Error in /api/pv/analyze:', error);
        res.status(502).json({ error: 'Internal server error, PVGIS call failed' });
    }
});
app.post('/api/simulate', async (req, res) => {
    const parsed = schema_1.SimulateSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.format() });
    }
    try {
        const result = await (0, simulate_1.runSimulation)(parsed.data);
        res.json(result);
    }
    catch (error) {
        console.error('Error in /api/simulate:', error);
        res.status(502).json({ error: 'Internal server error, PVGIS simulation failed' });
    }
});
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
