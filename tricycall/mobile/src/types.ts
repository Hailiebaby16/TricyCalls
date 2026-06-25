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
};

export type FareEstimate = {
  currency: 'PHP';
  fare: number;
  distanceKm: number;
  etaMinutes: number;
  durationMinutes: number;
  source: 'LOCAL_ESTIMATE' | 'OSRM';
  routeCoordinates: Array<{ lat: number; lng: number }>;
};

export type RideStatus = 'REQUESTED' | 'OFFERED' | 'ASSIGNED' | 'PICKED_UP' | 'COMPLETED' | 'CANCELLED';

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
  offer?: {
    driverId: string;
    status: 'pending';
    offeredAt: string;
    expiresAt: string;
    candidateDriverIds: string[];
    offerIndex: number;
  } | null;
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

export type CreateRideInput = {
  passengerName: string;
  pickup: LocationPoint;
  dropoff: LocationPoint;
  notes: string;
};
