function requireApiKey(req, res, next) {
    const key = req.headers["x-api-key"] || req.query.key;
    if (!process.env.PANEL_API_KEY || process.env.PANEL_API_KEY === "change-this-to-something-random-and-long") {
        console.warn("⚠️  PANEL_API_KEY není nastavený nebo je pořád defaultní hodnota - panel běží NEZABEZPEČENĚ.");
    }
    if (key !== process.env.PANEL_API_KEY) {
        return res.status(401).json({ error: "Neplatný nebo chybějící API klíč." });
    }
    next();
}

module.exports = { requireApiKey };
