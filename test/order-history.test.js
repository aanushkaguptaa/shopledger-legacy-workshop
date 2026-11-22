// Run: node --test
// Fixtures are in memory; no JSON store is imported.
var test = require('node:test');
var assert = require('node:assert/strict');
var orders = require('../lib/orders');
var dates = require('../lib/dates');

function history() {
  return { orders: [
    { id: 1008, date: '15/03/2022', customer: 'Meera Joshi', status: 'completed' },
    { id: 1001, date: '28/12/2021', customer: 'Walk-in', coupon: 'SAVE10' },
    { id: 1004, date: '30/01/2022', customer: 'Meera Joshi', status: 'cancelled' }
  ] };
}

function ids(list) {
  return list.map(function (order) { return order.id; });
}

test('mixed date formats sort chronologically and equal dates retain input order', function () {
  var db = { orders: [
    { id: 1, date: '2021-12-28' },
    { id: 2, date: '15/03/2022' },
    { id: 3, date: '2022-03-15' },
    { id: 4, date: '30/01/2022' }
  ] };
  assert.deepEqual(ids(orders.list(db)), [2, 3, 4, 1]);
  assert.deepEqual(ids(orders.list(db, { from: '2022-03-15', to: '15/03/2022' })), [2, 3]);
});

test('CURRENT BEHAVIOUR: date keys remain day-first strings, including date-picker input', function () {
  assert.equal(dates.normalizeDateKey('2022-03-15'), '15/03/2022');
  assert.equal(dates.normalizeDateKey(' 15/03/2022 '), '15/03/2022');
  assert.equal(dates.normalizeDateKey(''), '');
  assert.equal(dates.normalizeDateKey(undefined), '');
});

test('orders sort newest first across months and years without mutating input', function () {
  var db = history();
  var before = JSON.stringify(db);
  assert.deepEqual(ids(orders.list(db)), [1008, 1004, 1001]);
  assert.equal(JSON.stringify(db), before);
});

[
  { name: 'March range excludes older January and December orders',
    filters: { from: '2022-03-01', to: '2022-03-31' }, ids: [1008] },
  { name: 'December-to-March range includes every order',
    filters: { from: '2021-12-28', to: '2022-03-15' }, ids: [1008, 1004, 1001] },
  { name: 'from-only March boundary excludes older orders',
    filters: { from: '2022-03-15' }, ids: [1008] },
  { name: 'to-only January boundary excludes newer March order',
    filters: { to: '2022-01-30' }, ids: [1004, 1001] },
  { name: 'equal date boundaries include their matching order',
    filters: { from: '2022-03-15', to: '2022-03-15' }, ids: [1008] },
  { name: 'slash-format boundaries behave like date-picker boundaries',
    filters: { from: '01/03/2022', to: '31/03/2022' }, ids: [1008] }
].forEach(function (example) {
  test(example.name, function () {
    assert.deepEqual(ids(orders.list(history(), example.filters)), example.ids);
  });
});

test('status and search filters compose with date filters', function () {
  assert.deepEqual(ids(orders.list(history(), {
    status: 'completed', search: ' MEERA ', from: '2022-03-01', to: '2022-03-31'
  })), [1008]);
  assert.deepEqual(ids(orders.list(history(), { status: 'completed' })), [1008, 1001]);
  assert.deepEqual(ids(orders.list(history(), { search: 'save10' })), [1001]);
  assert.deepEqual(ids(orders.list(history(), { status: 'all', search: '1004' })), [1004]);
  assert.deepEqual(orders.list({ orders: [] }), []);
});
