const SAVE_KEY = "sudan-strategy-save-v4";
const CLIENT_ID_KEY = "sudan-strategy-client-id";
const API_BASE = (window.SUDAN_STRATEGY_CONFIG?.apiBase || "").replace(/\/$/, "");
const MINUTE_MS = 60_000;
const GEO_ID_TO_STATE = { SDGZ:"gezira", SDNB:"blue-nile", SDDC:"central-darfur", SDDE:"east-darfur", SDGD:"gedaref", SDKA:"kassala", SDKH:"khartoum", SDDN:"north-darfur", SDKN:"north-kordofan", SDNO:"northern", SDRS:"red-sea", SDNR:"river-nile", SDSI:"sennar", SDDS:"south-darfur", SDKS:"south-kordofan", SDDW:"west-darfur", SDGK:"west-kordofan", SDNW:"white-nile" };
const SVG_NS = "http://www.w3.org/2000/svg";
let catalog = { states: [], factions: [], scenario: null };
let rules = { units: {}, neighbors: {} };
let geojson = null;
let projection = null;
let game = null;
let toastTimer;
let clockTimer;

const $ = (id) => document.getElementById(id);
const stateById = (id) => catalog.states.find((item) => item.id === id);
const factionById = (id) => catalog.factions.find((item) => item.id === id);
const playerFaction = () => game?.factionId || "civic-coalition";
const notify = (message) => {
  const box = $("toast");
  box.textContent = message;
  box.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => box.classList.remove("show"), 2800);
  $("saveStatus").textContent = message;
};

function clientId() {
  let id = localStorage.getItem(CLIENT_ID_KEY);
  if (!id) {
    id = `client-${crypto.randomUUID?.() || Date.now()}`;
    localStorage.setItem(CLIENT_ID_KEY, id);
  }
  return id;
}

function initialArmies() {
  return [
    { id: "army-player-1", name: "الجيش الأول", owner: "player", factionId: "civic-coalition", stateId: "khartoum", morale: 78, units: { infantry: 3, armor: 1, artillery: 0, air: 0 } },
    { id: "army-ai-east", name: "قوة الشرق", owner: "ai", factionId: "regional-council", stateId: "south-kordofan", morale: 72, units: { infantry: 4, armor: 1, artillery: 1, air: 0 } },
    { id: "army-ai-west", name: "قوة الغرب", owner: "ai", factionId: "community-network", stateId: "west-darfur", morale: 68, units: { infantry: 5, armor: 0, artillery: 1, air: 0 } },
    { id: "army-ai-coast", name: "قوة الساحل", owner: "ai", factionId: "transitional-institutions", stateId: "red-sea", morale: 75, units: { infantry: 3, armor: 1, artillery: 0, air: 1 } }
  ];
}

function newGame() {
  return {
    id: clientId(), scenarioId: "sandbox-2026", factionId: "civic-coalition", selectedState: "khartoum", selectedArmyId: "army-player-1", turn: 0,
    resources: { manpower: 30, industry: 100 },
    control: { khartoum: "civic-coalition", "south-kordofan": "regional-council", "west-darfur": "community-network", "red-sea": "transitional-institutions" },
    armies: initialArmies(), history: [], lastSavedAt: null, nextSupplyAt: Date.now() + MINUTE_MS
  };
}

function mergeGame(source) {
  const base = newGame();
  return {
    ...base, ...source, id: game?.id || source.id || clientId(),
    resources: { ...base.resources, ...(source.resources || {}) },
    armies: Array.isArray(source.armies) ? source.armies : base.armies,
    control: { ...base.control, ...(source.control || {}) },
    history: Array.isArray(source.history) ? source.history : [],
    nextSupplyAt: Number(source.nextSupplyAt) > Date.now() ? Number(source.nextSupplyAt) : Date.now() + MINUTE_MS
  };
}

async function getJson(path, fallback) {
  try {
    const response = await fetch(path);
    if (!response.ok) throw Error(path);
    return await response.json();
  } catch (error) {
    console.warn(error);
    return fallback;
  }
}

async function loadCatalog() {
  try {
    const response = await fetch(`${API_BASE}/api/catalog`, { headers: { accept: "application/json" } });
    if (!response.ok) throw Error("catalog");
    return await response.json();
  } catch {
    return getJson("./data/catalog.json", { states: [], factions: [], scenario: null });
  }
}

