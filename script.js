let apiKey = sessionStorage.getItem("defiac_key") || "";

function api(path, opts = {}) {
    return fetch(`/api${path}`, {
        ...opts,
        headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            ...(opts.headers || {}),
        },
    }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Chyba požadavku");
        return r.json();
    });
}

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str ?? "";
    return div.innerHTML;
}

function formatTime(mysqlDatetime) {
    if (!mysqlDatetime) return "-";
    const d = new Date(String(mysqlDatetime).replace(" ", "T"));
    if (isNaN(d.getTime())) return String(mysqlDatetime);
    return d.toLocaleDateString("cs-CZ") + " " + d.toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" });
}

// ---------------------------------------------------------
// LOGIN
// ---------------------------------------------------------
async function tryLogin(key) {
    const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
    });
    if (!res.ok) return false;
    apiKey = key;
    sessionStorage.setItem("defiac_key", key);
    return true;
}

document.getElementById("login-btn").addEventListener("click", async () => {
    const key = document.getElementById("api-key-input").value.trim();
    if (!key) return;
    const ok = await tryLogin(key);
    if (ok) {
        showApp();
    } else {
        document.getElementById("login-error").classList.remove("hidden");
    }
});

document.getElementById("api-key-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("login-btn").click();
});

document.getElementById("logout-btn").addEventListener("click", () => {
    sessionStorage.removeItem("defiac_key");
    apiKey = "";
    document.getElementById("app").classList.add("hidden");
    document.getElementById("login-screen").classList.remove("hidden");
});

function showApp() {
    document.getElementById("login-screen").classList.add("hidden");
    document.getElementById("app").classList.remove("hidden");
    loadTab("general");
}

// ---------------------------------------------------------
// TABS
// ---------------------------------------------------------
document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".nav-item").forEach((b) => b.classList.remove("active"));
        document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
        btn.classList.add("active");
        const tab = btn.dataset.tab;
        document.getElementById(`tab-${tab}`).classList.add("active");
        loadTab(tab);
    });
});

async function loadTab(tab) {
    try {
        if (tab === "general") await loadGeneral();
        if (tab === "detections") await loadDetections();
        if (tab === "banlist") await loadBanlist();
        if (tab === "players") await loadPlayers();
        if (tab === "resources") await loadResources();
    } catch (err) {
        console.error(err);
    }
}

// ---------------------------------------------------------
// GENERAL
// ---------------------------------------------------------
async function loadGeneral() {
    const stats = await api("/stats");
    document.getElementById("stat-bans").textContent = stats.totalBans;
    document.getElementById("stat-detections").textContent = stats.totalDetections;
    document.getElementById("stat-players").textContent = stats.totalPlayers;
    document.getElementById("stat-24h").textContent = stats.detectionsLast24h;

    const container = document.getElementById("top-detections");
    container.innerHTML = "";
    stats.topDetections.forEach((d) => {
        const chip = document.createElement("div");
        chip.className = "chip";
        chip.innerHTML = `${escapeHtml(d.detection_name)} <b>${d.count}</b>`;
        container.appendChild(chip);
    });
}

// ---------------------------------------------------------
// DETECTIONS
// ---------------------------------------------------------
document.getElementById("detections-category").addEventListener("change", loadDetections);

async function loadDetections() {
    const category = document.getElementById("detections-category").value;
    const rows = await api(`/detections?limit=150${category ? `&category=${category}` : ""}`);
    const body = document.getElementById("detections-body");
    body.innerHTML = "";
    if (rows.length === 0) {
        body.innerHTML = `<tr><td colspan="5" class="empty">Žádné detekce.</td></tr>`;
        return;
    }
    rows.forEach((d) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${formatTime(d.created_at)}</td>
            <td>${escapeHtml(d.detection_name)}</td>
            <td><span class="badge badge-${d.severity}">${escapeHtml(d.severity)}</span></td>
            <td>${escapeHtml(d.player_name)} (${escapeHtml(String(d.server_id ?? "-"))})</td>
            <td>${escapeHtml(d.details)}</td>
        `;
        body.appendChild(tr);
    });
}

// ---------------------------------------------------------
// BANLIST
// ---------------------------------------------------------
let banSearchTimeout;
document.getElementById("banlist-search").addEventListener("input", () => {
    clearTimeout(banSearchTimeout);
    banSearchTimeout = setTimeout(loadBanlist, 300);
});

async function loadBanlist() {
    const search = document.getElementById("banlist-search").value;
    const rows = await api(`/bans?search=${encodeURIComponent(search)}`);
    const body = document.getElementById("banlist-body");
    body.innerHTML = "";
    if (rows.length === 0) {
        body.innerHTML = `<tr><td colspan="6" class="empty">Banlist je prázdný.</td></tr>`;
        return;
    }
    rows.forEach((b) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${formatTime(b.created_at)}</td>
            <td>${escapeHtml(b.player_name)}</td>
            <td>${escapeHtml(b.reason)}</td>
            <td>${escapeHtml(b.banned_by)}</td>
            <td style="font-size:11px; color:#8b8b9a;">${escapeHtml(b.license)}</td>
            <td><button class="action-btn danger" data-license="${escapeHtml(b.license)}">Unban</button></td>
        `;
        body.appendChild(tr);
    });
    body.querySelectorAll("[data-license]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            await api(`/bans/${encodeURIComponent(btn.dataset.license)}/unban`, { method: "POST" });
            loadBanlist();
        });
    });
}

// ---------------------------------------------------------
// PLAYERS
// ---------------------------------------------------------
let playerSearchTimeout;
document.getElementById("players-search").addEventListener("input", () => {
    clearTimeout(playerSearchTimeout);
    playerSearchTimeout = setTimeout(loadPlayers, 300);
});

async function loadPlayers() {
    const search = document.getElementById("players-search").value;
    const rows = await api(`/players?search=${encodeURIComponent(search)}`);
    const body = document.getElementById("players-body");
    body.innerHTML = "";
    if (rows.length === 0) {
        body.innerHTML = `<tr><td colspan="4" class="empty">Žádní hráči.</td></tr>`;
        return;
    }
    rows.forEach((p) => {
        const tr = document.createElement("tr");
        const riskColor = p.risk_score < 25 ? "#4ade80" : p.risk_score < 80 ? "#facc15" : "#f87171";
        tr.innerHTML = `
            <td>${escapeHtml(p.last_name)}</td>
            <td style="color:${riskColor}; font-weight:600;">${p.risk_score}</td>
            <td>${formatTime(p.last_seen)}</td>
            <td style="font-size:11px; color:#8b8b9a;">${escapeHtml(p.license)}</td>
        `;
        body.appendChild(tr);
    });
}

// ---------------------------------------------------------
// RESOURCES
// ---------------------------------------------------------
async function loadResources() {
    const rows = await api("/resource-events");
    const body = document.getElementById("resources-body");
    body.innerHTML = "";
    if (rows.length === 0) {
        body.innerHTML = `<tr><td colspan="4" class="empty">Žádné záznamy.</td></tr>`;
        return;
    }
    rows.forEach((r) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${formatTime(r.created_at)}</td>
            <td>${escapeHtml(r.resource_name)}</td>
            <td>${escapeHtml(r.action)}</td>
            <td>${escapeHtml(r.details || "-")}</td>
        `;
        body.appendChild(tr);
    });
}

// ---------------------------------------------------------
// AUTO-LOGIN pokud máme klíč v sessionStorage
// ---------------------------------------------------------
if (apiKey) {
    tryLogin(apiKey).then((ok) => {
        if (ok) showApp();
    });
}
