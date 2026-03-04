# PR Review Dashboard

A single-page dashboard that tracks pull requests you need to review across **all GitHub repositories** — including reviews requested via your teams.

GitHub's built-in search can tell you which PRs you're "involved" in, but can't distinguish between PRs you've already approved and those still waiting for your review. This dashboard fills that gap.

## Features

- **Cross-repo**: Automatically finds PRs across all repositories where you or your teams are requested as reviewers
- **Team-aware**: Auto-detects your GitHub team memberships and tracks team-based review requests
- **Filters by review state**: Pending (not reviewed yet), Commented, Changes Requested
- **Filters by reviewer**: Click any team/user badge to filter PRs for that specific reviewer
- **Groups by repository**: See at a glance which repos need your attention
- **Auto-refreshes** every 5 minutes (configurable)
- **Zero dependencies**: Single HTML file, no build step, no server

## Usage

### Option 1: GitHub Pages (recommended for teams)

1. Fork or clone this repo
2. Enable GitHub Pages in Settings → Pages → Source: `main` / root
3. Visit `https://<your-username>.github.io/pr-review-dashboard/`
4. Enter your GitHub PAT on first visit (stored in your browser only)

### Option 2: Open locally

```bash
open index.html
# or just double-click the file
```

## Token setup

Your token is stored **only** in your browser's `localStorage` and is sent exclusively to `api.github.com`. It never touches any other server.

### Fine-grained PAT (recommended)

More secure — scoped to specific permissions with an expiration date.

1. Go to [Settings → Fine-grained tokens](https://github.com/settings/personal-access-tokens/new)
2. Set a token name and expiration (e.g. 90 days)
3. **Repository access**: "All repositories" (or select the specific repos you review)
4. **Organization permissions**: Members → `read` (needed to detect your teams)
5. **Repository permissions**: Pull requests → `read`, Metadata → `read`

### Classic PAT

Simpler setup, broader access.

[Create one](https://github.com/settings/tokens/new?scopes=repo,read:org&description=PR+Review+Dashboard) with `repo` and `read:org` scopes.

## How it works

The dashboard runs three types of GitHub search queries in parallel using the GitHub GraphQL API:

1. `review-requested:USERNAME` — PRs where you are directly requested
2. `reviewed-by:USERNAME` — PRs you've already reviewed (to catch ones you commented on but didn't approve)
3. `team-review-requested:ORG/TEAM` — one query per team you belong to

Results are merged, deduplicated, and filtered to exclude:
- PRs you've already **approved**
- Your own PRs

Each PR shows which team or direct request triggered it, your current review status, and standard metadata (author, labels, timestamps).

## Privacy

- **No server**: Everything runs client-side in your browser
- **No tracking**: No analytics, no telemetry, no third-party scripts
- **No secrets in the repo**: Tokens are stored per-user in `localStorage`
- **Direct API calls**: Your browser talks directly to `api.github.com`

## License

MIT
