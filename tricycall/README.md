# Tricycall

Tricycall is an Expo Go ride-hailing prototype for barangay tricycle trips with a local Node backend.

The default demo area is Echague, Isabela, with saved places for the town center, municipal hall, Isabela State University - Echague, public market, parish church, transport terminal, and Cabugao Poblacion.

## Run

```bash
npm install
npm run backend
npm run mobile
```

On Windows PowerShell with script execution disabled, use the command shims directly:

```bash
npm.cmd install --cache .npm-cache
npm.cmd run backend
npm.cmd run mobile
```

When testing on a physical phone, set the API URL to your computer's LAN address before starting Expo:

```bash
$env:EXPO_PUBLIC_API_URL="http://YOUR_LAN_IP:4000"
npm run mobile
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
