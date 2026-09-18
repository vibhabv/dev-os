---
name: contractiq-file-locations
description: Physical location of ContractIQ's Stage 2 spec files and source docs relative to the agent's cwd.
metadata:
  type: project
---

The implementation-spec-reviewer agent's cwd is `/Users/vibhabangalorevenkataramu/dev-os/nextjs-app`, but the
ContractIQ spec files under review live one directory up, at the actual repo root:

- Source docs: `/Users/vibhabangalorevenkataramu/dev-os/docs/ContractIQ_PRD.md`,
  `/Users/vibhabangalorevenkataramu/dev-os/docs/engineering/engineering-doc.md`
- Specs under review: `/Users/vibhabangalorevenkataramu/dev-os/docs/specs/00-overview-and-conventions.md`
  through `19-landing-page-and-global-ux.md` (20 files), plus
  `/Users/vibhabangalorevenkataramu/dev-os/docs/specs/supabase-schema.sql`
- `.env.example` is at the true project root: `/Users/vibhabangalorevenkataramu/dev-os/.env.example`

**Why:** `docs/implementation/` (the path implied by this agent's own role description) does not exist in this
project — the planner's actual output directory is `docs/specs/`. This has been confirmed correct/expected by the
calling agent in at least one round (round 5) — do not flag the directory name as an issue.

**How to apply:** Always `Glob` both `docs/specs/**` and `docs/implementation/**` from the repo root
(`/Users/vibhabangalorevenkataramu/dev-os/`) at the start of a review, not from cwd, since a cwd-relative glob
returns nothing and could wrongly suggest no spec files exist yet.

Related: [[contractiq-review-history]]
