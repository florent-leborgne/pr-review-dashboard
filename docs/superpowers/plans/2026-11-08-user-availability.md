# GitHub Availability Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement the single task inline.

**Goal:** Display the authenticated token owner's GitHub availability and offer to edit it on GitHub.
**Architecture:** Extend the single-file dashboard with an independent viewer-status query and accessible popover. Reuse existing theme tokens, refresh lifecycle, and authenticated GraphQL helper.
**Tech stack:** HTML, CSS, browser JavaScript; Playwright for verification only.
**Spec:** ../specs/2026-11-08-user-availability-design.md

## Global constraints
- Zero runtime dependencies. No changes to service-status behavior or review tracking identity.
- Busy: red no-entry + Busy; default: green dot, no label; unavailable: neutral.

## Review focus
- Tracking username override must not change the status identity.
- Expired statuses and late responses must not show stale Busy or another account.
- API errors must not falsely indicate availability or break reviews.
- Untrusted messages must render as text, not HTML.
- Small screens, dark mode, keyboard dismissal and service incidents must remain usable.

## Task 1: Personal availability
- [x] Add checks for busy, default, expired, unavailable, token owner, safe messages, dismissal, and refresh; observe baseline failure.
- [x] Add header button/popover, responsive theme-aware CSS, viewer fetch and safe rendering. Refresh independently from reviews and on return to the tab.
- [x] Run all nine checks with Node VM. Browser visual verification unavailable: browser policy blocks local-file previews; no workaround attempted. CSS uses existing light/dark tokens and responsive wrapping.
- [ ] Update README, review changes, and prepare a draft pull request without merging or deploying.

Execution adaptation: local Git and Python require absent macOS developer tools. Sources and branch operations use the GitHub connector. Tests execute the actual dashboard JavaScript with Node VM and controlled network/DOM boundaries, not a browser. Run the shipped tests on a normal Node installation with `node --test tests/user-status.test.cjs`.
