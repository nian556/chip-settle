// calc.js 的單元測試；執行方式：node --test tests
const test = require('node:test');
const assert = require('node:assert/strict');
const { num, settle, compute } = require('../calc.js');

// 小工具：照付款清單轉帳後，檢查每個人是不是都歸零
function applyTransfers(balances, tx) {
  const left = Object.fromEntries(balances.map((b) => [b.i, b.amt]));
  tx.forEach((t) => { left[t.from] += t.amt; left[t.to] -= t.amt; });
  return left;
}
function assertAllSettled(balances, tx) {
  const left = applyTransfers(balances, tx);
  Object.values(left).forEach((v) => assert.equal(v, 0));
  tx.forEach((t) => assert.ok(t.amt > 0, '每筆付款金額都要大於 0'));
}
const bal = (...amts) => amts.map((amt, i) => ({ i, amt }));

// 小工具：快速做出一局的資料
const game = (rate, pairs) => ({
  rate,
  players: pairs.map(([initial, final]) => ({ initial, final }))
});

// ---------- num：輸入轉數字 ----------
test('num：空白、null、undefined 都回傳 null', () => {
  assert.equal(num(''), null);
  assert.equal(num(null), null);
  assert.equal(num(undefined), null);
});
test('num：不是數字的文字回傳 null', () => {
  assert.equal(num('abc'), null);
  assert.equal(num('Infinity'), null);
});
test('num：數字文字和數字都能轉換，0 不會被當成空白', () => {
  assert.equal(num('12.5'), 12.5);
  assert.equal(num(-3), -3);
  assert.equal(num(0), 0);
  assert.equal(num('0'), 0);
});

// ---------- settle：誰付給誰 ----------
test('settle：沒人輸贏時不用付款', () => {
  assert.deepEqual(settle([]), []);
  assert.deepEqual(settle(bal(0, 0, 0)), []);
});
test('settle：兩個人，輸的付給贏的', () => {
  assert.deepEqual(settle(bal(500, -500)), [{ from: 1, to: 0, amt: 500 }]);
});
test('settle：一人贏、三人輸，需要 3 筆', () => {
  const b = bal(900, -300, -300, -300);
  const tx = settle(b);
  assert.equal(tx.length, 3);
  assertAllSettled(b, tx);
});
test('settle：能互相抵銷的配對會分開算，筆數最少', () => {
  // A 贏 100、B 輸 100、C 贏 70、D 輸 70 → 只要 2 筆
  const b = bal(100, -70, 70, -100);
  const tx = settle(b);
  assert.equal(tx.length, 2);
  assertAllSettled(b, tx);
});
test('settle：三組可抵銷的配對 → 3 筆（而不是 5 筆）', () => {
  const b = bal(10, 20, 30, -30, -20, -10);
  const tx = settle(b);
  assert.equal(tx.length, 3);
  assertAllSettled(b, tx);
});
test('settle：範例那局（+1250、−420、+470、−1300）全部結清', () => {
  const b = bal(125000, -42000, 47000, -130000);
  const tx = settle(b);
  assert.equal(tx.length, 3);
  assertAllSettled(b, tx);
});
test('settle：超過 16 人時改用簡單算法，仍然全部結清', () => {
  const amts = [];
  for (let k = 1; k <= 10; k++) amts.push(k * 100, -k * 100);
  const b = bal(...amts);
  const tx = settle(b);
  assertAllSettled(b, tx);
  assert.ok(tx.length <= b.length - 1, '筆數不會超過人數減 1');
});
test('settle：不會改到傳進去的資料', () => {
  const b = bal(300, -100, -200);
  const copy = JSON.parse(JSON.stringify(b));
  settle(b);
  assert.deepEqual(b, copy);
});

// ---------- compute：盈虧計算 ----------
test('compute：範例那局的盈虧（單位：分）', () => {
  const r = compute(game(1, [[2000, 3250], [2000, 1580], [2000, 2470], [2000, 700]]));
  assert.equal(r.balanced, true);
  assert.deepEqual(r.rows.map((x) => x.cents), [125000, -42000, 47000, -130000]);
  assert.equal(r.rows.reduce((a, x) => a + x.cents, 0), 0);
});
test('compute：有人還沒填，不算平衡', () => {
  const r = compute(game(1, [[2000, 3000], [2000, '']]));
  assert.equal(r.missing, 1);
  assert.equal(r.balanced, false);
  assert.equal(r.rows[1].cents, null);
});
test('compute：籌碼總數對不上時，算出差多少', () => {
  const r = compute(game(1, [[2000, 2100], [2000, 2000]]));
  assert.equal(r.gap, 100);
  assert.equal(r.balanced, false);
  const r2 = compute(game(1, [[2000, 1950], [2000, 2000]]));
  assert.equal(r2.gap, -50);
});
test('compute：匯率換算（1 籌碼 = 0.5 元）', () => {
  const r = compute(game(0.5, [[1000, 1300], [1000, 700]]));
  assert.deepEqual(r.rows.map((x) => x.cents), [15000, -15000]);
});
test('compute：匯率是 0、負數或空白時，當作 1', () => {
  for (const rate of [0, -2, '', 'abc']) {
    const r = compute(game(rate, [[100, 150], [100, 50]]));
    assert.deepEqual(r.rows.map((x) => x.cents), [5000, -5000], `rate=${rate}`);
  }
});
test('compute：小數尾差由輸贏最大的人吸收，合計剛好為 0', () => {
  // 1 籌碼 = 1/3 元，換算後會有四捨五入的尾差
  const r = compute(game(1 / 3, [[0, 1], [0, 1], [0, 1], [0, -3]]));
  assert.equal(r.balanced, true);
  assert.equal(r.rows.reduce((a, x) => a + x.cents, 0), 0);
  assert.deepEqual(r.rows.map((x) => x.cents), [33, 33, 33, -99]);
});
test('compute：帶入籌碼空白時當作 0', () => {
  const r = compute(game(1, [['', 100], [200, 100]]));
  assert.equal(r.totalInit, 200);
  assert.equal(r.balanced, true);
});
test('compute：小數籌碼加總不會因為浮點誤差被判定對不上', () => {
  const r = compute(game(1, [[0.1, 0.3], [0.2, 0]]));
  // 可能算出 -0，在 JavaScript 裡 -0 === 0，所以用 === 比對
  assert.ok(r.gap === 0, `gap 應為 0，實際是 ${r.gap}`);
  assert.equal(r.balanced, true);
});
