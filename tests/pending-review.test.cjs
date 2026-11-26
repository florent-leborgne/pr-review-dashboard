const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1].replace(/\binit\(\);\s*$/, '');
const ME = 'florent-leborgne';

function dashboard() {
  const storage = new Map([['prd_token', 'test-token'], ['prd_user', ME]]);
  const element = () => ({ innerHTML: '', textContent: '', disabled: false, classList: { add() {}, remove() {} } });
  const context = vm.createContext({
    console, Date, setTimeout, clearTimeout,
    localStorage: {
      getItem: key => (storage.has(key) ? storage.get(key) : null),
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: key => storage.delete(key),
    },
    document: {
      documentElement: { setAttribute() {} },
      getElementById: element,
      querySelectorAll: () => [],
      createElement: () => {
        let text = '';
        return {
          set textContent(v) { text = String(v); },
          get innerHTML() { return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); },
        };
      },
    },
  });
  vm.runInContext(script, context);
  return context;
}

const review = (login, state, createdAt, comments = 0) => ({ author: { login, __typename: 'User' }, state, createdAt, comments: { totalCount: comments } });

function searchPR(number, reviews) {
  return {
    number,
    title: `PR ${number}`,
    url: `https://github.com/elastic/kibana/pull/${number}`,
    createdAt: '2026-11-20T10:00:00Z',
    updatedAt: '2026-11-26T10:00:00Z',
    isDraft: false,
    author: { login: 'kertal', avatarUrl: '' },
    repository: { nameWithOwner: 'elastic/kibana', isArchived: false },
    labels: { nodes: [] },
    reviewRequests: { nodes: [{ asCodeOwner: false, requestedReviewer: { login: ME } }] },
    reviews: { nodes: reviews },
    comments: { nodes: [] },
    commits: { nodes: [] },
  };
}

async function loadReviewRequests(prs) {
  const app = dashboard();
  for (const fn of ['loadUserStatus', 'setLoadingState', 'refreshMentions', 'renderPRs', 'renderMyPRs', 'renderMentions', 'updateCounts', 'updateHero']) {
    app[fn] = () => {};
  }
  app.fetchMyPRs = async () => {};
  app.searchPRs = async query => (query.includes(`review-requested:${ME}`) ? prs : []);
  await app.fetchPRs();
  return { app, prs: vm.runInContext('allPRs', app) };
}

test('an unsubmitted review leaves the PR under Review required and shows its own chip', async () => {
  const { app, prs } = await loadReviewRequests([
    searchPR(1, [review(ME, 'PENDING', '2026-11-26T10:37:10Z', 3)]),
  ]);

  assert.equal(prs.length, 1);
  assert.equal(prs[0].myState, 'NONE');
  assert.equal(prs[0].myLastActivityAt, null);
  assert.deepEqual({ ...prs[0].myDraftReview }, { comments: 3, startedAt: '2026-11-26T10:37:10Z' });

  const me = prs[0].otherReviewers.find(r => r.login === ME);
  assert.equal(me.state, 'PENDING', 'still shown as review requested, not as commented');

  const card = app.renderPRCard(prs[0]);
  assert.match(card, /Review not submitted · 3 comments/);
  assert.match(card, /Review required/);
});

test('a draft on top of a submitted comment keeps Commented and adds the chip', async () => {
  const { app, prs } = await loadReviewRequests([
    searchPR(2, [
      review(ME, 'PENDING', '2026-11-26T10:37:10Z', 1),
      review(ME, 'COMMENTED', '2026-11-24T09:00:00Z', 2),
    ]),
  ]);

  assert.equal(prs[0].myState, 'COMMENTED');
  assert.equal(prs[0].myLastActivityAt, '2026-11-24T09:00:00Z');
  assert.match(app.renderPRCard(prs[0]), /Review not submitted · 1 comment</);
});

test('a PR with only submitted reviews gets no chip', async () => {
  const { app, prs } = await loadReviewRequests([
    searchPR(3, [review(ME, 'COMMENTED', '2026-11-24T09:00:00Z', 2)]),
  ]);

  assert.equal(prs[0].myDraftReview, null);
  assert.doesNotMatch(app.renderPRCard(prs[0]), /Review not submitted/);
});

