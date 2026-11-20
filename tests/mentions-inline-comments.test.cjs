const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1].replace(/\binit\(\);\s*$/, '');

function dashboard(initialStorage = {}) {
  const storage = new Map([
    ['prd_token', 'test-token'],
    ['prd_user', 'florent-leborgne'],
    ...Object.entries(initialStorage),
  ]);
  const context = vm.createContext({
    console, Date, setTimeout, clearTimeout,
    localStorage: {
      getItem: key => (storage.has(key) ? storage.get(key) : null),
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: key => storage.delete(key),
    },
    document: {
      documentElement: { setAttribute() {} },
      getElementById: () => null,
      querySelectorAll: () => [],
    },
  });
  vm.runInContext(script, context);
  return context;
}

function graphqlMock(handler) {
  return async (_url, options) => {
    const body = JSON.parse(options.body);
    const data = await handler(body.query, body.variables || {});
    return { ok: true, json: async () => ({ data }) };
  };
}

test('fetchMentions finds a direct @user ping in an inline PR review comment when mentions: misses it', async () => {
  const app = dashboard();
  const seenQueries = [];
  const now = new Date().toISOString();

  app.fetch = graphqlMock((query, vars) => {
    if (query.includes('search(query: $q')) {
      seenQueries.push(vars.q);
      if (vars.q.includes('"@florent-leborgne"') && vars.q.includes('in:comments') && vars.q.includes('is:pr')) {
        return { search: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [{ __typename: 'PullRequest', id: 'PR_301037', updatedAt: now }] } };
      }
      return { search: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] } };
    }
    if (query.includes('nodes(ids: $ids)')) {
      assert.deepEqual(vars.ids, ['PR_301037']);
      return {
        nodes: [{
          __typename: 'PullRequest',
          id: 'PR_301037',
          number: 301037,
          title: 'Clarify data view override matching',
          url: 'https://github.com/elastic/kibana/pull/301037',
          state: 'OPEN',
          createdAt: now,
          lastEditedAt: null,
          updatedAt: now,
          body: 'Summary without mentions.',
          author: { login: 'kertal', __typename: 'User' },
          repository: { nameWithOwner: 'elastic/kibana', isArchived: false },
          comments: { nodes: [] },
          reviews: { nodes: [{ url: 'https://github.com/elastic/kibana/pull/301037#pullrequestreview-1', createdAt: now, body: '', author: { login: 'kertal', __typename: 'User' } }] },
          reviewThreads: {
            nodes: [{
              isResolved: false,
              comments: {
                nodes: [{
                  url: 'https://github.com/elastic/kibana/pull/301037#discussion_r4612713848',
                  createdAt: now,
                  body: 'FYI @florent-leborgne I think we need help here',
                  author: { login: 'kertal', __typename: 'User' },
                  path: 'src/platform/plugins/shared/data_views/docs/openapi/components/schemas/create_data_view_request_object.yaml',
                }],
              },
            }],
          },
        }],
      };
    }
    throw new Error(`Unexpected query: ${query}`);
  });

  await app.fetchMentions();

  const items = vm.runInContext('mentionItems', app);
  assert.ok(seenQueries.some(q => q.includes('"@florent-leborgne"') && q.includes('in:comments') && q.includes('is:pr') && q.includes('sort:updated-desc')));
  assert.equal(items.length, 1);
  assert.equal(items[0].key, 'elastic/kibana#301037');
  assert.deepEqual([...items[0].events[0].via], ['direct']);
  assert.equal(items[0].events[0].where, 'Review comment on create_data_view_request_object.yaml');
  assert.equal(items[0].events[0].url, 'https://github.com/elastic/kibana/pull/301037#discussion_r4612713848');
});

