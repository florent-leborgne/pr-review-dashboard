const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const html = fs.readFileSync(require('node:path').join(__dirname, '../index.html'), 'utf8');

function dashboard() {
  const storage = new Map([['prd_token', 'token-owner'], ['prd_user', 'tracking-override']]);
  const context = vm.createContext({
    console, Date, setTimeout, clearTimeout,
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
    document: { documentElement: { setAttribute() {} }, getElementById: () => null },
  });
  vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1].replace(/\binit\(\);\s*$/, ''), context);
  return context;
}

test('busy depends on the limited-availability flag, not status text', () => {
  const app = dashboard();
  assert.equal(typeof app.getUserAvailability, 'function', 'availability feature is missing');
  assert.equal(app.getUserAvailability({ message: 'On vacation', indicatesLimitedAvailability: false }).busy, false);
  assert.equal(app.getUserAvailability({ message: '', indicatesLimitedAvailability: true }).busy, true);
  assert.equal(app.getUserAvailability(null).busy, false);
});

test('expired status clears Busy and its message at the expiration boundary', () => {
  const app = dashboard();
  const status = { message: 'Deadline', indicatesLimitedAvailability: true, expiresAt: '2026-11-08T12:00:00Z' };
  assert.equal(app.getUserAvailability(status, Date.parse('2026-11-08T11:59:59Z')).busy, true);
  const cleared = app.getUserAvailability(status, Date.parse('2026-11-08T12:00:00Z'));
  assert.equal(cleared.busy, false);
  assert.equal(cleared.message, '');
});

test('status uses the token owner and never sends the tracking username', async () => {
  const app = dashboard();
  let request;
  app.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true, json: async () => ({ data: { viewer: { login: 'actual-owner', status: null } } }) };
  };
  let rendered;
  app.renderUserStatus = () => { rendered = vm.runInContext('userAvailability', app); };
  await app.loadUserStatus();
  assert.equal(request.url, 'https://api.github.com/graphql');
  assert.equal(request.options.headers.Authorization, 'Bearer token-owner');
  assert.match(JSON.parse(request.options.body).query, /viewer\s*\{/);
  assert.doesNotMatch(request.options.body, /tracking-override/);
  assert.equal(rendered.login, 'actual-owner');
});

test('API errors become unknown instead of showing an available state', async () => {
  const app = dashboard();
  app.fetch = async () => ({ ok: false, status: 403, statusText: 'Forbidden' });
  let rendered = 'not rendered';
  app.renderUserStatus = () => { rendered = vm.runInContext('userAvailability', app); };
  await app.loadUserStatus();
  assert.equal(rendered, null);
});

test('late responses cannot replace a newer status', async () => {
  const app = dashboard();
  let completeFirst;
  let requests = 0;
  app.fetch = async () => {
    if (++requests === 1) return new Promise(resolve => { completeFirst = resolve; });
    return { ok: true, json: async () => ({ data: { viewer: { login: 'new-owner', status: null } } }) };
  };
  let rendered;
  app.renderUserStatus = () => { rendered = vm.runInContext('userAvailability', app); };
  const first = app.loadUserStatus();
  await app.loadUserStatus();
  completeFirst({ ok: true, json: async () => ({ data: { viewer: { login: 'old-owner', status: null } } }) });
  await first;
  assert.equal(rendered.login, 'new-owner');
});

test('a changed token discards an in-flight status response', async () => {
  const app = dashboard();
  app.fetch = async () => {
    app.localStorage.setItem('prd_token', 'different-token');
    return { ok: true, json: async () => ({ data: { viewer: { login: 'old-owner', status: null } } }) };
  };
  let renders = 0;
  app.renderUserStatus = () => { renders++; };
  await app.loadUserStatus();
  assert.equal(renders, 0);
});

function statusElements(app) {
  const elements = new Map();
  app.document.getElementById = id => {
    if (!elements.has(id)) elements.set(id, { hidden: false, textContent: '', className: '', setAttribute(key, value) { this[key] = value; } });
    return elements.get(id);
  };
  return id => app.document.getElementById(id);
}

test('rendering shows Busy only for busy users and hides the default label', () => {
  const app = dashboard();
  const el = statusElements(app);
  vm.runInContext("userAvailability = { login: 'owner', status: { indicatesLimitedAvailability: true } }", app);
  app.renderUserStatus();
  assert.match(el('user-status-button').className, /is-busy/);
  assert.equal(el('user-status-label').hidden, false);
  vm.runInContext("userAvailability = { login: 'owner', status: null }", app);
  app.renderUserStatus();
  assert.match(el('user-status-button').className, /is-normal/);
  assert.equal(el('user-status-label').hidden, true);
  vm.runInContext('userAvailability = null', app);
  app.renderUserStatus();
  assert.match(el('user-status-button').className, /is-unknown/);
  assert.doesNotMatch(el('user-status-button').className, /is-normal/);
});

test('untrusted messages are text and the edit link contains only the token owner login', () => {
  const app = dashboard();
  const el = statusElements(app);
  vm.runInContext(`userAvailability = { login: 'actual-owner', status: { message: '<img src=x onerror=alert(1)>', indicatesLimitedAvailability: true } }`, app);
  app.renderUserStatus();
  assert.equal(el('user-status-message').textContent, '<img src=x onerror=alert(1)>');
  assert.equal(el('user-status-message').innerHTML, undefined);
  assert.equal(el('user-status-edit').href, 'https://github.com/actual-owner');
  assert.equal(el('user-status-edit').hidden, false);
});

test('popover closes on outside click and Escape; returning to the tab refreshes status', () => {
  const app = dashboard();
  const el = statusElements(app);
  const events = {};
  app.document.addEventListener = (name, handler) => { events[name] = handler; };
  const details = el('user-status');
  details.contains = target => target === details;
  let focused = false;
  el('user-status-button').focus = () => { focused = true; };
  app.setupUserStatus();
  details.open = true;
  events.click({ target: details });
  assert.equal(details.open, true);
  events.click({ target: {} });
  assert.equal(details.open, false);
  details.open = true;
  events.keydown({ key: 'Escape' });
  assert.equal(details.open, false);
  assert.equal(focused, true);
  let refreshed = 0;
  app.loadUserStatus = () => { refreshed++; };
  app.document.visibilityState = 'hidden';
  events.visibilitychange();
  assert.equal(refreshed, 0);
  app.document.visibilityState = 'visible';
  events.visibilitychange();
  assert.equal(refreshed, 1);
});
