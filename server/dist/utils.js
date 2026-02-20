"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.azimuthFromNorthToPVGISAspect = azimuthFromNorthToPVGISAspect;
exports.num = num;
exports.getMonthlyArray = getMonthlyArray;
// Conversie azimut din 0=N, 
function azimuthFromNorthToPVGISAspect(azimuth_from_north_deg) {
    let a = azimuth_from_north_deg - 180;
    if (a > 180)
        a -= 360;
    if (a < -180)
        a += 360;
    return a;
}
function num(x) {
    const n = Number(x);
    return Number.isFinite(n) ? n : 0;
}
function getMonthlyArray(pvcalc) {
    return pvcalc?.outputs?.monthly?.fixed ?? pvcalc?.outputs?.monthly ?? [];
}