test('an approved PR stays visible while you have a draft review open on it', async () => {
  const { app, prs } = await loadReviewRequests([
    searchPR(6, [
      review(ME, 'APPROVED', '2026-11-25T11:20:51Z', 33),
      review(ME, 'PENDING', '2026-11-26T10:37:10Z', 3),
    ]),
    searchPR(7, [review(ME, 'APPROVED', '2026-11-25T11:20:51Z')]),
  ]);

  assert.equal(prs.map(pr => pr.number).join(','), '6');
  assert.equal(prs[0].myState, 'APPROVED');
  const card = app.renderPRCard(prs[0]);
  assert.match(card, /class="pr-card approved/);
  assert.match(card, /Approved <span/);
  assert.match(card, /Review not submitted · 3 comments/);
});

test('My PRs ignores your own unsubmitted review when it decides who spoke last', async () => {
  const app = dashboard();
  app.searchMyPRs = async () => [{
    ...searchPR(4, [
      review('kertal', 'COMMENTED', '2026-11-25T09:00:00Z'),
      review(ME, 'PENDING', '2026-11-26T10:00:00Z', 2),
    ]),
    author: { login: ME, avatarUrl: '' },
    reviewRequests: { nodes: [] },
    timelineItems: { nodes: [] },
    headCommit: { nodes: [] },
  }];
  await app.fetchMyPRs();

  const [pr] = vm.runInContext('myOwnPRs', app);
  assert.equal(pr.needsAttention, true);
  assert.equal(pr.otherReviewers.some(r => r.login === ME), false);
});

function mentionNode(threadComments, reviews = []) {
  return {
    __typename: 'PullRequest',
    number: 5,
    title: 'PR 5',
    url: 'https://github.com/elastic/kibana/pull/5',
    state: 'OPEN',
    createdAt: '2026-11-20T10:00:00Z',
    lastEditedAt: null,
    body: '',
    author: { login: 'kertal', __typename: 'User' },
    repository: { nameWithOwner: 'elastic/kibana', isArchived: false },
    comments: { nodes: [] },
    reviews: { nodes: reviews },
    reviewThreads: { nodes: [{ isResolved: false, comments: { nodes: threadComments } }] },
  };
}

const threadComment = (login, createdAt, body, state = 'SUBMITTED') => ({ url: `u-${createdAt}`, createdAt, body, state, path: 'docs/a.md', author: { login, __typename: 'User' } });

test('a pending reply does not clear a tag, but a submitted one does', () => {
  const app = dashboard();
  const matchers = app.buildTagMatchers(ME);
  const tag = threadComment('kertal', '2026-11-25T09:00:00Z', `@${ME} can you check this wording?`);

  const pending = app.deriveMentionItem(mentionNode(
    [tag, threadComment(ME, '2026-11-26T10:00:00Z', 'Sure', 'PENDING')],
    [{ url: 'r1', createdAt: '2026-11-26T10:00:00Z', body: '', state: 'PENDING', author: { login: ME, __typename: 'User' } }],
  ), ME, matchers);
  assert.equal(pending?.events[0].type, 'tag');

  const sent = app.deriveMentionItem(mentionNode(
    [tag, threadComment(ME, '2026-11-26T10:00:00Z', 'Sure')],
  ), ME, matchers);
  assert.equal(sent, null);
});

test('a reply to your comment stays open while your answer is still a draft', () => {
  const app = dashboard();
  const item = app.deriveMentionItem(mentionNode([
    threadComment(ME, '2026-11-24T09:00:00Z', 'Suggest "select" here.'),
    threadComment('kertal', '2026-11-25T09:00:00Z', 'Done, what about the title?'),
    threadComment(ME, '2026-11-26T10:00:00Z', 'Looks good', 'PENDING'),
  ]), ME, app.buildTagMatchers(ME));

  assert.equal(item?.events[0].type, 'reply');
  assert.equal(item.events[0].author, 'kertal');
});
