import assert from 'node:assert/strict';
import test from 'node:test';
import { buildOsrmRouteUrl, estimateRouteFare, fetchOsrmRoute } from '../src/osrm.js';

const pickup = { name: 'Echague Town Center', lat: 16.7025, lng: 121.67833 };
const dropoff = { name: 'Isabela State University - Echague', lat: 16.7039, lng: 121.6846 };

test('fetchOsrmRoute converts OSRM distance and duration into tricycle fare', async () => {
  const fetchImpl = async url => {
    assert.equal(url.searchParams.get('overview'), 'full');
    assert.equal(url.searchParams.get('geometries'), 'geojson');

    return new Response(
      JSON.stringify({
        code: 'Ok',
        routes: [
          {
            distance: 2400,
            duration: 720,
            geometry: {
              type: 'LineString',
              coordinates: [
                [121.67833, 16.7025],
                [121.6846, 16.7039]
              ]
            }
          }
        ]
      }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
  };

  const estimate = await fetchOsrmRoute({ pickup, dropoff, osrmBaseUrl: 'https://osrm.test', fetchImpl });

  assert.equal(estimate.source, 'OSRM');
  assert.equal(estimate.distanceKm, 2.4);
  assert.equal(estimate.durationMinutes, 12);
  assert.deepEqual(estimate.routeCoordinates[0], { lat: 16.7025, lng: 121.67833 });
  assert.ok(estimate.fare > 50);
});

test('estimateRouteFare falls back when OSRM fails', async () => {
  const estimate = await estimateRouteFare(pickup, dropoff, {
    osrmBaseUrl: 'https://osrm.test',
    fetchImpl: async () => new Response(JSON.stringify({ code: 'NoRoute' }), { status: 200 })
  });

  assert.equal(estimate.source, 'LOCAL_ESTIMATE');
  assert.equal(estimate.currency, 'PHP');
});

test('buildOsrmRouteUrl uses lon-lat order and geojson geometry', () => {
  const url = buildOsrmRouteUrl({ pickup, dropoff, osrmBaseUrl: 'https://osrm.test/' });

  assert.equal(url.origin, 'https://osrm.test');
  assert.equal(url.pathname, '/route/v1/driving/121.67833,16.7025;121.6846,16.7039');
  assert.equal(url.searchParams.get('geometries'), 'geojson');
});
