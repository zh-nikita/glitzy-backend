// routes/minesRoutes.js
const express = require('express');
const router = express.Router();
const pool = require('../db'); // Make sure you have a DB connection setup
const { verifyToken } = require('../middleware/authMiddleware');


// Mines game initialization
router.post('/mines/start', verifyToken, async (req, res) => {
  const userId = req.user.id;
  const { minesCount, betAmount } = req.body;
  const gridSize = 5;
  
  try {
      const existingGame = await pool.query(
          'SELECT * FROM mines_games WHERE user_id = $1 AND game_state = $2',
          [userId, 'IN_PROGRESS']
      );

      if (existingGame.rows.length > 0) {
          return res.json({ message: "You already have an ongoing game!", game: existingGame.rows[0] });
      }

      // Generate the grid
      const grid = generateGrid(gridSize, minesCount);
      
      const newGame = await pool.query(
          'INSERT INTO mines_games (user_id, grid, mines_count, winnings, bet_amount, game_state) VALUES ($1, $2, $3, 0, $4, $5) RETURNING *',
          [userId, JSON.stringify(grid), minesCount, betAmount, 'IN_PROGRESS']
      );

      res.json({ message: "Game started!", game: newGame.rows[0] });
  } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
  }
});


router.post('/mines/reveal', verifyToken, async (req, res) => {
  const userId = req.user.id;
  const { row, col } = req.body;

  try {
      const game = await pool.query(
          'SELECT * FROM mines_games WHERE user_id = $1 AND game_state = $2',
          [userId, 'IN_PROGRESS']
      );

      if (game.rows.length === 0) {
          return res.status(400).json({ error: "No active Mines game." });
      }

      let gameData = game.rows[0];
      let grid = JSON.parse(gameData.grid);
      let revealedTiles = gameData.revealed_tiles ? JSON.parse(gameData.revealed_tiles) : [];
      let winnings = parseFloat(gameData.winnings);

      if (grid[row][col] === 'MINE') {
          await pool.query('UPDATE mines_games SET game_state = $1 WHERE user_id = $2', ['LOST', userId]);
          return res.json({ message: "Game over! You hit a mine.", result: "LOSE" });
      }

      let reward = grid[row][col];
      winnings += reward;
      revealedTiles.push({ row, col, reward });

      await pool.query(
          'UPDATE mines_games SET winnings = $1, revealed_tiles = $2 WHERE user_id = $3',
          [winnings, JSON.stringify(revealedTiles), userId]
      );

      res.json({ message: "Tile revealed!", reward, totalWinnings: winnings });
  } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
  }
});

router.post('/mines/cashout', verifyToken, async (req, res) => {
  const userId = req.user.id;

  try {
      const game = await pool.query(
          'SELECT * FROM mines_games WHERE user_id = $1 AND game_state = $2',
          [userId, 'IN_PROGRESS']
      );

      if (game.rows.length === 0) {
          return res.status(400).json({ error: "No active Mines game." });
      }

      let winnings = parseFloat(game.rows[0].winnings);

      await pool.query(
          'UPDATE users SET balance = balance + $1 WHERE id = $2 RETURNING balance',
          [winnings, userId]
      );

      await pool.query('UPDATE mines_games SET game_state = $1 WHERE user_id = $2', ['WON', userId]);

      res.json({ message: "Cash-out successful!", totalWinnings: winnings });
  } catch (error) {
      next(error);
  }
});

// Helper function to generate the Mines grid
function generateGrid(gridSize, minesCount) {
  const totalTiles = gridSize * gridSize;
  const mines = Array(minesCount).fill('MINE');
  const rewards = Array(totalTiles - minesCount).fill(0).map(() => Math.random() * 10); // Random rewards
  const grid = [...mines, ...rewards].sort(() => Math.random() - 0.5); // Shuffle the array

  // Convert the 1D array to a 2D grid
  const result = [];
  for (let i = 0; i < gridSize; i++) {
    result.push(grid.slice(i * gridSize, (i + 1) * gridSize));
  }

  return result;
}

module.exports = router;