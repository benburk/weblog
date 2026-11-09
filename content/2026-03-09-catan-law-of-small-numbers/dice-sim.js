// Interactive companion for the balanced-dice post. Builds a small widget with
// a histogram of rolled sums, a view of the 36-card deck, and a model toggle
// between fair 2d6 and the balanced algorithm described in the post. No deps.
(function () {
  "use strict";

  var root = document.getElementById("dice-sim");
  if (!root) return;

  var SUMS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  // c_k: number of (die1, die2) ordered pairs that sum to k. Totals 36.
  var FULL = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 };
  var RESHUFFLE_AT = 13; // reshuffle once this many cards remain (23 draws/cycle)
  var PENALTY = 0.34; // recency multiplier per appearance in the last 5 rolls
  var WINDOW = 5;

  function naiveProb(k) {
    return (6 - Math.abs(k - 7)) / 36;
  }

  // ---- state -------------------------------------------------------------
  var model = "balanced";
  var counts = { balanced: zeros(), naive: zeros() }; // histogram tallies
  var totals = { balanced: 0, naive: 0 };
  var deck = clone(FULL); // remaining cards per sum (balanced model)
  var recent = []; // last WINDOW rolls (balanced model)
  var lastRoll = null;

  function zeros() {
    var o = {};
    SUMS.forEach(function (k) { o[k] = 0; });
    return o;
  }
  function clone(o) {
    var c = {};
    Object.keys(o).forEach(function (k) { c[k] = o[k]; });
    return c;
  }
  function remaining() {
    return SUMS.reduce(function (n, k) { return n + deck[k]; }, 0);
  }

  // ---- the two models ----------------------------------------------------
  function rollNaive() {
    var d6 = function () { return 1 + Math.floor(Math.random() * 6); };
    return d6() + d6();
  }

  function rollBalanced() {
    if (remaining() <= RESHUFFLE_AT) deck = clone(FULL); // reshuffle
    var N = remaining();
    var weights = SUMS.map(function (k) {
      var w = deck[k] / N; // stage 1: base weight from remaining cards
      var a = recent.filter(function (x) { return x === k; }).length;
      return w * Math.max(0, 1 - PENALTY * a); // stage 2: recency penalty
    });
    var k = sample(SUMS, weights);
    deck[k] -= 1;
    recent.push(k);
    if (recent.length > WINDOW) recent.shift();
    return k;
  }

  // Weighted draw; falls back to uniform over available sums if every weight
  // got penalized to zero (extremely rare, but keeps the draw well-defined).
  function sample(items, weights) {
    var total = weights.reduce(function (a, b) { return a + b; }, 0);
    if (total <= 0) return items[Math.floor(Math.random() * items.length)];
    var r = Math.random() * total;
    for (var i = 0; i < items.length; i++) {
      r -= weights[i];
      if (r < 0) return items[i];
    }
    return items[items.length - 1];
  }

  function rollOnce() {
    var k = model === "balanced" ? rollBalanced() : rollNaive();
    counts[model][k] += 1;
    totals[model] += 1;
    lastRoll = k;
  }

  function reset() {
    counts = { balanced: zeros(), naive: zeros() };
    totals = { balanced: 0, naive: 0 };
    deck = clone(FULL);
    recent = [];
    lastRoll = null;
    render();
  }

  // ---- DOM scaffold ------------------------------------------------------
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  var modelBtns = {};
  var controls = el("div", "ds-controls");
  ["balanced", "naive"].forEach(function (m) {
    var b = el("button", "ds-toggle", m === "balanced" ? "Balanced" : "Naive 2d6");
    b.addEventListener("click", function () { model = m; render(); });
    modelBtns[m] = b;
    controls.appendChild(b);
  });
  var spacer = el("span", "ds-spacer");
  controls.appendChild(spacer);
  ["Draw", "Draw 10", "Reset"].forEach(function (label) {
    var b = el("button", "ds-action", label);
    b.addEventListener("click", function () {
      if (label === "Reset") return reset();
      var n = label === "Draw 10" ? 10 : 1;
      for (var i = 0; i < n; i++) rollOnce();
      render();
    });
    controls.appendChild(b);
  });

  var chart = el("div", "ds-chart");
  var bars = {}; // per-sum { col, bar, marker, count }
  SUMS.forEach(function (k) {
    var col = el("div", "ds-col");
    var stack = el("div", "ds-stack");
    var count = el("div", "ds-count", "");
    var bar = el("div", "ds-bar");
    var marker = el("div", "ds-marker"); // expected fair-dice count
    stack.appendChild(marker);
    stack.appendChild(bar);
    col.appendChild(count);
    col.appendChild(stack);
    col.appendChild(el("div", "ds-axis", String(k)));
    chart.appendChild(col);
    bars[k] = { bar: bar, marker: marker, count: count };
  });

  var deckWrap = el("div", "ds-deck");
  var deckCols = {};
  SUMS.forEach(function (k) {
    var col = el("div", "ds-deck-col");
    var cells = [];
    for (var i = 0; i < FULL[k]; i++) {
      var cell = el("div", "ds-card");
      col.appendChild(cell);
      cells.push(cell);
    }
    col.appendChild(el("div", "ds-axis", String(k)));
    deckWrap.appendChild(col);
    deckCols[k] = cells;
  });

  var status = el("div", "ds-status");

  root.appendChild(controls);
  root.appendChild(el("div", "ds-label", "Rolled sums"));
  root.appendChild(chart);
  var deckLabel = el("div", "ds-label", "Deck (cards remaining this cycle)");
  root.appendChild(deckLabel);
  root.appendChild(deckWrap);
  root.appendChild(status);

  // ---- render ------------------------------------------------------------
  function render() {
    Object.keys(modelBtns).forEach(function (m) {
      modelBtns[m].classList.toggle("ds-on", m === model);
    });

    var c = counts[model];
    var total = totals[model];
    var max = Math.max(1, Math.max.apply(null, SUMS.map(function (k) { return c[k]; })));
    SUMS.forEach(function (k) {
      bars[k].bar.style.height = (100 * c[k] / max) + "%";
      bars[k].count.textContent = c[k] ? String(c[k]) : "";
      // Dashed marker at the fair-dice expected count, for visual comparison.
      var expected = total * naiveProb(k);
      bars[k].marker.style.bottom = Math.min(100, 100 * expected / max) + "%";
      bars[k].marker.style.display = total > 0 ? "block" : "none";
    });

    // Deck panel only applies to the balanced model; the naive model rolls
    // independent dice with no deck.
    var isBalanced = model === "balanced";
    deckWrap.classList.toggle("ds-faded", !isBalanced);
    deckLabel.style.opacity = isBalanced ? "1" : "0.4";
    SUMS.forEach(function (k) {
      var live = isBalanced ? deck[k] : FULL[k];
      deckCols[k].forEach(function (cell, i) {
        cell.classList.toggle("ds-drawn", isBalanced && i >= live);
      });
    });

    var parts = ["Rolls: " + total];
    if (lastRoll != null) parts.push("Last: " + lastRoll);
    if (isBalanced) parts.push("Draws until reshuffle: " + (remaining() - RESHUFFLE_AT));
    status.textContent = parts.join("    |    ");
  }

  render();
})();
