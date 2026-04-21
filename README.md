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

### General
- **Settings panel**: Configure bot/service accounts to exclude from activity detection (gear icon in the header)
- **Draft toggle**: Show or hide draft PRs with a single click (shared across both tabs)
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

## Privacy

- **No server**: Everything runs client-side in your browser
- **No tracking**: No analytics, no telemetry, no third-party scripts
- **No secrets in the repo**: Tokens are stored per-user in `localStorage`
- **Direct API calls**: Your browser talks directly to `api.github.com`

## License

MIT
