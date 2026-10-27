// Validate on the Worker even when the browser client has already validated.
export function validateQuery(searchParams, route) {
  const params = new URLSearchParams();
  for (const [key, value] of searchParams) {
    if (!route.params.includes(key) || params.has(key)) {
      throw 400;
    }
    params.set(key, value);
  }

  if (route.endpoint === 'flights') {
    const parts = params.get('bbox')?.split(',');
    if (!parts || parts.length !== 4 || parts.some((part) =>
      !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(part.trim()))) {
      throw 400;
    }
    const bounds = parts.map(Number);
    const [south, west, north, east] = bounds;
    if (!bounds.every(Number.isFinite) || south < -90 || north > 90 ||
        west < -180 || east > 180 || south >= north || west >= east) {
      throw 400;
    }
    params.set('bbox', bounds.join(','));
    if (params.has('zoom')) {
      const zoom = params.get('zoom');
      if (!/^\d+$/.test(zoom) || Number(zoom) > 11) {
        throw 400;
      }
      params.set('zoom', String(Number(zoom)));
    }
  } else if (route.endpoint === 'flight') {
    if (params.size !== 1) {
      throw 400;
    }
    const key = params.keys().next().value;
    const code = params.get(key).trim().toUpperCase();
    if (!/^[A-Z0-9]{3,10}$/.test(code)) {
      throw 400;
    }
    params.set(key, code);
  } else if (params.has('country_code')) {
    const country = params.get('country_code').trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(country)) {
      throw 400;
    }
    params.set('country_code', country);
  }
  return params;
}
