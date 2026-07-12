const express = require("express");
const router = express.Router();
const pool = require("./db");

// ---------------------------------------------------------
// GET /api/stats - přehled pro dashboard
// ---------------------------------------------------------
router.get("/stats", async (req, res) => {
    try {
        const [[bans]] = await pool.query("SELECT COUNT(*) as count FROM defiac_bans WHERE active = 1");
        const [[detections]] = await pool.query("SELECT COUNT(*) as count FROM defiac_detections");
        const [[players]] = await pool.query("SELECT COUNT(*) as count FROM defiac_players");
        const [topDetections] = await pool.query(`
            SELECT detection_name, COUNT(*) as count
            FROM defiac_detections
            GROUP BY detection_name
            ORDER BY count DESC
            LIMIT 8
        `);
        const [last24h] = await pool.query(`
            SELECT COUNT(*) as count FROM defiac_detections
            WHERE created_at > (NOW() - INTERVAL 24 HOUR)
        `);

        res.json({
            totalBans: bans.count,
            totalDetections: detections.count,
            totalPlayers: players.count,
            detectionsLast24h: last24h[0].count,
            topDetections,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Chyba databáze." });
    }
});

// ---------------------------------------------------------
// GET /api/bans - seznam aktivních banů (s vyhledáváním)
// ---------------------------------------------------------
router.get("/bans", async (req, res) => {
    try {
        const search = req.query.search ? `%${req.query.search}%` : "%";
        const [rows] = await pool.query(
            `SELECT * FROM defiac_bans WHERE active = 1 AND (player_name LIKE ? OR license LIKE ? OR reason LIKE ?) ORDER BY created_at DESC LIMIT 500`,
            [search, search, search]
        );
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Chyba databáze." });
    }
});

// ---------------------------------------------------------
// POST /api/bans/:license/unban
// ---------------------------------------------------------
router.post("/bans/:license/unban", async (req, res) => {
    try {
        await pool.query("UPDATE defiac_bans SET active = 0 WHERE license = ?", [req.params.license]);
        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Chyba databáze." });
    }
});

// ---------------------------------------------------------
// POST /api/bans - manuální ban z panelu (hráč nemusí být online)
// ---------------------------------------------------------
router.post("/bans", async (req, res) => {
    const { license, playerName, reason, bannedBy, durationMinutes } = req.body;
    if (!license || !reason) {
        return res.status(400).json({ error: "license a reason jsou povinné." });
    }
    try {
        const expiresAt = durationMinutes
            ? new Date(Date.now() + durationMinutes * 60000).toISOString().slice(0, 19).replace("T", " ")
            : null;

        await pool.query(
            `INSERT INTO defiac_bans (license, identifiers, player_name, reason, banned_by, expires_at) VALUES (?, ?, ?, ?, ?, ?)`,
            [license, JSON.stringify([`license:${license}`]), playerName || "unknown", reason, bannedBy || "panel", expiresAt]
        );
        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Chyba databáze." });
    }
});

// ---------------------------------------------------------
// GET /api/detections - seznam detekcí (s filtrem)
// ---------------------------------------------------------
router.get("/detections", async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 100, 1000);
        const category = req.query.category;

        let query = "SELECT * FROM defiac_detections";
        const params = [];
        if (category) {
            query += " WHERE category = ?";
            params.push(category);
        }
        query += " ORDER BY created_at DESC LIMIT ?";
        params.push(limit);

        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Chyba databáze." });
    }
});

// ---------------------------------------------------------
// GET /api/players - hráči seřazení podle risk score
// ---------------------------------------------------------
router.get("/players", async (req, res) => {
    try {
        const search = req.query.search ? `%${req.query.search}%` : "%";
        const [rows] = await pool.query(
            `SELECT license, last_name, discord, risk_score, first_seen, last_seen
             FROM defiac_players
             WHERE last_name LIKE ? OR license LIKE ?
             ORDER BY risk_score DESC, last_seen DESC LIMIT 200`,
            [search, search]
        );
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Chyba databáze." });
    }
});

// ---------------------------------------------------------
// GET /api/players/:license - detail hráče + historie detekcí
// ---------------------------------------------------------
router.get("/players/:license", async (req, res) => {
    try {
        const [[player]] = await pool.query("SELECT * FROM defiac_players WHERE license = ?", [req.params.license]);
        if (!player) return res.status(404).json({ error: "Hráč nenalezen." });

        const [detections] = await pool.query(
            "SELECT * FROM defiac_detections WHERE license = ? ORDER BY created_at DESC LIMIT 200",
            [req.params.license]
        );
        const [bans] = await pool.query(
            "SELECT * FROM defiac_bans WHERE license = ? ORDER BY created_at DESC",
            [req.params.license]
        );

        res.json({ player, detections, bans });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Chyba databáze." });
    }
});

// ---------------------------------------------------------
// GET /api/resource-events - start/stop/integrity log
// ---------------------------------------------------------
router.get("/resource-events", async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM defiac_resource_events ORDER BY created_at DESC LIMIT 200");
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Chyba databáze." });
    }
});

// ---------------------------------------------------------
// GET /api/live-players - volitelné, jen pokud máš FIVEM_SERVER_URL
// nastavený a server má povolený /players.json endpoint
// ---------------------------------------------------------
router.get("/live-players", async (req, res) => {
    if (!process.env.FIVEM_SERVER_URL) {
        return res.json({ enabled: false, players: [] });
    }
    try {
        const response = await fetch(`${process.env.FIVEM_SERVER_URL}/players.json`);
        const players = await response.json();
        res.json({ enabled: true, players });
    } catch (err) {
        res.json({ enabled: true, players: [], error: "Server neodpovídá." });
    }
});

module.exports = router;
