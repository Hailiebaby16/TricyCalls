import assert from 'node:assert/strict';
import test from 'node:test';
import { estimateFare } from '../src/fare.js';
import { createRideStore } from '../src/store.js';

const pickup = { name: 'Echague Town Center', lat: 16.7025, lng: 121.67833 };
const dropoff = { name: 'Isabela State University - Echague', lat: 16.7039, lng: 121.6846 };
const routeEstimator = async () => ({
  currency: 'PHP',
  fare: 57,
  distanceKm: 2.4,
  etaMinutes: 12,
  durationMinutes: 12,
  source: 'OSRM',
  routeCoordinates: [
    { lat: pickup.lat, lng: pickup.lng },
    { lat: dropoff.lat, lng: dropoff.lng }
  ]
});

test('estimateFare returns a PHP fare with distance and ETA', () => {
  const estimate = estimateFare(pickup, dropoff);

  assert.equal(estimate.currency, 'PHP');
  assert.ok(estimate.fare >= 30);
  assert.ok(estimate.distanceKm > 0);
  assert.ok(estimate.etaMinutes >= 3);
});

test('createRide assigns an available tricycle driver', async () => {
  const store = createRideStore(() => new Date('2026-06-15T00:00:00.000Z'), routeEstimator);

  const ride = await store.createRide({
    passengerName: 'Ana',
    pickup,
    dropoff,
    notes: 'Near the blue gate'
  });

  assert.equal(ride.status, 'ASSIGNED');
  assert.equal(ride.driver.name, 'Mario Santos');
  assert.equal(ride.pickup.name, 'Echague Town Center');
  assert.equal(ride.fareSource, 'OSRM');
  assert.equal(ride.routeCoordinates.length, 2);
  assert.equal(store.listRides().length, 1);
});

test('createRide rejects identical pickup and drop-off names', async () => {
  const store = createRideStore(() => new Date('2026-06-15T00:00:00.000Z'), routeEstimator);

  await assert.rejects(
    async () =>
      await store.createRide({
        passengerName: 'Ana',
        pickup,
        dropoff: pickup,
        notes: ''
      }),
    /Pickup and drop-off must be different/
  );
});

test('updateRideStatus validates status changes', async () => {
  const store = createRideStore(() => new Date('2026-06-15T00:00:00.000Z'), routeEstimator);
  const ride = await store.createRide({ passengerName: 'Ana', pickup, dropoff, notes: '' });

  assert.equal(store.updateRideStatus(ride.id, 'PICKED_UP').status, 'PICKED_UP');
  assert.throws(() => store.updateRideStatus(ride.id, 'UNKNOWN'), /Unsupported ride status/);
});
