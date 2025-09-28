//CLIENT PVGIS, cu cache hibrid (memorie + sqlite) si retry
// deoarece poate raspunde 429/529 iar multe cereri se repeta, scop protectie + performanta
import axios from 'axios'; // pentru cereri http
import Bottleneck from 'bottleneck'; // pentru rate limiting si retry
import {LRUCache} from 'lru-cache'; // pentru cache in memorie
 import { getApiCache , upsertApiCache } from './db/sqlite';

type PVGISTool = 'PVcalc' // simulare productie pe luna/an
                | `seriescalc` // radiatie si productie PV orara -> grafice si analize detaliate
                | `tmy`  // typical meteorological year pt simulari avansate/export EPW (EnergyPlus Weather)
                | `MRcalc` // radiatie lunara pe plan -> pt validare / analiza resursa solara
                | `DRcalc` // radiatie zilnica pe plan -> pt validare / analiza resursa solara
                | `printhorizon` ; // profilul orizontului(umbrire orografica, pentru analize care tin cont de cladiri, munti) -> posibil sa il folosesc, nu stiu momentan

type QueryParams = Record<string, string | number | boolean | undefined>;

const DEFAULT_TIMEOUT_MS = 30000;
const MAX_ATTEMPTS = 5;

//limitez rafala cereri la 4 simultane si minim 60ms intre ele (16 req/s) 
//asta e protectia de 20 req/s cat zice PVGIS ca e limita si care ar duce la error 429/529
const limiter = new Bottleneck({ maxConcurrent: 4, minTime: 60});

//cache in memorie pt rasp JSON
const memCache = new LRUCache<string, any>({ max: 500, ttl: 1000 * 60 * 60 * 24 }); // max 500 intrari, fiecare valabila 24h

//determina url-ul api-ului PVGIS in functie de tool, alegand versiunea corecta
function baseUrl(tool: PVGISTool, radiation_database?: string) {
    const version = radiation_database === 'PVGIS-NSRDB' ? 'v5_2' : process.env.PVGIS_API_VERSION || 'v5_3';
    return `https://re.jrc.ec.europa.eu/api/${version}/${tool}`;
}

/*
    Normalizarea parametrilor:
    - booleeni -> 0/1 pt ca PVGIS ia valori numerice doar
    - eliminare parametrii undefined
    - adaug outputformat = json & browser = 0 (browser=1 da raspuns html, browser=0 da json)
*/
function buildQuery(params: QueryParams){
    const q = new URLSearchParams();

    for(const [k, v] of Object.entries(params)) {
        if(v === undefined) continue; // sarim parametrii undefined
        if(typeof v === 'boolean') q.append(k, v ? '1' : '0'); // boolean -> 0/1
        else q.append(k, v.toString());
    }

    q.set("outputformat", "json");
    q.set("browser", "0"); 
    return q.toString();
}

// fetch cu 1) cache memorie, 2) cache sqlite, 3) retry la 429/529/5xx
async function fetchWithRetry(url: string): Promise<any> {

    const hitMem = memCache.get(url);
    if(hitMem) {
        console.log(`PVGIS cache memorie HIT: ${url}`);
        return hitMem;
    }

    const hitDb = getApiCache(url);
    if(hitDb) {
        console.log(`PVGIS cache DB HIT: ${url}`);
        memCache.set(url, hitDb); //populam si cache in memorie
        return hitDb;
    }

    let attempt = 0;
    while(true){
        try{
            const res = await limiter.schedule(() => 
                axios.get(url, { timeout: DEFAULT_TIMEOUT_MS })
            );
            memCache.set(url, res.data);
            upsertApiCache(url, res.data);
            return res.data;

        } catch (error: any) {
            attempt++;
            const status = error.response?.status as number | undefined;

            const retriable = status === 429 || status === 529 || (status !== undefined && status >= 500 && status < 600);

            if(attempt < MAX_ATTEMPTS && retriable){
                const backoff = Math.min(1000 * 2 ** attempt, 10000); //exponential backoff, max 10s
                await new Promise(res => setTimeout(res, backoff));
                console.log(`PVGIS retrying ${url}, attempt ${attempt}, status ${status}`);
                continue;
            }
            
            console.log(`PVGIS failed ${url}, attempt ${attempt}, status ${status}`);
            throw error;

        }
    }
}

/*
    callPVGIS cu tool-ul si parametrii dati -> returneaza raspunsul JSON de la PVGIS -> singura poarta catre API
    @param tool ex: 'PVcalc', 'seriescalc', etc
    @param params obiect cu parametrii query (vezi schema.ts pentru detalii)
    @param radiation_database una din PVGIS-SARAH3, PVGIS-ERA5, PVGIS-NSRDB, PVGIS-CMSAF (optional, default PVGIS-SARAH3)

    nota: - toti parametrii sunt validati in schema.ts inainte de a ajunge aici
          - daca radiation_database e PVGIS-NSRDB, se foloseste versiunea v5_2 a API-ului (restul v5_3)
          - API asteapta param raddatabase eu il primesc radiation_database dar aici il mapez
*/

export async function callPVGIS(tool: PVGISTool, params: QueryParams, radiation_database?: string): Promise<any> {
    const finalParams = { ...params , raddatabase: radiation_database };

    const url = `${baseUrl(tool, radiation_database)}?${buildQuery(finalParams)}`;
    return await fetchWithRetry(url);
}

//helper - util la debug/loggin sau pentru a salva url ul exact in db pt comparatii
export function buildPVGISUrl(tool: PVGISTool, params: QueryParams, radiation_database?: string): string {
    const finalParams = { ...params , raddatabase: radiation_database };
    return `${baseUrl(tool, radiation_database)}?${buildQuery(finalParams)}`;
}