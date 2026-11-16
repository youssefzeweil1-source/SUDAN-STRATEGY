const SAVE_KEY = "sudan-strategy-save-v3";
const CLIENT_ID_KEY = "sudan-strategy-client-id";
const API_BASE = (window.SUDAN_STRATEGY_CONFIG?.apiBase || "").replace(/\/$/, "");
const GEO_ID_TO_STATE = { SDGZ:"gezira", SDNB:"blue-nile", SDDC:"central-darfur", SDDE:"east-darfur", SDGD:"gedaref", SDKA:"kassala", SDKH:"khartoum", SDDN:"north-darfur", SDKN:"north-kordofan", SDNO:"northern", SDRS:"red-sea", SDNR:"river-nile", SDSI:"sennar", SDDS:"south-darfur", SDKS:"south-kordofan", SDDW:"west-darfur", SDGK:"west-kordofan", SDNW:"white-nile" };
const SVG_NS = "http://www.w3.org/2000/svg";
let catalog = { meta: {}, scenario: null, states: [], factions: [], objectives: [], events: [] };
let rules = { units: {}, neighbors: {} };
let geojson = null;
let mapProjection = null;
let game = null;

const $ = (id) => document.getElementById(id);
const apiUrl = (path) => `${API_BASE}${path}`;
const status = (message) => { $("saveStatus").textContent = message; };
const clamp = (value) => Math.max(0, Math.min(100, Number(value) || 0));
const playerFaction = () => game?.factionId || "civic-coalition";
const factionById = (id) => catalog.factions.find((item) => item.id === id);
const stateById = (id) => catalog.states.find((item) => item.id === id);
const unitLabel = (type) => rules.units[type]?.label || type;

