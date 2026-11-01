# 0005 · Issue shape

- Status: accepted · 2026-11-01 · decided by Michal (lane owner) during the morning-digest split
- Amends: 0002 (what an issue carries)

## Context

ADR 0002 says each issue carries its source section, scope, a checkable done condition and what it's
blocked by, but not the exact form. The skill `plan-to-issues` asks the human for the form on every
plan unless it is written down, so each new plan, session or harness asked again, and could guess
differently. The morning-digest split settled it.

## Decision

Every issue split from a plan has this body, in this order, and one label:

```md
Source: plan.md § <n>

## Scope
<what to build, in the plan's words; the files it may touch; what it must not build>

## Done when
<the plan's done condition for this unit, checkable>

## Blocked by
<#n of each issue it needs, or —; "the done check needs #n merged" when it can start earlier>

## Rules
<the ADRs and styleguide lines that apply; "Close with the closing comment from AGENTS.md.">
```

- Label: `plan:<plan name from plan.md's frontmatter>`, e.g. `plan:morning-digest`.
- `Source:` is the first line, exactly, with the plan's own section number (`§ 1`, `§ 2a`). One section
  may give several issues (morning-digest § 1 gave the types and the reader); no issue spans sections.
- Titles name the unit of work, not the section.

Why each part is there:
- `Source:` and the label: the reviewer sorts and finds a plan's issues by them.
- Scope and Rules: a worker picks the issue up cold and sees nothing else.
- Done when: an issue closes only when it holds (AGENTS.md).
- Blocked by: lets independent issues go to workers at once, and says which ones must wait.

## Consequences

- `plan-to-issues` uses this shape and asks the human only about what it does not cover.
- Issues as files (ADR 0004) carry the same body under their frontmatter.
- Changing the shape means a new ADR, not a different answer per plan.
