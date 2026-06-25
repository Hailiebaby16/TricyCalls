# Spec: Passenger User Login

## Objective
Add a basic passenger login path so a returning rider can identify themselves before booking. Success means the mobile app shows a login form before the booking UI, validates credentials through the backend, greets the signed-in user, and uses that user's name for ride requests.

## Tech Stack
- Backend: Node.js `http` server with in-memory store fallback.
- Mobile: Expo React Native with React Native Paper.
- Tests: Node's built-in `node:test` runner for backend API behavior.

## Commands
- Backend tests: `npm --workspace tricycall/backend test`
- Mobile typecheck: `npx tsc --noEmit -p tricycall/mobile/tsconfig.json`

## Project Structure
- `tricycall/backend/src/` → API server, validation, auth helpers, seed data.
- `tricycall/backend/test/` → API tests.
- `tricycall/mobile/` → passenger Expo app.
- `tricycall/mobile/src/api/` → mobile API client.
- `tricycall/mobile/src/types.ts` → shared mobile TypeScript contracts.

## Code Style
Prefer small, explicit functions with object-shaped inputs and structured errors:

```js
const body = await parseJsonBody(req);
const session = authenticateUser(validateLoginRequest(body));
sendJson(res, 200, session);
```

## Testing Strategy
- Add backend API tests for successful login and invalid credentials.
- Run mobile TypeScript checking to catch API/type integration regressions.

## Boundaries
- Always: validate login input server-side, never return password material, keep backend errors structured.
- Ask first: persistent auth storage, JWT/cookie sessions, database schema changes, adding auth dependencies.
- Never: commit secrets, read `.env` values into output, store plaintext production passwords.

## Success Criteria
- `POST /api/auth/login` accepts demo credentials and returns a public user plus session token.
- Invalid credentials return `401` with `INVALID_CREDENTIALS`.
- Passenger mobile app starts on a login card and transitions to booking after login.
- Booking requests use the authenticated user's name.
