import type { Driver, LocationPoint, Ride } from '../types';

export const locations: LocationPoint[] = [
  { id: 'echague-town-center', name: 'Echague Town Center', lat: 16.7025, lng: 121.67833 },
  { id: 'echague-municipal-hall', name: 'Echague Municipal Hall', lat: 16.70405, lng: 121.67808 },
  { id: 'isu-echague-main', name: 'Isabela State University - Echague', lat: 16.7039, lng: 121.6846 },
  { id: 'echague-public-market', name: 'Echague Public Market', lat: 16.70135, lng: 121.67685 },
  { id: 'st-joseph-parish', name: 'St. Joseph Parish Church', lat: 16.7032, lng: 121.67745 },
  { id: 'echague-terminal', name: 'Echague Transport Terminal', lat: 16.70055, lng: 121.67595 },
  { id: 'cabugao-poblacion', name: 'Cabugao Poblacion', lat: 16.70625, lng: 121.6795 }
];

export const nearbyDrivers: Driver[] = [
  {
    id: 'driver-1',
    name: 'Mario Santos',
    plateNumber: 'TC-1024',
    tricycleNumber: 'Unit 18',
    rating: 4.9,
    etaMinutes: 4,
    status: 'AVAILABLE'
  },
  {
    id: 'driver-2',
    name: 'Liza Reyes',
    plateNumber: 'TC-2048',
    tricycleNumber: 'Unit 27',
    rating: 4.8,
    etaMinutes: 6,
    status: 'AVAILABLE'
  },
  {
    id: 'driver-3',
    name: 'Benjie Cruz',
    plateNumber: 'TC-3312',
    tricycleNumber: 'Unit 09',
    rating: 4.7,
    etaMinutes: 8,
    status: 'BUSY'
  }
];

export const recentRides: Ride[] = [
  {
    id: 'sample-1',
    status: 'COMPLETED',
    passengerName: 'Guest Passenger',
    pickup: locations[2],
    dropoff: locations[0],
    notes: '',
    driver: nearbyDrivers[1],
    fare: 48,
    currency: 'PHP',
    distanceKm: 1.6,
    etaMinutes: 7,
    durationMinutes: 7,
    fareSource: 'LOCAL_ESTIMATE',
    routeCoordinates: [],
    createdAt: '2026-06-14T09:30:00.000Z',
    updatedAt: '2026-06-14T09:50:00.000Z'
  },
  {
    id: 'sample-2',
    status: 'COMPLETED',
    passengerName: 'Guest Passenger',
    pickup: locations[4],
    dropoff: locations[1],
    notes: '',
    driver: nearbyDrivers[0],
    fare: 55,
    currency: 'PHP',
    distanceKm: 2.1,
    etaMinutes: 10,
    durationMinutes: 10,
    fareSource: 'LOCAL_ESTIMATE',
    routeCoordinates: [],
    createdAt: '2026-06-13T15:12:00.000Z',
    updatedAt: '2026-06-13T15:31:00.000Z'
  }
];
