# Out of 10 test.md

<aside>
🧰

</aside>

## What I want reviewed

- Review only the files / components / hooks / utilities / routes / services I give you for this pass.
- Focus on how good this area is in real-world use for a growing production app.

## Main goals

Score this area from **1–10** in each category below, where:

- **1–3 = poor / risky**
- **4–5 = weak with notable issues**
- **6–7 = decent but needs improvement**
- **8–9 = strong**
- **10 = excellent / hard to materially improve**

## Score categories

Give a score and short justification for each:

1. **Maintainability**
    - How easy this code will be to safely update over time.
2. **Debuggability**
    - How easy it is to trace bugs, isolate failures, and reason about behavior.
3. **Readability / Clarity**
    - How easy it is for another developer to understand quickly.
4. **Efficiency / Performance**
    - Whether there are obvious render, query, state, computation, or network inefficiencies.
5. **Scalability / Extensibility**
    - How well this structure will hold up as features, rules, and edge cases grow.
6. **Separation of Concerns**
    - Whether UI, business logic, data access, derived state, and utilities are cleanly separated.
7. **Reusability**
    - Whether logic and UI patterns are reusable without creating duplication.
8. **Consistency**
    - Whether patterns, naming, structure, and conventions are applied consistently.
9. **Testability**
    - How easy this area would be to test well.
10. **Resilience / Stability**
    - How likely this code is to break under edge cases, missing data, async issues, invalid state, or future refactors.

## Output format

Use this exact structure:

### 1) Executive Summary

Give a short summary of the overall health of this area in plain English.

### 2) Scorecard

Provide a table with:

- Category
- Score /10
- Why

### 3) Biggest Strengths

List the top 3–5 things this code does well.

### 4) Biggest Risks / Weak Points

List the top 3–7 problems hurting this area most.

Prioritize the issues that actually matter, not tiny nitpicks.

### 5) Specific Improvement Opportunities

Give concrete recommendations grouped by:

- Quick wins
- Medium-effort improvements
- Larger structural improvements

For each improvement:

- explain the problem
- why it matters
- what change you would make

### 6) Stability Risk Callout

Call out anything that feels fragile, tightly coupled, overly complex, or likely to cause regressions later.

### 7) Final Verdict

End with:

- **Overall score /10**
- **Ship confidence: High / Medium / Low**
- **Refactor priority: High / Medium / Low**

## Review rules

Important rules for this review:

- Do **not** focus on tiny formatting issues unless they affect clarity.
- Do **not** praise things vaguely. Be specific.
- Do **not** invent problems. Only mention issues supported by the code.
- Prefer practical software-engineering concerns over theory.
- Be honest if something is “fine for now” versus truly strong.
- Flag over-engineering just as much as under-structure.
- Consider real production concerns: future changes, edge cases, onboarding another dev, and bug fixing.
- If something cannot be judged from the provided files alone, say so clearly.
- When scoring, use the full range. Don’t inflate scores just to be nice.

## Extra lens for app code

Pay special attention to:

- components doing too much
- state that is duplicated or hard to trace
- business rules mixed into UI
- prop drilling / overly tangled dependencies
- weak naming
- hidden assumptions
- hardcoded values that should be centralized
- brittle conditional rendering
- derived data being recalculated in messy ways
- difficult async flows
- poor empty/error/loading handling
- forms and user input complexity
- places where future feature additions will get messy fast

## Tone

Be direct, practical, and senior-level. I want useful criticism, not sugarcoating.

Now review the code I provide using this exact framework.