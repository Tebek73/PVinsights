//bodyguard for the typescript schema validating at runtime if the data is correct
// de exemplu daca primesc de la pvgis un json cu un camp in plus fata de ce ma asteptam, zod o sa arunce eroare
import { start } from 'repl';
import { z } from 'zod';

export const AnalyzeSchema = z.object({
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),

    // Sistem PV

    peakpower_kwp: z.number().positive().max(1000), // puterea de varf a sistemului PV in kWp
    loss_pct: z.number().min(0).max(80).default(14), // pierderi in procente (daca nu e dat, se folosesc 14%)

    // Geometrie (ori tilt+azimuth, ori optimalangles)

    tilt_deg: z.number().min(0).max(90).optional(), // unghiul de inclinare al panourilor in grade (0=orizontal, 90=vertical)
    azimuth_from_north_deg: z.number().min(0).max(360).optional(), // azimutul din nord in grade (0=nord, 90=est, 180=sud, 270=vest)
    optimalangles: z.boolean().default(false), // daca e true, se ignora tilt_deg si azimuth_from_north_deg si se calculeaza unghiurile optime

    // Baza de radiatie + orizont

    usehorizon: z.boolean().default(true), // daca e true, se foloseste orizontul local (daca exista)
    radiation_database: z.enum(['PVGIS-SARAH3', 'PVGIS-ERA5', 'PVGIS-NSRDB', 'PVGIS-CMSAF']).optional(), // baza de date de radiatie (daca nu e data, se foloseste PVGIS-SARAH3)

    // Serii orare

    pv_timeseries: z.boolean().default(true), // daca e true, se returneaza si seriile orare de productie PV
    components: z.boolean().default(true), // daca e true, se returneaza si componentele de radiatie (G(i), Gb(i), Gd(i), GT(i), etc)
    startyear: z.number().int().min(2005).max(2020).optional(), // anul de start pentru seriile orare (daca nu e dat, se foloseste 2019)
    endyear: z.number().int().min(2005).max(2020).optional(), // anul de sfarsit pentru seriile orare (daca nu e dat, se foloseste 2019)

    // Alte optiuni si seturi de date

    want_tmy: z.boolean().default(true), // daca e true, se returneaza si un an tipic meteorologic (TMY)
    want_monthly: z.boolean().default(true), // daca e true, se returneaza si productia lunara
    want_yearly: z.boolean().default(false), // daca e true, se returneaza si productia anuala
    want_daily: z.boolean().default(false), // daca e true, se returneaza si productia zilnica
    want_horizon: z.boolean().default(false) // daca e true, se returneaza si orizontul local (daca exista)
});
