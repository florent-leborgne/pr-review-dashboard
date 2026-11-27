# Recently Approved Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement the single task inline.

**Goal:** Add a Recently approved filter under Review requests that shows whether PRs you approved landed and whether your review comments got an answer.
**Architecture:** One extra GraphQL search per refresh in the single-file dashboard. A pure `deriveApprovedItem` turns each PR into a card model, and `isAckReply` classifies short acknowledgements. Rendering reuses the PR card, merge queue, CI, and Mentions edge styles.
**Tech stack:** HTML, CSS, browser JavaScript. Tests run the real dashboard script in a Node VM.
**Spec:** ../specs/2026-11-26-recently-approved-design.md

## Global constraints
- Zero runtime dependencies. No change to how Review requests, My PRs, or Mentions select items.
- Default window 7 days. Options 7, 14, 30. The setting lives only in the Settings dialog.
- Untrusted text (titles, comment bodies, logins) renders escaped.

## Review focus
- An approval followed by request changes, a dismissed approval, or an approval outside the window must not appear.
- Merged or closed PRs with every thread resolved must not appear.
- Acknowledgements must not count as replies. Questions must.
- A failed search must keep the previous data.

## Task 1: Recently approved filter
- [x] Add `tests/recently-approved.test.cjs` covering selection, thread counts, replies and acknowledgements, dismissal, the search query, the All filter, the count, and card text. Observe failures.
- [x] Add the filter button, styles, search, derivation, dismissal storage, settings select, and rendering. Keep All unchanged.
- [x] Run `node --test tests/*.test.cjs`. Check the query against the GitHub API with `gh api graphql`, and the layout in light and dark themes with a browser preview fed by that response.
- [x] Update the README, commit, push the branch, and open a draft pull request without merging.
