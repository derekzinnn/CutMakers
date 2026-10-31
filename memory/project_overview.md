---
name: project-overview
description: CutMakers marketplace — stack, conventions, current build phase, and key architectural decisions
metadata:
  type: project
---

CutMakers is a video-editing marketplace (Fiverr-style). Monorepo with pnpm workspaces, Express/Prisma API, React+Vite frontend.

**Why:** Building MVP phase-by-phase; currently completing Phase 4.2 (negotiation + payment gate).

**How to apply:** All changes must follow the design system (navy/orange palette), use inline styles for colors, Tabler icons (outline), Syne/DM Sans fonts. Never use Supabase Auth or Storage. See CLAUDE.md for full conventions.

Key phase state:
- Orders flow: NEGOTIATING → AWAITING_PAYMENT → IN_PROGRESS → DELIVERED → COMPLETED
- Demo payment flow added in Phase 4.2 supplement: `PaymentMode` and `PaymentStatus` enums on Order, `PaymentEvent` audit table, `POST /orders/:id/payment/demo-confirm` endpoint (env-guarded, rate-limited)
- `DEMO_PAYMENT_ENABLED=true` controls the endpoint in dev/staging; blocked by default in production

**Pre-existing TypeScript issues:** `@types/express@5` types `req.params` loosely (string | string[]) causing errors in all controllers. `auth.service.ts` has JWT sign overload issues. These are pre-existing and out of scope.