async function init() {
  bindEvents();
  [catalog, rules, geojson] = await Promise.all([
    loadCatalog(),
    getJson("./data/army-rules.json", rules),
    getJson("./data/sudan-states.geojson", null)
  ]);
  game = newGame();
  try {
    const saved = localStorage.getItem(SAVE_KEY);
    if (saved) game = mergeGame(JSON.parse(saved));
  } catch (error) {
    console.warn(error);
  }
  if (API_BASE) await loadRemote();
  render();
  startClock();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  $("saveStatus").textContent = "جاهز — اضغط على الخريطة للعب";
}

async function loadRemote() {
  try {
    const response = await fetch(`${API_BASE}/api/saves/${encodeURIComponent(game.id)}`);
    if (response.ok) {
      const remote = await response.json();
      if (remote.gameState) game = mergeGame(remote.gameState);
    }
  } catch (error) {
    console.warn(error);
  }
}

function bindEvents() {
  const on = (id, event, handler) => $(id)?.addEventListener(event, handler);
  on("saveBtn", "click", () => { save(); notify("تم الحفظ"); });
  on("resetBtn", "click", resetGame);
  document.querySelectorAll(".unit-option").forEach((button) => button.addEventListener("click", () => recruit(button.dataset.unit)));
  on("unitDialog", "click", (event) => { if (event.target === $("unitDialog")) $("unitDialog").close(); });
}

function startClock() {
  clearInterval(clockTimer);
  clockTimer = setInterval(() => {
    if (!game) return;
    if (Date.now() >= game.nextSupplyAt) supplyTick();
    renderClock();
  }, 1000);
  renderClock();
}

function renderClock() {
  if (!game) return;
  const remaining = Math.max(0, game.nextSupplyAt - Date.now());
  const seconds = Math.ceil(remaining / 1000);
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  $("incomeClock").textContent = `الإمدادات خلال ${mm}:${ss}`;
}

function stateIncome(stateId) {
  const bonus = stateId === "khartoum" ? 1 : 0;
  return { manpower: 2 + bonus, industry: 4 + bonus * 2 };
}

function playerControlledStates() {
  return Object.entries(game.control).filter(([, faction]) => faction === playerFaction()).map(([stateId]) => stateId);
}

function supplyTick() {
  if (!game) return;
  const ownedStates = playerControlledStates();
  const income = ownedStates.reduce((total, stateId) => {
    const amount = stateIncome(stateId);
    total.manpower += amount.manpower;
    total.industry += amount.industry;
    return total;
  }, { manpower: 0, industry: 0 });
  game.resources.manpower += income.manpower;
  game.resources.industry += income.industry;
  const aiReport = moveEnemyArmies();
  game.nextSupplyAt = Date.now() + MINUTE_MS;
  game.turn += 1;
  game.history.push({ type: "minute", ownedStates: ownedStates.length, income, aiReport, at: new Date().toISOString() });
  save();
  render();
  notify(`إمدادات +${income.manpower} أفراد و+${income.industry} صناعة — العدو تحرك ${aiReport.moved} جيش`);
}

function moveEnemyArmies() {
  let moved = 0;
  let fights = 0;
  game.armies.filter((army) => army.owner === "ai").forEach((enemy) => {
    const neighbors = rules.neighbors[enemy.stateId] || [];
    const playerTargets = neighbors.filter((stateId) => game.armies.some((army) => army.owner === "player" && army.stateId === stateId));
    const ownedTargets = neighbors.filter((stateId) => game.control[stateId] === playerFaction());
    const target = playerTargets[0] || ownedTargets[Math.floor(Math.random() * ownedTargets.length)] || neighbors[Math.floor(Math.random() * neighbors.length)];
    if (!target) return;
    const defender = armyAt(target, "player");
    if (defender) {
      fights += 1;
      resolveEnemyBattle(enemy, defender);
      return;
    }
    enemy.stateId = target;
    game.control[target] = enemy.factionId;
    moved += 1;
  });
  return { moved, fights };
}

