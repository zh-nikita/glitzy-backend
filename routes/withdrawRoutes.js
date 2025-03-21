const express = require('express');
const axios = require('axios');
const router = express.Router();
const pool = require('../db'); // PostgreSQL connection
const { verifyToken } = require('../middleware/authMiddleware');
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

// Withdrawal request route
router.post('/withdraw', verifyToken, async (req, res) => {
    const { amount, cryptoUsername } = req.body;
    const userId = req.user.id;

    if (!amount || amount <= 0) {
        return res.status(400).json({ error: "Invalid withdrawal amount." });
    }

    try {
        // Check if user has enough balance
        const userQuery = "SELECT balance FROM users WHERE id = $1";
        const userResult = await pool.query(userQuery, [userId]);

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: "User not found." });
        }

        const userBalance = parseFloat(userResult.rows[0].balance);
        if (userBalance < amount) {
            return res.status(400).json({ error: "Insufficient balance." });
        }

        // Deduct amount from user balance immediately
        await pool.query('UPDATE users SET balance = balance - $1 WHERE id = $2', [amount, userId]);

        // Insert withdraw request into database
        const newWithdraw = await pool.query(
            'INSERT INTO withdrawals (user_id, amount, crypto_username, status) VALUES ($1, $2, $3, $4) RETURNING *',
            [userId, amount, cryptoUsername, 'PENDING']
        );

        // Send withdrawal request to Telegram bot (admin notification)
        const message = `🔴 *Withdrawal Request* 🔴\n\n👤 *User ID:* ${userId}\n💰 *Amount:* $${amount}\n🔗 *Crypto Username:* ${cryptoUsername}\n\n✅ Approve manually in Crypto Bot.`;
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            chat_id: ADMIN_CHAT_ID,
            text: message,
            parse_mode: "Markdown"
        });

        return res.status(200).json({ message: "Withdrawal request submitted successfully.", withdrawal: newWithdraw.rows[0] });
    } catch (error) {
        console.error("Error processing withdrawal request:", error);
        return res.status(500).json({ error: "Failed to process withdrawal request." });
    }
});

// Fetch Pending Withdrawals
router.get('/withdraw/pending', verifyToken, async (req, res) => {
    try {
        const pendingWithdrawals = await pool.query(
            'SELECT * FROM withdrawals WHERE status = $1',
            ['PENDING']
        );
        res.json(pendingWithdrawals.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
});

module.exports = router;

