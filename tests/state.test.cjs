const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../app/state.js');
const questions = require('../data/questions.json');
const known = new Map(questions.map(q => [q.id, q]));
const q = questions.find(q => q.grading === 'auto');
const validRecord = {hash:q.hash, answer:q.answer, correct:true, at:'2026-10-23T00:00:00.000Z'};

test('rejects a malformed import before any merge', () => {
  const local = S.empty();
  local.records[q.id] = [validRecord];
  const snapshot = JSON.stringify(local);
  const incoming = {format:'cn-exercises-v1', state:S.empty()};
  incoming.state.records[q.id] = [{...validRecord, answer:'Z'}];
  assert.throws(() => S.validateExport(incoming, known), /作答字段无效/);
  assert.equal(JSON.stringify(local), snapshot);
});

test('merges attempts once and retains study, stars and drafts', () => {
  const local = S.empty();
  local.records[q.id] = [validRecord];
  local.studied['1'] = true;
  const incoming = S.empty();
  incoming.records[q.id] = [validRecord, {...validRecord, answer:q.answer === 'A' ? 'B' : 'A', correct:false, at:'2026-10-23T01:00:00.000Z'}];
  incoming.stars[q.id] = true;
  incoming.drafts[q.id] = 'scratch';
  S.validateState(incoming, known);
  const merged = S.merge(local, incoming);
  assert.equal(merged.records[q.id].length, 2);
  assert.equal(merged.studied['1'], true);
  assert.equal(merged.stars[q.id], true);
  assert.equal(merged.drafts[q.id], 'scratch');
  assert.equal(local.records[q.id].length, 1);
});

test('rejects a forged correct answer', () => {
  const incoming = S.empty();
  incoming.records[q.id] = [{...validRecord, correct:false}];
  assert.throws(() => S.validateState(incoming, known), /判分字段不一致/);
});

test('corrections retain history but require a self review under the new decision', () => {
  const rv = {status:'corrected', scoring:'self', recheckId:'recheck-20261024'};
  const oldSelf = {...validRecord, answer:'self-right'};
  assert.equal(S.currentRecord(q, rv, [validRecord, oldSelf]), null);
  const updated = {...oldSelf, reviewVersion:rv.recheckId, at:'2026-10-24T00:00:00.000Z'};
  const entries = [validRecord, oldSelf, updated];
  assert.equal(S.currentRecord(q, rv, entries), updated);
  assert.equal(S.currentRecord(q, {...rv, status:'disputed'}, entries), null);
  const state = S.empty(); state.records[q.id] = entries;
  S.validateState(state, known);
  assert.equal(entries.length, 3);
});

test('a confirmed source answer still accepts compatible old attempts', () => {
  assert.equal(S.currentRecord(q, {status:'verified', scoring:'auto'}, [validRecord]), validRecord);
  assert.equal(S.currentRecord(q, null, [{...validRecord, hash:'0'.repeat(64)}]), null);
});
