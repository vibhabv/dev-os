---
name: engineering-review-loop-pattern
description: Why the engineering-planner <-> engineering-reviewer fix/review loop tends to run many rounds, and how to shorten it next time
metadata:
  type: feedback
---

On the ContractIQ engineering doc, the self-review-then-hand-to-reviewer loop took **8 rounds** before APPROVED (Rounds 1-7 NEEDS REVISION, shrinking each time: 7 issues → 4 → 2 → 2 minor → 1 → 1 → 1). The recurring root cause, called out by the reviewer itself across rounds 2-7, was narrow/literal fixing: a fix would correctly resolve the exact clause quoted in the review, but miss a sibling clause in the same PRD sentence/cell/table, or fail to propagate a newly-introduced mechanism into every one of the doc's own cross-reference surfaces.

**Why:** Fixing under review pressure narrows focus to "make this specific quoted issue go away," which is efficient per-round but blind to siblings that weren't quoted. The PRD is dense with multi-clause sentences and named subsections that are easy to treat as fully handled once one clause/mention is addressed.

**How to apply next time — do these proactively during my own self-review (step 5/6), before ever invoking `engineering-reviewer`:**

1. **Checklist every clause, not just the sentence.** When a PRD sentence/table-cell has multiple clauses joined by "and"/";"/multiple named items (e.g. "opt-in, anonymised" + "used to improve prompt quality"; "segmented by jurisdiction... and industry"; "user feedback tagged with contract type"), treat each clause as its own checklist item. A fix that addresses clause 1 of 2 is not done.
2. **Propagate every new table/column/component/env-var to all four enumeration surfaces the skill structure requires:** the ER diagram (Section 7), the folder structure (Section 11), the Feature Breakdown (Section 10), and the Specs-to-Implementation Mapping (Section 14). If a fix lands in, say, Section 6 or Section 8 alone but doesn't appear in these four, `engineering-reviewer` will flag it as a fresh, unresolved gap on the next round — even though the "real" fix already happened.
3. **Checklist PRD headline/named metrics separately from similarly-worded sibling metrics.** A "North Star Metric" and a "Primary Metric" that are both phrased as "time from upload to X" are easy to silently conflate into one number. Surface-level phrase similarity is not the same requirement.
4. **Reconcile, don't pick-and-ignore, when the same real-world commitment is scoped differently in two PRD sections** (e.g. a DPA scoped "before EU onboarding" in one section and as a flat launch go-criterion in another). Write an explicit paragraph that resolves the apparent conflict and cites both sections, rather than satisfying only the more specific one.
5. **Give low-engineering-relevance PRD artifacts (an evaluation spreadsheet, a public trust page, a benchmarks commitment) a short "here's how our existing data satisfies this" note even when the real fix is "no code needed."** Leaving them completely unmentioned reads as an oversight, not as a deliberate scoping decision — the reviewer cannot distinguish "considered and correctly out of scope" from "never checked" unless it's written down.
6. **Before the first hand-off to `engineering-reviewer`, do one full read-through specifically hunting for exactly the 5 patterns above** — not just re-verifying the doc addresses the PRD's obvious functional requirements (those are usually fine on the first pass; it's the secondary/cross-cutting sections — Assumptions, Responsible AI pillars, Evaluation Strategy subsections, dependency lists, Core Metrics — that hide multi-round gaps).

Applying this checklist during self-review, before round 1's hand-off, should meaningfully cut the number of rounds needed on future runs of this skill.
