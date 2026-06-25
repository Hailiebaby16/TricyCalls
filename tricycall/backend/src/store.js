import { drivers as seedDrivers, todas as seedTodas } from './data.js';
import { getDistanceMeters, isInsideRadius, isPointInsidePolygon } from './geofence.js';
import { estimateRouteFare } from './osrm.js';
import { createHttpError } from './validation.js';

const rideStatuses = ['REQUESTED', 'OFFERED', 'ASSIGNED', 'PICKED_UP', 'COMPLETED', 'CANCELLED'];
const queueStatuses = ['waiting', 'assigned', 'exited', 'expired'];
const nearPickupMeters = 1500;

export function createRideStore(now = () => new Date(), routeEstimator = estimateRouteFare, initialState = {}) {
  const rides = (initialState.rides ?? []).map(ride => structuredClone(ride));
  const todas = (initialState.todas ?? seedTodos()).map(toda => structuredClone(toda));
  const drivers = (initialState.drivers ?? seedDrivers.map(driver => ({ ...driver, lastLocation: null, pushToken: null, isOnline: true }))).map(driver => ({ ...driver }));
  const queueRecords = (initialState.queueRecords ?? []).map(record => structuredClone(record));

  function listRides() {
    expireStaleOffers();
    return [...rides].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  function getRide(id) {
    expireStaleOffers();
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

    const estimate = await routeEstimator(input.pickup, input.dropoff);
    const createdAt = now().toISOString();
    const dispatch = buildDispatch(input.pickup);
    const offeredDriver = dispatch.candidates[0] ?? null;
    const ride = {
      id: `ride-${createdAt.replace(/\D/g, '')}-${rides.length + 1}`,
      status: offeredDriver ? 'OFFERED' : 'REQUESTED',
      passengerName: input.passengerName,
      pickup: input.pickup,
      dropoff: input.dropoff,
      notes: input.notes,
      driver: offeredDriver ?? null,
      todaId: dispatch.toda?.id ?? null,
      dispatchSource: dispatch.source,
      offer: offeredDriver
        ? createOffer(dispatch.toda, offeredDriver, dispatch.candidates.map(driver => driver.id), 0)
        : null,
      rejectedDriverIds: [],
      fare: estimate.fare,
      currency: estimate.currency,
      distanceKm: estimate.distanceKm,
      etaMinutes: offeredDriver ? Math.max(offeredDriver.etaMinutes, estimate.etaMinutes) : estimate.etaMinutes,
      durationMinutes: estimate.durationMinutes,
      fareSource: estimate.source,
      routeCoordinates: estimate.routeCoordinates,
      createdAt,
      updatedAt: createdAt
    };

    rides.push(ride);
    if (offeredDriver) {
      markDriverQueueAssigned(offeredDriver.id, ride.id);
    }
    return ride;
  }

  function updateRideStatus(id, status) {
    if (!rideStatuses.includes(status)) {
      throw createHttpError(422, 'VALIDATION_ERROR', 'Unsupported ride status');
    }

    const ride = getRide(id);
    ride.status = status;
    ride.updatedAt = now().toISOString();

    if (['ASSIGNED', 'PICKED_UP', 'COMPLETED', 'CANCELLED'].includes(status)) {
      ride.offer = null;
    }
    if (['COMPLETED', 'CANCELLED'].includes(status) && ride.driver?.id) {
      clearAssignedQueue(ride.driver.id, ride.id, status === 'COMPLETED' ? 'exited' : 'expired');
    }
    return ride;
  }

  function acceptRide(id, driverId) {
    const ride = getRide(id);
    ensurePendingOfferForDriver(ride, driverId);
    ride.status = 'ASSIGNED';
    ride.driver = findDriver(driverId);
    ride.offer = null;
    ride.updatedAt = now().toISOString();
    markDriverQueueAssigned(driverId, ride.id);
    return ride;
  }

  function rejectRide(id, driverId) {
    const ride = getRide(id);
    ensurePendingOfferForDriver(ride, driverId);
    ride.rejectedDriverIds = [...new Set([...(ride.rejectedDriverIds ?? []), driverId])];
    clearAssignedQueue(driverId, ride.id, 'expired');
    offerNextDriver(ride);
    return ride;
  }

  function expireStaleOffers() {
    for (const ride of rides) {
      if (ride.status === 'OFFERED' && ride.offer?.expiresAt && ride.offer.expiresAt <= now().toISOString()) {
        ride.rejectedDriverIds = [...new Set([...(ride.rejectedDriverIds ?? []), ride.offer.driverId])];
        clearAssignedQueue(ride.offer.driverId, ride.id, 'expired');
        offerNextDriver(ride);
      }
    }
  }

  function listDrivers() {
    return drivers.map(driver => ({ ...driver }));
  }

  function updateDriverLocation(driverId, input) {
    const driver = findDriver(driverId);
    const location = validatePoint(input);
    driver.lastLocation = location;
    driver.isOnline = input.isOnline !== false;
    driver.updatedAt = now().toISOString();

    if (!driver.isOnline) {
      exitActiveDriverQueue(driverId, 'exited');
      return getDriverQueueStatus(driverId);
    }

    const toda = getDriverToda(driverId);
    if (!toda) {
      return getDriverQueueStatus(driverId);
    }

    const insideQueue = isInsideRadius(location, geoJsonPointToLatLng(toda.queueZone.center), toda.queueZone.radiusMeters);
    const activeQueue = getActiveQueueRecord(driverId);

    if (!insideQueue && activeQueue) {
      activeQueue.status = 'exited';
      activeQueue.exitedAt = now().toISOString();
      activeQueue.updatedAt = now().toISOString();
    }

    if (insideQueue && input.joinQueue === true && !activeQueue) {
      addQueueRecord(toda.id, driverId, location);
    }

    return getDriverQueueStatus(driverId);
  }

  function leaveQueue(driverId) {
    findDriver(driverId);
    exitActiveDriverQueue(driverId, 'exited');
    return getDriverQueueStatus(driverId);
  }

  function getDriverToda(driverId) {
    const driver = findDriver(driverId);
    const assignedToda = todas.find(toda => toda.active && toda.assignedDriverIds.includes(driver.id));
    return assignedToda ? structuredClone(assignedToda) : null;
  }

  function getDriverQueueStatus(driverId) {
    const driver = findDriver(driverId);
    const toda = getDriverToda(driverId);
    const activeQueue = getActiveQueueRecord(driverId);
    const queue = toda ? getTodaQueue(toda.id) : [];
    const queuePosition = activeQueue ? queue.findIndex(item => item.driverId === driverId) + 1 : null;
    const insideQueueZone =
      Boolean(toda && driver.lastLocation) &&
      isInsideRadius(driver.lastLocation, geoJsonPointToLatLng(toda.queueZone.center), toda.queueZone.radiusMeters);

    return {
      driverId,
      toda,
      status: activeQueue?.status ?? (insideQueueZone ? 'outside_queue' : 'outside_zone'),
      queuePosition,
      insideQueueZone,
      queueRecord: activeQueue ?? null
    };
  }

  function listTodas() {
    return todas.map(toda => structuredClone(toda));
  }

  function getToda(id) {
    const toda = todas.find(item => item.id === id);
    if (!toda) {
      throw createHttpError(404, 'TODA_NOT_FOUND', 'TODA was not found');
    }
    return structuredClone(toda);
  }

  function createToda(input) {
    const createdAt = now().toISOString();
    const toda = normalizeToda({ ...input, id: input.id ?? `toda-${createdAt.replace(/\D/g, '')}-${todas.length + 1}` });
    toda.createdAt = createdAt;
    toda.updatedAt = createdAt;
    todas.push(toda);
    return structuredClone(toda);
  }

  function updateToda(id, input) {
    const index = todas.findIndex(item => item.id === id);
    if (index === -1) {
      throw createHttpError(404, 'TODA_NOT_FOUND', 'TODA was not found');
    }

    const updated = normalizeToda({ ...todas[index], ...input, id });
    updated.updatedAt = now().toISOString();
    todas[index] = updated;
    return structuredClone(updated);
  }

  function disableToda(id) {
    return updateToda(id, { active: false });
  }

  function assignDriverToToda(todaId, driverId) {
    const driver = findDriver(driverId);
    for (const toda of todas) {
      toda.assignedDriverIds = toda.assignedDriverIds.filter(id => id !== driver.id);
    }
    const toda = todas.find(item => item.id === todaId);
    if (!toda) {
      throw createHttpError(404, 'TODA_NOT_FOUND', 'TODA was not found');
    }
    toda.assignedDriverIds.push(driver.id);
    driver.todaId = toda.id;
    toda.updatedAt = now().toISOString();
    return structuredClone(toda);
  }

  function removeDriverFromToda(todaId, driverId) {
    const driver = findDriver(driverId);
    const toda = todas.find(item => item.id === todaId);
    if (!toda) {
      throw createHttpError(404, 'TODA_NOT_FOUND', 'TODA was not found');
    }
    toda.assignedDriverIds = toda.assignedDriverIds.filter(id => id !== driver.id);
    if (driver.todaId === todaId) {
      driver.todaId = null;
    }
    exitActiveDriverQueue(driverId, 'exited');
    toda.updatedAt = now().toISOString();
    return structuredClone(toda);
  }

  function getTodaQueue(todaId) {
    getToda(todaId);
    return queueRecords
      .filter(record => record.todaId === todaId && record.status === 'waiting')
      .sort((a, b) => a.enteredAt.localeCompare(b.enteredAt))
      .map(record => ({ ...record, driver: drivers.find(driver => driver.id === record.driverId) ?? null }));
  }

  function setDriverPushToken(driverId, pushToken) {
    const driver = findDriver(driverId);
    driver.pushToken = typeof pushToken === 'string' ? pushToken : null;
    driver.updatedAt = now().toISOString();
    return { driverId, pushToken: driver.pushToken };
  }

  function buildDispatch(pickup) {
    const toda = findTodaForPickup(pickup);
    const available = drivers.filter(driver => driver.status === 'AVAILABLE' && !hasActiveAssignedRide(driver.id));

    if (!toda) {
      return {
        toda: null,
        source: 'nearest_driver',
        candidates: sortDriversByDistance(available, pickup)
      };
    }

    const assigned = available.filter(driver => toda.assignedDriverIds.includes(driver.id));
    const queued = getTodaQueue(toda.id)
      .map(record => assigned.find(driver => driver.id === record.driverId))
      .filter(Boolean);
    if (queued.length > 0) {
      return { toda, source: 'toda_queue', candidates: queued };
    }

    const terminalDrivers = assigned
      .filter(driver => driver.lastLocation)
      .filter(driver => isInsideRadius(driver.lastLocation, geoJsonPointToLatLng(toda.terminalZone.center), toda.terminalZone.radiusMeters));
    if (terminalDrivers.length > 0) {
      return { toda, source: 'toda_terminal', candidates: sortDriversByDistance(terminalDrivers, pickup) };
    }

    const nearPickup = assigned
      .filter(driver => driver.lastLocation)
      .filter(driver => getDistanceMeters(driver.lastLocation.lat, driver.lastLocation.lng, pickup.lat, pickup.lng) <= nearPickupMeters);
    if (nearPickup.length > 0) {
      return { toda, source: 'toda_near_pickup', candidates: sortDriversByDistance(nearPickup, pickup) };
    }

    if (toda.fallbackEnabled) {
      return { toda, source: 'nearest_driver', candidates: sortDriversByDistance(available, pickup) };
    }

    return { toda, source: 'none', candidates: [] };
  }

  function offerNextDriver(ride) {
    const candidates = (ride.offer?.candidateDriverIds ?? []).filter(driverId => !(ride.rejectedDriverIds ?? []).includes(driverId));
    const nextDriverId = candidates[0];
    const originalCandidates = ride.offer?.candidateDriverIds ?? candidates;

    if (!nextDriverId) {
      ride.status = 'REQUESTED';
      ride.driver = null;
      ride.offer = null;
      ride.updatedAt = now().toISOString();
      return;
    }

    const driver = findDriver(nextDriverId);
    const index = originalCandidates.indexOf(nextDriverId);
    ride.status = 'OFFERED';
    ride.driver = driver;
    ride.offer = createOffer(todas.find(toda => toda.id === ride.todaId), driver, originalCandidates, index);
    ride.updatedAt = now().toISOString();
    markDriverQueueAssigned(driver.id, ride.id);
  }

  function findTodaForPickup(pickup) {
    return todas.find(toda => {
      if (!toda.active) {
        return false;
      }

      const inServiceZone = isPointInsidePolygon(pickup, toda.serviceZone);
      const nearTerminal = isInsideRadius(pickup, geoJsonPointToLatLng(toda.terminalZone.center), toda.terminalZone.radiusMeters);
      return inServiceZone || nearTerminal;
    });
  }

  function addQueueRecord(todaId, driverId, location) {
    const toda = getToda(todaId);
    if (!toda.assignedDriverIds.includes(driverId)) {
      throw createHttpError(403, 'DRIVER_NOT_IN_TODA', 'Driver is not assigned to this TODA');
    }

    if (getActiveQueueRecord(driverId)) {
      throw createHttpError(409, 'DRIVER_ALREADY_QUEUED', 'Driver already has an active TODA queue record');
    }

    const timestamp = now().toISOString();
    const record = {
      id: `queue-${timestamp.replace(/\D/g, '')}-${queueRecords.length + 1}`,
      todaId,
      driverId,
      enteredAt: timestamp,
      exitedAt: null,
      status: 'waiting',
      lastLocation: location,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    queueRecords.push(record);
    return record;
  }

  function markDriverQueueAssigned(driverId, rideId) {
    const activeQueue = getActiveQueueRecord(driverId);
    if (activeQueue) {
      activeQueue.status = 'assigned';
      activeQueue.rideId = rideId;
      activeQueue.updatedAt = now().toISOString();
    }
  }

  function clearAssignedQueue(driverId, rideId, status) {
    const assignedRecord = queueRecords.find(record => record.driverId === driverId && record.rideId === rideId && record.status === 'assigned');
    if (assignedRecord && queueStatuses.includes(status)) {
      assignedRecord.status = status;
      assignedRecord.exitedAt = now().toISOString();
      assignedRecord.updatedAt = now().toISOString();
    }
  }

  function exitActiveDriverQueue(driverId, status) {
    const activeQueue = getActiveQueueRecord(driverId);
    if (activeQueue) {
      activeQueue.status = status;
      activeQueue.exitedAt = now().toISOString();
      activeQueue.updatedAt = now().toISOString();
    }
  }

  function getActiveQueueRecord(driverId) {
    return queueRecords.find(record => record.driverId === driverId && ['waiting', 'assigned'].includes(record.status));
  }

  function hasActiveAssignedRide(driverId) {
    return rides.some(ride => ride.driver?.id === driverId && ['OFFERED', 'ASSIGNED', 'PICKED_UP'].includes(ride.status));
  }

  function sortDriversByDistance(candidateDrivers, point) {
    return [...candidateDrivers].sort((a, b) => {
      const aDistance = a.lastLocation ? getDistanceMeters(a.lastLocation.lat, a.lastLocation.lng, point.lat, point.lng) : Number.POSITIVE_INFINITY;
      const bDistance = b.lastLocation ? getDistanceMeters(b.lastLocation.lat, b.lastLocation.lng, point.lat, point.lng) : Number.POSITIVE_INFINITY;
      return aDistance - bDistance || a.etaMinutes - b.etaMinutes;
    });
  }

  function createOffer(toda, driver, candidateDriverIds, offerIndex) {
    const offeredAt = now().toISOString();
    const timeoutSeconds = toda?.bookingTimeoutSeconds ?? 30;
    return {
      driverId: driver.id,
      status: 'pending',
      offeredAt,
      expiresAt: new Date(Date.parse(offeredAt) + timeoutSeconds * 1000).toISOString(),
      candidateDriverIds,
      offerIndex
    };
  }

  function ensurePendingOfferForDriver(ride, driverId) {
    expireStaleOffers();
    if (ride.status !== 'OFFERED' || ride.offer?.driverId !== driverId) {
      throw createHttpError(409, 'RIDE_NOT_OFFERED_TO_DRIVER', 'Ride is not currently offered to this driver');
    }
  }

  function findDriver(driverId) {
    const driver = drivers.find(item => item.id === driverId);
    if (!driver) {
      throw createHttpError(404, 'DRIVER_NOT_FOUND', 'Driver was not found');
    }
    return driver;
  }

  return {
    listRides,
    getRide,
    createRide,
    updateRideStatus,
    acceptRide,
    rejectRide,
    listDrivers,
    updateDriverLocation,
    leaveQueue,
    getDriverToda,
    getDriverQueueStatus,
    listTodas,
    getToda,
    createToda,
    updateToda,
    disableToda,
    assignDriverToToda,
    removeDriverFromToda,
    getTodaQueue,
    setDriverPushToken,
    dumpState
  };

  function dumpState() {
    return {
      rides: rides.map(ride => structuredClone(ride)),
      drivers: drivers.map(driver => ({ ...driver })),
      todas: todas.map(toda => structuredClone(toda)),
      queueRecords: queueRecords.map(record => structuredClone(record))
    };
  }
}

function seedTodos() {
  return seedTodosRaw().map(toda => structuredClone(toda));
}

function seedTodosRaw() {
  return seedTodas;
}

function validatePoint(input) {
  if (!Number.isFinite(input?.lat) || !Number.isFinite(input?.lng)) {
    throw createHttpError(422, 'VALIDATION_ERROR', 'lat and lng must be numbers');
  }
  return { lat: input.lat, lng: input.lng };
}

function geoJsonPointToLatLng(point) {
  return {
    lng: point.coordinates[0],
    lat: point.coordinates[1]
  };
}

function normalizeToda(input) {
  if (typeof input.name !== 'string' || input.name.trim().length < 2) {
    throw createHttpError(422, 'VALIDATION_ERROR', 'TODA name is required');
  }
  if (!input.serviceZone || input.serviceZone.type !== 'Polygon') {
    throw createHttpError(422, 'VALIDATION_ERROR', 'serviceZone must be a GeoJSON Polygon');
  }
  if (!input.terminalZone?.center || !Number.isFinite(input.terminalZone.radiusMeters)) {
    throw createHttpError(422, 'VALIDATION_ERROR', 'terminalZone center and radiusMeters are required');
  }
  if (!input.queueZone?.center || !Number.isFinite(input.queueZone.radiusMeters)) {
    throw createHttpError(422, 'VALIDATION_ERROR', 'queueZone center and radiusMeters are required');
  }

  return {
    id: input.id,
    name: input.name.trim(),
    description: typeof input.description === 'string' ? input.description.trim() : '',
    active: input.active !== false,
    assignedDriverIds: Array.isArray(input.assignedDriverIds) ? [...new Set(input.assignedDriverIds)] : [],
    serviceZone: input.serviceZone,
    terminalZone: input.terminalZone,
    queueZone: input.queueZone,
    fallbackEnabled: input.fallbackEnabled !== false,
    bookingTimeoutSeconds: Number.isFinite(input.bookingTimeoutSeconds) ? input.bookingTimeoutSeconds : 30,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt
  };
}
