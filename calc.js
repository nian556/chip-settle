// 計算邏輯（不碰畫面），網頁和單元測試共用
(function (root) {
  // 把輸入值轉成數字；空白或不是數字就回傳 null
  function num(v) {
    if (v === '' || v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  // ---------- 最少付款筆數 ----------
  // 把有輸贏的人分成「總和為 0」的小組，組數越多，付款筆數越少（每組 k 人只需 k-1 筆）。
  function greedy(group) {
    const cred = group.filter((x) => x.amt > 0).map((x) => ({ i: x.i, amt: x.amt }));
    const debt = group.filter((x) => x.amt < 0).map((x) => ({ i: x.i, amt: -x.amt }));
    const out = [];
    while (cred.length && debt.length) {
      cred.sort((a, b) => b.amt - a.amt);
      debt.sort((a, b) => b.amt - a.amt);
      const c = cred[0], d = debt[0];
      const pay = Math.min(c.amt, d.amt);
      out.push({ from: d.i, to: c.i, amt: pay });
      c.amt -= pay; d.amt -= pay;
      if (!c.amt) cred.shift();
      if (!d.amt) debt.shift();
    }
    return out;
  }
  function settle(balances) {
    const items = balances.filter((b) => b.amt !== 0);
    const m = items.length;
    if (!m) return [];
    if (m > 16) return greedy(items);
    const N = 1 << m;
    const sum = new Array(N).fill(0);
    const dp = new Array(N).fill(0);
    for (let mask = 1; mask < N; mask++) {
      const low = mask & -mask;
      sum[mask] = sum[mask ^ low] + items[31 - Math.clz32(low)].amt;
      let best = 0;
      for (let i = 0; i < m; i++) if (mask & (1 << i)) best = Math.max(best, dp[mask ^ (1 << i)]);
      dp[mask] = best + (sum[mask] === 0 ? 1 : 0);
    }
    // 回推出各個總和為 0 的小組
    const groups = [];
    let mask = N - 1, cur = [];
    while (mask) {
      const add = sum[mask] === 0 ? 1 : 0;
      for (let i = 0; i < m; i++) {
        const bit = 1 << i;
        if ((mask & bit) && dp[mask ^ bit] + add === dp[mask]) {
          cur.push(items[i]);
          mask ^= bit;
          if (sum[mask] === 0) { groups.push(cur); cur = []; }
          break;
        }
      }
    }
    return groups.flatMap(greedy);
  }

  // ---------- 盈虧計算 ----------
  // state 需要有 rate（1 籌碼幾元）和 players（每人的 initial、final）
  function compute(state) {
    const rate = num(state.rate) > 0 ? num(state.rate) : 1;
    const rows = state.players.map((p, i) => {
      const init = num(p.initial) ?? 0;
      const fin = num(p.final);
      return { i, init, fin, diff: fin === null ? null : fin - init };
    });
    const missing = rows.filter((r) => r.fin === null).length;
    const totalInit = rows.reduce((a, r) => a + r.init, 0);
    const totalFin = rows.reduce((a, r) => a + (r.fin ?? 0), 0);
    const gap = Math.round((totalFin - totalInit) * 1e6) / 1e6;
    const balanced = missing === 0 && gap === 0;

    rows.forEach((r) => { r.cents = r.diff === null ? null : Math.round(r.diff * rate * 100); });
    if (balanced) {
      // 換算後的小數尾差，交給輸贏最大的人吸收，讓合計剛好為 0
      const resid = rows.reduce((a, r) => a + r.cents, 0);
      if (resid) {
        const big = rows.reduce((a, r) => (Math.abs(r.cents) > Math.abs(a.cents) ? r : a));
        big.cents -= resid;
      }
    }
    return { rows, missing, totalInit, totalFin, gap, balanced };
  }

  const api = { num, greedy, settle, compute };
  // 在 Node（測試）用 module.exports，在網頁用 window.ChipCalc
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ChipCalc = api;
})(typeof window !== 'undefined' ? window : globalThis);
