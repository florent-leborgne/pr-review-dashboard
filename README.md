# PR Review Dashboard

A single-page dashboard that tracks pull requests you need to review across **all GitHub repositories** — including reviews requested via your teams.

GitHub's built-in search can tell you which PRs you're "involved" in, but can't distinguish between PRs you've already approved and those still waiting for your review. This dashboard fills that gap.

## Features

### Review Requests tab
- **Cross-repo**: Automatically finds PRs across all repositories where you or your teams are requested as reviewers
- **Team-aware**: Auto-detects your GitHub team memberships and tracks team-based review requests
- **Filters by review state**: Pending review, Commented, Changes requested
- **Filters by reviewer**: Click any team/user badge in the header to filter PRs for that specific reviewer
- **Team muting**: Double-click a team or user badge to mute it — those PRs are hidden until you unmute
- **Collapsible teams bar**: Click the chevron next to the teams bar to collapse it to a compact summary line (state persisted)
- **Required reviewer chips**: CODEOWNERs are highlighted with a distinct badge so you know when you're the required approver
- **Other reviewers' status**: See who else has approved, commented, requested changes, or is still pending
- **CI status**: Each PR shows its current CI state (passed, failed, running) inline
- **Dismiss / restore**: Hide a PR from the list without losing it — it auto-resurfaces if the PR is updated
- **Collapsible repo sections**: Click a repository header to collapse or expand its PR list

### My PRs tab
- **Your open PRs**: Tracks PRs you authored or are assigned to across all repositories
- **Needs attention**: Highlights PRs where someone else (human, not a bot) has responded since your last activity
- **Review & CI status**: Shows the overall review decision (approved, changes requested, review required) and CI state per PR
- **Reviewer chips**: See who has reviewed, commented, or is still pending on each of your PRs
- **Collapsible repo sections**: Same expand/collapse per repo as the Review Requests tab
- **Merge queue status**: A PR in the GitHub merge queue shows a **Queued** chip at the top of its status chips, with its position and estimated time when GitHub provides them. A queued PR is dimmed because there's nothing to do but wait, and it doesn't count as needing attention.
- **Queue problems**: A **Queue blocked** chip appears when GitHub reports the queued PR as unmergeable. A **Removed from queue** chip appears when GitHub took the PR out of the queue (for example after failed checks) and you haven't pushed since. Both are highlighted as needing attention.

### Mentions tab
- **Tags**: Finds issues and PRs where someone wrote `@you` or `@org/team` for one of your tracked teams, in a description, a comment, a review, or a review comment. Tags inside code blocks, inline code, and quoted lines don't count.
- **Replies**: Finds replies to your review comments, in review threads that are still unresolved. A flat comment on the same issue or PR doesn't count as a reply unless it tags you or your team.
- **Filters**: Switch between all mentions, tags only, and replies only.
- **Clears when you answer**: A mention leaves the list when you post on the same issue or PR after it.
- **Mark as seen**: Select the close button on a card to dim it. A newer mention on the same item brings it back.
- **No duplicates with My PRs**: Mentions on your own open PRs are hidden because the **My PRs** tab already flags responses from others. Mentions on PRs in **Review requests** are still shown.
- **Respects your teams bar**: Muted and excluded teams don't produce mentions, and bot accounts are ignored.
- **Limitation**: Discussions aren't covered yet. The GitHub search API doesn't return them for the `mentions:` qualifier.

### General
- **Settings panel**: Three configuration options (gear icon in the header):
  - **Bot/service accounts**: Accounts to ignore when detecting new activity on your PRs and new mentions
  - **Mentions time window**: How far back the **Mentions** tab looks. Select 7, 14 (default), 30, or 60 days.
  - **Team tag exclusions**: Teams you never want to track — they are removed from the teams bar and their review requests are hidden from the dashboard. You can only exclude teams you belong to; your own handle cannot be excluded.
- **Draft control**: Select **Show**, **Hide**, or **Only** to see all PRs, no drafts, or only drafts. The choice is shared across the **Review requests** and **My PRs** tabs, and doesn't apply to **Mentions**.
- **Light & dark theme**: Light theme by default, with a toggle to switch to dark mode (persisted)
- **Accessible label colors**: Label colors are automatically adjusted for contrast based on the active theme
- **Auto-refreshes** every 5 minutes (configurable)
- **Zero dependencies**: Single HTML file, no build step, no server

