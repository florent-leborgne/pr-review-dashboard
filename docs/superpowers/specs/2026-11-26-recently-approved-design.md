# Recently approved filter

Approved in chat after a browser mockup, then moved from its own tab to a filter. **Recently approved** is a filter under **Review requests**, after **Changes requested**. It shows the PRs you approved recently, so you can check whether they landed and whether your comments got an answer. It is not part of **All**, because it is a follow-up list, not a to-do list. A divider separates it from the other filters.

## Which PRs appear

A PR appears when your latest decisive review (approve or request changes) is an approval made inside the time window. It leaves the list when one of these happens:

- It is merged or closed, and every review thread you started is resolved.
- You dismiss it.
- The approval is older than the time window.

A dismissed approval brings the PR back to the other Review requests filters, as before. Your own PRs and archived repositories are skipped.

## Card content

- Landed state: **Open** with CI, the merge queue chip when queued, **Merged** (purple edge), or **Closed** (red edge).
- Your comments: "2 of 3 comments resolved", "All 3 comments resolved", or "No comments from you". The count covers every review thread you started on the PR, including threads from before the approval.
- Reply waiting: when the last submitted comment in one of your unresolved threads is from another person, the card gets the gold attention style, a "@name replied" line, and a quote that links to the comment. Bots and configured service accounts don't count. Your own unsubmitted reply doesn't count as an answer.
- Acknowledgements: a short reply such as "Done in 3f9c2e1", "Addressed, thanks", or a thumbs-up shows as a muted quote labeled **Looks addressed**. It doesn't trigger the attention style, doesn't turn the count gold, and doesn't bring back a dismissed card. A reply with a question mark, or with words outside the acknowledgement list, is a real reply.
- Title, repo grouping, author, and "you approved 2d ago". No reviewer chips or labels.

## Filter and settings

- The filter count shows the PRs in the list. It turns gold when at least one has a real reply waiting.
- Dismiss uses the PR card "x" button. Dismissed cards move to a collapsed list with **Restore**. A new real reply brings a dismissed card back.
- The time window lives only in the Settings dialog: 7 (default), 14, or 30 days.
- The Drafts control applies, as for the other Review requests filters. The teams bar doesn't apply, because an approval is always yours.
- Loads in parallel with the other tabs. A failed load keeps the last data.

## Data

One search per refresh: `is:pr reviewed-by:USER -author:USER updated:>=DATE`, with no `is:open`, so it returns open, merged, and closed PRs. A PR approved inside the window was also updated inside it. Each PR loads your reviews, the last 50 review threads (first comment and last 3 comments of each), state, merge and close times, merge queue entry, and CI. The search reads at most 8 pages of 25 PRs.

Alternatives considered: reusing the open `reviewed-by` search plus a merged search would make the daily Review requests query heavier. A two-step cache like Mentions is more code than a 7 to 30 day window needs.

Limitation: plain PR conversation comments can't be resolved on GitHub, so they don't count. The Mentions tab still catches them when someone tags you.
