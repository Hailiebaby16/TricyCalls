import { drivers as seedDrivers, todas as seedTodas } from './data.js';
import { estimateRouteFare } from './osrm.js';
import { createRideStore } from './store.js';

const collectionNames = ['rides', 'drivers', 'todas', 'queueRecords'];

export async function createMongoRideStore({
  uri,
  dbName = 'tricycall',
  now = () => new Date(),
  routeEstimator = estimateRouteFare
}) {
  const { MongoClient } = await import('mongodb');

  if (!uri) {
    throw new Error('MONGODB_URI is required to create a MongoDB ride store');
  }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  const collections = Object.fromEntries(collectionNames.map(name => [name, db.collection(name)]));

  await collections.rides.createIndex({ id: 1 }, { unique: true });
  await collections.todas.createIndex({ id: 1 }, { unique: true });
  await collections.drivers.createIndex({ id: 1 }, { unique: true });
  await collections.queueRecords.createIndex({ id: 1 }, { unique: true });
  await collections.queueRecords.createIndex({ todaId: 1, status: 1, enteredAt: 1 });

  const initialState = await loadState(collections);
  const store = createRideStore(now, routeEstimator, initialState);

  async function persist() {
    const state = store.dumpState();
    await Promise.all(
      collectionNames.map(async name => {
        await collections[name].deleteMany({});
        if (state[name].length > 0) {
          await collections[name].insertMany(state[name]);
        }
      })
    );
  }

  return {
    listRides: store.listRides,
    getRide: store.getRide,
    listDrivers: store.listDrivers,
    getDriverToda: store.getDriverToda,
    getDriverQueueStatus: store.getDriverQueueStatus,
    listTodas: store.listTodas,
    getToda: store.getToda,
    getTodaQueue: store.getTodaQueue,
    async createRide(input) {
      const result = await store.createRide(input);
      await persist();
      return result;
    },
    async updateRideStatus(id, status) {
      const result = store.updateRideStatus(id, status);
      await persist();
      return result;
    },
    async acceptRide(id, driverId) {
      const result = store.acceptRide(id, driverId);
      await persist();
      return result;
    },
    async rejectRide(id, driverId) {
      const result = store.rejectRide(id, driverId);
      await persist();
      return result;
    },
    async updateDriverLocation(driverId, input) {
      const result = store.updateDriverLocation(driverId, input);
      await persist();
      return result;
    },
    async leaveQueue(driverId) {
      const result = store.leaveQueue(driverId);
      await persist();
      return result;
    },
    async createToda(input) {
      const result = store.createToda(input);
      await persist();
      return result;
    },
    async updateToda(id, input) {
      const result = store.updateToda(id, input);
      await persist();
      return result;
    },
    async disableToda(id) {
      const result = store.disableToda(id);
      await persist();
      return result;
    },
    async assignDriverToToda(todaId, driverId) {
      const result = store.assignDriverToToda(todaId, driverId);
      await persist();
      return result;
    },
    async removeDriverFromToda(todaId, driverId) {
      const result = store.removeDriverFromToda(todaId, driverId);
      await persist();
      return result;
    },
    async setDriverPushToken(driverId, pushToken) {
      const result = store.setDriverPushToken(driverId, pushToken);
      await persist();
      return result;
    },
    dumpState: store.dumpState,
    async close() {
      await client.close();
    }
  };
}

async function loadState(collections) {
  const [rides, storedDrivers, storedTodos, queueRecords] = await Promise.all(
    collectionNames.map(name => collections[name].find({}, { projection: { _id: 0 } }).toArray())
  );

  return {
    rides,
    drivers:
      storedDrivers.length > 0
        ? storedDrivers
        : seedDrivers.map(driver => ({ ...driver, lastLocation: null, pushToken: null, isOnline: true })),
    todas: storedTodos.length > 0 ? storedTodos : seedTodas,
    queueRecords
  };
}
