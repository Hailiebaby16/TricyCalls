# Tricycall

Tricycall is an Expo Go ride-hailing prototype for barangay tricycle trips with a local Node backend.

The default demo area is Echague, Isabela, with saved places for the town center, municipal hall, Isabela State University - Echague, public market, parish church, transport terminal, and Cabugao Poblacion.

## Run

```bash
npm install
npm run backend
npm run mobile
npm run rider
npm run admin
```

On Windows PowerShell with script execution disabled, use the command shims directly:

```bash
npm.cmd install --cache .npm-cache
npm.cmd run backend
npm.cmd run mobile
npm.cmd run rider
npm.cmd run admin
```

When testing on a physical phone, set the API URL to your computer's LAN address before starting Expo:

```bash
$env:EXPO_PUBLIC_API_URL="http://YOUR_LAN_IP:4000"
npm run mobile
```

On Windows, find your LAN IP with:

```bash
ipconfig
```

Use the IPv4 address for the Wi-Fi network your phone is connected to. Example:

```bash
$env:EXPO_PUBLIC_API_URL="http://192.168.1.23:4000"
npm.cmd run mobile
```

If you change `EXPO_PUBLIC_API_URL`, restart Expo with the cache cleared:

```bash
npx.cmd expo start -c
```

## MongoDB

By default, the backend uses an in-memory store for quick testing. To persist rides, TODAs, queue records, driver locations, and push tokens in MongoDB:

```bash
$env:MONGODB_URI="mongodb://127.0.0.1:27017"
$env:MONGODB_DB_NAME="tricycall"
npm.cmd run backend
```

## Backend API

- `GET /api/health`
- `GET /api/locations`
- `GET /api/drivers`
- `POST /api/fare-estimates`
- `GET /api/rides`
- `POST /api/rides`
- `GET /api/rides/:id`
- `PATCH /api/rides/:id`
- `POST /api/rides/:id/accept`
- `POST /api/rides/:id/reject`
- `GET /api/todas`
- `POST /api/todas`
- `GET /api/todas/:id`
- `PATCH /api/todas/:id`
- `DELETE /api/todas/:id`
- `POST /api/todas/:id/drivers/:driverId`
- `DELETE /api/todas/:id/drivers/:driverId`
- `GET /api/todas/:id/queue`
- `POST /api/drivers/:driverId/location`
- `GET /api/drivers/:driverId/toda`
- `GET /api/drivers/:driverId/queue`
- `DELETE /api/drivers/:driverId/queue`
- `POST /api/drivers/:driverId/push-token`
- WebSocket: `/api/socket?role=driver&driverId=driver-1`
- WebSocket: `/api/socket?role=admin`

## TODA Priority Dispatch

Drivers belong to one TODA. A driver must press **Join Queue** from inside the queue zone to enter the FIFO priority list. Booking priority is:

1. TODA driver waiting inside queueZone, sorted by `enteredAt`
2. TODA driver inside terminalZone
3. TODA driver near pickup
4. Existing nearest available driver fallback

Bookings are first created as `OFFERED`. The driver must tap **Accept** before the ride becomes `ASSIGNED`. Rejecting a ride offers it to the next eligible driver.

Example: join the queue for `driver-1`:

```bash
Invoke-RestMethod http://localhost:4000/api/drivers/driver-1/location `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"lat":16.70055,"lng":121.67595,"joinQueue":true}'
```

Example: create a passenger booking:

```bash
Invoke-RestMethod http://localhost:4000/api/rides `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"passengerName":"Ana","pickup":{"name":"Echague Town Center","lat":16.7025,"lng":121.67833},"dropoff":{"name":"Echague Municipal Hall","lat":16.70405,"lng":121.67808},"notes":"Front gate"}'
```

Example: accept the offered booking:

```bash
Invoke-RestMethod http://localhost:4000/api/rides/RIDE_ID/accept `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"driverId":"driver-1"}'
```

Example TODA payload:

```json
{
  "id": "toda-demo",
  "name": "Demo TODA",
  "description": "Demo service area",
  "active": true,
  "assignedDriverIds": ["driver-1"],
  "serviceZone": {
    "type": "Polygon",
    "coordinates": [[[121.6737,16.6984],[121.6868,16.6984],[121.6868,16.7082],[121.6737,16.7082],[121.6737,16.6984]]]
  },
  "terminalZone": {
    "center": { "type": "Point", "coordinates": [121.67595, 16.70055] },
    "radiusMeters": 450
  },
  "queueZone": {
    "center": { "type": "Point", "coordinates": [121.67595, 16.70055] },
    "radiusMeters": 120
  },
  "fallbackEnabled": true,
  "bookingTimeoutSeconds": 30
}
```

## OSM, OSRM, and Leaflet

Tricycall uses OpenStreetMap tiles rendered with Leaflet in the app. The backend uses OSRM route distance and duration for fare estimates and falls back to the local distance estimate if OSRM is unavailable.

You can point the backend at a different OSRM server:

```bash
$env:OSRM_BASE_URL="https://router.project-osrm.org"
npm.cmd run backend
```

## Location Pinpointing

The mobile app can request foreground location permission and set pickup to the device GPS position. Use the active pickup/drop-off field and the pin controls to fine-tune either coordinate before estimating fare or booking.

All API errors use:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable message"
  }
}
```
