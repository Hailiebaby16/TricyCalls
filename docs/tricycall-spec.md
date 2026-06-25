# Spec: Tricycall

## Objective
Build Tricycall, a mobile-first ride-hailing system for booking tricycle rides in Echague, Isabela, plus rider and admin apps. The current slice lets a passenger request a ride, TODA drivers join a priority queue, drivers accept/reject live ride offers, and admins manage TODA zones and queue order.

## Tech Stack
- Passenger, rider, and admin apps: React Native with Expo Go SDK 54, TypeScript, and React Native Paper for Material 3 UI components.
- Backend: Node.js HTTP server using built-in modules, lightweight WebSocket upgrade handling, MongoDB optional persistence, in-memory fallback, Node test runner.
- API style: REST with JSON, structured error responses, camelCase fields.

## Commands
- Mobile dev: `npm run mobile`
- Rider dev: `npm run rider`
- Admin dev: `npm run admin`
- Backend dev: `npm run backend`
- Backend tests: `npm run test:backend`
- Backend health check: `Invoke-RestMethod http://localhost:4000/api/health`
- MongoDB mode: set `MONGODB_URI` and optional `MONGODB_DB_NAME` before `npm run backend`.

## Project Structure
- `tricycall/mobile` - Expo Go app.
- `tricycall/mobile/src` - Mobile API client, data, types, and UI.
- `tricycall/rider` - Expo Go driver app for TODA queue and ride offers.
- `tricycall/admin` - Expo Go admin app for TODA management and operations.
- `tricycall/backend` - Node backend API.
- `tricycall/backend/src` - Server, routing, validation, geofence helpers, realtime sockets, MongoDB wrapper, and ride/TODA store.
- `tricycall/backend/test` - Backend unit/API behavior tests.

## Code Style
```ts
type RideStatus = 'REQUESTED' | 'ASSIGNED' | 'PICKED_UP' | 'COMPLETED';

export async function createRide(input: CreateRideInput): Promise<Ride> {
  const response = await request<Ride>('/api/rides', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return response;
}
```

Prefer explicit type contracts, small focused modules, and readable names over early abstraction.

## Testing Strategy
Backend behavior is covered with `node --test`, focused on validation, fare estimation, OSRM route response parsing, TODA geofence queue behavior, and ride lifecycle. Expo apps are typechecked with `tsc --noEmit`.

## Boundaries
- Always: Validate API inputs, return consistent errors, keep the app Expo Go compatible, attribute OpenStreetMap tiles, preserve TODA FIFO queue priority.
- Ask first: Authentication, payment integrations, production-grade background job processing, native builds.
- Never: Commit secrets, require native Expo prebuild for the first slice, remove existing plugin repository files.

## Success Criteria
- A user can run the backend and receive JSON from `/api/health`.
- A user can run the Expo app and see the Tricycall booking experience.
- The mobile app can estimate and request a ride against the backend API.
- Ride requests are offered to the priority driver first and require driver acceptance before becoming assigned.
- TODA priority order is queue FIFO, terminal-zone driver, TODA driver near pickup, existing nearest-driver fallback.
- Drivers can join queue from the rider app, refresh GPS, leave queue manually, receive socket offers, and accept/reject bookings.
- Admins can edit TODA name/description, assign drivers, draw serviceZone polygons with Leaflet, set terminal/queue centers, and view live queue order.
- MongoDB persists rides, drivers, TODAs, and queue records when `MONGODB_URI` is set; in-memory fallback remains available for tests and local demos.
- Fare uses OSRM route distance/duration when routing succeeds, otherwise falls back to local haversine distance.
- The booking screen shows an OSM tile map rendered with Leaflet and the selected OSRM route.
- Pickup and drop-off are selected through a Grab-style stacked route card with searchable suggestions and a swap action.
- Users can set pickup from device GPS, tap the Leaflet map to preview a pickup/drop-off pin, confirm the pin, and fine-tune either coordinate before estimating or booking.
- Default saved places are Echague, Isabela locations such as the town center, municipal hall, ISU Echague, public market, parish church, transport terminal, and Cabugao Poblacion.
- The mobile UI uses React Native Paper components with a cohesive red-and-white theme, accessible status colors, fluid full-width surfaces, and bottom tab navigation.
- Backend tests pass.

## Open Questions
- Auth, payment, and production push notification credentials are intentionally left for a later production slice.

# Implementation Plan: Tricycall

## Architecture Decisions
- Use a nested `tricycall` workspace to avoid overwriting this repository's existing agent-skills content.
- Keep the backend dependency-free so the core API can run and test before package installs.
- Use seeded Echague TODA, mock coordinates, and demo tricycle drivers; MongoDB mode stores the current operational state.
- Use OSRM server-side for route-aware pricing and Leaflet with OpenStreetMap tiles for map rendering.
- Use WebSocket messages for driver ride offers and admin live refresh, with Expo push token registration as a notification channel.

## Task List

### Phase 1: Foundation
- [x] Add spec and package layout.
- [ ] Add backend store, validation, routes, and tests.
- [ ] Add Expo app config, scripts, and typed UI source.

### Phase 2: Core Flow
- [ ] Implement fare estimate and ride request API calls in the mobile app.
- [ ] Render booking, active ride, driver, and history states.
- [ ] Verify backend tests and syntax checks.

### Phase 3: Handoff
- [ ] Document run commands and environment variables.
- [ ] Report dependency installation requirements.

## Risks and Mitigations
| Risk | Impact | Mitigation |
| --- | --- | --- |
| Expo packages are not installed locally | Medium | Provide package files and run no-network verification where possible. |
| Mobile device cannot reach localhost | Medium | Support `EXPO_PUBLIC_API_URL` for LAN IP configuration. |
| Backend data is in-memory only | Low for prototype | Document as first-slice behavior and keep store isolated for replacement. |
