require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const authRoutes = require('./routes/authRoutes');
const minesRoutes = require('./routes/minesRoutes');

const app = express();
const port = process.env.PORT || 5000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

app.use(cors({
  origin: 'http://yourfrontenddomain.com',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// ✅ Kept only Mines routes
app.use('/api/auth', authRoutes);
app.use('/api/mines', minesRoutes);

const verifyToken = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
    return res.status(403).json({ error: 'Unauthorized. Please log in.' });
  }

  jwt.verify(token, process.env.JWT_SECRET_KEY, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token.' });
    }
    req.user = decoded;
    next();
  });
};

app.post('/api/deposit', verifyToken, async (req, res) => {
  const { amount } = req.body;

  if (!amount || isNaN(amount) || amount <= 0) {
    return res.status(400).json({ error: 'Invalid deposit amount.' });
  }

  const username = req.user.username;
  if (!username) {
    return res.status(403).json({ error: 'Unauthorized. Please log in.' });
  }

  try {
    const result = await pool.query(
      'UPDATE users SET balance = balance + $1 WHERE username = $2 RETURNING balance',
      [amount, username]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const newBalance = result.rows[0].balance;
    console.log(`Deposit complete for ${username}. New balance: ${newBalance}`);
    return res.json({ message: `Deposit of $${amount} successful! New balance: $${newBalance}` });
  } catch (error) {
    console.error('Deposit error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ✅ Serve React Build in Production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/build')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
  });
}
// Global Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(`❌ Server Error:`, err);
  res.status(500).json({ error: 'Internal server error. Please try again later.' });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