test('fetchMentions finds a @org/team ping in an inline PR review comment scoped to the team org', async () => {
  const app = dashboard();
  vm.runInContext("userTeams = [{ org: 'elastic', slug: 'platform-docs', name: 'Platform Docs', qualified: 'elastic/platform-docs' }]", app);
  const seenQueries = [];
  const now = new Date().toISOString();

  app.fetch = graphqlMock((query, vars) => {
    if (query.includes('search(query: $q')) {
      seenQueries.push(vars.q);
      if (vars.q.includes('"@elastic/platform-docs"') && vars.q.includes('in:comments') && vars.q.includes('is:pr') && vars.q.includes('org:elastic')) {
        return { search: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [{ __typename: 'PullRequest', id: 'PR_TEAM_1', updatedAt: now }] } };
      }
      return { search: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] } };
    }
    if (query.includes('nodes(ids: $ids)')) {
      return {
        nodes: [{
          __typename: 'PullRequest',
          id: 'PR_TEAM_1',
          number: 999,
          title: 'Update schema',
          url: 'https://github.com/elastic/kibana/pull/999',
          state: 'OPEN',
          createdAt: now,
          lastEditedAt: null,
          updatedAt: now,
          body: 'No ping in body',
          author: { login: 'teammate', __typename: 'User' },
          repository: { nameWithOwner: 'elastic/kibana', isArchived: false },
          comments: { nodes: [] },
          reviews: { nodes: [] },
          reviewThreads: {
            nodes: [{
              isResolved: false,
              comments: {
                nodes: [{
                  url: 'https://github.com/elastic/kibana/pull/999#discussion_r1',
                  createdAt: now,
                  body: 'cc @elastic/platform-docs please check this wording',
                  author: { login: 'teammate', __typename: 'User' },
                  path: 'docs/api.yaml',
                }],
              },
            }],
          },
        }],
      };
    }
    throw new Error(`Unexpected query: ${query}`);
  });

  await app.fetchMentions();

  const items = vm.runInContext('mentionItems', app);
  assert.ok(seenQueries.some(q =>
    q.includes('"@elastic/platform-docs"')
    && q.includes('in:comments')
    && q.includes('is:pr')
    && q.includes('org:elastic')
    && q.includes('sort:updated-desc')
  ));
  assert.equal(items.length, 1);
  assert.deepEqual([...items[0].events[0].via], ['elastic/platform-docs']);
  assert.equal(items[0].events[0].where, 'Review comment on api.yaml');
});

test('muted and excluded teams are skipped in mention searches and unmuting/un-excluding refreshes mentions', async () => {
  const app = dashboard({
    prd_muted_teams: JSON.stringify(['elastic/docs']),
    prd_excluded_teams: JSON.stringify(['elastic/employees']),
  });
  vm.runInContext(`userTeams = [
    { org: 'elastic', slug: 'platform-docs', qualified: 'elastic/platform-docs' },
    { org: 'elastic', slug: 'docs', qualified: 'elastic/docs' },
    { org: 'elastic', slug: 'employees', qualified: 'elastic/employees' },
  ]`, app);
  const seenQueries = [];
  app.fetch = graphqlMock((query, vars) => {
    if (query.includes('search(query: $q')) {
      seenQueries.push(vars.q);
      return { search: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] } };
    }
    return { nodes: [] };
  });

  await app.fetchMentions();

  assert.ok(seenQueries.some(q => q.includes('elastic/platform-docs')));
  assert.equal(seenQueries.some(q => q.includes('elastic/docs')), false);
  assert.equal(seenQueries.some(q => q.includes('elastic/employees')), false);

  let refreshes = 0;
  app.refreshMentions = () => { refreshes++; };
  app.renderTeamsInfo = () => {};
  app.updateCounts = () => {};
  app.renderPRs = () => {};
  app.renderMentions = () => {};

  app.toggleMuteTeam('elastic/platform-docs'); // muting should not need a refresh
  assert.equal(refreshes, 0);
  app.toggleMuteTeam('elastic/platform-docs'); // unmuting should refresh
  assert.equal(refreshes, 1);
  app.toggleMuteTeam('direct'); // muting direct
  app.toggleMuteTeam('direct'); // unmuting direct doesn't need extra fetch
  assert.equal(refreshes, 1);
  app.removeExcludedTeam('elastic/employees'); // un-excluding should refresh
  assert.equal(refreshes, 2);
});