function resolveEnemyBattle(enemy, defender) {
  if (power(enemy) * (0.9 + Math.random() * 0.2) > power(defender) * (0.9 + Math.random() * 0.2)) {
    reduceArmy(defender, Math.max(1, Math.ceil(power(defender) * 0.2)));
    defender.morale = Math.max(0, defender.morale - 12);
    if (!totalUnits(defender)) {
      game.armies = game.armies.filter((army) => army.id !== defender.id);
      enemy.stateId = defender.stateId;
      game.control[enemy.stateId] = enemy.factionId;
    }
    notify("تحرك العدو وهاجم جيشًا تابعًا لك");
  } else {
    reduceArmy(enemy, Math.max(1, Math.ceil(power(enemy) * 0.2)));
    enemy.morale = Math.max(0, enemy.morale - 10);
  }
}

function calculateProjection() {
  const points = [];
  const visit = (coords) => Array.isArray(coords[0]) ? coords.forEach(visit) : points.push(coords);
  geojson.features.forEach((feature) => visit(feature.geometry.coordinates));
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  return { project: ([x, y]) => [24 + ((x - minX) / (maxX - minX)) * 852, 24 + ((maxY - y) / (maxY - minY)) * 652] };
}

function featureStateId(feature) { return GEO_ID_TO_STATE[feature.properties?.id]; }
function pathFor(rings) { return rings.map((ring) => `${ring.map((point, index) => `${index ? "L" : "M"}${projection.project(point).map((number) => number.toFixed(1)).join(" ")}`).join(" ")}Z`).join(" "); }
function centerFor(feature) { const ring = feature.geometry.coordinates[0]; const center = ring.reduce((total, point) => [total[0] + point[0], total[1] + point[1]], [0, 0]); return projection.project([center[0] / ring.length, center[1] / ring.length]); }
function svgEl(tag, attrs) { const node = document.createElementNS(SVG_NS, tag); Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value)); return node; }
function armyAt(stateId, owner) { return game.armies.find((army) => army.stateId === stateId && (owner ? army.owner === owner : true)); }
function totalUnits(army) { return Object.values(army.units || {}).reduce((sum, count) => sum + count, 0); }
function power(army) { return Object.entries(army.units).reduce((sum, [type, count]) => sum + count * (rules.units[type]?.strength || 1), 0) * (0.7 + (army.morale || 70) / 100 * 0.3); }
function reduceArmy(army, loss) { for (const type of ["air", "armor", "artillery", "infantry"]) while (loss > 0 && army.units[type] > 0) { army.units[type] -= 1; loss -= rules.units[type]?.strength || 1; } }

function renderMap() {
  const loading = $("mapLoading");
  if (!geojson) { loading.textContent = "تعذر تحميل الخريطة"; return; }
  loading.hidden = true;
  projection = calculateProjection();
  const svg = $("mapSvg");
  svg.replaceChildren();
  geojson.features.forEach((feature) => {
    const id = featureStateId(feature);
    if (!id) return;
    const selected = game.selectedState === id;
    const selectedArmy = game.armies.find((army) => army.id === game.selectedArmyId);
    const destination = selectedArmy && id !== selectedArmy.stateId && game.selectedState === id;
    const path = svgEl("path", { d: pathFor(feature.geometry.coordinates), class: `state-shape${selected ? " selected" : ""}${destination ? " destination" : ""}`, fill: stateFill(id), "data-state-id": id });
    path.addEventListener("click", () => selectState(id));
    svg.appendChild(path);
    const [x, y] = centerFor(feature);
    const text = svgEl("text", { x, y, class: "map-label", "text-anchor": "middle" });
    text.textContent = stateById(id)?.name || id;
    text.addEventListener("click", () => selectState(id));
    svg.appendChild(text);
  });
  const groups = {};
  game.armies.forEach((army) => (groups[army.stateId] ||= []).push(army));
  Object.entries(groups).forEach(([stateId, armies]) => {
    const feature = geojson.features.find((item) => featureStateId(item) === stateId);
    if (!feature) return;
    const [x, y] = centerFor(feature);
    armies.forEach((army, index) => {
      const group = svgEl("g", { class: `army-marker ${army.owner}${army.id === game.selectedArmyId ? " selected" : ""}`, transform: `translate(${x + (index - (armies.length - 1) / 2) * 18},${y - 22})` });
      group.append(svgEl("circle", { r: 13 }), svgEl("text", { x: 0, y: 5, "text-anchor": "middle" }));
      group.lastChild.textContent = totalUnits(army);
      group.addEventListener("click", (event) => { event.stopPropagation(); game.selectedArmyId = army.id; game.selectedState = army.stateId; render(); });
      svg.appendChild(group);
    });
  });
}

