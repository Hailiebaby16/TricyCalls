const BASE_FARE = 25;
const PER_KM = 14;
const PER_MINUTE = 1.5;
const SERVICE_FEE = 5;

export function haversineKm(origin, destination) {
  const earthRadiusKm = 6371;
  const dLat = toRadians(destination.lat - origin.lat);
  const dLng = toRadians(destination.lng - origin.lng);
  const lat1 = toRadians(origin.lat);
  const lat2 = toRadians(destination.lat);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

export function calculateFare({ distanceKm, durationMinutes, source = 'LOCAL_ESTIMATE', routeCoordinates = [] }) {
  const billableDistanceKm = Math.max(0.4, distanceKm);
  const billableDurationMinutes = Math.max(3, durationMinutes);
  const fare = BASE_FARE + billableDistanceKm * PER_KM + billableDurationMinutes * PER_MINUTE + SERVICE_FEE;

  return {
    currency: 'PHP',
    distanceKm: Number(billableDistanceKm.toFixed(2)),
    fare: Math.ceil(fare),
    etaMinutes: Math.ceil(billableDurationMinutes),
    durationMinutes: Math.ceil(billableDurationMinutes),
    source,
    routeCoordinates
  };
}

export function estimateFare(origin, destination) {
  const distanceKm = haversineKm(origin, destination);
  return calculateFare({
    distanceKm,
    durationMinutes: distanceKm * 5,
    source: 'LOCAL_ESTIMATE'
  });
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}
