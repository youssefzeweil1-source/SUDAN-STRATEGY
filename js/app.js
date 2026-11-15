const SAVE_KEY = "sudan-strategy-save-v1";
let states = [];
let game = { scenarioDate: "2026-11-15", selectedState: null, factionId: null, lastSavedAt: null };
const $ = (id) => document.getElementById(id);
const status = (message) => { $("saveStatus").textContent = message; };
async function init() {
  try {
    const response = await fetch("./data/sudan-states.json");
    if (!response.ok) throw new Error("تعذر تحميل بيانات الولايات");
    states = await response.json();
  } catch (error) { status("تعذر تحميل البيانات"); console.error(error); return; }
  loadLocalSave(); renderStates();
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("./service-worker.js").catch(console.warn);
  $("saveBtn").addEventListener("click", saveNow);
  $("resetBtn").addEventListener("click", resetGame);
  $("exportBtn").addEventListener("click", exportSave);
  $("importFile").addEventListener("change", importSave);
  $("stateSearch").addEventListener("input", renderStates);
  status(game.lastSavedAt ? "تم تحميل آخر حفظ محلي" : "جاهز — لم يبدأ الحفظ بعد");
}
function renderStates() {
  const query = $("stateSearch").value.trim();
  const filtered = states.filter(s => s.name.includes(query));
  $("statesGrid").innerHTML = "";
  filtered.forEach(state => {
    const button = document.createElement("button");
    button.className = "state-button" + (game.selectedState === state.id ? " active" : "");
    button.textContent = state.name;
    button.addEventListener("click", () => {
      game.selectedState = state.id; renderStates();
      const details = $("stateDetails"); details.replaceChildren();
      const title = document.createElement("strong"); title.textContent = state.name;
      const description = document.createElement("span");
      description.textContent = "تم تحديد الولاية. ستُضاف بيانات الاقتصاد والموارد والسيناريو بعد تجهيز مصادرها.";
      details.append(title, description); autoSave();
    });
    $("statesGrid").appendChild(button);
  });
}
function autoSave() {
  game.lastSavedAt = new Date().toISOString();
  localStorage.setItem(SAVE_KEY, JSON.stringify(game));
  status("حُفظ تلقائياً " + new Date(game.lastSavedAt).toLocaleTimeString("ar-EG"));
}
function saveNow() { autoSave(); exportSave(); }
function loadLocalSave() {
  try { const raw = localStorage.getItem(SAVE_KEY); if (raw) game = { ...game, ...JSON.parse(raw) }; }
  catch (error) { console.warn("تعذر قراءة الحفظ المحلي", error); }
}
function exportSave() {
  const blob = new Blob([JSON.stringify({version:1, game}, null, 2)], {type:"application/json"});
  const url = URL.createObjectURL(blob); const a = document.createElement("a");
  a.href = url; a.download = "sudan-strategy-save.json"; a.click(); URL.revokeObjectURL(url);
}
function importSave(event) {
  const file = event.target.files?.[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!parsed.game || parsed.version !== 1) throw new Error("صيغة الحفظ غير معروفة");
      game = { ...game, ...parsed.game }; autoSave(); renderStates(); alert("تم استيراد الحفظ بنجاح");
    } catch { alert("ملف الحفظ غير صالح أو غير متوافق"); }
    event.target.value = "";
  };
  reader.readAsText(file);
}
function resetGame() {
  if (!confirm("هل تريد بدء لعبة جديدة؟ سيتم حذف الحفظ المحلي الحالي.")) return;
  localStorage.removeItem(SAVE_KEY);
  game = { scenarioDate:"2026-11-15", selectedState:null, factionId:null, lastSavedAt:null };
  renderStates();
  $("stateDetails").innerHTML = "<strong>اختر ولاية</strong><span>ستظهر هنا معلومات الولاية عند تحديدها.</span>";
  status("بدأت لعبة جديدة");
}
init();