function stateFill(id) {
  if (game.control[id] === playerFaction()) return "#4f9275";
  if (armyAt(id, "ai")) return factionById(armyAt(id, "ai").factionId)?.color || "#9d5e58";
  return "#294a3d";
}

function selectState(id) {
  const playerArmy = armyAt(id, "player");
  const selectedArmy = game.armies.find((army) => army.id === game.selectedArmyId);
  if (playerArmy) {
    game.selectedArmyId = playerArmy.id;
    game.selectedState = id;
  } else if (selectedArmy?.owner === "player" && (rules.neighbors[selectedArmy.stateId] || []).includes(id)) {
    game.selectedState = id;
  } else {
    game.selectedArmyId = null;
    game.selectedState = id;
  }
  render();
}

function render() {
  renderMap();
  renderResources();
  renderSelection();
  renderActions();
  renderArmies();
  renderClock();
  $("turnLabel").textContent = `اليوم ${game.turn + 1}`;
}

function renderResources() {
  const resources = game.resources;
  $("resourceBar").innerHTML = `<span class="resource-pill"><b>${resources.manpower}</b> أفراد</span><span class="resource-pill"><b>${resources.industry}</b> صناعة</span>`;
}

function renderSelection() {
  const card = $("selectionCard");
  const army = game.armies.find((item) => item.id === game.selectedArmyId);
  const state = stateById(game.selectedState);
  if (army) {
    const destination = state && state.id !== army.stateId ? ` ← ${state.name}` : "";
    card.innerHTML = `<div class="selection-main"><span class="selection-icon ${army.owner === "ai" ? "enemy" : ""}">${totalUnits(army)}</span><div><strong>${army.name}</strong><small>${stateById(army.stateId)?.name} · ${unitSummary(army)} · معنويات ${army.morale}%${destination}</small></div></div><button class="selection-clear" data-clear>إلغاء التحديد</button>`;
    card.querySelector("[data-clear]").onclick = () => { game.selectedArmyId = null; render(); };
    return;
  }
  if (state) {
    const troops = game.armies.filter((item) => item.stateId === state.id);
    card.innerHTML = `<div class="selection-main"><span class="selection-icon">⌖</span><div><strong>${state.name}</strong><small>${troops.length ? `${troops.length} جيش في الولاية` : "لا يوجد جيش هنا"} · ${state.region} · إمداد +${stateIncome(state.id).manpower} أفراد و+${stateIncome(state.id).industry} صناعة/دقيقة</small></div></div>`;
  }
}

function unitSummary(army) { return Object.entries(army.units).filter(([, count]) => count).map(([type, count]) => `${rules.units[type]?.label || type} ${count}`).join(" · "); }
function actionButton(label, kind, handler) { const button = document.createElement("button"); button.className = `action-button ${kind || ""}`; button.textContent = label; button.onclick = handler; return button; }

function renderActions() {
  const dock = $("actionDock");
  dock.replaceChildren();
  const army = game.armies.find((item) => item.id === game.selectedArmyId);
  const destination = stateById(game.selectedState);
  if (army?.owner === "player") {
    const adjacent = (rules.neighbors[army.stateId] || []).includes(game.selectedState) && game.selectedState !== army.stateId;
    const enemy = armyAt(game.selectedState, "ai");
    if (adjacent && enemy) dock.append(actionButton(`هجوم على ${destination.name}`, "red", attack));
    else if (adjacent) dock.append(actionButton(`تحرك إلى ${destination.name}`, "gold", move));
    else {
      const hint = document.createElement("span");
      hint.className = "action-empty";
      hint.textContent = "اضغط على ولاية مجاورة لاختيار وجهة";
      dock.append(hint);
    }
    dock.append(actionButton("تجنيد", "", () => $("unitDialog").showModal()));
    return;
  }
  if (destination && !armyAt(destination.id, "ai")) dock.append(actionButton(`إنشاء جيش في ${destination.name}`, "gold", createArmy));
  else {
    const hint = document.createElement("span");
    hint.className = "action-empty";
    hint.textContent = destination ? "اختر راية جيشك من الخريطة" : "اختر جيشًا أو ولاية";
    dock.append(hint);
  }
}

