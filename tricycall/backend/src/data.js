export const barangays = [
  { id: 'echague-town-center', name: 'Echague Town Center', lat: 16.7025, lng: 121.67833 },
  { id: 'echague-municipal-hall', name: 'Echague Municipal Hall', lat: 16.70405, lng: 121.67808 },
  { id: 'isu-echague-main', name: 'Isabela State University - Echague', lat: 16.7039, lng: 121.6846 },
  { id: 'echague-public-market', name: 'Echague Public Market', lat: 16.70135, lng: 121.67685 },
  { id: 'st-joseph-parish', name: 'St. Joseph Parish Church', lat: 16.7032, lng: 121.67745 },
  { id: 'echague-terminal', name: 'Echague Transport Terminal', lat: 16.70055, lng: 121.67595 },
  { id: 'cabugao-poblacion', name: 'Cabugao Poblacion', lat: 16.70625, lng: 121.6795 }
];

export const drivers = [
  {
    id: 'driver-1',
    name: 'Mario Santos',
    plateNumber: 'TC-1024',
    tricycleNumber: 'Unit 18',
    rating: 4.9,
    etaMinutes: 4,
    status: 'AVAILABLE',
    todaId: 'toda-echague-town-center'
  },
  {
    id: 'driver-2',
    name: 'Liza Reyes',
    plateNumber: 'TC-2048',
    tricycleNumber: 'Unit 27',
    rating: 4.8,
    etaMinutes: 6,
    status: 'AVAILABLE',
    todaId: 'toda-echague-town-center'
  },
  {
    id: 'driver-3',
    name: 'Benjie Cruz',
    plateNumber: 'TC-3312',
    tricycleNumber: 'Unit 09',
    rating: 4.7,
    etaMinutes: 8,
    status: 'BUSY',
    todaId: 'toda-echague-town-center'
  }
];

export const todas = [
  {
    id: 'toda-echague-town-center',
    name: 'Echague Town Center TODA',
    description: 'Demo TODA serving Echague town center, municipal hall, market, and nearby terminal trips.',
    active: true,
    assignedDriverIds: ['driver-1', 'driver-2', 'driver-3'],
    serviceZone: {
      type: 'Polygon',
      coordinates: [
        [
          [121.6737, 16.6984],
          [121.6868, 16.6984],
          [121.6868, 16.7082],
          [121.6737, 16.7082],
          [121.6737, 16.6984]
        ]
      ]
    },
    terminalZone: {
      center: { type: 'Point', coordinates: [121.67595, 16.70055] },
      radiusMeters: 450
    },
    queueZone: {
      center: { type: 'Point', coordinates: [121.67595, 16.70055] },
      radiusMeters: 120
    },
    fallbackEnabled: true,
    bookingTimeoutSeconds: 30
  }
];
