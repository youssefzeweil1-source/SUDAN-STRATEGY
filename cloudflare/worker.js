const JSON_HEADERS = {
  "content-type": "application/json; charset=UTF-8",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type"
};

const json = (payload, status = 200) => new Response(JSON.stringify(payload), {
  status,
  headers: JSON_HEADERS
});

const parseChoices = (value) => {
  try { return JSON.parse(value); } catch { return []; }
};

const clamp = (value) => Math.max(0, Math.min(100, Number(value) || 0));

async function catalog(env) {
  const scenario = await env.DB.prepare(
    "SELECT id, title_ar AS title, date_label_ar AS dateLabel, description_ar AS description, disclaimer_ar AS disclaimer FROM scenarios WHERE is_active = 1 ORDER BY id LIMIT 1"
  ).first();
  if (!scenario) throw new Error("active_scenario_missing");

  const [statesResult, factionsResult, objectivesResult, eventsResult] = await Promise.all([
    env.DB.prepare(
      "SELECT s.id, s.name_ar AS name, s.region_ar AS region, s.scenario_note_ar AS note, sf.faction_id AS factionId, sf.influence, sf.stance_ar AS stance FROM states s LEFT JOIN state_factions sf ON sf.state_id = s.id ORDER BY s.name_ar"
    ).all(),
    env.DB.prepare(
      "SELECT id, name_ar AS name, type_ar AS type, description_ar AS description, objectives_ar AS objectives, color, is_fictional AS isFictional FROM factions ORDER BY name_ar"
    ).all(),
    env.DB.prepare(
      "SELECT o.id, o.title_ar AS title, o.description_ar AS description, o.reward_points AS rewardPoints FROM objectives o JOIN scenario_objectives so ON so.objective_id = o.id WHERE so.scenario_id = ? ORDER BY so.sequence"
    ).bind(scenario.id).all(),
    env.DB.prepare(
      "SELECT id, title_ar AS title, description_ar AS description, choices_json AS choicesJson FROM events WHERE scenario_id = ? ORDER BY sequence"
    ).bind(scenario.id).all()
  ]);

  const stateMap = new Map();
  for (const row of statesResult.results || []) {
    if (!stateMap.has(row.id)) stateMap.set(row.id, { id: row.id, name: row.name, region: row.region, note: row.note, factions: [] });
    if (row.factionId) stateMap.get(row.id).factions.push({ id: row.factionId, influence: row.influence, stance: row.stance });
  }

  return {
    meta: { schemaVersion: 1, contentStatus: "fictional-scenario-not-live-intelligence", source: "cloudflare-d1" },
    scenario,
    states: [...stateMap.values()],
    factions: (factionsResult.results || []).map((row) => ({ ...row, isFictional: Boolean(row.isFictional) })),
    objectives: objectivesResult.results || [],
    events: (eventsResult.results || []).map((row) => ({ id: row.id, title: row.title, description: row.description, choices: parseChoices(row.choicesJson) }))
  };
}

const saveIdIsValid = (value) => typeof value === "string" && /^[A-Za-z0-9_-]{8,80}$/.test(value);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: JSON_HEADERS });

    try {
      if (url.pathname === "/health" && request.method === "GET") {
        return json({ ok: true, service: "sudan-strategy-api", database: "d1" });
      }

      if (url.pathname === "/api/catalog" && request.method === "GET") {
        return json(await catalog(env));
      }

      if (url.pathname === "/api/saves" && request.method === "POST") {
        const body = await request.json();
        const id = body?.id;
        if (!saveIdIsValid(id)) return json({ error: "invalid_save_id" }, 400);
        const scenarioId = typeof body.scenarioId === "string" ? body.scenarioId.slice(0, 80) : "sandbox-2026";
        const selectedStateId = typeof body.selectedStateId === "string" ? body.selectedStateId.slice(0, 80) : null;
        const factionId = typeof body.factionId === "string" ? body.factionId.slice(0, 80) : null;
        const gameState = body.gameState && typeof body.gameState === "object" ? body.gameState : {};
        const serialized = JSON.stringify(gameState);
        if (serialized.length > 12000) return json({ error: "save_too_large" }, 413);
        const now = new Date().toISOString();
        await env.DB.prepare(
          "INSERT INTO game_saves (id, scenario_id, selected_state_id, faction_id, game_state_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET scenario_id = excluded.scenario_id, selected_state_id = excluded.selected_state_id, faction_id = excluded.faction_id, game_state_json = excluded.game_state_json, updated_at = excluded.updated_at"
        ).bind(id, scenarioId, selectedStateId, factionId, serialized, now, now).run();
        return json({ ok: true, id, updatedAt: now });
      }

      const saveMatch = url.pathname.match(/^\/api\/saves\/([A-Za-z0-9_-]{8,80})$/);
      if (saveMatch && request.method === "GET") {
        const row = await env.DB.prepare(
          "SELECT id, scenario_id AS scenarioId, selected_state_id AS selectedStateId, faction_id AS factionId, game_state_json AS gameStateJson, updated_at AS updatedAt FROM game_saves WHERE id = ?"
        ).bind(saveMatch[1]).first();
        if (!row) return json({ error: "save_not_found" }, 404);
        return json({ ...row, gameState: JSON.parse(row.gameStateJson) });
      }

      return json({ error: "not_found" }, 404);
    } catch (error) {
      console.error(error);
      return json({ error: "server_error", message: "تعذر تنفيذ طلب قاعدة البيانات." }, 500);
    }
  }
};
