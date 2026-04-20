# Pass 12 — operating surfaces

This pass adds the first thin adult-facing operating surfaces on top of the hardened backend and spelling content model.

What is now true:

- the shell has explicit Parent Hub and Admin / Operations routes
- parent/admin access is role-aware instead of implied
- Worker routes now expose real hub read models
- Parent Hub is backed by durable learner state, sessions, and events
- Admin / Operations is backed by durable content bundles and mutation receipts
- audit lookup is real on the Worker path and explicitly placeholder in the local reference build
- no side reporting store was added

Tests now cover:

- parent hub read-model correctness
- admin hub read-model correctness
- worker permission enforcement for parent/admin surfaces

Result after this pass:

**77 / 77 tests passing**
