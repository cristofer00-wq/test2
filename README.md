# DEFI-AC Web Panel

Samostatná webová appka (Node.js + Express + MySQL) pro DEFI-AC anticheat.
Čte a zapisuje do stejné databáze jako FiveM resource `defi_anticheat`.

## Instalace

```bash
cd defi_anticheat_panel
npm install
cp .env.example .env
```

Uprav `.env`:
```
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=tvuj_mysql_user
DB_PASSWORD=tvoje_heslo
DB_NAME=stejna_databaze_jako_v_oxmysql_konfiguraci

PORT=3300
PANEL_API_KEY=vygeneruj_si_dlouhy_nahodny_string
```

**Důležité:** `PANEL_API_KEY` je jediná ochrana panelu. Musí být dlouhý,
náhodný a nikde veřejně nesdílený. Panel podle něj pouští/nepouští
požadavky na `/api/*`.

Spuštění:
```bash
npm start
```

Otevři `http://TVOJE_IP:3300` (nebo `localhost:3300` lokálně) a přihlas se
API klíčem z `.env`.

## Doporučené nasazení na produkci

- Pusť to za reverse proxy (nginx/Caddy) s HTTPS, ne přímo naholo na portu.
- `PANEL_API_KEY` používej jen přes HTTPS (jinak jde odposlechnout).
- Zvaž firewall pravidlo, aby port panelu nebyl veřejně otevřený úplně
  všem, pokud ho potřebuješ jen pro pár adminů.
- Process manager pro produkci: `pm2 start src/server.js --name defi-ac-panel`

## Co obsahuje

- **Přehled** — souhrn banů/detekcí/hráčů, top detekce
- **Detekce** — kompletní log se filtrem podle kategorie
- **Banlist** — vyhledávání, unban jedním klikem, ruční ban
- **Hráči** — seznam s risk score, vyhledávání
- **Resources** — start/stop/integrity log ostatních resourců na serveru

## Volitelné: live hráči online

Pokud chceš vidět kdo je zrovna online (ne jen historická data z DB),
nastav v `.env`:
```
FIVEM_SERVER_URL=http://tvuj-server-ip:30120
```
Vyžaduje to mít na FiveM serveru povolený `/players.json` endpoint
(pozor, ten dokáže vypsat IP adresy hráčů, pokud to necháš úplně otevřené
- doporučeno jen ve vnitřní síti nebo za dalším firewallem).
