import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { AnalyzeSchema, SimulateSchema } from './schema';
import { callPVGIS } from './pvgis';
import { azimuthFromNorthToPVGISAspect, num } from './utils';
import { runSimulation } from './simulate';

dotenv.config(); //incarca variabilele din .env in process.env

const app = express(); // creeaza aplicatia express
app.use(cors()); // permite trafic cross-origin
app.use(express.json()); // parseaza corpul request-urilor ca JSON

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

const port = process.env.PORT || 3000;

app.post('/api/pv/analyze', async (req, res) => {
  const parsed = AnalyzeSchema.safeParse(req.body); // valideaza inputul cu zod
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.format() }); 
  }

  const input = parsed.data;

  try{

    const pvcalcParams: Record<string, any> = {
      lat: input.lat,
      lon: input.lon,
      peakpower: input.peakpower_kwp,
      loss: input.loss_pct,
      usehorizon: input.usehorizon ? 1 : 0
    };

    if(input.optimalangles || input.tilt_deg === undefined || input.azimuth_from_north_deg === undefined) {
        pvcalcParams.optimalangles = 1;
    } else {
        pvcalcParams.angle = input.tilt_deg;
        pvcalcParams.aspect = azimuthFromNorthToPVGISAspect(num(input.azimuth_from_north_deg));
    }

    const pvcalc = await callPVGIS('PVcalc', pvcalcParams, input.radiation_database);

    res.json({ inputs: input, results: pvcalc });
  }catch (error: any){
    console.error('Error in /api/pv/analyze:', error);
    res.status(502).json({ error: 'Internal server error, PVGIS call failed' });
  }
});

app.post('/api/simulate', async (req, res) => {
  const parsed = SimulateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.format() });
  }

  try {
    const result = await runSimulation(parsed.data);
    res.json(result);
  } catch (error: any) {
    console.error('Error in /api/simulate:', error);
    res.status(502).json({ error: 'Internal server error, PVGIS simulation failed' });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});