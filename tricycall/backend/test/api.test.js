import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from '../src/server.js';
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

test('API creates and lists rides', async () => {
  const server = createServer(createRideStore(() => new Date('2026-06-15T00:00:00.000Z'), routeEstimator));
  const baseUrl = await listen(server);

  try {
    const createResponse = await fetch(`${baseUrl}/api/rides`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passengerName: 'Ana', pickup, dropoff, notes: 'Front gate' })
    });
    const created = await createResponse.json();

    assert.equal(createResponse.status, 201);
    assert.equal(created.status, 'ASSIGNED');

    const listResponse = await fetch(`${baseUrl}/api/rides`);
    const list = await listResponse.json();

    assert.equal(listResponse.status, 200);
    assert.equal(list.data.length, 1);
    assert.equal(list.data[0].id, created.id);
  } finally {
    await close(server);
  }
});

test('API returns structured validation errors', async () => {
  const server = createServer(createRideStore());
  const baseUrl = await listen(server);

  try {
    const response = await fetch(`${baseUrl}/api/rides`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pickup, dropoff: pickup })
    });
    const body = await response.json();

    assert.equal(response.status, 422);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
  } finally {
    await close(server);
  }
});

function listen(server) {
  return new Promise(resolve => {
    server.listen(0, () => {
      const address = server.address();
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close(error => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}
