# Spec: Tricycall

## Objective
Build Tricycall, a mobile-first ride-hailing app for booking tricycle rides in Echague, Isabela, plus a local backend API. The first usable slice lets a passenger choose pickup/drop-off locations, see a fare estimate, book a nearby tricycle, track the active ride, and view recent rides.

## Tech Stack
- Mobile: React Native with Expo Go, TypeScript.
- Backend: Node.js HTTP server using built-in modules, in-memory data store, Node test runner.
- API style: REST with JSON, structured error responses, camelCase fields.

## Commands
- Mobile dev: `npm run mobile`
- Backend dev: `npm run backend`
- Backend tests: `npm run test:backend`
- Backend health check: `Invoke-RestMethod http://localhost:4000/api/health`

## Project Structure
- `tricycall/mobile` - Expo Go app.
- `tricycall/mobile/src` - Mobile API client, data, types, and UI.
- `tricycall/backend` - Node backend API.
- `tricycall/backend/src` - Server, routing, validation, and ride store.
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
Backend behavior is covered with `node --test`, focused on validation, fare estimation, OSRM route response parsing, and ride lifecycle. Mobile UI is structured with typed data and pure API client functions; runtime validation requires installing dependencies and opening the Expo app.

## Boundaries
- Always: Validate API inputs, return consistent errors, keep the app Expo Go compatible, attribute OpenStreetMap tiles.
- Ask first: Persistent database, authentication, payment integrations, live GPS tracking.
- Never: Commit secrets, require native Expo prebuild for the first slice, remove existing plugin repository files.

## Success Criteria
- A user can run the backend and receive JSON from `/api/health`.
- A user can run the Expo app and see the Tricycall booking experience.
- The mobile app can estimate and request a ride against the backend API.
- Fare uses OSRM route distance/duration when routing succeeds, otherwise falls back to local haversine distance.
- The booking screen shows an OSM tile map rendered with Leaflet and the selected OSRM route.
- Pickup and drop-off are selected through a Grab-style stacked route card with searchable suggestions and a swap action.
- Users can set pickup from device GPS and fine-tune either pickup or drop-off coordinates before estimating or booking.
- Default saved places are Echague, Isabela locations such as the town center, municipal hall, ISU Echague, public market, parish church, transport terminal, and Cabugao Poblacion.
- The mobile UI uses a cohesive light transport theme with teal primary controls, amber booking actions, and accessible status colors.
- Backend tests pass.

## Open Questions
- Auth, payment, and live dispatch rules are intentionally left for a later production slice.

# Implementation Plan: Tricycall

## Architecture Decisions
- Use a nested `tricycall` workspace to avoid overwriting this repository's existing agent-skills content.
- Keep the backend dependency-free so the core API can run and test before package installs.
- Use mock coordinates and tricycle drivers for the first slice; expose contracts that can later back onto a database.
- Use OSRM server-side for route-aware pricing and Leaflet with OpenStreetMap tiles for map rendering.

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
