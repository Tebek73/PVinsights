"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.callPVGIS = callPVGIS;
exports.buildPVGISUrl = buildPVGISUrl;
// PVGIS API client: in-memory cache + rate limit + retry (429/529/5xx)
const axios_1 = __importDefault(require("axios"));
const bottleneck_1 = __importDefault(require("bottleneck"));
const lru_cache_1 = require("lru-cache");
const DEFAULT_TIMEOUT_MS = 30000;
const MAX_ATTEMPTS = 5;
//limitez rafala cereri la 4 simultane si minim 60ms intre ele (16 req/s) 
//asta e protectia de 20 req/s cat zice PVGIS ca e limita si care ar duce la error 429/529
const limiter = new bottleneck_1.default({ maxConcurrent: 4, minTime: 60 });
//cache in memorie pt rasp JSON
const memCache = new lru_cache_1.LRUCache({ max: 500, ttl: 1000 * 60 * 60 * 24 }); // max 500 intrari, fiecare valabila 24h
//determina url-ul api-ului PVGIS in functie de tool, alegand versiunea corecta
function baseUrl(tool, radiation_database) {
    const version = radiation_database === 'PVGIS-NSRDB' ? 'v5_2' : process.env.PVGIS_API_VERSION || 'v5_3';
    return `https://re.jrc.ec.europa.eu/api/${version}/${tool}`;
}
/*
    Normalizarea parametrilor:
    - booleeni -> 0/1 pt ca PVGIS ia valori numerice doar
    - eliminare parametrii undefined
    - adaug outputformat = json & browser = 0 (browser=1 da raspuns html, browser=0 da json)
*/
function buildQuery(params) {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v === undefined)
            continue; // sarim parametrii undefined
        if (typeof v === 'boolean')
            q.append(k, v ? '1' : '0'); // boolean -> 0/1
        else
            q.append(k, v.toString());
    }
    q.set("outputformat", "json");
    q.set("browser", "0");
    return q.toString();
}
// fetch: memory cache first, then API with retry on 429/529/5xx
async function fetchWithRetry(url) {
    const cached = memCache.get(url);
    if (cached) {
        return cached;
    }
    let attempt = 0;
    while (true) {
        try {
            const res = await limiter.schedule(() => axios_1.default.get(url, { timeout: DEFAULT_TIMEOUT_MS }));
            memCache.set(url, res.data);
            return res.data;
        }
        catch (error) {
            attempt++;
            const status = error.response?.status;
            const retriable = status === 429 || status === 529 || (status !== undefined && status >= 500 && status < 600);
            if (attempt < MAX_ATTEMPTS && retriable) {
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
async function callPVGIS(tool, params, radiation_database) {
    const finalParams = { ...params, raddatabase: radiation_database };
    const url = `${baseUrl(tool, radiation_database)}?${buildQuery(finalParams)}`;
    return await fetchWithRetry(url);
}
//helper - util la debug/loggin sau pentru a salva url ul exact in db pt comparatii
function buildPVGISUrl(tool, params, radiation_database) {
    const finalParams = { ...params, raddatabase: radiation_database };
    return `${baseUrl(tool, radiation_database)}?${buildQuery(finalParams)}`;
}