function getClientId() {
  let id = localStorage.getItem(CLIENT_ID_KEY);
  if (!id) { id = `client-${crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`}`; localStorage.setItem(CLIENT_ID_KEY, id); }
  return id;
}

function initialArmies() {
  return [
    { id: "army-player-1", name: "الجيش الأول", owner: "player", factionId: "civic-coalition", stateId: "khartoum", morale: 78, units: { infantry: 3, armor: 1, artillery: 0, air: 0 } },
    { id: "army-ai-east", name: "قوة الشرق الخيالية", owner: "ai", factionId: "regional-council", stateId: "south-kordofan", morale: 72, units: { infantry: 4, armor: 1, artillery: 1, air: 0 } },
    { id: "army-ai-west", name: "قوة الغرب الخيالية", owner: "ai", factionId: "community-network", stateId: "west-darfur", morale: 68, units: { infantry: 5, armor: 0, artillery: 1, air: 0 } },
    { id: "army-ai-coast", name: "قوة الساحل الخيالية", owner: "ai", factionId: "transitional-institutions", stateId: "red-sea", morale: 75, units: { infantry: 3, armor: 1, artillery: 0, air: 1 } }
  ];
}

function createNewGame() {
  return {
    id: getClientId(), scenarioId: "sandbox-2026", selectedState: "khartoum", factionId: "civic-coalition", selectedArmyId: "army-player-1", turn: 0,
    metrics: { legitimacy: 50, stability: 50, services: 50 }, resources: { manpower: 30, industry: 100 },
    control: {}, armies: initialArmies(), history: [], lastSavedAt: null
  };
}

async function init() {
  bindEvents();
  [catalog, rules, geojson] = await Promise.all([loadCatalog(), loadJson("./data/army-rules.json"), loadJson("./data/sudan-states.geojson")]);
  game = createNewGame(); loadLocalSave(); await loadRemoteSave();
  normalizeGame(); renderAll();
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("./service-worker.js").catch(console.warn);
  status(game.lastSavedAt ? "تم تحميل آخر حفظ" : `جاهز — ${catalog.meta.source === "cloudflare-d1" ? "متصل بقاعدة البيانات" : "نسخة محلية"}`);
}

function bindEvents() {
  $("saveBtn").addEventListener("click", saveNow); $("resetBtn").addEventListener("click", resetGame); $("exportBtn").addEventListener("click", exportSave); $("importFile").addEventListener("change", importSave); $("stateSearch").addEventListener("input", renderStates);
  $("createArmyBtn").addEventListener("click", createArmy); $("moveArmyBtn").addEventListener("click", moveSelectedArmy); $("attackBtn").addEventListener("click", attackSelectedState);
  document.querySelectorAll(".recruit-button").forEach((button) => button.addEventListener("click", () => recruitUnit(button.dataset.unit)));
}

async function loadJson(path) { try { const response = await fetch(path); if (!response.ok) throw new Error(path); return await response.json(); } catch (error) { console.error(error); return path.includes("army-rules") ? { units: {}, neighbors: {} } : null; } }

async function loadCatalog() {
  try { const response = await fetch(apiUrl("/api/catalog"), { headers: { accept: "application/json" } }); if (!response.ok) throw new Error("catalog unavailable"); return await response.json(); }
  catch { try { return await (await fetch("./data/catalog.json")).json(); } catch { status("تعذر تحميل كتالوج السيناريو"); return catalog; } }
}

function loadLocalSave() { try { const raw = localStorage.getItem(SAVE_KEY); if (raw) game = mergeGame(JSON.parse(raw)); } catch (error) { console.warn("تعذر قراءة الحفظ المحلي", error); } }
async function loadRemoteSave() {
  if (!API_BASE || !game?.id) return;
  try { const response = await fetch(apiUrl(`/api/saves/${encodeURIComponent(game.id)}`)); if (response.ok) { const remote = await response.json(); if (remote.gameState) game = mergeGame(remote.gameState); } } catch (error) { console.warn("تعذر تحميل الحفظ السحابي", error); }
}

function mergeGame(source) { return { ...createNewGame(), ...source, id: game?.id || source.id || getClientId(), metrics: { ...createNewGame().metrics, ...(source.metrics || {}) }, resources: { ...createNewGame().resources, ...(source.resources || {}) }, armies: Array.isArray(source.armies) ? source.armies : initialArmies(), control: source.control || {}, history: Array.isArray(source.history) ? source.history : [] }; }
function normalizeGame() {
  if (!game.control || !Object.keys(game.control).length) game.control = {};
  game.armies.forEach((army) => { if (!army.units) army.units = { infantry: 1, armor: 0, artillery: 0, air: 0 }; if (!army.morale) army.morale = 70; });
}

function renderAll() { renderMeta(); renderMap(); renderResources(); renderMapStateSummary(); renderArmiesList(); renderSelectedArmy(); renderStates(); renderStateDetails(); renderFactions(); renderFactionDetails(); renderMetrics(); renderEvent(); renderObjectives(); renderFactionSelect(); }
function renderMeta() { const s = catalog.scenario || {}; $("scenarioTitle").textContent = s.title || "ملف السيناريو"; $("scenarioDescription").textContent = s.description || "سيناريو غير متاح."; $("scenarioDate").textContent = s.dateLabel || "—"; $("stateCount").textContent = `${catalog.states.length} ولاية`; $("factionCount").textContent = `${catalog.factions.length} جهات`; $("scenarioDisclaimer").textContent = s.disclaimer || "هذا محتوى خيالي لأغراض اللعب."; $("turnLabel").textContent = `الدور ${game.turn + 1}`; }

function calculateBounds() {
  const points = [];
  const visit = (coords) => Array.isArray(coords[0]) ? coords.forEach(visit) : points.push(coords);
  geojson.features.forEach((feature) => visit(feature.geometry.coordinates));
  const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]); const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys); const pad = 24;
  return { minX, maxX, minY, maxY, project: ([x, y]) => [pad + ((x - minX) / (maxX - minX)) * (900 - pad * 2), pad + ((maxY - y) / (maxY - minY)) * (700 - pad * 2)] };
}
function featureStateId(feature) { return GEO_ID_TO_STATE[feature.properties?.id] || null; }
function polygonPath(rings) { return rings.map((ring) => `${ring.map((point, index) => `${index ? "L" : "M"}${mapProjection.project(point).map((n) => n.toFixed(1)).join(" ")}`).join(" ")}Z`).join(" "); }
function stateCenter(feature) { const ring = feature.geometry.coordinates[0]; const center = ring.reduce((acc, point) => [acc[0] + point[0], acc[1] + point[1]], [0, 0]); return mapProjection.project([center[0] / ring.length, center[1] / ring.length]); }
function createSvgElement(tag, attrs = {}) { const element = document.createElementNS(SVG_NS, tag); Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, value)); return element; }

function renderMap() {
  if (!geojson) return; mapProjection = calculateBounds(); const svg = $("mapSvg"); svg.replaceChildren();
  geojson.features.forEach((feature) => {
    const id = featureStateId(feature); if (!id) return; const path = createSvgElement("path", { d: polygonPath(feature.geometry.coordinates), class: `state-shape${game.selectedState === id ? " selected" : ""}`, fill: stateFill(id), "data-state-id": id }); path.addEventListener("click", () => selectState(id)); svg.appendChild(path);
    const label = stateById(id); const [x, y] = stateCenter(feature); const text = createSvgElement("text", { x, y, class: "map-label", "text-anchor": "middle" }); text.textContent = label?.name || id; text.addEventListener("click", () => selectState(id)); svg.appendChild(text);
  });
  const grouped = {}; game.armies.forEach((army) => { (grouped[army.stateId] ||= []).push(army); });
  Object.entries(grouped).forEach(([stateId, armies]) => { const feature = geojson.features.find((item) => featureStateId(item) === stateId); if (!feature) return; const [x, y] = stateCenter(feature); armies.forEach((army, index) => { const group = createSvgElement("g", { class: `army-marker ${army.owner === "player" ? "player" : "enemy"}${army.id === game.selectedArmyId ? " selected" : ""}`, transform: `translate(${x + (index - (armies.length - 1) / 2) * 18},${y - 22})` }); const circle = createSvgElement("circle", { r: 12 }); const text = createSvgElement("text", { x: 0, y: 5, "text-anchor": "middle" }); text.textContent = totalUnits(army); group.append(circle, text); group.addEventListener("click", (event) => { event.stopPropagation(); game.selectedArmyId = army.id; game.selectedState = army.stateId; renderAll(); }); svg.appendChild(group); }); });
}
function stateFill(stateId) { const owner = game.control[stateId]; if (owner === playerFaction()) return "#4f8e70"; const army = game.armies.find((item) => item.stateId === stateId && item.owner === "ai"); return army ? (factionById(army.factionId)?.color || "#a15f58") : "#2a403a"; }
function selectState(stateId) { game.selectedState = stateId; const army = game.armies.find((item) => item.owner === "player" && item.stateId === stateId); if (army) game.selectedArmyId = army.id; renderAll(); }

function renderResources() { const r = game.resources; $("resourceSummary").innerHTML = `<span><b>${r.manpower}</b> أفراد متاحون</span><span><b>${r.industry}</b> صناعة</span>`; }
function renderMapStateSummary() { const box = $("mapStateSummary"); const state = stateById(game.selectedState); if (!state) { box.innerHTML = "<strong>اختر ولاية من الخريطة</strong><span>ستظهر هنا الملكية والجيوش المتواجدة.</span>"; return; } const control = game.control[state.id] ? factionById(game.control[state.id])?.name : "محايدة"; const stationed = game.armies.filter((army) => army.stateId === state.id); box.innerHTML = `<strong>${state.name}</strong><span>الملكية: ${control || "محايدة"}</span><span>الجيوش هنا: ${stationed.length}</span>`; }
function renderFactionSelect() { const select = $("armyFactionSelect"); const current = select.value || playerFaction(); select.replaceChildren(); catalog.factions.forEach((faction) => { const option = document.createElement("option"); option.value = faction.id; option.textContent = faction.name; select.appendChild(option); }); select.value = catalog.factions.some((f) => f.id === current) ? current : playerFaction(); }

function renderArmiesList() { const list = $("armiesList"); list.replaceChildren(); const title = document.createElement("strong"); title.textContent = "جيوش السيناريو"; list.appendChild(title); game.armies.forEach((army) => { const button = document.createElement("button"); button.className = `army-list-item${army.id === game.selectedArmyId ? " active" : ""}`; button.innerHTML = `<span><b>${army.name}</b><small>${stateById(army.stateId)?.name || "—"} · ${army.owner === "player" ? "جيشك" : "خصم خيالي"}</small></span><em>${totalUnits(army)}</em>`; button.addEventListener("click", () => { game.selectedArmyId = army.id; game.selectedState = army.stateId; renderAll(); }); list.appendChild(button); }); }
function renderSelectedArmy() { const box = $("selectedArmyInfo"); const army = game.armies.find((item) => item.id === game.selectedArmyId); const canAct = army?.owner === "player"; $("moveArmyBtn").disabled = !canAct || !game.selectedState || army.stateId === game.selectedState; $("attackBtn").disabled = !canAct || !game.selectedState || army.stateId === game.selectedState; if (!army) { box.innerHTML = "<strong>لا يوجد جيش مختار</strong><span>أنشئ جيشًا أو اختر راية على الخريطة.</span>"; return; } const faction = factionById(army.factionId); box.innerHTML = `<strong>${army.name}</strong><span>${faction?.name || "جهة"} · ${stateById(army.stateId)?.name || "—"}</span><span>القوة: ${armyPower(army)} · المعنويات: ${army.morale}%</span><span>${unitBreakdown(army)}</span>`; }
function totalUnits(army) { return Object.values(army.units || {}).reduce((sum, count) => sum + count, 0); }
function unitBreakdown(army) { return Object.entries(army.units).filter(([, count]) => count > 0).map(([type, count]) => `${unitLabel(type)} ${count}`).join(" · "); }
function armyPower(army) { return Object.entries(army.units).reduce((sum, [type, count]) => sum + count * (rules.units[type]?.strength || 1), 0) * (0.7 + (army.morale || 70) / 100 * 0.3); }

function createArmy() { const stateId = game.selectedState; const factionId = $("armyFactionSelect").value || playerFaction(); if (!stateId) return status("اختر ولاية أولًا"); const id = `army-${Date.now()}`; game.armies.push({ id, name: `جيش ${game.armies.filter((a) => a.owner === "player").length + 1}`, owner: "player", factionId, stateId, morale: 70, units: { infantry: 1, armor: 0, artillery: 0, air: 0 } }); game.selectedArmyId = id; game.control[stateId] ||= factionId; game.turn += 1; autoSave(); renderAll(); status("تم إنشاء جيش خيالي جديد"); }
function recruitUnit(type) { const army = game.armies.find((item) => item.id === game.selectedArmyId); const spec = rules.units[type]; if (!army || army.owner !== "player" || !spec) return status("اختر أحد جيوشك أولًا"); if (game.resources.manpower < spec.cost.manpower || game.resources.industry < spec.cost.industry) return status("الموارد لا تكفي لتجنيد هذه الوحدة"); game.resources.manpower -= spec.cost.manpower; game.resources.industry -= spec.cost.industry; army.units[type] = (army.units[type] || 0) + 1; army.morale = clamp(army.morale + 2); game.turn += 1; autoSave(); renderAll(); status(`تم تجنيد وحدة ${spec.label}`); }
function neighborsOf(stateId) { return rules.neighbors[stateId] || []; }
function moveSelectedArmy() { const army = game.armies.find((item) => item.id === game.selectedArmyId); const destination = game.selectedState; if (!army || army.owner !== "player" || !destination || !neighborsOf(army.stateId).includes(destination)) return status("اختر ولاية مجاورة للجيش المختار"); if (game.armies.some((item) => item.owner === "ai" && item.stateId === destination)) return status("توجد قوة خصم هنا — استخدم زر بدء الاشتباك"); army.stateId = destination; game.control[destination] = army.factionId; game.turn += 1; autoSave(); renderAll(); status("تحرك الجيش إلى الولاية المجاورة"); }
function attackSelectedState() { const army = game.armies.find((item) => item.id === game.selectedArmyId); const destination = game.selectedState; const defenders = game.armies.filter((item) => item.owner === "ai" && item.stateId === destination); if (!army || army.owner !== "player" || !destination || !neighborsOf(army.stateId).includes(destination) || !defenders.length) return status("اختر ولاية مجاورة فيها قوة خصم"); const attackerScore = armyPower(army) * (0.9 + Math.random() * 0.25); const defenderScore = defenders.reduce((sum, item) => sum + armyPower(item), 0) * (0.9 + Math.random() * 0.2); game.history.push({ type: "battle", from: army.stateId, to: destination, attackerScore: Math.round(attackerScore), defenderScore: Math.round(defenderScore), turn: game.turn }); if (attackerScore >= defenderScore) { game.armies = game.armies.filter((item) => !(item.owner === "ai" && item.stateId === destination)); army.stateId = destination; army.morale = clamp(army.morale - 8); game.control[destination] = army.factionId; status("انتصرت في الاشتباك السيناريوي وسيطرت على الولاية"); } else { army.morale = clamp(army.morale - 16); reduceArmy(army, Math.max(1, Math.ceil(armyPower(army) * 0.2))); status("خسر الجيش الجولة وتراجع أثره"); } game.turn += 1; autoSave(); renderAll(); }
function reduceArmy(army, loss) { for (const type of ["air", "armor", "artillery", "infantry"]) { while (loss > 0 && army.units[type] > 0) { army.units[type] -= 1; loss -= rules.units[type]?.strength || 1; } } }

function renderStates() { const query = $("stateSearch").value.trim(); const filtered = catalog.states.filter((state) => state.name.includes(query) || state.region.includes(query)); $("statesGrid").replaceChildren(); filtered.forEach((state) => { const button = document.createElement("button"); button.className = `state-button${game.selectedState === state.id ? " active" : ""}`; button.innerHTML = `<span>${state.name}</span><small>${state.region}</small>`; button.addEventListener("click", () => selectState(state.id)); $("statesGrid").appendChild(button); }); }
function renderStateDetails() { const details = $("stateDetails"); details.replaceChildren(); const state = stateById(game.selectedState); if (!state) { details.innerHTML = "<strong>اختر ولاية</strong><span>ستظهر هنا معلومات الولاية عند تحديدها.</span>"; return; } const title = document.createElement("h3"); title.textContent = state.name; const region = document.createElement("span"); region.textContent = `النطاق: ${state.region}`; const note = document.createElement("p"); note.textContent = state.note; const heading = document.createElement("span"); heading.textContent = `الملكية الحالية: ${game.control[state.id] ? factionById(game.control[state.id])?.name : "محايدة"}`; details.append(title, region, note, heading); }
function renderFactions() { const grid = $("factionsGrid"); grid.replaceChildren(); catalog.factions.forEach((faction) => { const button = document.createElement("button"); button.className = `faction-card${game.factionId === faction.id ? " active" : ""}`; button.style.setProperty("--faction-color", faction.color || "var(--accent)"); button.innerHTML = `<strong>${faction.name}</strong><span>${faction.type}</span><span>${faction.isFictional ? "جهة خيالية" : "بيانات غير موسومة"}</span>`; button.addEventListener("click", () => { game.factionId = faction.id; $("armyFactionSelect").value = faction.id; autoSave(); renderAll(); }); grid.appendChild(button); }); }
function renderFactionDetails() { const details = $("factionDetails"); details.replaceChildren(); const faction = factionById(game.factionId); if (!faction) { details.innerHTML = "<strong>اختر جهة</strong><span>ستظهر هنا أولويتها العامة في السيناريو.</span>"; return; } details.innerHTML = `<h3>${faction.name}</h3><span class="faction-badge">${faction.type} — دور خيالي</span><p>${faction.description}</p><p>الأولوية: ${faction.objectives}</p>`; }
function renderMetrics() { ["legitimacy", "stability", "services"].forEach((key) => { const value = clamp(game.metrics[key]); $(`${key}Value`).textContent = value; $(`${key}Meter`).style.width = `${value}%`; }); }
function renderEvent() { const event = catalog.events[game.turn % Math.max(1, catalog.events.length)]; const card = $("eventCard"); card.replaceChildren(); if (!event) return; const title = document.createElement("h3"); title.textContent = event.title; const description = document.createElement("p"); description.textContent = event.description; const choices = document.createElement("div"); choices.className = "choices"; event.choices.forEach((choice) => { const button = document.createElement("button"); button.className = "choice"; button.innerHTML = `<strong>${choice.label}</strong><span>${choice.description}</span><div class="effect-line">${Object.entries(choice.effects).map(([key, value]) => `<span class="effect${value < 0 ? " negative" : ""}">${key} ${value > 0 ? "+" : ""}${value}</span>`).join("")}</div>`; button.addEventListener("click", () => { Object.entries(choice.effects).forEach(([key, value]) => { game.metrics[key] = clamp(game.metrics[key] + value); }); game.history.push({ eventId: event.id, choiceId: choice.id, turn: game.turn }); game.turn += 1; autoSave(); renderAll(); }); choices.appendChild(button); }); card.append(title, description, choices); }
function renderObjectives() { const list = $("objectivesList"); list.replaceChildren(); catalog.objectives.forEach((objective) => { const item = document.createElement("article"); item.className = "objective"; item.innerHTML = `<h3>${objective.title}</h3><p>${objective.description}</p><span class="reward">+${objective.rewardPoints} نقطة تقدّم</span>`; list.appendChild(item); }); }

function autoSave() { game.lastSavedAt = new Date().toISOString(); localStorage.setItem(SAVE_KEY, JSON.stringify(game)); status(`حُفظ محليًا ${new Date(game.lastSavedAt).toLocaleTimeString("ar-EG")}`); syncSave(); }
async function syncSave() { if (!API_BASE) return; try { const response = await fetch(apiUrl("/api/saves"), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: game.id, scenarioId: game.scenarioId, selectedStateId: game.selectedState, factionId: game.factionId, gameState: game }) }); if (response.ok) status("تم حفظ الجيش والموارد محليًا وفي D1"); } catch (error) { console.warn("تعذر مزامنة الحفظ", error); } }
function saveNow() { autoSave(); exportSave(); }
function exportSave() { const blob = new Blob([JSON.stringify({ version: 3, game }, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "sudan-strategy-army-save.json"; link.click(); URL.revokeObjectURL(url); }
function importSave(event) { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { try { const parsed = JSON.parse(reader.result); if (!parsed.game || ![1, 2, 3].includes(parsed.version)) throw new Error("invalid"); game = mergeGame(parsed.game); normalizeGame(); autoSave(); renderAll(); alert("تم استيراد حفظ الجيوش بنجاح"); } catch { alert("ملف الحفظ غير صالح أو غير متوافق"); } event.target.value = ""; }; reader.readAsText(file); }
function resetGame() { if (!confirm("هل تريد بدء لعبة جديدة؟ سيتم حذف الحفظ المحلي الحالي.")) return; localStorage.removeItem(SAVE_KEY); game = createNewGame(); renderAll(); status("بدأت لعبة جديدة"); }

init();
