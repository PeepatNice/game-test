-- Create the custom schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS "game-test";

-- Create the score table
CREATE TABLE IF NOT EXISTS "game-test".score (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    coin INTEGER DEFAULT 0,
    distance INTEGER DEFAULT 0,
    distance_statistics INTEGER DEFAULT 0,
    score INTEGER DEFAULT 0,
    score_statistics INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create an index on name for faster lookups
CREATE INDEX IF NOT EXISTS idx_score_name ON "game-test".score(name);
