const express = require('express');
const router = express.Router();
const pool = require('../db'); // PostgreSQL connection
const { verifyToken } = require('../middleware/authMiddleware');
const axios = require('axios');

// Route to generate deposit instructions
router.post('/crypto', verifyToken, async (req, res) => {
    const userId = req.user.id;
    
    // Fixed CryptoBot deposit link
    const cryptoBotLink = "https://t.me/send?start=IVuZxsJkK6r1";
    return res.json({ paymentUrl: cryptoBotLink, instructions: "Send the desired amount and submit a screenshot to our Telegram bot for approval." });
});

// Route to handle deposit verification
router.post('/crypto/verify', verifyToken, async (req, res) => {
    const { transactionId } = req.body;
    const userId = req.user.id;
    
    if (!transactionId) {
        return res.status(400).json({ error: "Transaction ID is required for verification." });
    }
    
    try {
        // Store transaction request for admin review
        const query = "INSERT INTO deposits (user_id, transaction_id, status) VALUES ($1, $2, 'pending') RETURNING id";
        const result = await pool.query(query, [userId, transactionId]);
        
        // Notify admin via Telegram bot (Replace with your actual bot and chat ID)
        const TELEGRAM_BOT_TOKEN = "8187528420:AAEwyAA0htCTzkqAVl9BFGo2DlWNYH6Oz8c";
        const ADMIN_CHAT_ID = "835322110";
        const message = `📥 *New Deposit Request* 📥\n\n👤 *User ID:* ${userId}\n🔍 *Transaction ID:* ${transactionId}\n📌 *Review & Approve*`;
        
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            chat_id: ADMIN_CHAT_ID,
            text: message,
            parse_mode: "Markdown"
        });

        res.json({ message: "Deposit request submitted. Admin will review it soon." });
    } catch (error) {
        console.error("Error verifying deposit:", error);
        res.status(500).json({ error: "Failed to submit deposit request." });
    }
});
router.post("/deposit/request", verifyToken, async (req, res) => {
    const { amount, transactionId } = req.body;
    const userId = req.user.id;

    if (!amount || amount <= 0) {
        return res.status(400).json({ error: "Invalid deposit amount." });
    }

    try {
        // Check if transaction already exists
        const existing = await pool.query(
            "SELECT * FROM deposits WHERE transaction_id = $1",
            [transactionId]
        );

        if (existing.rows.length > 0) {
            return res.status(400).json({ error: "This transaction was already submitted." });
        }

        // Store deposit request
        const newDeposit = await pool.query(
            "INSERT INTO deposits (user_id, amount, transaction_id, status) VALUES ($1, $2, $3, $4) RETURNING *",
            [userId, amount, transactionId, "PENDING"]
        );

        res.json({ message: "Deposit request submitted.", deposit: newDeposit.rows[0] });
    } catch (error) {
        console.error("Deposit request error:", error);
        res.status(500).json({ error: "Failed to process deposit request." });
    }
});

// Fetch pending deposits (for admin)
router.get("/deposit/pending", verifyToken, async (req, res) => {
    try {
        const pendingDeposits = await pool.query(
            "SELECT * FROM deposits WHERE status = $1",
            ["PENDING"]
        );
        res.json(pendingDeposits.rows);
    } catch (error) {
        console.error("Error fetching pending deposits:", error);
        res.status(500).json({ error: "Internal server error." });
    }
});

// Approve deposit (Admin updates balance)
router.post("/deposit/approve", verifyToken, async (req, res) => {
    const { depositId } = req.body;

    try {
        const deposit = await pool.query(
            "SELECT * FROM deposits WHERE id = $1 AND status = $2",
            [depositId, "PENDING"]
        );

        if (deposit.rows.length === 0) {
            return res.status(400).json({ error: "Deposit not found or already approved." });
        }

        const { user_id, amount } = deposit.rows[0];

        // Update user balance
        await pool.query("UPDATE users SET balance = balance + $1 WHERE id = $2", [amount, user_id]);

        // Mark deposit as approved
        await pool.query("UPDATE deposits SET status = $1 WHERE id = $2", ["APPROVED", depositId]);

        res.json({ message: "Deposit approved and balance updated." });
    } catch (error) {
        console.error("Error approving deposit:", error);
        res.status(500).json({ error: "Failed to approve deposit." });
    }
});
module.exports = router;