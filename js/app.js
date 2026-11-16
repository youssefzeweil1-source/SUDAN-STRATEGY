const SAVE_KEY = "sudan-strategy-save-v2";
const CLIENT_ID_KEY = "sudan-strategy-client-id";
const API_BASE = (window.SUDAN_STRATEGY_CONFIG?.apiBase || "").replace(/\/$/, "");
let catalog = { meta: {}, scenario: null, states: [], factions: [], objectives: [], events: [] };
let game = createNewGame();

const $ = (id) => document.getElementById(id);
const apiUrl = (path) => `${API_BASE}${path}`;
const status = (message) => { $("saveStatus").textContent = message; };
const clamp = (value) => Math.max(0, Math.min(100, Number(value) || 0));
const getClientId = () => {
  let id = localStorage.getItem(CLIENT_ID_KEY);
  if (!id) { id = `client-${crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`}`; localStorage.setItem(CLIENT_ID_KEY, id); }
  return id;
};

function createNewGame() {
  return {
    id: getClientId(), scenarioId: "sandbox-2026", selectedState: null, factionId: null,
    turn: 0, metrics: { legitimacy: 50, stability: 50, services: 50 }, history: [], lastSavedAt: null
  };
}

async function init() {
  bindEvents();
  catalog = await loadCatalog();
  loadLocalSave();
  await loadRemoteSave();
  renderAll();
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("./service-worker.js").catch(console.warn);
  status(game.lastSavedAt ? "تم تحميل آخر حفظ" : `جاهز — ${catalog.meta.source === "cloudflare-d1" ? "متصل بقاعدة البيانات" : "نسخة محلية"}`);
}

function bindEvents() {
  $("saveBtn").addEventListener("click", saveNow);
  $("resetBtn").addEventListener("click", resetGame);
  $("exportBtn").addEventListener("click", exportSave);
  $("importFile").addEventListener("change", importSave);
  $("stateSearch").addEventListener("input", renderStates);
}

async function loadCatalog() {
  try {
    const response = await fetch(apiUrl("/api/catalog"), { headers: { accept: "application/json" } });
    if (!response.ok) throw new Error("catalog unavailable");
    const remote = await response.json();
    if (!remote.scenario || !Array.isArray(remote.states)) throw new Error("invalid catalog");
    return remote;
  } catch (error) {
    try {
      const response = await fetch("./data/catalog.json");
      if (!response.ok) throw new Error("local catalog unavailable");
      return await response.json();
    } catch (fallbackError) {
      console.error(error, fallbackError); status("تعذر تحميل كتالوج السيناريو"); return catalog;
    }
  }
}

function loadLocalSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const stored = JSON.parse(raw);
    if (stored && stored.scenarioId === catalog.scenario?.id) game = mergeGame(stored);
  } catch (error) { console.warn("تعذر قراءة الحفظ المحلي", error); }
}

async function loadRemoteSave() {
  if (!API_BASE || !game.id) return;
  try {
    const response = await fetch(apiUrl(`/api/saves/${encodeURIComponent(game.id)}`), { headers: { accept: "application/json" } });
    if (!response.ok) return;
    const remote = await response.json();
    if (remote.gameState) game = mergeGame(remote.gameState);
  } catch (error) { console.warn("تعذر تحميل الحفظ السحابي", error); }
}

function mergeGame(source) {
  return {
    ...createNewGame(), ...source, id: game.id || source.id || getClientId(),
    scenarioId: catalog.scenario?.id || "sandbox-2026",
    metrics: { ...createNewGame().metrics, ...(source.metrics || {}) }, history: Array.isArray(source.history) ? source.history : []
  };
}

function renderAll() {
  renderMeta(); renderStates(); renderStateDetails(); renderFactions(); renderFactionDetails(); renderMetrics(); renderEvent(); renderObjectives();
}

function renderMeta() {
  const scenario = catalog.scenario || {};
  $("scenarioTitle").textContent = scenario.title || "ملف السيناريو";
  $("scenarioDescription").textContent = scenario.description || "سيناريو غير متاح.";
  $("scenarioDate").textContent = scenario.dateLabel || "—";
  $("stateCount").textContent = `${catalog.states.length} ولاية`;
  $("factionCount").textContent = `${catalog.factions.length} جهات`;
  $("scenarioDisclaimer").textContent = scenario.disclaimer || "هذا محتوى خيالي لأغراض اللعب.";
}

function renderStates() {
  const query = $("stateSearch").value.trim();
  const filtered = catalog.states.filter((state) => state.name.includes(query) || state.region.includes(query));
  $("statesGrid").replaceChildren();
  if (!filtered.length) { $("statesGrid").textContent = "لا توجد ولاية مطابقة."; return; }
  filtered.forEach((state) => {
    const button = document.createElement("button");
    button.className = `state-button${game.selectedState === state.id ? " active" : ""}`;
    button.innerHTML = `<span>${state.name}</span><small>${state.region}</small>`;
    button.addEventListener("click", () => { game.selectedState = state.id; autoSave(); renderAll(); });
    $("statesGrid").appendChild(button);
  });
}

function renderStateDetails() {
  const details = $("stateDetails"); details.replaceChildren();
  const state = catalog.states.find((item) => item.id === game.selectedState);
  if (!state) { details.innerHTML = "<strong>اختر ولاية</strong><span>ستظهر هنا معلومات الولاية عند تحديدها.</span>"; return; }
  const title = document.createElement("h3"); title.textContent = state.name;
  const region = document.createElement("span"); region.textContent = `النطاق السيناريوي: ${state.region}`;
  const note = document.createElement("p"); note.textContent = state.note;
  const heading = document.createElement("span"); heading.textContent = "علاقات التأثير السيناريوي — ليست خريطة سيطرة";
  const list = document.createElement("div"); list.className = "influence-list";
  state.factions.forEach((relation) => {
    const faction = catalog.factions.find((item) => item.id === relation.id);
    const row = document.createElement("div"); row.className = "influence-row";
    const name = document.createElement("span"); name.textContent = faction?.name || relation.id;
    const progress = document.createElement("div"); progress.className = "progress";
    const fill = document.createElement("i"); fill.style.width = `${clamp(relation.influence)}%`; fill.style.background = faction?.color || "var(--accent)"; progress.appendChild(fill);
    const score = document.createElement("span"); score.textContent = `${relation.influence}%`; score.setAttribute("aria-label", "نسبة سيناريوية");
    row.append(name, progress, score); list.appendChild(row);
  });
  details.append(title, region, note, heading, list);
}

function renderFactions() {
  const grid = $("factionsGrid"); grid.replaceChildren();
  catalog.factions.forEach((faction) => {
    const button = document.createElement("button"); button.className = `faction-card${game.factionId === faction.id ? " active" : ""}`; button.style.setProperty("--faction-color", faction.color || "var(--accent)");
    button.innerHTML = `<strong>${faction.name}</strong><span>${faction.type}</span><span>${faction.isFictional ? "جهة خيالية" : "بيانات غير موسومة"}</span>`;
    button.addEventListener("click", () => { game.factionId = faction.id; autoSave(); renderAll(); }); grid.appendChild(button);
  });
}

function renderFactionDetails() {
  const details = $("factionDetails"); details.replaceChildren();
  const faction = catalog.factions.find((item) => item.id === game.factionId);
  if (!faction) { details.innerHTML = "<strong>اختر جهة</strong><span>ستظهر هنا أولويتها العامة في السيناريو.</span>"; return; }
  const title = document.createElement("h3"); title.textContent = faction.name;
  const badge = document.createElement("span"); badge.className = "faction-badge"; badge.textContent = `${faction.type} — دور خيالي`;
  const description = document.createElement("p"); description.textContent = faction.description;
  const objective = document.createElement("p"); objective.textContent = `الأولوية: ${faction.objectives}`;
  details.append(title, badge, description, objective);
}

function renderMetrics() {
  ["legitimacy", "stability", "services"].forEach((key) => { const value = clamp(game.metrics[key]); $(`${key}Value`).textContent = value; $(`${key}Meter`).style.width = `${value}%`; });
  $("turnLabel").textContent = `الجولة ${game.turn + 1}`;
}

function renderEvent() {
  const event = catalog.events[game.turn % Math.max(1, catalog.events.length)];
  const card = $("eventCard"); card.replaceChildren();
  if (!event) { card.textContent = "لا توجد أحداث متاحة."; return; }
  const title = document.createElement("h3"); title.textContent = event.title;
  const description = document.createElement("p"); description.textContent = event.description;
  const choices = document.createElement("div"); choices.className = "choices";
  event.choices.forEach((choice) => {
    const button = document.createElement("button"); button.className = "choice";
    const label = document.createElement("strong"); label.textContent = choice.label;
    const detail = document.createElement("span"); detail.textContent = choice.description;
    const effects = document.createElement("div"); effects.className = "effect-line";
    Object.entries(choice.effects).forEach(([key, value]) => { const effect = document.createElement("span"); effect.className = `effect${value < 0 ? " negative" : ""}`; effect.textContent = `${metricLabel(key)} ${value > 0 ? "+" : ""}${value}`; effects.appendChild(effect); });
    button.append(label, detail, effects); button.addEventListener("click", () => applyChoice(event, choice)); choices.appendChild(button);
  });
  card.append(title, description, choices);
}

function metricLabel(key) { return ({ legitimacy: "شرعية", stability: "استقرار", services: "خدمات" })[key] || key; }

function applyChoice(event, choice) {
  Object.entries(choice.effects).forEach(([key, value]) => { game.metrics[key] = clamp(game.metrics[key] + value); });
  game.history.push({ eventId: event.id, choiceId: choice.id, at: new Date().toISOString() }); game.turn += 1; autoSave(); renderAll();
}

function renderObjectives() {
  const list = $("objectivesList"); list.replaceChildren();
  catalog.objectives.forEach((objective) => { const item = document.createElement("article"); item.className = "objective"; item.innerHTML = `<h3>${objective.title}</h3><p>${objective.description}</p><span class="reward">+${objective.rewardPoints} نقطة تقدّم</span>`; list.appendChild(item); });
}

function autoSave() {
  game.lastSavedAt = new Date().toISOString(); localStorage.setItem(SAVE_KEY, JSON.stringify(game)); status(`حُفظ محليًا ${new Date(game.lastSavedAt).toLocaleTimeString("ar-EG")}`); syncSave();
}

async function syncSave() {
  if (!API_BASE) return;
  try {
    const response = await fetch(apiUrl("/api/saves"), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: game.id, scenarioId: game.scenarioId, selectedStateId: game.selectedState, factionId: game.factionId, gameState: game }) });
    if (response.ok) status("تم حفظ الجلسة محليًا وفي D1");
  } catch (error) { console.warn("تعذر مزامنة الحفظ", error); }
}

function saveNow() { autoSave(); exportSave(); }

function exportSave() {
  const blob = new Blob([JSON.stringify({ version: 2, game }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "sudan-strategy-save.json"; link.click(); URL.revokeObjectURL(url);
}

function importSave(event) {
  const file = event.target.files?.[0]; if (!file) return;
  const reader = new FileReader(); reader.onload = () => {
    try { const parsed = JSON.parse(reader.result); if (!parsed.game || ![1, 2].includes(parsed.version)) throw new Error("invalid"); game = mergeGame(parsed.game); autoSave(); renderAll(); alert("تم استيراد الحفظ بنجاح"); }
    catch { alert("ملف الحفظ غير صالح أو غير متوافق"); }
    event.target.value = "";
  }; reader.readAsText(file);
}

function resetGame() {
  if (!confirm("هل تريد بدء لعبة جديدة؟ سيتم حذف الحفظ المحلي الحالي.")) return;
  localStorage.removeItem(SAVE_KEY); game = createNewGame(); renderAll(); status("بدأت لعبة جديدة");
}

init();
