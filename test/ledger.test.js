// Run: node --test
// Fixtures are in memory; no JSON store is imported.
var test = require('node:test');
var assert = require('node:assert/strict');
var ledger = require('../lib/ledger');

function khata() {
  return {
    customers: [{ id: 1, name: 'Meera Joshi', openingBalance: 0,
      totalBilled: 2432.01, totalSettled: 1200, balance: 1232.01 }],
    nextSettlementId: 501,
    settlements: [{ id: 500, amount: 1200 }]
  };
}

test('non-numeric and non-finite settlements are rejected without mutation', function () {
  ['abc', 'Infinity', Infinity, NaN].forEach(function (amount) {
    var db = khata();
    var before = JSON.stringify(db);
    assert.equal(ledger.recordSettlement(db, 1, amount).ok, false);
    assert.equal(JSON.stringify(db), before);
  });
});

test('fractional settlements keep the cumulative total rounded to paise', function () {
  var db = khata();
  db.customers[0].totalSettled = 0.1;
  var result = ledger.recordSettlement(db, 1, '0.20');
  assert.equal(result.customer.totalSettled, 0.3);
  assert.equal(result.settlement.amount, 0.2);
});

test('string settlement adds numerically and leaves Meera owing 732.01', function () {
  var db = khata();
  var before = ledger.listCustomers(db)[0];
  assert.equal(before.totalSettled, 1200);
  assert.equal(before.balance, 1232.01);

  // The browser sends the input value as a string; the route passes it through.
  var result = ledger.recordSettlement(db, '1', '500', 'cash', 'Part payment');
  assert.equal(result.ok, true);
  assert.equal(result.customer, db.customers[0]);
  assert.equal(result.customer.totalSettled, 1700);
  assert.equal(result.customer.balance, 732.01);
  assert.equal(result.settlement.amount, 500);
  assert.equal(result.settlement.id, 501);
  assert.equal(result.settlement.customerId, 1);
  assert.equal(result.settlement.customerName, 'Meera Joshi');
  assert.equal(result.settlement.mode, 'cash');
  assert.equal(result.settlement.note, 'Part payment');
  assert.match(result.settlement.date, /^\d{2}\/\d{2}\/\d{4}$/);
  assert.equal(db.nextSettlementId, 502);
  assert.equal(db.settlements[0], result.settlement);
  assert.deepEqual(db.settlements[1], { id: 500, amount: 1200 });
  var displayed = ledger.listCustomers(db)[0];
  assert.equal(displayed.totalSettled, 1700);
  assert.equal(displayed.balance, 732.01);
});

test('CURRENT BEHAVIOUR: numeric settlement adds correctly and creates missing settlement history', function () {
  var db = khata();
  delete db.settlements;
  var result = ledger.recordSettlement(db, 1, 500);
  assert.equal(result.ok, true);
  assert.equal(result.customer.totalSettled, 1700);
  assert.equal(result.customer.balance, 732.01);
  assert.equal(result.settlement.amount, 500);
  assert.equal(result.settlement.mode, 'upi');
  assert.equal(result.settlement.note, 'Khata settlement');
  assert.deepEqual(db.settlements, [result.settlement]);
});

test('a stored string total is added numerically to a settlement', function () {
  var db = khata();
  db.customers[0].totalSettled = '1200';
  var result = ledger.recordSettlement(db, 1, 500);
  assert.equal(result.customer.totalSettled, 1700);
  assert.equal(result.customer.balance, 732.01);
});

test('CURRENT BEHAVIOUR: zero, negative and missing amounts are rejected without mutation', function () {
  [0, '0', -500, '-500', '', null, undefined].forEach(function (amount) {
    var db = khata();
    var before = JSON.stringify(db);
    assert.deepEqual(ledger.recordSettlement(db, 1, amount), {
      ok: false, error: 'Settlement amount must be greater than zero'
    });
    assert.equal(JSON.stringify(db), before);
  });
});

test('CURRENT BEHAVIOUR: unknown customer is rejected without mutation', function () {
  var db = khata();
  var before = JSON.stringify(db);
  assert.deepEqual(ledger.recordSettlement(db, 999, '500'), {
    ok: false, error: 'Customer not found'
  });
  assert.equal(JSON.stringify(db), before);
});
