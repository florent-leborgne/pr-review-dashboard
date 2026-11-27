const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1].replace(/\binit\(\);\s*$/, '');
const ME = 'florent-leborgne';
const NOW = Date.parse('2026-11-26T12:00:00Z');

function dashboard() {
  const storage = new Map([['prd_token', 'test-token'], ['prd_user', ME]]);
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, { innerHTML: '', textContent: '', className: '', title: '', disabled: false, classList: { add() {}, remove() {}, toggle() {} } });
    return elements.get(id);
  };
  const context = vm.createContext({
    console, setTimeout, clearTimeout,
    Date: class extends Date {
      constructor(...args) { super(...(args.length ? args : [NOW])); }
      static now() { return NOW; }
    },
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

const user = login => ({ login, __typename: 'User' });
const review = (login, state, createdAt) => ({ author: user(login), state, createdAt });
const comment = (login, createdAt, body, extra = {}) => ({
  author: user(login), createdAt, body, state: 'SUBMITTED', url: `https://github.com/c/${createdAt}`, ...extra,
});
const thread = (isResolved, comments, isOutdated = false) => ({
  isResolved,
  isOutdated,
  first: { nodes: [comments[0]] },
  latest: { nodes: comments.slice(-3) },
});

function approvedPR(overrides = {}) {
  return {
    number: 101,
    title: 'Rename the Patterns tab actions',
    url: 'https://github.com/elastic/kibana/pull/101',
    state: 'OPEN',
    mergedAt: null,
    closedAt: null,
    updatedAt: '2026-11-26T09:00:00Z',
    isDraft: false,
    mergeQueueEntry: null,
    author: user('mchen'),
    repository: { nameWithOwner: 'elastic/kibana', isArchived: false },
    reviews: { nodes: [review(ME, 'APPROVED', '2026-11-24T10:00:00Z')] },
    reviewThreads: { nodes: [] },
    commits: { nodes: [{ commit: { statusCheckRollup: { state: 'SUCCESS' } } }] },
    ...overrides,
  };
}

test('acknowledgements are short replies made only of known words, links, and commit hashes', () => {
  const app = dashboard();
  for (const body of [
    'Done',
    'Done in 3f9c2e1',
    'Fixed in https://github.com/elastic/kibana/pull/101/commits/3f9c2e1a',
    'Addressed, thanks!',
    '👍',
    ':+1:',
    'Good catch, updated.',
    'Applied the suggestion',
    'Done in `3f9c2e1`, thank you',
    'Applied in 801246f36293, thanks.',
    'Implemented all of your suggestions in https://github.com/elastic/kibana/pull/305633/commits/abc1234',
    'Implemented all in https://github.com/elastic/kibana/pull/304435/commits/def5678',
    'Addressed in [address feedback: update reason description](https://github.com/elastic/kibana/pull/306574/changes/fc297ab456be378116441fdadd0ea2baf7b0362b). Thanks"',
    'Fixed in https://github.com/elastic/kibana/compare/main...branch?expand=1',
  ]) {
    assert.equal(app.isAckReply(body), true, body);
  }
  for (const body of [
    'Done, but should this say Field statistics?',
    'Should this say "Field statistics" or "Field stats"?',
    "I'm not sure about this one. The UI says Field stats in 9.3.",
    'Done. Also, can you look at the title again',
    '',
  ]) {
    assert.equal(app.isAckReply(body), false, body);
  }
});

test('only an approval inside the window, as your latest decision, makes a card', () => {
  const app = dashboard();
  const item = app.deriveApprovedItem(approvedPR(), ME, NOW, 7);
  assert.equal(item.key, 'elastic/kibana#101');
  assert.equal(item.approvedAt, '2026-11-24T10:00:00Z');
  assert.equal(item.state, 'OPEN');
  assert.equal(item.ciState, 'success');

  const changed = approvedPR({ reviews: { nodes: [
    review(ME, 'APPROVED', '2026-11-24T10:00:00Z'),
    review(ME, 'CHANGES_REQUESTED', '2026-11-25T10:00:00Z'),
  ] } });
  assert.equal(app.deriveApprovedItem(changed, ME, NOW, 7), null, 'request changes after the approval');

  const commentedLater = approvedPR({ reviews: { nodes: [
    review(ME, 'APPROVED', '2026-11-24T10:00:00Z'),
    review(ME, 'COMMENTED', '2026-11-25T10:00:00Z'),
  ] } });
  assert.notEqual(app.deriveApprovedItem(commentedLater, ME, NOW, 7), null, 'a comment does not revoke the approval');

  const dismissed = approvedPR({ reviews: { nodes: [review(ME, 'DISMISSED', '2026-11-24T10:00:00Z')] } });
  assert.equal(app.deriveApprovedItem(dismissed, ME, NOW, 7), null, 'dismissed approval');

  const old = approvedPR({ reviews: { nodes: [review(ME, 'APPROVED', '2026-11-10T10:00:00Z')] } });
  assert.equal(app.deriveApprovedItem(old, ME, NOW, 7), null, 'outside 7 days');
  assert.notEqual(app.deriveApprovedItem(old, ME, NOW, 30), null, 'inside 30 days');

  const mine = approvedPR({ author: user(ME) });
  assert.equal(app.deriveApprovedItem(mine, ME, NOW, 7), null, 'own PR');

  const archived = approvedPR({ repository: { nameWithOwner: 'elastic/old', isArchived: true } });
  assert.equal(app.deriveApprovedItem(archived, ME, NOW, 7), null, 'archived repo');
});

test('threads you started are counted, including ones from before the approval', () => {
  const app = dashboard();
  const item = app.deriveApprovedItem(approvedPR({ reviewThreads: { nodes: [
    thread(true, [comment(ME, '2026-11-23T09:00:00Z', 'Typo here')]),
    thread(false, [comment(ME, '2026-11-24T10:00:00Z', 'Suggest "select".')]),
    thread(false, [comment(ME, '2026-11-24T10:00:00Z', 'Lowercase?'), comment('mchen', '2026-11-25T08:00:00Z', 'Done in 3f9c2e1')]),
    thread(false, [comment('akumar', '2026-11-24T08:00:00Z', 'Not my thread')]),
  ] } }), ME, NOW, 7);

  assert.deepEqual({ ...item.threads }, { total: 3, resolved: 1, outdated: 0 });
});

test('outdated threads count as addressed, unless a real reply waits in one', () => {
  const app = dashboard();
  const mine = comment(ME, '2026-11-24T10:00:00Z', 'Suggest "select".');
  const merged = threads => approvedPR({ state: 'MERGED', mergedAt: '2026-11-25T10:00:00Z', reviewThreads: { nodes: threads } });

  assert.equal(app.deriveApprovedItem(merged([
    thread(true, [mine]),
    thread(false, [mine], true),
    thread(false, [mine, comment('mchen', '2026-11-25T08:00:00Z', 'Applied in 801246f36293, thanks.')], true),
  ]), ME, NOW, 7), null, 'resolved or outdated, with only an acknowledgement');

  const question = app.deriveApprovedItem(merged([
    thread(false, [mine, comment('mchen', '2026-11-25T08:00:00Z', 'Which wording do you prefer?')], true),
  ]), ME, NOW, 7);
  assert.equal(question?.needsLook, true, 'a real reply keeps it');

  const stillOpen = app.deriveApprovedItem(merged([thread(false, [mine], true), thread(false, [mine])]), ME, NOW, 7);
  assert.deepEqual({ ...stillOpen.threads }, { total: 2, resolved: 0, outdated: 1 });

  const handled = app.renderApprovedCard(app.deriveApprovedItem(approvedPR({ reviewThreads: { nodes: [
    thread(true, [mine]), thread(false, [mine], true), thread(false, [mine], true),
  ] } }), ME, NOW, 7));
  assert.match(handled, /ra-chip ok/);
  assert.match(handled, /1 of 3 comments resolved · 2 outdated/);

  assert.match(app.renderApprovedCard(stillOpen), /ra-chip open[^>]*>.*0 of 2 comments resolved · 1 outdated/s);
});

test('merged or closed PRs stay only while one of your threads is unresolved', () => {
  const app = dashboard();
  const resolved = { nodes: [thread(true, [comment(ME, '2026-11-24T10:00:00Z', 'Nit')])] };
  const open = { nodes: [thread(false, [comment(ME, '2026-11-24T10:00:00Z', 'Nit')])] };

  assert.equal(app.deriveApprovedItem(approvedPR({ state: 'MERGED', mergedAt: '2026-11-25T10:00:00Z', reviewThreads: resolved }), ME, NOW, 7), null);
  assert.equal(app.deriveApprovedItem(approvedPR({ state: 'MERGED', mergedAt: '2026-11-25T10:00:00Z' }), ME, NOW, 7), null, 'no threads at all');
  assert.equal(app.deriveApprovedItem(approvedPR({ state: 'CLOSED', closedAt: '2026-11-25T10:00:00Z', reviewThreads: resolved }), ME, NOW, 7), null);

  const merged = app.deriveApprovedItem(approvedPR({ state: 'MERGED', mergedAt: '2026-11-25T10:00:00Z', reviewThreads: open }), ME, NOW, 7);
  assert.equal(merged.state, 'MERGED');
  assert.equal(app.deriveApprovedItem(approvedPR({ reviewThreads: resolved }), ME, NOW, 7).state, 'OPEN', 'open PRs always stay');
});

test('a real reply needs a look, an acknowledgement does not', () => {
  const app = dashboard();
  const withReply = body => approvedPR({ reviewThreads: { nodes: [
    thread(false, [comment(ME, '2026-11-24T10:00:00Z', 'Lowercase?'), comment('mchen', '2026-11-25T08:00:00Z', body)]),
  ] } });

  const question = app.deriveApprovedItem(withReply('Should this say "Field stats"?'), ME, NOW, 7);
  assert.equal(question.needsLook, true);
  assert.equal(question.replies.length, 1);
  assert.equal(question.replies[0].author, 'mchen');
  assert.equal(question.replies[0].ack, false);

  const ack = app.deriveApprovedItem(withReply('Done in 3f9c2e1'), ME, NOW, 7);
  assert.equal(ack.needsLook, false);
  assert.equal(ack.replies[0].ack, true);
});

test('your answer, a draft answer, bots, and resolved threads are handled', () => {
  const app = dashboard();
  const prWith = (isResolved, comments) => approvedPR({ reviewThreads: { nodes: [thread(isResolved, comments)] } });
  const mine = comment(ME, '2026-11-24T10:00:00Z', 'Lowercase?');
  const question = comment('mchen', '2026-11-25T08:00:00Z', 'Which one?');

  const answered = app.deriveApprovedItem(prWith(false, [mine, question, comment(ME, '2026-11-25T09:00:00Z', 'The first')]), ME, NOW, 7);
  assert.equal(answered.needsLook, false, 'you answered last');

  const draft = app.deriveApprovedItem(prWith(false, [mine, question, comment(ME, '2026-11-25T09:00:00Z', 'The first', { state: 'PENDING' })]), ME, NOW, 7);
  assert.equal(draft.needsLook, true, 'an unsubmitted answer is not an answer');

  const bot = app.deriveApprovedItem(prWith(false, [mine, comment('elasticmachine', '2026-11-25T08:00:00Z', 'Build failed?')]), ME, NOW, 7);
  assert.equal(bot.needsLook, false, 'service accounts are ignored');

  const resolved = app.deriveApprovedItem(prWith(true, [mine, question]), ME, NOW, 7);
  assert.equal(resolved.needsLook, false, 'a resolved thread needs nothing');
});

function setApproved(app, items) {
  app.__items = items;
  vm.runInContext('approvedItems = __items; approvedLoaded = true', app);
}

test('a dismissed card comes back for a new real reply, not for an acknowledgement', () => {
  const app = dashboard();
  const mine = comment(ME, '2026-11-24T10:00:00Z', 'Lowercase?');
  const first = comment('mchen', '2026-11-25T08:00:00Z', 'Which one?');
  const set = comments => setApproved(app, [
    app.deriveApprovedItem(approvedPR({ reviewThreads: { nodes: [thread(false, comments)] } }), ME, NOW, 7),
  ]);

  set([mine, first]);
  assert.equal(app.computeApprovedView().attention, 1);
  app.dismissApproved('elastic/kibana#101');
  let view = app.computeApprovedView();
  assert.equal(view.active.length, 0);
  assert.equal(view.dismissed.length, 1);
  assert.equal(view.attention, 0);

  set([mine, first, comment('mchen', '2026-11-25T10:00:00Z', 'Done, thanks')]);
  assert.equal(app.computeApprovedView().active.length, 0, 'an acknowledgement keeps it dismissed');

  set([mine, first, comment('mchen', '2026-11-25T11:00:00Z', 'Actually, what about the title?')]);
  view = app.computeApprovedView();
  assert.equal(view.active.length, 1, 'a real reply brings it back');
  assert.equal(view.attention, 1);

  app.dismissApproved('elastic/kibana#101');
  app.restoreApproved('elastic/kibana#101');
  assert.equal(app.computeApprovedView().active.length, 1);
});

test('one search covers open, merged, and closed PRs inside the window', async () => {
  const app = dashboard();
  const queries = [];
  app.searchApprovedPRs = async q => { queries.push(q); return [approvedPR(), approvedPR({ number: 102, author: user(ME) })]; };
  app.renderApproved = () => {};
  await app.fetchApproved();

  assert.equal(queries.length, 1);
  assert.equal(queries[0], `is:pr reviewed-by:${ME} -author:${ME} updated:>=2026-11-19`);
  assert.doesNotMatch(queries[0], /is:open/);
  assert.equal(vm.runInContext('approvedItems', app).map(it => it.number).join(','), '101');

  app.searchApprovedPRs = async () => { throw new Error('rate limited'); };
  await app.refreshApproved();
  assert.equal(vm.runInContext('approvedItems', app).length, 1, 'a failed refresh keeps the last data');
});

test('All never shows approved PRs, the Recently approved filter does', () => {
  const app = dashboard();
  setApproved(app, [app.deriveApprovedItem(approvedPR({ title: 'Approved one' }), ME, NOW, 7)]);
  const container = app.document.getElementById('pr-container');

  app.renderPRs();
  assert.doesNotMatch(container.innerHTML, /Approved one/);

  vm.runInContext("currentFilter = 'approved'", app);
  app.renderPRs();
  assert.match(container.innerHTML, /Approved one/);
  assert.match(container.innerHTML, /PRs you approved in the last 7 days/);

  app.updateCounts();
  assert.equal(String(app.document.getElementById('count-approved').textContent), '1');
});

test('the count turns gold for a real reply, and the Drafts control applies', () => {
  const app = dashboard();
  const reply = approvedPR({ number: 7, isDraft: true, reviewThreads: { nodes: [
    thread(false, [comment(ME, '2026-11-24T10:00:00Z', 'Lowercase?'), comment('mchen', '2026-11-25T08:00:00Z', 'Which one?')]),
  ] } });
  setApproved(app, [app.deriveApprovedItem(reply, ME, NOW, 7), app.deriveApprovedItem(approvedPR(), ME, NOW, 7)]);
  const count = app.document.getElementById('count-approved');

  app.updateCounts();
  assert.equal(String(count.textContent), '2');
  assert.match(count.className, /has-attention/);

  app.localStorage.setItem('prd_draft_mode', 'hide');
  app.updateCounts();
  assert.equal(String(count.textContent), '1');
  assert.doesNotMatch(count.className, /has-attention/);
});

test('the window setting accepts 7, 14, or 30 days and defaults to 7', () => {
  const app = dashboard();
  assert.equal(app.getApprovedWindowDays(), 7);
  app.refreshApproved = async () => {};
  app.renderApproved = () => {};
  app.saveApprovedWindow('30');
  assert.equal(app.getApprovedWindowDays(), 30);
  app.saveApprovedWindow('5');
  assert.equal(app.getApprovedWindowDays(), 30);
});

test('cards show the landed state, the comment count, and escaped reply text', () => {
  const app = dashboard();
  const open = app.deriveApprovedItem(approvedPR({ reviewThreads: { nodes: [
    thread(true, [comment(ME, '2026-11-23T09:00:00Z', 'Typo')]),
    thread(false, [comment(ME, '2026-11-24T10:00:00Z', 'Lowercase?'), comment('mchen', '2026-11-25T08:00:00Z', 'Use <b>this</b>?')]),
  ] } }), ME, NOW, 7);
  const card = app.renderApprovedCard(open);
  assert.match(card, /needs-attention/);
  assert.match(card, /1 of 2 comments resolved/);
  assert.match(card, /@mchen replied/);
  assert.match(card, /Use &lt;b&gt;this&lt;\/b&gt;\?/);
  assert.match(card, /you approved 2d ago/);
  assert.match(card, />\s*Open</);

  const merged = app.deriveApprovedItem(approvedPR({ state: 'MERGED', mergedAt: '2026-11-25T12:00:00Z', reviewThreads: { nodes: [
    thread(false, [comment(ME, '2026-11-24T10:00:00Z', 'Nit'), comment('mchen', '2026-11-25T08:00:00Z', 'Done')]),
  ] } }), ME, NOW, 7);
  const mergedCard = app.renderApprovedCard(merged);
  assert.match(mergedCard, /mc-merged/);
  assert.match(mergedCard, /Merged 1d ago/);
  assert.match(mergedCard, /0 of 1 comment resolved/);
  assert.match(mergedCard, /Looks addressed/);
  assert.doesNotMatch(mergedCard, /needs-attention/);

  const quiet = app.renderApprovedCard(app.deriveApprovedItem(approvedPR(), ME, NOW, 7));
  assert.match(quiet, /No comments from you/);
});
