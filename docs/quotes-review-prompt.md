# Quotes System — Code Review Prompt

## Before scoring anything

1. Read the actual current files in scope. Do not assume prior state or what has already been fixed.
2. Base every score and every rewrite target on what you observe in the code right now.
3. Aggressive stance: rewrites and full refactors are on the table. Call them out when warranted.
4. "Fine for now" is only valid if the code genuinely does not block future features or introduce real risk.

---

## Score categories

Score each from **1–10**:

- **1–3** = poor / risky
- **4–5** = weak with notable issues
- **6–7** = decent but needs improvement
- **8–9** = strong
- **10** = excellent / hard to materially improve

Use the full range. Do not inflate scores to be kind.

1. **Maintainability** — how easy this code will be to safely update over time
2. **Debuggability** — how easy it is to trace bugs, isolate failures, and reason about behavior
3. **Readability / Clarity** — how easy it is for another developer to understand quickly
4. **Efficiency / Performance** — obvious render, query, state, computation, or network inefficiencies
5. **Scalability / Extensibility** — how well this holds up as features, rules, and edge cases grow
6. **Separation of Concerns** — whether UI, business logic, data access, derived state, and utilities are cleanly separated
7. **Reusability** — whether logic and UI patterns are reusable without duplication
8. **Consistency** — whether patterns, naming, structure, and conventions are applied consistently
9. **Testability** — how easy this area would be to test well
10. **Resilience / Stability** — how likely this code is to break under edge cases, missing data, async issues, invalid state, or future refactors

---

## Quotes-system-specific review lens

Beyond general app concerns, explicitly check for:

- **VM builders doing too much** — a VM builder should only convert state to UI shape; flag any that make decisions, call hooks, or manage side effects
- **State machine action bloat** — flag action sets that could be consolidated; actions that do too much per dispatch
- **Controller/hook boundary violations** — mutation logic in the hook facade; orchestration logic that belongs in the controller
- **Polymorphic adapter completeness** — any rate/flag category missing a full adapter (`rowToDraft`, `formatDraftValue`, `validateDraft`, `draftToPayload`)
- **Read model bypass** — hooks or components making API or DB calls that should go through the service layer
- **Route alias violations** — any logic duplicated between `app/crm/quotes/[id]` and canonical estimate routes
- **`useDenseQuoteAdminOrchestrator` pattern not applied** — dense editors written from scratch when the generic orchestrator covers them
- **Validation outside `lib/quotes/`** — validation or normalization placed in hooks, components, or route handlers

Also apply the standard app code lens:

- Components doing too much
- State duplicated or hard to trace
- Business rules mixed into UI
- Prop drilling / overly tangled dependencies
- Weak naming
- Hidden assumptions
- Hardcoded values that should be centralized
- Brittle conditional rendering
- Derived data recomputed in messy ways
- Difficult async flows
- Poor empty / error / loading handling
- Places where future feature additions will get messy fast

---

## Output format

Use this exact structure:

### 1) Executive Summary

Short plain-English summary of the overall health of this area.

### 2) Scorecard

| Category | Score /10 | Why |
|---|---|---|
| Maintainability | | |
| Debuggability | | |
| Readability / Clarity | | |
| Efficiency / Performance | | |
| Scalability / Extensibility | | |
| Separation of Concerns | | |
| Reusability | | |
| Consistency | | |
| Testability | | |
| Resilience / Stability | | |

### 3) Biggest Strengths

Top 3–5 specific things this code does well. Name files and patterns — no vague praise.

### 4) Biggest Risks / Weak Points

Top 3–7 problems hurting this area most. Prioritize by actual impact.

### 5) Specific Improvement Opportunities

Grouped by effort:

**Quick wins** (under 1 hour each):
- Problem → why it matters → what change to make

**Medium-effort improvements** (hours to a day):
- Problem → why it matters → what change to make

**Larger structural improvements** (days):
- Problem → why it matters → what change to make

### 6) Stability Risk Callout

Call out anything fragile, tightly coupled, overly complex, or likely to cause regressions. Be specific about which files and why.

### 7) Final Verdict

- **Overall score /10**
- **Ship confidence: High / Medium / Low**
- **Refactor priority: High / Medium / Low**

### 8) Rewrite Targets

Uncapped ranked list ordered by: severity + how much it blocks future features.

For each target:

---

#### Rewrite Target #N: [area name]

**Why:** 2–3 sentences on what is broken and why it matters.

**Severity:** High / Medium

**Blocks:** What future work this makes harder or riskier.

**Ready-to-use prompt:**

```
Read docs/quotes-system.md and follow it.

Task: rewrite
Scope: [specific files]
Goal: [what the rewrite should achieve]

Success criteria:
- [criterion]

Out of scope:
- [non-goal]
```

---

## Review rules

- Do not focus on tiny formatting issues unless they affect clarity
- Do not praise things vaguely — name the file or pattern
- Do not invent problems — only flag issues supported by what you actually read
- Prefer practical software-engineering concerns over theory
- Flag over-engineering just as much as under-structure
- If something cannot be judged from the provided files alone, say so
- Consider: future changes, edge cases, onboarding another developer, bug-fixing speed
