
// Conversie azimut din 0=N, 
export function azimuthFromNorthToPVGISAspect(azimuth_from_north_deg: number): number {
    let a = azimuth_from_north_deg - 180;
    if(a > 180) a -= 360;
    if(a < -180) a += 360;
    return a;
}

export function num(x: unknown): number {
    const n = Number(x);
    return Number.isFinite(n) ? n : 0;
}