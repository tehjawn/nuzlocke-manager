<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# No automated unit tests

This repo does **not** maintain automated unit/integration tests.

- Do **not** create `*.test.ts`, `*.test.tsx`, `*.spec.ts`, or `*.spec.tsx` files.
- Do **not** add a `test` / `vitest` / `jest` / `tsx --test` script to `package.json`.
- Do **not** add Vitest, Jest, Testing Library, or similar test runner dependencies.
- Do **not** suggest or scaffold tests “for coverage” when implementing features or fixing bugs.
- Prefer manual QA / smoke checks. Runtime fixture data under `fixtures/` is fine and is not a test suite.

If a user explicitly asks for tests anyway, confirm once that they want to override this policy before adding any.
