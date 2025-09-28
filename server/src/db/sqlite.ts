import Database from 'better-sqlite3'; // sqlite simplu si rapid, fara dependinte native
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'data', 'app.db'); //calea catre fisierul sqlite
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true }); //creaza directorul daca nu exista

const db = new Database(DB_PATH); //deschide baza de date (sau o creeaza daca nu exista)
db.pragma('journal_mode = WAL'); //setari pentru performanta si siguranta
db.pragma('synchronous = NORMAL'); 
db.pragma('foreign_keys = ON'); 

/*
    inputs_json -> salveaza req complet asa cum a trecut de ZOD
    results_json -> salveaza raspunsul complet brut de la PVGIS
    derived_json -> salveaza date derivate de mine (ex: E_anual, E_monthly, etc)
*/

db.exec(`
CREATE TABLE IF NOT EXISTS locations(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lat REAL NOT NULL,
    lon REAL NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

create INDEX IF NOT EXISTS idx_locations_lat_lon ON locations(lat, lon);

CREATE TABLE IF NOT EXISTS systems(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    peakpower_kwp REAL NOT NULL,
    loss_pct REAL NOT NULL,
    tilt_deg REAL,
    azimuth_from_north_deg REAL,
    optimalangles INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS analyses(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    location_id INTEGER NOT NULL,
    system_id INTEGER NOT NULL,
    
    -- parametri cheie comparatii
    radiation_database TEXT,
    usehorizon INTEGER,
    startyear INTEGER,
    endyear INTEGER,

    -- flags (stocate si separat ca json complet la input)
    want_tmy INTEGER,
    want_monthly INTEGER,
    want_yearly INTEGER,
    want_daily INTEGER,
    want_horizon INTEGER,
    pv_timeseries INTEGER,
    components INTEGER,

    -- input complet (json dupa validare ZOD)
    input_json TEXT NOT NULL,

    -- payload de la PVGIS
    results_json TEXT NOT NULL,

    -- valori derivate calculate de mine (ex: E_anual, E_monthly, etc)
    derived_json TEXT,

    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (location_id) REFERENCES locations(id),
    FOREIGN KEY (system_id) REFERENCES systems(id)
);

CREATE TABLE IF NOT EXISTS api_cache(
    url TEXT PRIMARY KEY,
    json TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    last_hit_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`);

// --- API CACHE ---

export function upsertApiCache(url: string, json: any) {
    //db.prepare ce face mai exact este ca pregateste o instructiune SQL pentru executare ulterioara
    db.prepare(`
        INSERT INTO api_cache (url, json) VALUES (?, ?)
        ON CONFLICT(url) DO UPDATE SET json=excluded.json, last_hit_at=CURRENT_TIMESTAMP
    `).run(url, JSON.stringify(json));
}

export function getApiCache(url: string): any | null {
    const row = db.prepare('SELECT json FROM api_cache WHERE url = ?').get(url) as { json: string } | undefined;
    return row ? JSON.parse(row.json) : null;
}

// --- LOCATIONS ---

export function getOrCreateLocation(lat: number, lon: number): number {
    const row = db.prepare('SELECT id FROM locations WHERE lat = ? AND lon = ?').get(lat, lon) as { id: number } | undefined;
    if (row) {
        return row.id as number;
    }
    return db.prepare('INSERT INTO locations (lat, lon) VALUES (?, ?)').run(lat, lon).lastInsertRowid as number;
}

export function createSystem(p: {
    peakpower_kwp: number;
    loss_pct: number;
    tilt_deg?: number;
    azimuth_from_north_deg?: number;
    optimalangles?: boolean;
}): number {
    return db.prepare(`
        INSERT INTO systems (peakpower_kwp, loss_pct, tilt_deg, azimuth_from_north_deg, optimalangles)
        VALUES (?, ?, ?, ?, ?)
    `).run(
        p.peakpower_kwp,
        p.loss_pct,
        p.tilt_deg ?? null,
        p.azimuth_from_north_deg ?? null,
        p.optimalangles ? 1 : 0
    ).lastInsertRowid as number;
}

export function createAnalysis(
    location_id: number,
    system_id: number,
    inputs: any,
    results: any,
    derived: any
): number {
    const stmt = db.prepare(`
        INSERT INTO analyses (
            location_id, system_id,
            radiation_database, usehorizon, startyear, endyear,
            want_tmy, want_monthly, want_yearly, want_daily, want_horizon,
            pv_timeseries, components,
            input_json, results_json, derived_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    return stmt.run(
        location_id,
        system_id,
        inputs.radiation_database ?? null,
        inputs.usehorizon ? 1 : 0,
        inputs.startyear ?? null,
        inputs.endyear ?? null,
        inputs.want_tmy ? 1 : 0,
        inputs.want_monthly ? 1 : 0,
        inputs.want_yearly ? 1 : 0,
        inputs.want_daily ? 1 : 0,
        inputs.want_horizon ? 1 : 0,
        inputs.pv_timeseries ? 1 : 0,
        inputs.components ? 1 : 0,
        JSON.stringify(inputs),
        JSON.stringify(results),
        JSON.stringify(derived)
    ).lastInsertRowid as number;
}

export function listAnalyses(limit = 25) {
    return db.prepare(`
        SELECT a.id, a.created_at, l.lat, l.lon, s.peakpower_kwp, s.loss_pct, s.tilt_deg, s.azimuth_from_north_deg, s.optimalangles,
               a.radiation_database, a.usehorizon, a.startyear, a.endyear,
               a.want_tmy, a.want_monthly, a.want_yearly, a.want_daily, a.want_horizon,
               a.pv_timeseries, a.components
        FROM analyses a
        JOIN locations l ON l.id = a.location_id
        JOIN systems s ON s.id = a.system_id
        ORDER BY a.id DESC
        LIMIT ?
    `).all(limit);
}