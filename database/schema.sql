PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS states (
  id TEXT PRIMARY KEY,
  name_ar TEXT NOT NULL,
  region_ar TEXT NOT NULL,
  scenario_note_ar TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS factions (
  id TEXT PRIMARY KEY,
  name_ar TEXT NOT NULL,
  type_ar TEXT NOT NULL,
  description_ar TEXT NOT NULL,
  objectives_ar TEXT NOT NULL,
  color TEXT NOT NULL,
  is_fictional INTEGER NOT NULL DEFAULT 1 CHECK (is_fictional IN (0, 1))
);

CREATE TABLE IF NOT EXISTS scenarios (
  id TEXT PRIMARY KEY,
  title_ar TEXT NOT NULL,
  date_label_ar TEXT NOT NULL,
  description_ar TEXT NOT NULL,
  disclaimer_ar TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0, 1))
);

CREATE TABLE IF NOT EXISTS state_factions (
  state_id TEXT NOT NULL REFERENCES states(id) ON DELETE CASCADE,
  faction_id TEXT NOT NULL REFERENCES factions(id) ON DELETE CASCADE,
  influence INTEGER NOT NULL CHECK (influence BETWEEN 0 AND 100),
  stance_ar TEXT NOT NULL,
  PRIMARY KEY (state_id, faction_id)
);

CREATE TABLE IF NOT EXISTS objectives (
  id TEXT PRIMARY KEY,
  title_ar TEXT NOT NULL,
  description_ar TEXT NOT NULL,
  reward_points INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS scenario_objectives (
  scenario_id TEXT NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  objective_id TEXT NOT NULL REFERENCES objectives(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL,
  PRIMARY KEY (scenario_id, objective_id)
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  scenario_id TEXT NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  title_ar TEXT NOT NULL,
  description_ar TEXT NOT NULL,
  choices_json TEXT NOT NULL,
  sequence INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS game_saves (
  id TEXT PRIMARY KEY,
  scenario_id TEXT NOT NULL REFERENCES scenarios(id),
  selected_state_id TEXT REFERENCES states(id),
  faction_id TEXT REFERENCES factions(id),
  game_state_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_state_factions_state ON state_factions(state_id);
CREATE INDEX IF NOT EXISTS idx_state_factions_faction ON state_factions(faction_id);
CREATE INDEX IF NOT EXISTS idx_events_scenario_sequence ON events(scenario_id, sequence);
CREATE INDEX IF NOT EXISTS idx_game_saves_updated_at ON game_saves(updated_at);
