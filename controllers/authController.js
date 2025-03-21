const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const pool = require('../db');  // Use the pool from the database connection

// User login logic
const login = async (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Please provide email and password.' });
  }

  try {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    
    if (!result.rows.length) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    const user = result.rows[0];

    // Compare hashed password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    // Create JWT token
    const token = jwt.sign(
      { username: user.username, email: user.email },
      process.env.JWT_SECRET_KEY,
      { expiresIn: '1h' } // Set token expiration
    );

    return res.json({
      message: 'Login successful!',
      token,  // Send the token to the client
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { login };
