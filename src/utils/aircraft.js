export const metersToFeet = (value) => (Number.isFinite(value) ? value / 0.3048 : null);
export const metersPerSecondToKnots = (value) => (Number.isFinite(value) ? (value * 3600) / 1852 : null);
export const groundState = (value) => (value === true ? 'Ground (reported)' : value === false ? 'Airborne' : 'Unknown');
