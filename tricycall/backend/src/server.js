import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { URL } from 'node:url';
import { barangays, drivers } from './data.js';
import { createMongoRideStore } from './mongoStore.js';
import { estimateRouteFare } from './osrm.js';
import { createRealtimeHub, sendExpoPush } from './realtime.js';
import { createRideStore } from './store.js';
import { createHttpError, parseJsonBody, validateLocation, validateRideRequest } from './validation.js';

loadEnvFiles();

const port = Number(process.env.PORT ?? 4000);
const store = createRideStore();

export function createServer(rideStore = store) {
  const realtime = createRealtimeHub();
  const server = http.createServer(async (req, res) => {
    try {
      await route(req, res, rideStore, realtime);
    } catch (error) {
      sendError(res, error);
    }
  });
  realtime.attach(server);
  return server;
}

async function route(req, res, rideStore, realtime) {
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
    sendJson(res, 200, { data: rideStore.listDrivers ? await rideStore.listDrivers() : drivers });
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
    sendJson(res, 200, { data: await rideStore.listRides() });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/rides') {
    const body = await parseJsonBody(req);
    const ride = await rideStore.createRide(validateRideRequest(body));
    await notifyRideOffer(rideStore, realtime, ride);
    realtime.notifyAdmins('ride.created', ride);
    sendJson(res, 201, ride);
    return;
  }

  const rideMatch = url.pathname.match(/^\/api\/rides\/([^/]+)$/);
  if (rideMatch && req.method === 'GET') {
    sendJson(res, 200, await rideStore.getRide(rideMatch[1]));
    return;
  }

  if (rideMatch && req.method === 'PATCH') {
    const body = await parseJsonBody(req);
    sendJson(res, 200, await rideStore.updateRideStatus(rideMatch[1], body.status));
    return;
  }

  if (rideMatch && req.method === 'POST' && url.pathname.endsWith('/accept')) {
    const body = await parseJsonBody(req);
    const ride = await rideStore.acceptRide(rideMatch[1], body.driverId);
    realtime.notifyAdmins('ride.accepted', ride);
    sendJson(res, 200, ride);
    return;
  }

  if (rideMatch && req.method === 'POST' && url.pathname.endsWith('/reject')) {
    const body = await parseJsonBody(req);
    const ride = await rideStore.rejectRide(rideMatch[1], body.driverId);
    await notifyRideOffer(rideStore, realtime, ride);
    realtime.notifyAdmins('ride.rejected', ride);
    sendJson(res, 200, ride);
    return;
  }

  const acceptMatch = url.pathname.match(/^\/api\/rides\/([^/]+)\/accept$/);
  if (acceptMatch && req.method === 'POST') {
    const body = await parseJsonBody(req);
    const ride = await rideStore.acceptRide(acceptMatch[1], body.driverId);
    realtime.notifyAdmins('ride.accepted', ride);
    sendJson(res, 200, ride);
    return;
  }

  const rejectMatch = url.pathname.match(/^\/api\/rides\/([^/]+)\/reject$/);
  if (rejectMatch && req.method === 'POST') {
    const body = await parseJsonBody(req);
    const ride = await rideStore.rejectRide(rejectMatch[1], body.driverId);
    await notifyRideOffer(rideStore, realtime, ride);
    realtime.notifyAdmins('ride.rejected', ride);
    sendJson(res, 200, ride);
    return;
  }

  const driverLocationMatch = url.pathname.match(/^\/api\/drivers\/([^/]+)\/location$/);
  if (driverLocationMatch && req.method === 'POST') {
    const body = await parseJsonBody(req);
    const queueStatus = await rideStore.updateDriverLocation(driverLocationMatch[1], body);
    realtime.notifyAdmins('queue.updated', queueStatus);
    sendJson(res, 200, queueStatus);
    return;
  }

  const driverTodaMatch = url.pathname.match(/^\/api\/drivers\/([^/]+)\/toda$/);
  if (driverTodaMatch && req.method === 'GET') {
    sendJson(res, 200, await rideStore.getDriverToda(driverTodaMatch[1]));
    return;
  }

  const driverQueueMatch = url.pathname.match(/^\/api\/drivers\/([^/]+)\/queue$/);
  if (driverQueueMatch && req.method === 'GET') {
    sendJson(res, 200, await rideStore.getDriverQueueStatus(driverQueueMatch[1]));
    return;
  }

  if (driverQueueMatch && req.method === 'DELETE') {
    sendJson(res, 200, await rideStore.leaveQueue(driverQueueMatch[1]));
    return;
  }

  const pushMatch = url.pathname.match(/^\/api\/drivers\/([^/]+)\/push-token$/);
  if (pushMatch && req.method === 'POST') {
    const body = await parseJsonBody(req);
    sendJson(res, 200, await rideStore.setDriverPushToken(pushMatch[1], body.pushToken));
    return;
  }

  if (url.pathname === '/api/todas' && req.method === 'GET') {
    sendJson(res, 200, { data: await rideStore.listTodas() });
    return;
  }

  if (url.pathname === '/api/todas' && req.method === 'POST') {
    const body = await parseJsonBody(req);
    sendJson(res, 201, await rideStore.createToda(body));
    return;
  }

  const todaMatch = url.pathname.match(/^\/api\/todas\/([^/]+)$/);
  if (todaMatch && req.method === 'GET') {
    sendJson(res, 200, await rideStore.getToda(todaMatch[1]));
    return;
  }

  if (todaMatch && req.method === 'PATCH') {
    const body = await parseJsonBody(req);
    sendJson(res, 200, await rideStore.updateToda(todaMatch[1], body));
    return;
  }

  if (todaMatch && req.method === 'DELETE') {
    sendJson(res, 200, await rideStore.disableToda(todaMatch[1]));
    return;
  }

  const todaDriverMatch = url.pathname.match(/^\/api\/todas\/([^/]+)\/drivers\/([^/]+)$/);
  if (todaDriverMatch && req.method === 'POST') {
    sendJson(res, 200, await rideStore.assignDriverToToda(todaDriverMatch[1], todaDriverMatch[2]));
    return;
  }

  if (todaDriverMatch && req.method === 'DELETE') {
    sendJson(res, 200, await rideStore.removeDriverFromToda(todaDriverMatch[1], todaDriverMatch[2]));
    return;
  }

  const todaQueueMatch = url.pathname.match(/^\/api\/todas\/([^/]+)\/queue$/);
  if (todaQueueMatch && req.method === 'GET') {
    sendJson(res, 200, { data: await rideStore.getTodaQueue(todaQueueMatch[1]) });
    return;
  }

  throw createHttpError(404, 'NOT_FOUND', 'Route was not found');
}

