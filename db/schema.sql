-- Create the users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  balance DECIMAL(10, 2) DEFAULT 0
);

-- Optionally, create a table for game history
CREATE TABLE game_history (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  game_type VARCHAR(50) NOT NULL,
  result TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- schema.sql
CREATE TABLE game_history (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  game_type VARCHAR(50) NOT NULL,
  result TEXT NOT NULL,
  winnings DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE deposits ADD CONSTRAINT unique_transaction UNIQUE (transaction_id);

CREATE UNIQUE INDEX unique_username ON users (username);

CREATE TABLE mines_games (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    grid JSONB NOT NULL, -- Stores the game board
    mines_count INT NOT NULL,
    winnings DECIMAL(10, 2) DEFAULT 0,
    game_state TEXT DEFAULT 'NOT_STARTED',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS deposits (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    transaction_id TEXT UNIQUE NOT NULL,
    status TEXT CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
