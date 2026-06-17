import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { URL } from 'node:url';
import { barangays, drivers } from './data.js';
import { estimateRouteFare } from './osrm.js';
import { createRideStore } from './store.js';
import { createHttpError, parseJsonBody, validateLocation, validateRideRequest } from './validation.js';

const port = Number(process.env.PORT ?? 4000);
const store = createRideStore();

export function createServer(rideStore = store) {
  return http.createServer(async (req, res) => {
    try {
      await route(req, res, rideStore);
    } catch (error) {
      sendError(res, error);
    }
  });
}

async function route(req, res, rideStore) {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

  if (req.method === 'OPTIONS') {
    sendJson(res, 204, null);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/health') {
    sendJson(res, 200, { status: 'ok', service: 'tricycall-backend' });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/locations') {
    sendJson(res, 200, { data: barangays });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/drivers') {
    sendJson(res, 200, { data: drivers });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/fare-estimates') {
    const body = await parseJsonBody(req);
    const pickup = validateLocation(body.pickup, 'pickup');
    const dropoff = validateLocation(body.dropoff, 'dropoff');
    sendJson(res, 200, await estimateRouteFare(pickup, dropoff));
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/rides') {
    sendJson(res, 200, { data: rideStore.listRides() });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/rides') {
    const body = await parseJsonBody(req);
    const ride = await rideStore.createRide(validateRideRequest(body));
    sendJson(res, 201, ride);
    return;
  }

  const rideMatch = url.pathname.match(/^\/api\/rides\/([^/]+)$/);
  if (rideMatch && req.method === 'GET') {
    sendJson(res, 200, rideStore.getRide(rideMatch[1]));
    return;
  }

  if (rideMatch && req.method === 'PATCH') {
    const body = await parseJsonBody(req);
    sendJson(res, 200, rideStore.updateRideStatus(rideMatch[1], body.status));
    return;
  }

  throw createHttpError(404, 'NOT_FOUND', 'Route was not found');
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  });

  if (status === 204) {
    res.end();
    return;
  }

  res.end(JSON.stringify(payload));
}

function sendError(res, error) {
  const status = Number.isInteger(error.status) ? error.status : 500;
  const code = error.code ?? 'INTERNAL_ERROR';
  const message = status === 500 ? 'Internal server error' : error.message;

  sendJson(res, status, {
    error: {
      code,
      message,
      details: error.details
    }
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  createServer().listen(port, () => {
    console.log(`Tricycall backend listening on http://localhost:${port}`);
  });
}
