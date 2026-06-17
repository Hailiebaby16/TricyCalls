import { drivers } from './data.js';
import { estimateRouteFare } from './osrm.js';
import { createHttpError } from './validation.js';

const rideStatuses = ['REQUESTED', 'ASSIGNED', 'PICKED_UP', 'COMPLETED', 'CANCELLED'];

export function createRideStore(now = () => new Date(), routeEstimator = estimateRouteFare) {
  const rides = [];

  function listRides() {
    return [...rides].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  function getRide(id) {
    const ride = rides.find(item => item.id === id);
    if (!ride) {
      throw createHttpError(404, 'RIDE_NOT_FOUND', 'Ride was not found');
    }
    return ride;
  }

  async function createRide(input) {
    if (input.pickup.name === input.dropoff.name) {
      throw createHttpError(422, 'VALIDATION_ERROR', 'Pickup and drop-off must be different');
    }

    const driver = drivers.find(item => item.status === 'AVAILABLE');
    const estimate = await routeEstimator(input.pickup, input.dropoff);
    const createdAt = now().toISOString();
    const ride = {
      id: `ride-${createdAt.replace(/\D/g, '')}-${rides.length + 1}`,
      status: driver ? 'ASSIGNED' : 'REQUESTED',
      passengerName: input.passengerName,
      pickup: input.pickup,
      dropoff: input.dropoff,
      notes: input.notes,
      driver: driver ?? null,
      fare: estimate.fare,
      currency: estimate.currency,
      distanceKm: estimate.distanceKm,
      etaMinutes: driver ? Math.max(driver.etaMinutes, estimate.etaMinutes) : estimate.etaMinutes,
      durationMinutes: estimate.durationMinutes,
      fareSource: estimate.source,
      routeCoordinates: estimate.routeCoordinates,
      createdAt,
      updatedAt: createdAt
    };

    rides.push(ride);
    return ride;
  }

  function updateRideStatus(id, status) {
    if (!rideStatuses.includes(status)) {
      throw createHttpError(422, 'VALIDATION_ERROR', 'Unsupported ride status');
    }

    const ride = getRide(id);
    ride.status = status;
    ride.updatedAt = now().toISOString();
    return ride;
  }

  return {
    listRides,
    getRide,
    createRide,
    updateRideStatus
  };
}
