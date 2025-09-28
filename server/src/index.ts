import express from 'express'; //adauga server http cu rute 
import cors from 'cors'; // permite trafic cross-origin(eu am frontend pe :4200 si backend pe :3000)
import dotenv from 'dotenv'; // pune configurari in .env(port, api keys, etc) ca sa nu hardcodezi in cod
import { AnalyzeSchema } from './schema'; // schema zod pt validare input
import { callPVGIS } from './pvgis';
import { getOrCreateLocation, createAnalysis, createSystem, listAnalyses } from './db/sqlite';
import { azimuthFromNorthToPVGISAspect, num } from './utils';

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
      useHorizon: input.usehorizon ? 1 : 0
    };

    if(input.optimalangles || input.tilt_deg === undefined || input.azimuth_from_north_deg === undefined) {
        pvcalcParams.optimalangles = 1;
    } else {
        pvcalcParams.angle = input.tilt_deg;
        pvcalcParams.aspect = azimuthFromNorthToPVGISAspect(num(input.azimuth_from_north_deg));
    }

    const pvcalc = await callPVGIS('PVcalc', pvcalcParams, input.radiation_database);

    const locId = getOrCreateLocation(input.lat, input.lon);
    const sysId = createSystem({
        peakpower_kwp: input.peakpower_kwp,
        loss_pct: input.loss_pct,
        tilt_deg: input.tilt_deg,
        azimuth_from_north_deg: input.azimuth_from_north_deg,
        optimalangles: input.optimalangles
    });
    const analysisId = createAnalysis(locId, sysId, input, pvcalc, {});

    res.json({ id: analysisId, inputs: input, results: pvcalc });
  }catch (error: any){
    console.error('Error in /api/pv/analyze:', error);
    res.status(502).json({ error: 'Internal server error, PVGIS call failed' });
  }
});

app.get('/api/pv/analyses', (req, res) => {
  res.json({ items: listAnalyses() });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});