async function notifyRideOffer(rideStore, realtime, ride) {
  if (ride.status !== 'OFFERED' || !ride.offer?.driverId) {
    return;
  }

  realtime.notifyDriver(ride.offer.driverId, 'ride.offered', ride);
  const driver = (await rideStore.listDrivers?.())?.find(item => item.id === ride.offer.driverId);
  await sendExpoPush(driver?.pushToken, 'New Tricycall booking', `${ride.pickup.name} to ${ride.dropoff.name}`, {
    rideId: ride.id
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
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

if (process.argv[1] && fileURLToPath(import.meta.url).toLowerCase() === path.resolve(process.argv[1]).toLowerCase()) {
  startServer().catch(error => {
    console.error(error);
    process.exit(1);
  });
}

export async function createConfiguredStore(env = process.env) {
  if (env.MONGODB_URI) {
    return await createMongoRideStore({
      uri: env.MONGODB_URI,
      dbName: env.MONGODB_DB_NAME ?? 'tricycall'
    });
  }

  return createRideStore();
}

async function startServer() {
  const rideStore = await createConfiguredStore();
  const server = createServer(rideStore);

  server.listen(port, () => {
    const database = process.env.MONGODB_URI ? 'MongoDB' : 'in-memory store';
    console.log(`Tricycall backend listening on http://localhost:${port} using ${database}`);
  });

  process.on('SIGINT', async () => {
    await rideStore.close?.();
    server.close(() => process.exit(0));
  });
}

function loadEnvFiles() {
  const currentFile = fileURLToPath(import.meta.url);
  const backendEnvPath = path.resolve(path.dirname(currentFile), '..', '.env');
  const rootEnvPath = path.resolve(path.dirname(currentFile), '..', '..', '..', '.env');

  for (const envPath of [rootEnvPath, backendEnvPath]) {
    if (!fs.existsSync(envPath)) {
      continue;
    }

    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      const match = trimmed.match(/^(?:\$env:)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match) {
        continue;
      }

      const key = match[1];
      const value = unquoteEnvValue(match[2].trim());
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
}

function unquoteEnvValue(value) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  return value;
}
