const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// PostgreSQL connection
const pool = new Pool({
    host: '103.2.113.228',
    port: 5432,
    database: 'game-test',
    user: 'postgres',
    password: 'w,jmik[8iy[',
    // Connection pool settings
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000,  // 15 seconds timeout
    // Keep connections alive (important for remote servers / Docker)
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
});

// Test DB connection on startup with retry
async function testConnection(retries = 5) {
    for (let i = 1; i <= retries; i++) {
        try {
            await pool.query('SELECT NOW()');
            console.log('✅ Connected to PostgreSQL');
            return;
        } catch (err) {
            console.error(`❌ DB connection attempt ${i}/${retries} failed:`, err.message);
            if (i < retries) {
                console.log(`   Retrying in 3 seconds...`);
                await new Promise(r => setTimeout(r, 3000));
            }
        }
    }
    console.error('⚠️  Could not connect to database. Server will continue but DB features may not work.');
}
testConnection();

// ─── API Routes ──────────────────────────────────────────

// POST /api/login — Register or login player
app.post('/api/login', async (req, res) => {
    try {
        const { name } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'กรุณากรอกชื่อผู้เล่น' });
        }

        const trimmedName = name.trim();

        // Check if player exists
        const existing = await pool.query(
            'SELECT * FROM "game-test".score WHERE name = $1',
            [trimmedName]
        );

        if (existing.rows.length > 0) {
            // Player exists, return their data
            return res.json({ player: existing.rows[0], isNew: false });
        }

        // Create new player
        const result = await pool.query(
            'INSERT INTO "game-test".score (name, coin, distance, distance_statistics, score, score_statistics) VALUES ($1, 0, 0, 0, 0, 0) RETURNING *',
            [trimmedName]
        );

        res.json({ player: result.rows[0], isNew: true });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการเชื่อมต่อ' });
    }
});

// POST /api/score — Save score after game over
app.post('/api/score', async (req, res) => {
    try {
        const { name, coin, distance, score } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Missing player name' });
        }

        // Update player record:
        // - Always update coin, distance, score with latest values
        // - Update distance_statistics and score_statistics only if new values are higher
        const result = await pool.query(
            `UPDATE "game-test".score 
             SET coin = $2, 
                 distance = $3, 
                 score = $4,
                 distance_statistics = GREATEST(distance_statistics, $3),
                 score_statistics = GREATEST(score_statistics, $4)
             WHERE name = $1
             RETURNING *`,
            [name, coin || 0, distance || 0, score || 0]
        );

        if (result.rows.length === 0) {
            // Player doesn't exist, create new record
            const insertResult = await pool.query(
                `INSERT INTO "game-test".score (name, coin, distance, distance_statistics, score, score_statistics) 
                 VALUES ($1, $2, $3, $3, $4, $4) RETURNING *`,
                [name, coin || 0, distance || 0, score || 0]
            );
            return res.json({ player: insertResult.rows[0] });
        }

        res.json({ player: result.rows[0] });
    } catch (err) {
        console.error('Score save error:', err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการบันทึกคะแนน' });
    }
});

// GET /api/leaderboard — Get top 10 scores
app.get('/api/leaderboard', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT name, coin, distance_statistics, score_statistics 
             FROM "game-test".score 
             ORDER BY score_statistics DESC 
             LIMIT 10`
        );
        res.json({ leaderboard: result.rows });
    } catch (err) {
        console.error('Leaderboard error:', err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการโหลด Leaderboard' });
    }
});

// ─── Fallback: serve index.html for SPA ──────────────────
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ─── Start Server ────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`🎮 Hill Climb Racing server running at http://localhost:${PORT}`);
});
