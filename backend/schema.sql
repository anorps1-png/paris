-- Schéma de base de données pour TennisBetAI (PostgreSQL / Supabase)

-- 1. Table des joueurs
CREATE TABLE IF NOT EXISTS players (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    ranking INT,
    is_seeded BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Table des matchs (données du jour)
CREATE TABLE IF NOT EXISTS matches (
    id SERIAL PRIMARY KEY,
    tournament VARCHAR(255),
    surface VARCHAR(50),
    match_date TIMESTAMP WITH TIME ZONE,
    player1_id INT REFERENCES players(id),
    player2_id INT REFERENCES players(id),
    odds_home DECIMAL(5,2),
    odds_away DECIMAL(5,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Table de l'historique des matchs (pour les conditions H1/H2)
CREATE TABLE IF NOT EXISTS player_match_history (
    id SERIAL PRIMARY KEY,
    player_id INT REFERENCES players(id),
    role VARCHAR(50), -- 'tocard' ou 'favori'
    result VARCHAR(10), -- 'win' ou 'loss'
    total_break_target_reached BOOLEAN,
    total_individual_break_reached BOOLEAN,
    match_date TIMESTAMP WITH TIME ZONE
);

-- 4. Table des prédictions/analyses
CREATE TABLE IF NOT EXISTS predictions (
    id SERIAL PRIMARY KEY,
    match_id INT REFERENCES matches(id),
    logic_type VARCHAR(10), -- 'H1', 'H2', 'H3'
    is_valid BOOLEAN,
    details JSONB, -- Ex: raisons de la validation ou de l'invalidation
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