function renderArmies() {
  const strip = $("armyStrip");
  strip.replaceChildren();
  game.armies.forEach((army) => {
    const button = document.createElement("button");
    button.className = `army-chip${army.id === game.selectedArmyId ? " active" : ""}`;
    button.innerHTML = `<b>${army.name}</b><small>${stateById(army.stateId)?.name} · ${totalUnits(army)} وحدات</small>`;
    button.onclick = () => { game.selectedArmyId = army.id; game.selectedState = army.stateId; render(); };
    strip.append(button);
  });
}

function createArmy() {
  const stateId = game.selectedState;
  if (!stateId || armyAt(stateId, "ai")) return notify("اختر ولاية خالية");
  if (game.resources.manpower < 4 || game.resources.industry < 10) return notify("الموارد لا تكفي لإنشاء جيش");
  const id = `army-${Date.now()}`;
  game.resources.manpower -= 4;
  game.resources.industry -= 10;
  game.armies.push({ id, name: `جيش ${game.armies.filter((army) => army.owner === "player").length + 1}`, owner: "player", factionId: playerFaction(), stateId, morale: 70, units: { infantry: 1, armor: 0, artillery: 0, air: 0 } });
  game.control[stateId] = playerFaction();
  game.selectedArmyId = id;
  game.turn += 1;
  save();
  render();
  notify("تم إنشاء الجيش");
}

function move() {
  const army = game.armies.find((item) => item.id === game.selectedArmyId);
  const destination = game.selectedState;
  if (!army || !(rules.neighbors[army.stateId] || []).includes(destination)) return notify("اختر ولاية مجاورة");
  if (armyAt(destination, "ai")) return notify("يوجد خصم هنا — اضغط الهجوم");
  army.stateId = destination;
  game.control[destination] = army.factionId;
  game.selectedState = destination;
  game.turn += 1;
  save();
  render();
  notify("تحرك الجيش");
}

function attack() {
  const army = game.armies.find((item) => item.id === game.selectedArmyId);
  const destination = game.selectedState;
  const defenders = game.armies.filter((item) => item.owner === "ai" && item.stateId === destination);
  if (!army || !defenders.length || !(rules.neighbors[army.stateId] || []).includes(destination)) return notify("اختر ولاية مجاورة فيها خصم");
  const attackScore = power(army) * (0.95 + Math.random() * 0.2);
  const defenseScore = defenders.reduce((sum, item) => sum + power(item), 0) * (0.9 + Math.random() * 0.2);
  if (attackScore >= defenseScore) {
    game.armies = game.armies.filter((item) => !(item.owner === "ai" && item.stateId === destination));
    army.stateId = destination;
    army.morale = Math.max(0, army.morale - 8);
    game.control[destination] = army.factionId;
    notify("انتصرت وسيطرت على الولاية");
  } else {
    army.morale = Math.max(0, army.morale - 14);
    reduceArmy(army, Math.max(1, Math.ceil(power(army) * 0.2)));
    notify("خسر الجيش الاشتباك");
  }
  game.turn += 1;
  game.selectedState = army.stateId;
  save();
  render();
}

function recruit(type) {
  const army = game.armies.find((item) => item.id === game.selectedArmyId);
  const spec = rules.units[type];
  if (!army || army.owner !== "player" || !spec) return notify("اختر جيشك أولًا");
  if (game.resources.manpower < spec.cost.manpower || game.resources.industry < spec.cost.industry) return notify("الموارد لا تكفي");
  game.resources.manpower -= spec.cost.manpower;
  game.resources.industry -= spec.cost.industry;
  army.units[type] = (army.units[type] || 0) + 1;
  army.morale = Math.min(100, army.morale + 2);
  game.turn += 1;
  $("unitDialog").close();
  save();
  render();
  notify(`تم تجنيد ${spec.label}`);
}

function save() {
  game.lastSavedAt = new Date().toISOString();
  localStorage.setItem(SAVE_KEY, JSON.stringify(game));
  if (API_BASE) fetch(`${API_BASE}/api/saves`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: game.id, scenarioId: game.scenarioId, selectedStateId: game.selectedState, factionId: game.factionId, gameState: game }) }).catch(() => {});
}

function resetGame() {
  if (!confirm("بدء لعبة جديدة؟")) return;
  localStorage.removeItem(SAVE_KEY);
  game = newGame();
  render();
  notify("بدأت لعبة جديدة");
}

init();
