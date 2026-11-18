const $ = (id) => document.getElementById(id);

let originalDFA = null;
let minimizedDFA = null;
let steps = [];
let currentStep = 0;

function splitValues(value) {
  return value.split(",").map(x => x.trim()).filter(Boolean);
}

function renderTransitionInputs() {
  const old = {};
  document.querySelectorAll(".transition-input").forEach(i => old[i.dataset.state + "|" + i.dataset.symbol] = i.value);
  const states = splitValues($("states").value);
  const alphabet = splitValues($("alphabet").value);
  if (!states.length || !alphabet.length) {
    $("transitionTable").innerHTML = "<p class='hint'>Enter states and alphabet first.</p>";
    return;
  }

  let html = "<table><thead><tr><th>State</th>" +
    alphabet.map(a => `<th>${escapeHtml(a)}</th>`).join("") +
    "</tr></thead><tbody>";

  states.forEach(state => {
    html += `<tr><th>${escapeHtml(state)}</th>`;
    alphabet.forEach(symbol => {
      html += `<td><input class="transition-input" data-state="${escapeAttr(state)}" data-symbol="${escapeAttr(symbol)}" aria-label="Transition from ${escapeAttr(state)} on ${escapeAttr(symbol)}" value="${escapeAttr(old[state + "|" + symbol] || "")}"></td>`;
    });
    html += "</tr>";
  });
  html += "</tbody></table>";
  $("transitionTable").innerHTML = html;
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}
function escapeAttr(text) { return escapeHtml(text); }

function loadExample() {
  $("states").value = "A, B, C, D, E, F, G";
  $("alphabet").value = "0, 1";
  $("initial").value = "A";
  $("finals").value = "C, D, E";
  renderTransitionInputs();
  const values = {
    "A|0": "B", "A|1": "C", "B|0": "A", "B|1": "D",
    "C|0": "E", "C|1": "F", "D|0": "E", "D|1": "F",
    "E|0": "E", "E|1": "F", "F|0": "F", "F|1": "F",
    "G|0": "A", "G|1": "G"
  };
  document.querySelectorAll(".transition-input").forEach(input => {
    input.value = values[`${input.dataset.state}|${input.dataset.symbol}`] || "";
  });
  clearOutput();
}

function readDFA() {
  const states = splitValues($("states").value);
  const alphabet = splitValues($("alphabet").value);
  const initial = $("initial").value.trim();
  const finals = splitValues($("finals").value);
  if (!states.length) throw new Error("Enter at least one state.");
  if (!alphabet.length) throw new Error("Enter at least one alphabet symbol.");
  if (new Set(states).size !== states.length) throw new Error("State names must be unique.");
  if (new Set(alphabet).size !== alphabet.length) throw new Error("Alphabet symbols must be unique.");
  if (alphabet.some(a => [...a].length !== 1)) throw new Error("Each alphabet symbol must be a single character.");
  if (!states.includes(initial)) throw new Error("Initial state must be one of the listed states.");
  for (const f of finals) if (!states.includes(f)) throw new Error(`Final state '${f}' is not listed.`);

  const transitions = {};
  states.forEach(s => transitions[s] = {});
  document.querySelectorAll(".transition-input").forEach(input => {
    const s = input.dataset.state;
    const a = input.dataset.symbol;
    const destination = input.value.trim();
    if (!destination) throw new Error(`Missing transition: ${s} on ${a}.`);
    if (!states.includes(destination)) throw new Error(`Destination '${destination}' is not a listed state.`);
    transitions[s][a] = destination;
  });
  return { states, alphabet, initial, finals, transitions };
}

