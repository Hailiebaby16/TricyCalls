import { calculateFare, estimateFare } from './fare.js';

const defaultOsrmBaseUrl = 'https://router.project-osrm.org';

export async function estimateRouteFare(pickup, dropoff, options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const osrmBaseUrl = options.osrmBaseUrl ?? process.env.OSRM_BASE_URL ?? defaultOsrmBaseUrl;

  try {
    return await fetchOsrmRoute({ pickup, dropoff, osrmBaseUrl, fetchImpl });
  } catch {
    return estimateFare(pickup, dropoff);
  }
}

export async function fetchOsrmRoute({ pickup, dropoff, osrmBaseUrl = defaultOsrmBaseUrl, fetchImpl = fetch }) {
  const url = buildOsrmRouteUrl({ pickup, dropoff, osrmBaseUrl });
  const response = await fetchImpl(url);

  if (!response.ok) {
    throw new Error(`OSRM returned ${response.status}`);
  }

  const payload = await response.json();
  const route = payload?.routes?.[0];

  if (payload?.code !== 'Ok' || !route) {
    throw new Error(`OSRM route failed: ${payload?.code ?? 'UNKNOWN'}`);
  }

  if (!Number.isFinite(route.distance) || !Number.isFinite(route.duration)) {
    throw new Error('OSRM response was missing distance or duration');
  }

  const routeCoordinates = normalizeGeoJsonCoordinates(route.geometry?.coordinates);

  return calculateFare({
    distanceKm: route.distance / 1000,
    durationMinutes: route.duration / 60,
    source: 'OSRM',
    routeCoordinates
  });
}

export function buildOsrmRouteUrl({ pickup, dropoff, osrmBaseUrl = defaultOsrmBaseUrl }) {
  const base = osrmBaseUrl.replace(/\/$/, '');
  const coordinates = `${pickup.lng},${pickup.lat};${dropoff.lng},${dropoff.lat}`;
  const url = new URL(`${base}/route/v1/driving/${coordinates}`);

  url.searchParams.set('overview', 'full');
  url.searchParams.set('geometries', 'geojson');
  url.searchParams.set('steps', 'false');

  return url;
}

function normalizeGeoJsonCoordinates(coordinates) {
  if (!Array.isArray(coordinates)) {
    return [];
  }

  return coordinates
    .filter(point => Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1]))
    .map(([lng, lat]) => ({ lat, lng }));
}
