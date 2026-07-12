require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const { requireApiKey } = require("./auth");
const routes = require("./routes");

const app = express();
app.use(cors());
app.use(express.json());

// Statický frontend (dashboard)
app.use(express.static(path.join(__dirname, "..", "public")));

// Login endpoint - ověří API klíč a vrátí ok (frontend si ho pak posílá v hlavičce)
app.post("/api/login", (req, res) => {
    if (req.body.key === process.env.PANEL_API_KEY) {
        return res.json({ ok: true });
    }
    res.status(401).json({ ok: false, error: "Neplatný klíč." });
});

// Vše pod /api (kromě loginu výše) vyžaduje API klíč
app.use("/api", requireApiKey, routes);

const PORT = process.env.PORT || 3300;
app.listen(PORT, () => {
    console.log(`✅ DEFI-AC Panel běží na http://localhost:${PORT}`);
    if (!process.env.DB_NAME) {
        console.warn("⚠️  DB_NAME není nastavený v .env - zkopíruj .env.example jako .env a doplň údaje.");
    }
});