function reachableStates(dfa) {
  const visited = new Set([dfa.initial]);
  const queue = [dfa.initial];
  while (queue.length) {
    const state = queue.shift();
    for (const symbol of dfa.alphabet) {
      const next = dfa.transitions[state][symbol];
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
  return dfa.states.filter(s => visited.has(s));
}

function normalizePartition(partition) {
  return partition.map(group => group.slice().sort()).sort((a, b) => a[0].localeCompare(b[0]));
}

function partitionSignature(state, dfa, partition) {
  return dfa.alphabet.map(symbol => {
    const destination = dfa.transitions[state][symbol];
    return partition.findIndex(group => group.includes(destination));
  }).join(",");
}

function groupIndex(state, partition) {
  return partition.findIndex(group => group.includes(state));
}

function groupText(group) { return "{" + group.join(", ") + "}"; }

function refinePartition(dfa, partition) {
  const refined = [];
  const reasons = [];
  for (const group of partition) {
    const buckets = new Map();
    for (const state of group) {
      const signature = partitionSignature(state, dfa, partition);
      if (!buckets.has(signature)) buckets.set(signature, []);
      buckets.get(signature).push(state);
    }
    const parts = [...buckets.values()];
    if (parts.length > 1) {
      const symbol = dfa.alphabet.find(a =>
        new Set(group.map(s => groupIndex(dfa.transitions[s][a], partition))).size > 1);
      const detail = parts.map(p =>
        `${p.join(", ")} go to ${groupText(partition[groupIndex(dfa.transitions[p[0]][symbol], partition)])}`
      ).join("; ");
      reasons.push(`${groupText(group)} splits on input '${symbol}': ${detail}.`);
    }
    refined.push(...parts);
  }
  return { partition: normalizePartition(refined), reasons };
}

function samePartition(a, b) {
  const x = normalizePartition(a).map(g => g.join("|")).join(";");
  const y = normalizePartition(b).map(g => g.join("|")).join(";");
  return x === y;
}

function minimize(dfa) {
  const reachable = reachableStates(dfa);
  const removed = dfa.states.filter(s => !reachable.includes(s));
  const reduced = {
    states: reachable,
    alphabet: dfa.alphabet,
    initial: dfa.initial,
    finals: dfa.finals.filter(s => reachable.includes(s)),
    transitions: dfa.transitions
  };

  let partition = [];
  const nonFinal = reduced.states.filter(s => !reduced.finals.includes(s));
  const final = reduced.states.filter(s => reduced.finals.includes(s));
  if (nonFinal.length) partition.push(nonFinal);
  if (final.length) partition.push(final);
  partition = normalizePartition(partition);

  const history = [{
    title: "Initial partition",
    description: "First, separate final states from non-final states.",
    partition: partition.map(g => g.slice())
  }];

  while (true) {
    const { partition: next, reasons } = refinePartition(reduced, partition);
    if (samePartition(partition, next)) break;
    partition = next;
    history.push({
      title: `Partition refinement ${history.length}`,
      description: "A group is split when its states transition to different partition groups for at least one input symbol.",
      reasons,
      partition: partition.map(g => g.slice())
    });
  }

  history.push({
    title: "Final partition",
    description: "No group can be split further. States in the same group are equivalent and can be merged.",
    partition: partition.map(g => g.slice())
  });

  const nameForGroup = new Map();
  const newStates = partition.map((group, index) => {
    const name = groupName(group);
    group.forEach(s => nameForGroup.set(s, name));
    return name;
  });
  const newTransitions = {};
  partition.forEach(group => {
    const newName = nameForGroup.get(group[0]);
    newTransitions[newName] = {};
    reduced.alphabet.forEach(symbol => {
      const destination = reduced.transitions[group[0]][symbol];
      newTransitions[newName][symbol] = nameForGroup.get(destination);
    });
  });

  const newFinals = partition
    .filter(group => group.some(s => reduced.finals.includes(s)))
    .map(group => nameForGroup.get(group[0]));

  return {
    reachable, removed, history, partition,
    minimized: {
      states: newStates,
      alphabet: reduced.alphabet,
      initial: nameForGroup.get(reduced.initial),
      finals: newFinals,
      transitions: newTransitions
    }
  };
}

function renderPartition() {
  if (!steps.length) return;
  const step = steps[currentStep];
  $("stepDescription").textContent = `${step.title}: ${step.description}`;
  let html = `<div class="partition"><strong>Iteration ${currentStep + 1} of ${steps.length}</strong><div>`;
  step.partition.forEach(group => {
    html += `<span class="group">{ ${group.map(escapeHtml).join(", ")} }</span>`;
  });
  html += "</div>";
  if (step.reasons && step.reasons.length) {
    html += "<p><strong>Why groups split:</strong></p><ul class='reasons'>" +
      step.reasons.map(r => `<li>${escapeHtml(r)}</li>`).join("") + "</ul>";
  }
  html += "</div>";
  $("partitionView").innerHTML = html;
  $("previous").disabled = currentStep === 0;
  $("next").disabled = currentStep === steps.length - 1;
  $("showAll").disabled = currentStep === steps.length - 1;
}

function renderDfaTable(dfa) {
  let html = `<table><thead><tr><th>State</th>${dfa.alphabet.map(a => `<th>${escapeHtml(a)}</th>`).join("")}</tr></thead><tbody>`;
  dfa.states.forEach(state => {
    const marker = (state === dfa.initial ? "→ " : "") + (dfa.finals.includes(state) ? "* " : "");
    html += `<tr><th>${escapeHtml(marker + state)}</th>`;
    dfa.alphabet.forEach(symbol => {
      html += `<td>${escapeHtml(dfa.transitions[state][symbol])}</td>`;
    });
    html += "</tr>";
  });
  return html + "</tbody></table>";
}

function runMinimization() {
  $("error").textContent = "";
  try {
    originalDFA = readDFA();
    const result = minimize(originalDFA);
    minimizedDFA = result.minimized;
    steps = result.history;
    currentStep = 0;
    renderPartition();

    const removedText = result.removed.length
      ? `Unreachable states removed: ${result.removed.join(", ")}.`
      : "No unreachable states were found.";
    $("result").innerHTML = `
      <div class="result-summary">
        <strong>Minimization complete.</strong><br>
        Original states: ${originalDFA.states.length}<br>
        Minimized states: ${minimizedDFA.states.length}<br>
        ${escapeHtml(removedText)}
      </div>
      <h3>State diagrams</h3>
      <div class="diagrams">
        <figure><figcaption>Original DFA${result.removed.length ? " (dashed = unreachable)" : ""}</figcaption>${drawDfa(originalDFA, result.removed)}</figure>
        <figure><figcaption>Minimized DFA</figcaption>${drawDfa(minimizedDFA)}</figure>
      </div>
      <h3>Minimized transition table</h3>
      ${renderDfaTable(minimizedDFA)}
      <h3>How states were merged</h3>
      ${mergeTable(result)}
      <p class="hint">In this table, → marks the initial state and * marks final states.</p>`;
    $("previous").disabled = true;
    $("next").disabled = steps.length <= 1;
    $("showAll").disabled = steps.length <= 1;
    $("testResult").innerHTML = "";
  } catch (error) {
    $("error").textContent = error.message;
  }
}

function runString(dfa, input) {
  let state = dfa.initial;
  for (const symbol of input) {
    if (!dfa.alphabet.includes(symbol)) {
      return { valid: false, accepted: false, message: `Symbol '${symbol}' is not in the alphabet.` };
    }
    state = dfa.transitions[state][symbol];
  }
  return { valid: true, accepted: dfa.finals.includes(state), state };
}

function testInputString() {
  if (!originalDFA || !minimizedDFA) {
    $("testResult").textContent = "Minimize a DFA before testing a string.";
    return;
  }
  const input = $("testString").value.trim();
  const a = runString(originalDFA, input);
  const b = runString(minimizedDFA, input);
  if (!a.valid) {
    $("testResult").textContent = a.message;
    return;
  }
  $("testResult").innerHTML = `
    <div class="partition">
      <strong>Original DFA:</strong> ${a.accepted ? "Accepted" : "Rejected"} (final state reached: ${escapeHtml(a.state)})<br>
      <strong>Minimized DFA:</strong> ${b.accepted ? "Accepted" : "Rejected"} (final state reached: ${escapeHtml(b.state)})<br>
      <strong>Result:</strong> ${a.accepted === b.accepted ? "Both DFAs give the same answer." : "Mismatch detected. Check the implementation."}
    </div>`;
}

function clearOutput() {
  originalDFA = null;
  minimizedDFA = null;
  steps = [];
  currentStep = 0;
  $("error").textContent = "";
  $("stepDescription").textContent = "Enter a DFA and select “Minimize DFA” to begin.";
  $("partitionView").innerHTML = "";
  $("result").innerHTML = "";
  $("testResult").innerHTML = "";
  $("previous").disabled = true;
  $("next").disabled = true;
  $("showAll").disabled = true;
}

$("buildTable").addEventListener("click", () => {
  renderTransitionInputs();
  clearOutput();
});
$("minimize").addEventListener("click", runMinimization);
$("loadExample").addEventListener("click", loadExample);
$("previous").addEventListener("click", () => {
  if (currentStep > 0) { currentStep--; renderPartition(); }
});
$("next").addEventListener("click", () => {
  if (currentStep < steps.length - 1) { currentStep++; renderPartition(); }
});
$("showAll").addEventListener("click", () => {
  currentStep = steps.length - 1;
  renderPartition();
});
$("test").addEventListener("click", testInputString);

renderTransitionInputs();
loadExample();

function groupName(group) {
  return group.length > 1 ? "{" + group.join(",") + "}" : group[0];
}

function mergeTable(result) {
  let html = "<table><thead><tr><th>Minimized state</th><th>Original states merged</th></tr></thead><tbody>";
  result.partition.forEach(g => {
    html += `<tr><th>${escapeHtml(groupName(g))}</th><td>${escapeHtml(g.join(", "))}</td></tr>`;
  });
  result.removed.forEach(r => {
    html += `<tr><th>${escapeHtml(r)}</th><td>removed (unreachable)</td></tr>`;
  });
  return html + "</tbody></table>";
}

function drawDfa(dfa, unreachable = []) {
  const W = 480, H = 340, cx = W / 2, cy = H / 2, n = dfa.states.length;
  const maxLen = Math.max(...dfa.states.map(s => s.length));
  const r = Math.min(34, Math.max(20, 3.6 * maxLen + 8));
  const R = n === 1 ? 0 : Math.min(W, H) / 2 - r - 40;
  const pos = {};
  dfa.states.forEach((s, i) => {
    const t = 2 * Math.PI * i / n - Math.PI / 2;
    pos[s] = { x: cx + R * Math.cos(t), y: cy + R * Math.sin(t) };
  });
  const edges = new Map();
  dfa.states.forEach(s => dfa.alphabet.forEach(a => {
    const d = dfa.transitions[s][a], k = s + "\u0000" + d;
    if (!edges.has(k)) edges.set(k, { from: s, to: d, labels: [] });
    edges.get(k).labels.push(a);
  }));
  const f = v => v.toFixed(1);
  const unit = (dx, dy) => { const l = Math.hypot(dx, dy) || 1; return { x: dx / l, y: dy / l }; };
  let svg = `<svg viewBox="0 0 ${W} ${H}" class="dfa-svg" role="img" aria-label="DFA state diagram"><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#4a5560"/></marker></defs>`;
  const label = (x, y, text) =>
    `<text x="${f(x)}" y="${f(y)}" class="edge-label" text-anchor="middle" dominant-baseline="middle">${escapeHtml(text)}</text>`;

  edges.forEach(e => {
    const a = pos[e.from], b = pos[e.to], text = e.labels.join(",");
    if (e.from === e.to) {
      const u = n === 1 ? { x: 0, y: -1 } : unit(a.x - cx, a.y - cy), v = { x: -u.y, y: u.x };
      const pt = (du, dv) => ({ x: a.x + u.x * du + v.x * dv, y: a.y + u.y * du + v.y * dv });
      const s0 = pt(r, -9), e0 = pt(r + 2, 9), c1 = pt(r + 40, -28), c2 = pt(r + 40, 28), m = pt(r + 38, 0);
      svg += `<path d="M${f(s0.x)},${f(s0.y)} C${f(c1.x)},${f(c1.y)} ${f(c2.x)},${f(c2.y)} ${f(e0.x)},${f(e0.y)}" class="edge" marker-end="url(#arrow)"/>` + label(m.x + u.x * 8, m.y + u.y * 8, text);
    } else {
      const d = unit(b.x - a.x, b.y - a.y), perp = { x: -d.y, y: d.x };
      const hasReverse = edges.has(e.to + "\u0000" + e.from);
      const off = hasReverse ? 28 : 0;
      const c = { x: (a.x + b.x) / 2 + perp.x * off, y: (a.y + b.y) / 2 + perp.y * off };
      const ua = unit(c.x - a.x, c.y - a.y), ub = unit(c.x - b.x, c.y - b.y);
      const s0 = { x: a.x + ua.x * r, y: a.y + ua.y * r }, e0 = { x: b.x + ub.x * (r + 3), y: b.y + ub.y * (r + 3) };
      const mx = 0.25 * s0.x + 0.5 * c.x + 0.25 * e0.x, my = 0.25 * s0.y + 0.5 * c.y + 0.25 * e0.y;
      svg += `<path d="M${f(s0.x)},${f(s0.y)} Q${f(c.x)},${f(c.y)} ${f(e0.x)},${f(e0.y)}" class="edge" marker-end="url(#arrow)"/>` + label(mx + perp.x * 10, my + perp.y * 10, text);
    }
  });

  dfa.states.forEach(s => {
    const p = pos[s], dead = unreachable.includes(s);
    svg += `<g class="${dead ? "node dead" : "node"}"><circle cx="${f(p.x)}" cy="${f(p.y)}" r="${r}"/>`;
    if (dfa.finals.includes(s)) svg += `<circle cx="${f(p.x)}" cy="${f(p.y)}" r="${r - 4}"/>`;
    svg += `<text x="${f(p.x)}" y="${f(p.y)}" text-anchor="middle" dominant-baseline="middle">${escapeHtml(s)}</text></g>`;
    if (s === dfa.initial) {
      svg += `<line x1="${f(p.x - r - 28)}" y1="${f(p.y)}" x2="${f(p.x - r - 1)}" y2="${f(p.y)}" class="edge" marker-end="url(#arrow)"/>`;
    }
  });
  return svg + "</svg>";
}

// Editing anything invalidates old results; changing states/alphabet rebuilds the table.
document.addEventListener("input", e => {
  if (e.target.id === "testString") return;
  if (e.target.id === "states" || e.target.id === "alphabet") renderTransitionInputs();
  if (originalDFA) clearOutput();
});
