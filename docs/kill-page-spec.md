# Spec: Kill Page

## Objective
Add a standalone `kill.jsx` page component to the Tricycall mobile app repository so future routing work can import a clearly named maintenance/safety-style page without changing the existing booking flow.

## Tech Stack
- Expo React Native app under `tricycall/mobile`
- React 19 with JSX
- React Native primitives for cross-platform rendering

## Commands
- Install: `npm install`
- Mobile start: `npm run mobile`
- Backend tests: `npm run test:backend`
- Type check: `npx tsc --noEmit -p tricycall/mobile/tsconfig.json`

## Project Structure
- `tricycall/mobile/src/pages/kill.jsx` → New standalone page component
- `docs/kill-page-spec.md` → Scope and acceptance criteria for this change

## Code Style
```jsx
export default function KillPage() {
  return (
    <SafeAreaView style={styles.screen}>
      <Text style={styles.title}>Page title</Text>
    </SafeAreaView>
  );
}
```

Use focused functional components, React Native `StyleSheet.create`, semantic component names, and the existing Tricycall green/yellow visual language.

## Testing Strategy
- Run the existing backend test suite to check repository health.
- Run the mobile TypeScript compiler to ensure the existing TypeScript project remains valid.
- This static JSX page has no business logic, so no dedicated unit test is required for this slice.

## Boundaries
- Always: Keep the new page self-contained and safe to import later.
- Ask first: Add routing, navigation changes, dependencies, or backend behavior.
- Never: Remove existing ride-booking functionality or commit secrets.

## Success Criteria
- A `kill.jsx` page exists in the mobile source tree.
- The page exports a reusable default React component.
- The page uses accessible text and touch targets.
- Existing checks continue to pass.

## Open Questions
- None for this self-contained repository addition.