## Usage

1. Open [**the dashboard**](https://florent-leborgne.github.io/pr-review-dashboard/)
2. Enter your GitHub PAT on first visit (stored in your browser only)

## Token setup

Your token is stored **only** in your browser's `localStorage` and is sent exclusively to `api.github.com`. It never touches any other server.

### Create a classic PAT

[Create a classic token](https://github.com/settings/tokens/new?scopes=repo,read:org&description=PR+Review+Dashboard) with these scopes:

- **`repo`** — access to pull requests across your repositories
- **`read:org`** — needed to detect your team memberships

### Authorize SSO for Elastic org repos

If you need to access repositories in an organization that uses SAML SSO (e.g. the `elastic` org), you must authorize your token for SSO after creating it:

1. Go to [Settings → Personal access tokens](https://github.com/settings/tokens)
2. Next to your token, click **Configure SSO**
3. Click **Authorize** next to the `elastic` organization

Without this step, API requests to Elastic org repositories will return `404` even if the token has the correct scopes.

## How it works

All data is fetched from the GitHub GraphQL API and runs entirely in your browser.

### Review Requests tab

Runs three types of searches in parallel:

1. `review-requested:USERNAME` — PRs where you are directly requested
2. `reviewed-by:USERNAME` — PRs you've already reviewed (to catch ones you commented on but didn't approve)
3. `team-review-requested:ORG/TEAM` — one query per team you belong to

Results are merged, deduplicated, and filtered to exclude:
- PRs you've already **approved** (comment-only reviews don't override a previous approval)
- PRs from **archived repositories**
- Your own PRs

Each PR card shows:
- Which team or direct request triggered it
- Your current review status (pending review, commented, changes requested)
- Required reviewers (CODEOWNERs) highlighted with a distinct badge
- Other reviewers' status (approved, commented, changes requested, pending)
- CI status (passed, failed, running)
- GitHub labels (with contrast-adjusted colors), draft status, author, and timestamps

### My PRs tab

Fetches PRs where `author:USERNAME` or `assignee:USERNAME`, then enriches each with:
- The latest human activity (review or comment), excluding bots and configured service accounts
- Whether the last human activity was from someone other than you ("needs attention")
- The overall review decision from GitHub (approved, changes requested, review required)
- CI state and reviewer chips

The "needs attention" logic ignores bot accounts (GitHub Apps, `[bot]`-suffixed logins, and any accounts you add in Settings) so that CI noise never triggers a false alert.

For the merge queue, each PR also requests `mergeQueueEntry` (position, state, estimated time to merge) and the latest `AddedToMergeQueueEvent` or `RemovedFromMergeQueueEvent` from its timeline. A PR with no queue entry whose latest queue event is a removal, and that has no commit after it, gets the **Removed from queue** chip. A manual dequeue looks the same as a removal by GitHub.

### Mentions tab

Mentions use two steps to stay within GitHub's rate limits.

1. **List candidates cheaply.** Three kinds of searches return only item IDs and update times:
   - `mentions:USERNAME` for items that tag you
   - `commenter:USERNAME` for items where you commented, which is where replies can happen
   - `team:ORG/TEAM` for items that tag one of your teams, one query per tracked team

   Each search is limited to items updated inside your mentions time window.
2. **Load details only for items that changed.** The dashboard remembers the update time of each item while the page is open. It requests comments and review threads only for IDs whose update time changed since the last refresh.

The dashboard then finds tags and replies in the loaded text. It reads the last 20 comments of each item and the last 30 review threads (the first 10 comments of each thread), so a very long conversation can hide older events. A description tag uses the time of the last edit, so editing a description that tags you can bring the mention back.

## Privacy

- **No server**: Everything runs client-side in your browser
- **No tracking**: No analytics, no telemetry, no third-party scripts
- **No secrets in the repo**: Tokens are stored per-user in `localStorage`
- **Direct API calls**: Your browser talks directly to `api.github.com`

## License

MIT