test('inline PR comment hits respect existing rules: bots, quoted/code, loose text, answered, My PRs overlap, window, and commenter prOnly', async () => {
  const app = dashboard();
  vm.runInContext("userTeams = [{ org: 'elastic', slug: 'docs', qualified: 'elastic/docs' }]", app);
  const now = Date.now();
  const recent = new Date(now - 3600_000).toISOString();
  const after = new Date(now - 1800_000).toISOString();
  const old = new Date(now - 30 * 86400_000).toISOString();
  const hydratedIds = [];

  app.fetch = graphqlMock((query, vars) => {
    if (query.includes('search(query: $q')) {
      if (vars.q.startsWith('commenter:florent-leborgne')) {
        return {
          search: {
            pageInfo: { hasNextPage: false, endCursor: null },
            nodes: [{ __typename: 'Issue', id: 'ISSUE_ONLY_COMMENTED', updatedAt: recent }],
          },
        };
      }
      if (vars.q.includes('in:comments') && vars.q.includes('"@florent-leborgne"')) {
        return {
          search: {
            pageInfo: { hasNextPage: false, endCursor: null },
            nodes: [
              { __typename: 'PullRequest', id: 'PR_BOT', updatedAt: recent },
              { __typename: 'PullRequest', id: 'PR_QUOTED', updatedAt: recent },
              { __typename: 'PullRequest', id: 'PR_ANSWERED', updatedAt: after },
              { __typename: 'PullRequest', id: 'PR_MY_OWN', updatedAt: recent },
              { __typename: 'PullRequest', id: 'PR_OLD_COMMENT', updatedAt: recent },
            ],
          },
        };
      }
      if (vars.q.includes('in:comments') && vars.q.includes('"@elastic/docs"')) {
        return {
          search: {
            pageInfo: { hasNextPage: false, endCursor: null },
            nodes: [{ __typename: 'PullRequest', id: 'PR_LOOSE_TEXT', updatedAt: recent }],
          },
        };
      }
      return { search: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] } };
    }
    if (query.includes('nodes(ids: $ids)')) {
      hydratedIds.push(...vars.ids);
      const mkPR = (id, number, threadComments, comments = []) => ({
        __typename: 'PullRequest',
        id,
        number,
        title: `PR ${number}`,
        url: `https://github.com/elastic/kibana/pull/${number}`,
        state: 'OPEN',
        createdAt: old,
        lastEditedAt: null,
        updatedAt: recent,
        body: '',
        author: { login: 'kertal', __typename: 'User' },
        repository: { nameWithOwner: 'elastic/kibana', isArchived: false },
        comments: { nodes: comments },
        reviews: { nodes: [] },
        reviewThreads: { nodes: [{ isResolved: false, comments: { nodes: threadComments } }] },
      });
      return {
        nodes: [
          mkPR('PR_BOT', 1, [{ url: 'u1', createdAt: recent, body: 'Pinging @florent-leborgne', author: { login: 'infra-bot', __typename: 'Bot' }, path: 'a.md' }]),
          mkPR('PR_QUOTED', 2, [{ url: 'u2', createdAt: recent, body: '> @florent-leborgne\n`@florent-leborgne`', author: { login: 'kertal', __typename: 'User' }, path: 'a.md' }]),
          mkPR('PR_ANSWERED', 3, [
            { url: 'u3a', createdAt: recent, body: 'Hey @florent-leborgne', author: { login: 'kertal', __typename: 'User' }, path: 'a.md' },
            { url: 'u3b', createdAt: after, body: 'On it!', author: { login: 'florent-leborgne', __typename: 'User' }, path: 'a.md' },
          ]),
          mkPR('PR_MY_OWN', 4, [{ url: 'u4', createdAt: recent, body: 'Hey @florent-leborgne', author: { login: 'kertal', __typename: 'User' }, path: 'a.md' }]),
          mkPR('PR_OLD_COMMENT', 5, [{ url: 'u5', createdAt: old, body: 'Hey @florent-leborgne', author: { login: 'kertal', __typename: 'User' }, path: 'a.md' }]),
          mkPR('PR_LOOSE_TEXT', 6, [{ url: 'u6', createdAt: recent, body: 'See Elastic Docs and @elastic/docs-content', author: { login: 'kertal', __typename: 'User' }, path: 'a.md' }]),
        ],
      };
    }
    throw new Error(`Unexpected query: ${query}`);
  });

  await app.fetchMentions();

  // Issue found only via commenter: must still be skipped from hydration.
  assert.equal(hydratedIds.includes('ISSUE_ONLY_COMMENTED'), false);

  // Bot, quoted/code, answered, and loose-text PRs produce no mention item at all.
  const keys = Array.from(vm.runInContext('mentionItems', app), i => i.key).sort();
  assert.deepEqual(keys, ['elastic/kibana#4', 'elastic/kibana#5']);

  // My PRs overlap rule hides #4, and 14-day window hides #5.
  vm.runInContext(`myPRsLoadedOnce = true; myOwnPRs = [{ repo: 'elastic/kibana', number: 4 }];`, app);
  const view = app.computeMentionView();
  assert.equal(view.unseen.length, 0);
  assert.equal(view.seen.length, 0);
});

test('inline PR comment text searches cap pagination at 2 pages while qualifier searches paginate up to 5 pages', async () => {
  const app = dashboard();
  const pageCounts = new Map();

  app.fetch = graphqlMock((query, vars) => {
    if (query.includes('search(query: $q')) {
      pageCounts.set(vars.q, (pageCounts.get(vars.q) || 0) + 1);
      return { search: { pageInfo: { hasNextPage: true, endCursor: `c${pageCounts.get(vars.q)}` }, nodes: [] } };
    }
    return { nodes: [] };
  });

  await app.fetchMentions();

  const mentionsQ = [...pageCounts.keys()].find(q => q.startsWith('mentions:florent-leborgne'));
  const inlineQ = [...pageCounts.keys()].find(q => q.includes('"@florent-leborgne"') && q.includes('in:comments'));
  assert.equal(pageCounts.get(mentionsQ), 5);
  assert.ok(inlineQ, 'expected an inline PR comments search query');
  assert.equal(pageCounts.get(inlineQ), 2);
});
