export type LocationPoint = {
  id: string;
  name: string;
  lat: number;
  lng: number;
};

export type Driver = {
  id: string;
  name: string;
  plateNumber: string;
  tricycleNumber: string;
  rating: number;
  etaMinutes: number;
  status: 'AVAILABLE' | 'BUSY';
  todaId?: string | null;
  lastLocation?: { lat: number; lng: number } | null;
};

export type RideStatus = 'REQUESTED' | 'OFFERED' | 'ASSIGNED' | 'PICKED_UP' | 'COMPLETED' | 'CANCELLED';

export type ZoneCircle = {
  center: {
    type: 'Point';
    coordinates: [number, number];
  };
  radiusMeters: number;
};

export type Toda = {
  id: string;
  name: string;
  description: string;
  active: boolean;
  assignedDriverIds: string[];
  serviceZone: {
    type: 'Polygon';
    coordinates: number[][][];
  };
  terminalZone: ZoneCircle;
  queueZone: ZoneCircle;
  fallbackEnabled: boolean;
  bookingTimeoutSeconds: number;
};

export type TodaQueueRecord = {
  id: string;
  todaId: string;
  driverId: string;
  enteredAt: string;
  exitedAt: string | null;
  status: 'waiting' | 'assigned' | 'exited' | 'expired';
  lastLocation: { lat: number; lng: number };
  createdAt: string;
  updatedAt: string;
  driver?: Driver | null;
};

export type Ride = {
  id: string;
  status: RideStatus;
  passengerName: string;
  pickup: LocationPoint;
  dropoff: LocationPoint;
  notes: string;
  driver: Driver | null;
  todaId?: string | null;
  dispatchSource?: string;
  fare: number;
  currency: 'PHP';
  distanceKm: number;
  etaMinutes: number;
  durationMinutes: number;
  fareSource: 'LOCAL_ESTIMATE' | 'OSRM';
  routeCoordinates: Array<{ lat: number; lng: number }>;
  createdAt: string;
  updatedAt: string;
};
