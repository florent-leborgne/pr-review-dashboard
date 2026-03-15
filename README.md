# PR Review Dashboard

A single-page dashboard that tracks pull requests you need to review across **all GitHub repositories** — including reviews requested via your teams.

GitHub's built-in search can tell you which PRs you're "involved" in, but can't distinguish between PRs you've already approved and those still waiting for your review. This dashboard fills that gap.

## Features

- **Cross-repo**: Automatically finds PRs across all repositories where you or your teams are requested as reviewers
- **Team-aware**: Auto-detects your GitHub team memberships and tracks team-based review requests
- **Filters by review state**: Pending review, Commented, Changes requested
- **Filters by reviewer**: Click any team/user badge in the header to filter PRs for that specific reviewer
- **Blocking indicator**: Shows whether a PR is "Waiting on you only" vs "You + N others pending" so you can prioritize
- **Other reviewers' status**: See who else has approved, commented, requested changes, or is still pending
- **Draft toggle**: Show or hide draft PRs with a single click
- **Groups by repository**: See at a glance which repos need your attention
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

The dashboard runs three types of GitHub search queries in parallel using the GitHub GraphQL API:

1. `review-requested:USERNAME` — PRs where you are directly requested
2. `reviewed-by:USERNAME` — PRs you've already reviewed (to catch ones you commented on but didn't approve)
3. `team-review-requested:ORG/TEAM` — one query per team you belong to

Results are merged, deduplicated, and filtered to exclude:
- PRs you've already **approved** (comment-only reviews don't override a previous approval)
- PRs from **archived repositories**
- Your own PRs

Each PR shows:
- Which team or direct request triggered it
- Your current review status (pending review, commented, changes requested)
- Whether the PR is blocked on you specifically or also waiting on others
- Other reviewers' status (approved, commented, changes requested, pending)
- GitHub labels (with contrast-adjusted colors), draft status, author, and timestamps

## Privacy

- **No server**: Everything runs client-side in your browser
- **No tracking**: No analytics, no telemetry, no third-party scripts
- **No secrets in the repo**: Tokens are stored per-user in `localStorage`
- **Direct API calls**: Your browser talks directly to `api.github.com`

## License

MIT
