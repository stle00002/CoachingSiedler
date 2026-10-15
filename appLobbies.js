/*
 * appAccounts2.js
 * Kontobasierte Version des COACHING-Siedler-Browserclients.
 * Grundlage: vorhandener app(1).js-Spielclient; ergänzt um Registrierung,
 * E-Mail-Verifizierung, Login, Sitzungs-Reconnect und Kontostatistiken.
 * Benötigt serverAccounts.py und accounts.py auf dem Server.
 */
const TILE_IMAGES = {
  HOLZ: new Image(),
  LEHM: new Image(),
  SCHAF: new Image(),
  WEIZEN: new Image(),
  ERZ: new Image(),
  WÜSTE: new Image(),
  WASSER: new Image(),
  GOLD: new Image(),
};

const WS_URL = "wss://ste-about-ireland-online.trycloudflare.com";

let isSpectator = false;
const IS_IPHONE = /iPhone/i.test(navigator.userAgent);
const DESKTOP_BOARD_SIZE = 35.2212389380531;

if (IS_IPHONE) {
    document.documentElement.classList.add("iphone");
}

const YOUR_TURN_SOUND = new Audio("sounds/YourTurn.wav");
YOUR_TURN_SOUND.volume = 1.0;

let wasMyTurn = false;

const ROBBER_IMAGE = new Image();
const ROBBER_CANVAS = document.createElement("canvas");
const ROBBER_CTX = ROBBER_CANVAS.getContext("2d");

ROBBER_IMAGE.onload = () => {
    prepareRobberImage();
};

ROBBER_IMAGE.src = "images/ritterrotermantel.png";

const RESOURCE_COLORS = {
    HOLZ: "#159413",
    LEHM: "#f17646",
    SCHAF: "#1edb09",
    WEIZEN: "#f1e545",
    ERZ: "#a8aaab"
};

let tradeOpen = false;
let lastTradeId = null;
let tradeDeclined = false;

let tradeOffer = {
  HOLZ: 0,
  LEHM: 0,
  SCHAF: 0,
  WEIZEN: 0,
  ERZ: 0
};

let tradeRequest = {
  HOLZ: 0,
  LEHM: 0,
  SCHAF: 0,
  WEIZEN: 0,
  ERZ: 0
};

let boardZoom = 1.0;
let boardOffsetX = 0;
let boardOffsetY = 0;

let isDraggingBoard = false;
let dragStartX = 0;
let dragStartY = 0;
let dragStartOffsetX = 0;
let dragStartOffsetY = 0;

const MIN_BOARD_ZOOM = 0.6;
const MAX_BOARD_ZOOM = 20;

let touchStartDistance = 0;
let touchStartZoom = 1;
let touchStartOffsetX = 0;
let touchStartOffsetY = 0;

let touchStartX = 0;
let touchStartY = 0;
let touchMoved = false;

TILE_IMAGES.HOLZ.src = "images/forestBright.png";
TILE_IMAGES.LEHM.src = "images/hillBright.png";
TILE_IMAGES.SCHAF.src = "images/pastureBright.png";
TILE_IMAGES.WEIZEN.src = "images/fieldBright.png";
TILE_IMAGES.ERZ.src = "images/mountain.png";
TILE_IMAGES.WÜSTE.src = "images/desert.png";
TILE_IMAGES.WASSER.src = "images/water2.png";
TILE_IMAGES.GOLD.src = "images/goldBright.png";

const RES = ["HOLZ", "LEHM", "SCHAF", "WEIZEN", "ERZ"];

const COLORS = [
  ["rot", "#e53935"],
  ["blau", "#2979ff"],
  ["grün", "#32b44a"],
  ["gelb", "#f4d03f"],
  ["orange", "#ff8a20"],
  ["lila", "#9b45d6"],
  ["türkis", "#19c7c7"],
  ["pink", "#ff5ca8"],
  ["schwarz", "#000000"],
  ["weiß", "#ffffff"],

  // Farben 11–15: kräftiger und leuchtender
  ["neongrün", "#39ff00"],
  ["braun", "#a0522d"],
  ["dunkelblau", "#254bff"],
  ["koralle", "#ff493d"],
  ["gold", "#ffd000"],

  // Farben 16–25: intensiver und klarer unterscheidbar
  ["mint", "#00ffad"],
  ["lavendel", "#c084ff"],
  ["türkisblau", "#05fadd"],
  ["bordeaux", "#c0004f"],
  ["navy", "#2020c9"],
  ["magenta", "#ff00cc"],
  ["oliv", "#b5c900"],
  ["silber", "#8a8b8d"],
  ["pfirsich", "#ff9378"],
  ["petrol", "#00a6a6"],
];
const state = { players: [], board: null };
let ws = null,
  me = localStorage.getItem("catanName") || "",
  myColor = localStorage.getItem("catanColor") || "rot",
  mode = null,
  lastState = null;
const $ = (id) => document.getElementById(id);

// Kontositzung: Der Server bestimmt den Spielernamen aus dem verifizierten Konto.
let sessionToken = localStorage.getItem("catanSessionToken") || "";
let accountStats = null;
let pendingVerificationToken = new URLSearchParams(window.location.search).get("verify") || "";
let accountUiReady = false;


function accountMessage(text, isError = false) {
  const el = $("accountMessage");
  if (!el) { console.log(text); return; }
  el.textContent = text || "";
  el.style.color = isError ? "#ff8b8b" : "#b8f7bd";
}

function ensureAccountUi() {
  if (accountUiReady || !$("join-row")) return;
  accountUiReady = true;
  const row = $("join-row");
  row.innerHTML = `
    <div id="accountPanel" style="width:100%;max-width:440px;margin:0 auto;display:grid;gap:10px;text-align:left">
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button type="button" id="accountLoginTab">Anmelden</button>
        <button type="button" id="accountRegisterTab">Konto erstellen</button>
      </div>
      <label for="accountUsername">Username</label>
      <input id="accountUsername" maxlength="20" autocomplete="username" placeholder="Username (3–20 Zeichen)" />
      <div id="accountEmailWrap" class="hidden">
        <label for="accountEmail">E-Mail-Adresse</label>
        <input id="accountEmail" type="email" maxlength="254" autocomplete="email" placeholder="du@example.com" />
      </div>
      <label for="accountPassword">Passwort</label>
      <input id="accountPassword" type="password" maxlength="128" autocomplete="current-password" placeholder="Mindestens 10 Zeichen" />
      <div id="accountPasswordConfirmWrap" class="hidden">
        <label for="accountPasswordConfirm">Passwort wiederholen</label>
        <input id="accountPasswordConfirm" type="password" maxlength="128" autocomplete="new-password" placeholder="Passwort erneut eingeben" />
      </div>
      <button type="button" id="accountSubmit" class="primary">Anmelden</button>
      <div id="accountMessage" role="status" aria-live="polite" style="min-height:1.4em;overflow-wrap:anywhere"></div>
    </div>`;
  $("accountLoginTab").onclick = () => setAccountMode("login");
  $("accountRegisterTab").onclick = () => setAccountMode("register");
  $("accountSubmit").onclick = submitAccountForm;
  $("accountPassword").addEventListener("keydown", e => { if (e.key === "Enter") submitAccountForm(); });
  $("accountPasswordConfirm").addEventListener("keydown", e => { if (e.key === "Enter") submitAccountForm(); });
  $("accountUsername").addEventListener("keydown", e => { if (e.key === "Enter") submitAccountForm(); });
  setAccountMode("login");
  if (me) $("accountUsername").value = me;
}

let accountMode = "login";
function setAccountMode(mode) {
  accountMode = mode;
  if (!$("accountPanel")) return;
  $("accountEmailWrap").classList.toggle("hidden", mode !== "register");
  $("accountPasswordConfirmWrap").classList.toggle("hidden", mode !== "register");
  $("accountPassword").placeholder = mode === "register" ? "Mindestens 10 Zeichen" : "Passwort";
  $("accountSubmit").textContent = mode === "register" ? "Registrieren" : "Anmelden";
  $("accountPassword").autocomplete = mode === "register" ? "new-password" : "current-password";
  $("accountLoginTab").disabled = mode === "login";
  $("accountRegisterTab").disabled = mode === "register";
  accountMessage(mode === "register" ? "Nach der Registrierung erhältst du eine Bestätigungs-E-Mail." : "Bitte melde dich mit deinem Konto an.");
}

function submitAccountForm() {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    accountMessage("Noch keine Serververbindung. Bitte kurz warten.", true);
    return;
  }
  const username = $("accountUsername").value.trim();
  const password = $("accountPassword").value;
  if (!username || !password) {
    accountMessage("Bitte Username und Passwort ausfüllen.", true);
    return;
  }
  if (accountMode === "register") {
    const email = $("accountEmail").value.trim();
    const passwordConfirm = $("accountPasswordConfirm").value;
    if (!email) { accountMessage("Bitte deine E-Mail-Adresse eingeben.", true); return; }
    if (password !== passwordConfirm) {
      accountMessage("Die beiden Passwörter stimmen nicht überein.", true);
      $("accountPasswordConfirm").focus();
      return;
    }
    send("register", { username, email, password });
  } else {
    send("login", { username, password });
  }
}

function renderLoggedInAccount(username, stats = accountStats) {
  me = username;
  localStorage.setItem("catanName", username);
  if (accountStats) stats = accountStats;
  const row = $("join-row");
  if (!row) return;
  row.style.display = "block";
  row.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap">
      <span>Angemeldet als <b>${escapeAccountText(username)}</b></span>
      <button type="button" id="accountLogoutBtn">Abmelden</button>
      <button type="button" id="accountStatsBtn">Statistik aktualisieren</button>
    </div>
    <div id="accountStatsText" style="text-align:center;margin-top:8px"></div>
    <div id="accountMessage" role="status" aria-live="polite" style="text-align:center;margin-top:6px;overflow-wrap:anywhere"></div>`;
  $("accountLogoutBtn").onclick = logoutAccount;
  $("accountStatsBtn").onclick = () => send("get_account_stats", { token: sessionToken });
  updateAccountStats(stats);
}

function updateAccountStats(stats) {
  if (!stats) return;
  accountStats = stats;
  const el = $("accountStatsText");
  if (!el) return;
  el.textContent = `Partien: ${stats.games_played ?? 0} · Siege: ${stats.wins ?? 0} · Niederlagen: ${stats.losses ?? 0} · Siegpunkte gesamt: ${stats.total_victory_points ?? 0}`;
}

function renderLoggedOutAccount(message = "") {
  accountUiReady = false;
  ensureAccountUi();
  showPreLobby(true);
  showPreLobbyActions(false);
  hideRoomToolbar();
  $("lobby").classList.add("hidden");
  $("game").classList.add("hidden");
  if (message) accountMessage(message);
}

function escapeAccountText(value) {
  return String(value).replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;", "'":"&#39;"}[ch]));
}

// -------------------------
// Multi-Lobby UI
// -------------------------
let currentRoomCode = localStorage.getItem("catanRoomCode") || "";
let pendingInviteCode = new URLSearchParams(window.location.search).get("room") || "";

function setPreLobbyMessage(message, isError = false) {
  const el = $("preLobbyMessage");
  if (!el) return;
  el.textContent = message || "";
  el.style.color = isError ? "#ff8b8b" : "#b8f7bd";
}

function showPreLobby(show) {
  const el = $("preLobby");
  if (el) el.classList.toggle("hidden", !show);
}

function showPreLobbyActions(show) {
  const el = $("preLobbyActions");
  if (el) el.classList.toggle("hidden", !show);
}

function inviteUrl(code = currentRoomCode) {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  if (code) url.searchParams.set("room", code);
  return url.toString();
}

function showRoomToolbar() {
  const bar = $("roomToolbar");
  if (!bar || !currentRoomCode) return;
  $("roomCodeText").textContent = currentRoomCode;
  $("roomInviteText").textContent = inviteUrl();
  bar.classList.remove("hidden");
}

function hideRoomToolbar() {
  const bar = $("roomToolbar");
  if (bar) bar.classList.add("hidden");
}

function createRoom() {
  if (!sessionToken) { setPreLobbyMessage("Bitte melde dich zuerst an.", true); return; }
  if (!ws || ws.readyState !== WebSocket.OPEN) { setPreLobbyMessage("Keine Serververbindung.", true); return; }
  setPreLobbyMessage("Lobby wird erstellt …");
  send("create_room", { token: sessionToken });
}

function joinRoom(code) {
  code = String(code || "").trim().toUpperCase();
  if (!code) { setPreLobbyMessage("Bitte gib einen Einladungscode ein.", true); return; }
  if (!sessionToken) { setPreLobbyMessage("Bitte melde dich zuerst an.", true); return; }
  if (!ws || ws.readyState !== WebSocket.OPEN) { setPreLobbyMessage("Keine Serververbindung.", true); return; }
  setPreLobbyMessage("Lobby wird gesucht …");
  send("join_room", { code, token: sessionToken });
}

function leaveRoom() {
  if (ws && ws.readyState === WebSocket.OPEN) send("leave_room", { token: sessionToken });
  currentRoomCode = "";
  localStorage.removeItem("catanRoomCode");
  hideRoomToolbar();
  showPreLobby(true);
  showPreLobbyActions(true);
  $("lobby").classList.add("hidden");
  $("game").classList.add("hidden");
  setPreLobbyMessage("");
}

function logoutAccount() {
  if (ws && ws.readyState === WebSocket.OPEN) send("logout", { token: sessionToken });
  sessionToken = "";
  accountStats = null;
  currentRoomCode = "";
  localStorage.removeItem("catanSessionToken");
  localStorage.removeItem("catanName");
  localStorage.removeItem("catanRoomCode");
  me = "";
  isSpectator = false;
  lastState = null;
  mode = null;
  renderLoggedOutAccount("Du wurdest abgemeldet.");
}

let lobbyUiInitialized = false;
function initializeLobbyUi() {
  if (lobbyUiInitialized) return;
  const actions = $("preLobbyActions");
  if (!actions || !$("createRoomBtn")) return;
  lobbyUiInitialized = true;
  $("createRoomBtn").onclick = createRoom;
  $("joinRoomBtn").onclick = () => joinRoom($("roomCodeInput").value);
  $("roomCodeInput").addEventListener("keydown", e => { if (e.key === "Enter") joinRoom($("roomCodeInput").value); });
  $("backToMenuBtn").onclick = leaveRoom;
  $("logoutRoomBtn").onclick = logoutAccount;
  $("copyInviteBtn").onclick = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl());
      $("copyInviteBtn").textContent = "Link kopiert ✓";
      setTimeout(() => { if ($("copyInviteBtn")) $("copyInviteBtn").textContent = "Einladungslink kopieren"; }, 1800);
    } catch (_) {
      const text = inviteUrl();
      window.prompt("Kopiere diesen Einladungslink:", text);
    }
  };
  if (pendingInviteCode) $("roomCodeInput").value = pendingInviteCode.toUpperCase();
  hideRoomToolbar();
  showPreLobby(true);
  if (sessionToken) showPreLobbyActions(true);
}

function send(type, extra = {}) {
if (
    isSpectator &&
    !["join", "chat_message", "logout", "leave_room", "create_room", "join_room"].includes(type)
) {
    console.log("Zuschaueraktion blockiert:", type);
    return;
}

  if (ws && ws.readyState === 1) {
    console.log("Nachricht wird gesendet:", type);
    ws.send(JSON.stringify({ type, ...extra }));
  }
}


let player_index = null;
let reconnectTimer = null;
let reconnectDelay = 1000;

function connect() {
  if (ws && (ws.readyState === WebSocket.OPEN ||
             ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    $("connection").textContent = "Verbunden";
    reconnectDelay = 1000;
    ensureAccountUi();

    // E-Mail-Bestätigungslink: Token einmal an den Server senden und URL bereinigen.
    if (pendingVerificationToken) {
      send("verify_email", { token: pendingVerificationToken });
      pendingVerificationToken = "";
      try { window.history.replaceState({}, document.title, window.location.pathname + window.location.hash); } catch (_) {}
    }

    // Nach einem Reload zurück in den Raum, falls ein Raumcode gespeichert ist.
    if (sessionToken) {
      if (me) renderLoggedInAccount(me, accountStats);
      const requestedRoom = pendingInviteCode || localStorage.getItem("catanRoomCode") || "";
      if (requestedRoom) {
        pendingInviteCode = "";
        joinRoom(requestedRoom);
      } else {
        showPreLobby(true);
        showPreLobbyActions(true);
      }
    }
  };

  ws.onclose = () => {
    $("connection").textContent = "Verbindung getrennt";

    // automatisch erneut verbinden
    if (!reconnectTimer) {
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, reconnectDelay);

      reconnectDelay = Math.min(reconnectDelay * 2, 10000);
    }
  };

  ws.onerror = () => {
    $("connection").textContent = "WebSocket-Fehler";
  };

  ws.onmessage = (e) => {
    try {
      const m = JSON.parse(e.data);
      if (mapBuilder.active){
        return
      }

      if (m.type === "state") {
        hideRoomToolbar()
        renderState(m.state);
      }

      else if (m.type === "error") {
        console.log(m.message || "Fehler");
        accountMessage(m.message || "Ein Fehler ist aufgetreten.", true);
      }
      else if (m.type === "room_joined") {
        currentRoomCode = String(m.code || "").toUpperCase();
        if (currentRoomCode) localStorage.setItem("catanRoomCode", currentRoomCode);
        showRoomToolbar();
        showPreLobby(false);
        setPreLobbyMessage("");
        if (me == "Stefan"){
            send("change_color", { playerName: me, color: "pink" });
        }

      }
      else if (m.type === "room_left") {
        currentRoomCode = "";
        localStorage.removeItem("catanRoomCode");
        hideRoomToolbar();
        showPreLobby(true);
        $("lobby").classList.add("hidden");
        $("game").classList.add("hidden");
      }
      else if (m.type === "room_error") {
        setPreLobbyMessage(m.message || "Lobby konnte nicht geöffnet werden.", true);
        if (localStorage.getItem("catanRoomCode")) {
          localStorage.removeItem("catanRoomCode");
          currentRoomCode = "";
        }
        hideRoomToolbar();
        showPreLobby(true);
      }
      else if (m.type === "register_result") {
        if (m.ok) {
          setAccountMode("login");
          $("accountUsername").value = $("accountUsername").value.trim();
          $("accountPassword").value = "";
          if ($("accountPasswordConfirm")) $("accountPasswordConfirm").value = "";
          accountMessage(m.message || "Registrierung erfolgreich. Bitte E-Mail bestätigen.");
        } else {
          accountMessage(m.error || "Registrierung fehlgeschlagen.", true);
        }
      }
      else if (m.type === "verify_result") {
        if (m.ok) setAccountMode("login");
        accountMessage(m.ok ? (m.message || "E-Mail bestätigt. Du kannst dich anmelden.") : (m.error || "E-Mail-Bestätigung fehlgeschlagen."), !m.ok);
      }
      else if (m.type === "login_result") {
        if (!m.ok) {
          accountMessage(m.error || "Anmeldung fehlgeschlagen.", true);
        } else {
          sessionToken = m.token;
          me = m.username;
          accountStats = m.stats || null;
          localStorage.setItem("catanSessionToken", sessionToken);
          localStorage.setItem("catanName", me);
          renderLoggedInAccount(me, accountStats);
          showPreLobby(true);
          const requestedRoom = pendingInviteCode || localStorage.getItem("catanRoomCode") || "";
          if (requestedRoom) {
            pendingInviteCode = "";
            joinRoom(requestedRoom);
          } else {
            showPreLobbyActions(true);
          }
        }
      }
      else if (m.type === "account_stats") {
        updateAccountStats(m.stats);
      }
      else if (m.type === "auth_error") {
        sessionToken = "";
        localStorage.removeItem("catanSessionToken");
        localStorage.removeItem("catanName");
        me = "";
        accountMessage(m.message || "Bitte erneut anmelden.", true);
        renderLoggedOutAccount(m.message || "Bitte erneut anmelden.");
      }
      else if (m.type === "logout_result") {
        renderLoggedOutAccount("Du wurdest abgemeldet.");
      }
else if (m.action === "lobby_update") {
    if (currentRoomCode) showRoomToolbar();
    if (!sessionToken) {
        $("lobby").classList.add("hidden");
        $("game").classList.add("hidden");
        return;
    }
    console.log("LOBBY UPDATE:", m.players);

    // Zuschauer und bereits im Spiel befindliche Spieler
    // dürfen nicht zurück in die Lobby wechseln.
    if (isSpectator) {
        return;
    }
if ($("victoryTrophy")) {
    $("victoryTrophy").src = "images/pokal.png";
}

if ($("victoryOverlay")) {
    $("victoryOverlay").classList.add("hidden");
}

if ($("victoryText")) {
    $("victoryText").textContent = "";
}
    // Lobby-Spielerliste aktualisieren
    renderLobby(m.players, m.loading);

    renderMapPicker(
        m.maps || [],
        m.selected_map || null
    );

    // Lobby anzeigen
    $("lobby").classList.remove("hidden");
    $("game").classList.add("hidden");
}


else if (m.action === "welcome") {
  showPreLobby(false);
  if ($("join-row")) document.getElementById("join-row").style.display = sessionToken ? "block" : "none";

  isSpectator = m.spectator === true;
  player_index = m.player_index ?? null;

  if (m.in_game) {
    // Laufendes Spiel: Spieler oder Zuschauer
    document.getElementById("lobby-actions").style.display = "none";
    document.getElementById("colors").style.display = "none";

    document.getElementById("lobby").classList.add("hidden");
    document.getElementById("game").classList.remove("hidden");

    if (isSpectator) {
      console.log("Als Zuschauer verbunden");
    }
  } else {
    // Normale Lobby
    isSpectator = false;
    document.getElementById("lobby-actions").style.display = "block";
    document.getElementById("colors").style.display = "block";
  }

  console.log("Verbunden", {
    spectator: isSpectator,
    player_index
  });
}

    } catch (err) {
      console.error(err);
    }
  };
}
$("acceptTradeBtn").onclick = () => {
    send("acceptTrade", {
        playerName: me
    });

    $("tradeOffer").classList.add("hidden");
};
$("declineTradeBtn").onclick = () => {
    console.log("Tradedecline message will be send");
    send("declineTrade", {
        playerName: me
    });
    tradeDeclined = true;
};
// Der frühere freie Namensbeitritt wird durch Konto-Login ersetzt.
ensureAccountUi();
initializeLobbyUi();
$("readyBtn").onclick = () => send("ready", { playerName: me, value: true });
$("botAddBtn").onclick = () => send("addBot");
$("botRemoveBtn").onclick = () => send("removeBot");
$("startBtn").onclick = () => send("start_game");
COLORS.forEach(([n, c]) => {
  const b = document.createElement("button");
  b.className = "color";
  b.style.background = c;
  b.title = n;
  b.onclick = () => {
    if (me != "Stefan"){
    myColor = n;
    localStorage.setItem("catanColor", n);
    send("change_color", { playerName: me, color: n });
  }
};
  $("colors").appendChild(b);
});
document
  .querySelectorAll(".actions button")
  .forEach((b) => (b.onclick = () => startAction(b.dataset.action)));

function normalize(s) {
  return s || {};
}
$("tradeButton").onclick = () => {

    if (tradeOpen) {
        closeTradeBar();
    } else {
        openTradeBar();
    }

};
function resourceBox(resource, amount) {
    const color = RESOURCE_COLORS[resource] || "#888";

    return `
        <div 
            class="resource-box" 
            style="background:${color}" 
            title="${resource}"
            onclick="resourceClicked('${resource}')"
        >
            ${amount}
        </div>
    `;
}
function resourceClicked(resource) {
    if (!lastState) return;

    const mep = (lastState.players || [])
        .find((p) => p.name === me);

    if (!mep) return;

    // Nur wenn dieser Spieler Ressourcen abwerfen muss
    if (!mep.hasToDiscard || mep.hasToDiscard <= 0) {
        return;
    }

    // Nur Ressourcen anklicken können, die man tatsächlich besitzt
    if ((mep.resources?.[resource] || 0) <= 0) {
        return;
    }

    send("discardResource", {
        playerName: me,
        res: resource
    });
}
function renderLobby(players, loading) {

  // ==========================================
  // LOADING
  // ==========================================
  if (loading) {

    enterFullscreen()
    // Keine Spielerliste
    $("players").innerHTML = `
      <div class="lobby-loading">
        <div class="loading-spinner"></div>
        <span>Spiel wird gestartet...</span>
      </div>
    `;

    // Alle Lobby-Elemente ausblenden
    $("join-row").style.display = "none";
    $("lobby-actions").style.display = "none";
    $("colors").style.display = "none";

    return;
  }

  // ==========================================
  // NORMALE LOBBY
  // ==========================================

  $("lobby-actions").style.display = "";
  $("colors").style.display = "";

  $("players").innerHTML = players
    .map(
      (p) => `
        <div class="player-row">
          <span
            class="dot"
            style="background:${colorCss(p.color)}"
          ></span>

          <b>${esc(p.name)}</b>

          <span>
            ${p.ready ? "✓ bereit" : "nicht bereit"}
            ${p.is_host ? " 👑" : ""}
          </span>
        </div>
      `,
    )
    .join("");
}

function renderPlayerTrade(trade) {
    console.log("TRADE FUNKTION AUFGERUFEN:", trade);

    const tradeOffer = document.getElementById("tradeOffer");

    if (!trade) {
        tradeDeclined =false;
        lastTradeId = null;
        tradeOffer.classList.add("hidden");
        return;
    }
    const tradeId = trade.tradeId;

    const isOwnTrade = trade.tradingPlayer === me;

    // Neues Handelsangebot
    if (tradeId !== lastTradeId) {
        tradeDeclined = false;
        lastTradeId = tradeId;
        if (!hasResources(trade.request) && !isOwnTrade){
          console.log("Tradedecline message will be send");
          send("declineTrade", {
             playerName: me
            });
          tradeDeclined = true;
        }
    }

    const acceptTradeBtn = $("acceptTradeBtn");
    const declineTradeBtn = $("declineTradeBtn");
    acceptTradeBtn.disabled = false;
    declineTradeBtn.disabled = false;
    if (tradeDeclined || isSpectator) {
      acceptTradeBtn.disabled = true;
      declineTradeBtn.disabled = true;
    } else if (isOwnTrade) {
      acceptTradeBtn.disabled = true;
      declineTradeBtn.disabled = false;
    } else {
      acceptTradeBtn.disabled = false;
      declineTradeBtn.disabled = false;
    }

    console.log("TRADE ELEMENT:", tradeOffer);
    console.log("PARENT:", tradeOffer.parentElement);

    if (isOwnTrade){
      $("tradeTitle").textContent = "DEIN HANDELSANGEBOT";
    }else{
      $("tradeTitle").textContent = "HANDELSANGEBOT";
    }

  
    const offerLabel = document.querySelector("#tradeOffer .trade-label");
const requestLabel = document.querySelector("#tradeOffer .trade-content > div:nth-child(3) .trade-label");

if (isOwnTrade) {
    offerLabel.textContent = "Du möchtest:";
    requestLabel.textContent = "Du gibst:";
} else {
    offerLabel.textContent = "Gibt:";
    requestLabel.textContent = "Möchte:";
}
const topResources = isOwnTrade ? trade.request : trade.offer;
const bottomResources = isOwnTrade ? trade.offer : trade.request;

$("tradeOfferResources").innerHTML =
    `<div class="trade-resources">
        ${Object.entries(topResources || {})
            .filter(([_, amount]) => amount > 0)
            .map(([resource, amount]) => resourceBox(resource, amount))
            .join("")}
    </div>`;

$("tradeRequestResources").innerHTML =
    `<div class="trade-resources">
        ${Object.entries(bottomResources || {})
            .filter(([_, amount]) => amount > 0)
            .map(([resource, amount]) => resourceBox(resource, amount))
            .join("")}
    </div>`;

    tradeOffer.classList.remove("hidden");

    console.log("HANDELSFENSTER SICHTBAR");
    console.log("POSITION:", getComputedStyle(tradeOffer).position);
    console.log("DISPLAY:", getComputedStyle(tradeOffer).display);
    console.log("RECT:", tradeOffer.getBoundingClientRect());
}
function hasResources(request) {
    const mep = (lastState?.players || [])
        .find((p) => p.name === me);

    if (!mep) return false;

    const resources = mep.resources || {};

    for (const [resource, count] of Object.entries(request || {})) {
        if ((resources[resource] || 0) < count) {
            return false;
        }
    }

    return true;
}
function acceptPlayerTrade() {
  send("acceptTrade", {
    playerName: me
  });

  closeModal();
}
function declinePlayerTrade() {
  send("declineTrade", {
    playerName: me
  });

  tradeDeclined = true;
  closeModal();
}

let previousResourceSnapshot = null;
const resourceGainTimers = new Map();

function updateResourceGains(s) {
    console.log("updatResourceGains startet");
    const players = s.players || [];

    const currentSnapshot = players.map(p => ({
        id: p.id,
        name: p.name,
        resources: { ...(p.resources || {}) }
    }));

    if (previousResourceSnapshot === null) {
        previousResourceSnapshot = currentSnapshot;
        console.log("Ressourcen-Popups: Ausgangsstand gespeichert");
        return;
    }

    for (const p of currentSnapshot) {
        const old = previousResourceSnapshot.find(
            player => player.id === p.id
        );

        if (!old) continue;

        const changes = RES
            .map(resource => ({
                resource,
                amount:
                    (Number(p.resources[resource]) || 0) -
                    (Number(old.resources[resource]) || 0)
            }))
            .filter(change => change.amount !== 0);

        if (changes.length === 0) continue;


const row = [...$("playerList").querySelectorAll(".player-card")]
    .find(el => el.dataset.playerId === String(p.id));

        if (!row) {
            console.warn("Spielerzeile nicht gefunden:", p.name);
            continue;
        }

        console.log("SPIELERZEILE GEFUNDEN:", p.name, row);
        const nameRow = row.querySelector(".player-name-row");
        if (!nameRow) {
            console.warn("player-name-row fehlt:", p.name);
            continue;
        }
        console.log("NAME-ROW GEFUNDEN:", p.name, nameRow);
        // Container für alle Ressourcen-Popups dieses Spielers
        let gainContainer = nameRow.querySelector(".resource-gain");

        if (!gainContainer) {
            gainContainer = document.createElement("span");
            gainContainer.className = "resource-gain";
            nameRow.appendChild(gainContainer);
        }

        // Neues Popup erstellen, ohne bestehende Popups zu verändern
        const popup = document.createElement("span");
        popup.className = "resource-gain-popup";

        for (const gain of changes) {
            const square = document.createElement("span");
            square.className = "resource-gain-square";
            square.style.background =
                RESOURCE_COLORS[gain.resource] || "#888";
            square.textContent = `${gain.amount > 0 ? "+" : ""}${gain.amount}`;
            square.title = gain.resource;
            popup.appendChild(square);
        }

        gainContainer.appendChild(popup);

        // Jedes Popup hat seinen eigenen Timer
        setTimeout(() => {
            popup.classList.add("fading");

            setTimeout(() => {
                popup.remove();

                // Container entfernen, wenn keine Popups mehr existieren
                if (
                    gainContainer.isConnected &&
                    gainContainer.children.length === 0
                ) {
                    gainContainer.remove();
                }
            }, 1200);
        }, 12000);
    }
    previousResourceSnapshot = currentSnapshot;
}

function drawKnightCard(canvas) {
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Lila Rückseite mit abgerundeten Ecken
    const x = 1;
    const y = 1;
    const cw = w - 2;
    const ch = h - 2;
    const r = 5;

    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + cw - r, y);
    ctx.quadraticCurveTo(x + cw, y, x + cw, y + r);
    ctx.lineTo(x + cw, y + ch - r);
    ctx.quadraticCurveTo(x + cw, y + ch, x + cw - r, y + ch);
    ctx.lineTo(x + r, y + ch);
    ctx.quadraticCurveTo(x, y + ch, x, y + ch - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();

    const purple = "#a855f7";

    ctx.fillStyle = purple;
    ctx.fill();

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Schwarze Ritterfigur: Kopf
    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.29, w * 0.115, h * 0.105, 0, 0, Math.PI * 2);
    ctx.fill();

    // Körper
    ctx.beginPath();
    ctx.moveTo(w * 0.39, h * 0.39);
    ctx.quadraticCurveTo(w * 0.29, h * 0.43, w * 0.31, h * 0.66);
    ctx.lineTo(w * 0.35, h * 0.78);
    ctx.lineTo(w * 0.65, h * 0.78);
    ctx.lineTo(w * 0.69, h * 0.66);
    ctx.quadraticCurveTo(w * 0.71, h * 0.43, w * 0.61, h * 0.39);
    ctx.closePath();
    ctx.fill();

    // Sockel
    ctx.beginPath();
    ctx.moveTo(w * 0.31, h * 0.77);
    ctx.quadraticCurveTo(w * 0.25, h * 0.80, w * 0.25, h * 0.85);
    ctx.lineTo(w * 0.75, h * 0.85);
    ctx.quadraticCurveTo(w * 0.75, h * 0.80, w * 0.69, h * 0.77);
    ctx.closePath();
    ctx.fill();

    // Dezente Glanzpunkte
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.beginPath();
    ctx.ellipse(w * 0.47, h * 0.25, w * 0.025, h * 0.018, -0.5, 0, Math.PI * 2);
    ctx.fill();
}

const cardVisualPrevious = new Map();

const RESOURCE_NAMES = {
    HOLZ: "Holz",
    LEHM: "Lehm",
    SCHAF: "Schafe",
    WEIZEN: "Weizen",
    ERZ: "Erz",
    GOLD: "Gold"
};
function updatePlayerCardVisuals(p, row) {
    const id = String(p.id);
    const resources = p.resources || {};
    const resourceGroups = row.querySelector(".resource-card-groups");
    const developmentBoxes = row.querySelector(".development-card-boxes");

    let previous = cardVisualPrevious.get(id);

    // Gemeinsame Ressourcenreihe
    let boxRow = resourceGroups.querySelector(".resource-card-row");

    if (!boxRow) {
        boxRow = document.createElement("div");
        boxRow.className = "resource-card-row";
        resourceGroups.appendChild(boxRow);
    }

    // Alle Ressourcen zusammenzählen
    const resourceCount = RES.reduce(
        (sum, resource) => sum + Math.max(0, Number(resources[resource]) || 0),
        0
    );

    // Entwicklungskarten zählen
    const dcCount = Math.max(
        0,
        Number(p.countDevelopmentCards) ||
        Object.values(p.developmentCards || {}).reduce(
            (sum, n) => sum + (Number(n) || 0), 0
        )
    );

    // Erstmalige Initialisierung
    if (!previous) {
        // Vorhandene Boxen an die tatsächliche Kartenanzahl anpassen
        while (boxRow.children.length < resourceCount) {
            const box = document.createElement("span");
            box.className = "inventory-box resource-box";
            boxRow.appendChild(box);
        }

        while (boxRow.children.length > resourceCount) {
            boxRow.lastElementChild.remove();
        }

        while (developmentBoxes.children.length < dcCount) {
            const box = document.createElement("span");
            box.className = "inventory-box development-box";
            developmentBoxes.appendChild(box);
        }

        while (developmentBoxes.children.length > dcCount) {
            developmentBoxes.lastElementChild.remove();
        }

        cardVisualPrevious.set(id, {
            resources: { ...resources },
            resourceCount,
            dcCount
        });

        return;
    }

// Änderung der Ressourcenkarten erkennen
const oldResources = previous.resources || {};
const oldResourceCount = RES.reduce(
    (sum, resource) =>
        sum + Math.max(0, Number(oldResources[resource]) || 0),
    0
);

const resourceDelta = resourceCount - oldResourceCount;

if (resourceDelta > 0) {
    // Neue Karten nach tatsächlichem Rohstoff bestimmen
    const newCards = [];

    for (const resource of RES) {
        const oldAmount = Math.max(
            0, Number(oldResources[resource]) || 0
        );
        const newAmount = Math.max(
            0, Number(resources[resource]) || 0
        );

        for (let i = oldAmount; i < newAmount; i++) {
            newCards.push(resource);
        }
    }

    // Falls sich Rohstoffe gleichzeitig verändert haben,
    // die Kartenanzahl auf die tatsächliche Zunahme begrenzen.
    const gainedResources = newCards.slice(0, resourceDelta);

    for (const resource of gainedResources) {
        const box = document.createElement("span");
        box.className = "inventory-box resource-box gained";
        box.dataset.resource = resource;

        box.style.background = RESOURCE_COLORS[resource] || "rgb(207, 123, 243)";
        boxRow.appendChild(box);

        box._colorTimer = setTimeout(() => {
            if (!box.isConnected || box.classList.contains("losing")) {
                return;
            }

            box.style.background = "rgb(207, 123, 243)";
        }, 12000);
    }
} else if (resourceDelta < 0) {
    let toLose = -resourceDelta;

    for (const box of [...boxRow.children].reverse()) {
        if (toLose <= 0) break;
        if (box.classList.contains("losing")) continue;

        clearTimeout(box._colorTimer);
box.classList.remove("gained");
box.classList.add("losing");
box.style.background = "#a855f7";
toLose--;

setTimeout(() => box.remove(), 1200);

    }
}
    // Änderung der Entwicklungskarten
    const dcDelta = dcCount - previous.dcCount;

    if (dcDelta > 0) {
        for (let i = 0; i < dcDelta; i++) {
            const box = document.createElement("span");
            box.className = "inventory-box development-box gained";
            box.style.background = "#a855f7";
            developmentBoxes.appendChild(box);

            box._colorTimer = setTimeout(() => {
                if (!box.isConnected) return;

                box.classList.remove("gained");
                box.style.background = "#a855f7";
            }, 12000);
        }
    } else if (dcDelta < 0) {
        let toLose = -dcDelta;

        for (const box of [...developmentBoxes.children].reverse()) {
            if (toLose <= 0) break;
            if (box.classList.contains("losing")) continue;

            clearTimeout(box._colorTimer);
   box.classList.remove("gained");
box.classList.add("losing");
box.style.background = "#a855f7";
toLose--;

setTimeout(() => box.remove(), 1200);
        }
    }

    cardVisualPrevious.set(id, {
        resources: { ...resources },
        resourceCount,
        dcCount
    });
}
function renderState(s) {

  lastState = s;

  renderChatHistory(s.chat_history || []);
  renderDiceStatistics(s.dices || {});
  updateDice(s);


    const mep2 = (s.players || []).find(p => p.name === me);

    console.log("MEP:", mep2);
    console.log("GOLD CHOICES:", mep2?.goldChoices);
    if (mep2 && (mep2.goldChoices || 0) > 0) {
        console.log("ÖFFNE GOLD MODAL");

        openGoldResourceModal();
    } else {
        closeGoldResourceModal();
    }
  const isMyTurn = s.currentPlayerName === me;

if (isMyTurn && !wasMyTurn) {
    YOUR_TURN_SOUND.currentTime = 0;
    YOUR_TURN_SOUND.play().catch(err => {
        console.log("YourTurn.wav konnte nicht abgespielt werden:", err);
    });
}

wasMyTurn = isMyTurn;
  checkVictory(s);
  updateActionButtons(s);
  console.log("PLAYER TRADE:", s.playerTrade);
  if (s.playerTrade) {
    renderPlayerTrade(s.playerTrade);
} else {
    $("tradeOffer").classList.add("hidden");
}
  
  const players = s.players || [];

  $("players").innerHTML = players
    .map(
      (p) =>

`<div class="player-row">
    <span class="dot" style="background:${colorCss(p.color)}"></span>
    <div class="player-name-row">
        <b class="player-name">${esc(p.name)}</b>
    </div>
    <span>${p.ready ? "✓ bereit" : ""}${p.is_host ? " 👑" : ""}</span>
</div>`
    )
    .join("");
// Vorhandene Ressourcen-Popups sichern
const savedPopups = new Map();

$("playerList").querySelectorAll(".player-card").forEach(row => {
    const container = row.querySelector(".resource-gain");

    if (container) {
        savedPopups.set(
            row.dataset.playerId,
            container
        );
    }
});
const playerList = $("playerList");

players.forEach(p => {
    let row = [...playerList.querySelectorAll(".player-card")]
        .find(el => el.dataset.playerId === String(p.id));

if (!row) {
    row = document.createElement("div");
    row.className = "player-card";
    row.dataset.playerId = p.id;

    row.innerHTML = `
        <div class="player-name-row">
            <b class="player-name"></b>
        </div>
        <div class="player-stats">
            <div class="resource-card-groups"></div>
            <div class="played-cards-row">
                <div class="development-card-boxes"></div>
                <div class="player-knights"></div>
            </div>
        </div>
    `;

    playerList.appendChild(row);
}

    const name = row.querySelector(".player-name");
    name.style.color = colorCss(p.color);

    // Nur den Text und den Zugpfeil aktualisieren,
    // ohne die player-name-row oder Popups zu ersetzen.
    name.textContent = `${p.name} ${p.victoryPoints || 0} `;

    if (isCurrent(p)) {
        const arrow = document.createElement("span");
        arrow.className = "turn-arrow";
        arrow.textContent = "←";
        name.appendChild(arrow);
    }

const knightContainer = row.querySelector(".player-knights");
const knightCount = Math.max(0, Number(p.knights) || 0);

// Nur neu zeichnen, wenn sich die Anzahl geändert hat
if (Number(knightContainer.dataset.count) !== knightCount) {
    knightContainer.replaceChildren();
    knightContainer.dataset.count = String(knightCount);

    for (let i = 0; i < knightCount; i++) {
        const canvas = document.createElement("canvas");
        canvas.width = 36;
        canvas.height = 52;
        canvas.className = "knight-card";
        canvas.title = "Ritter";

        knightContainer.appendChild(canvas);
        drawKnightCard(canvas);
    }
}

    updatePlayerCardVisuals(p, row);
});

// Spieler entfernen, die nicht mehr im State vorhanden sind
const playerIds = new Set(players.map(p => String(p.id)));

playerList.querySelectorAll(".player-card").forEach(row => {
    if (!playerIds.has(row.dataset.playerId)) {
        row.remove();
    }
});

 const mep = players.find((p) => p.name === me);
  if (mep) {
    $("resources").innerHTML =
  '<h3>Ressourcen</h3><div class="resources">' +
  RES.map(
    (r) => resourceBox(r, mep.resources?.[r] || 0)
  ).join("") +
  "</div>";
    $("devCards").innerHTML = Object.entries(mep.developmentCards || {})
  .map(
    ([k, v]) => `
      <div class="cardline">
        <span
          class="dev-card-name"
          data-card="${k}"
          style="cursor:${v > 0 ? "pointer" : "default"}"
        >
          ${k}
        </span>
        <b>${v}</b>
      </div>
    `
  )
  .join("");

$("devCards").querySelectorAll(".dev-card-name").forEach((card) => {
  card.addEventListener("click", () => {
    playDevelopmentCard(card.dataset.card);
  });
});
  }
  if (s.board || s.tiles || s.vertices) {
    $("lobby").classList.add("hidden");
    $("game").classList.remove("hidden");
    drawBoard(s);
  } else $("game").classList.add("hidden");
  $("turnText").textContent = s.current_player ? ` · ${s.current_player}` : "";
  $("phaseText").textContent = phaseText(s);
  updatePrompt(s);
}
function phaseText(s) {
    let goldChoices = false;
    for (player of s.players){
        if (player.goldChoices > 0){
            goldChoices = true;
        }
    }
  if (s.würfelMode) return "Würfeln"
  if (s.setupPhase) return "Aufbauphase";
  if (s.buildPhase) return "Baurunde";
  if (goldChoices) return "Gold auswählen"
  if (s.moveRobberMode) return "Räuber bewegen";
  if (s.stealMode) return "Stehlen";
  if (s.discardResourcesMode) return "Abwerfen";
  return "Spielphase";
}
function isCurrent(p) {
  return p.id === lastState?.currentPlayer;
}
function colorCss(c) {
  if (Array.isArray(c)) {
    return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
  }

  const x = COLORS.find((a) => a[0] === c);
  return x ? x[1] : c || "#888";
}
function esc(x) {
  return String(x ?? "").replace(
    /[&<>"']/g,
    (m) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        m
      ],
  );
}
function getBoard(s) {
  return s.board || s;
}
function canBuildSettlement(v, b, s, mep) {
    if (!v) return false;

    // Bereits besetzt
    if (v.owner !== null && v.owner !== undefined) {
        return false;
    }

    const vertices = b.vertices || [];
    const edges = b.edges || [];

    // ------------------------------------------------
    // 2-Abstand-Regel:
    // Kein direkt benachbarter Vertex darf besetzt sein
    // ------------------------------------------------
    for (const e of edges) {
        let neighbor = null;

        if (e.vertex1 === v.id) {
            neighbor = vertices.find(x => x.id === e.vertex2);
        } else if (e.vertex2 === v.id) {
            neighbor = vertices.find(x => x.id === e.vertex1);
        }

        if (
            neighbor &&
            neighbor.owner !== null &&
            neighbor.owner !== undefined
        ) {
            return false;
        }
    }

    // ------------------------------------------------
    // SETUPPHASE
    // In der Setupphase braucht man keine eigene Straße
    // ------------------------------------------------
    if (s.setupPhase) {
        return true;
    }

    // ------------------------------------------------
    // NORMALE PHASE:
    // Es muss eine eigene Straße an diesem Vertex hängen
    // ------------------------------------------------
    return edges.some(e => {
        if (e.owner !== mep.id) {
            return false;
        }

        return e.vertex1 === v.id || e.vertex2 === v.id;
    });
}


function canBuildCity(v, mep) {
    // Stadt nur auf eigener Siedlung
    return v.owner === mep.id && !v.isCity;
}


function canBuildRoad(e, b, s, mep) {
    if (!e) return false;

    // Straße bereits vorhanden
    if (e.owner !== null && e.owner !== undefined) {
        return false;
    }

    const vertices = b.vertices || [];
    const edges = b.edges || [];

    // ------------------------------------------------
    // SETUPPHASE:
    // Straße muss an einer eigenen richtigen Siedlung hängen 
    // ------------------------------------------------
if (s.setupPhase) {
    const v1 = vertices.find(v => v.id === e.vertex1);
    const v2 = vertices.find(v => v.id === e.vertex2);

    // Straße darf an einer eigenen Siedlung/Stadt liegen
    const atOwnSettlement =
        (v1 && v1.owner === mep.id) ||
        (v2 && v2.owner === mep.id);

    if (!atOwnSettlement) {
        return false;
    }

    // Keine eigene Straße darf an einem der beiden Endpunkte
    // dieser neuen Straße liegen.
    const connectedEdges = edges.filter(other => {
        if (other.id === e.id) return false;

        return (
            other.vertex1 === e.vertex1 ||
            other.vertex2 === e.vertex1 ||
            other.vertex1 === e.vertex2 ||
            other.vertex2 === e.vertex2
        );
    });

    for (const other of connectedEdges) {
        if (other.owner === mep.id) {
            return false;
        }
    }

    return true;
}

    // ------------------------------------------------
    // NORMALE PHASE:
    // Straße muss an einer eigenen Straße hängen
    // ------------------------------------------------
    return edges.some(other => {
        if (other.id === e.id) return false;
        if (other.owner !== mep.id) return false;

        return (
            other.vertex1 === e.vertex1 ||
            other.vertex2 === e.vertex1 ||
            other.vertex1 === e.vertex2 ||
            other.vertex2 === e.vertex2
        );
    });
}
// =========================================================
// GEMEINSAME FELD-DARSTELLUNG
// Wird von drawBoard() und drawMapPreview() verwendet
// =========================================================

function drawMapTiles(ctx, tiles, pos, size) {
    for (const t of tiles) {
        const p = pos(+t.q, +t.r);

        // Unbekannte Ressource als weißes Feld mit Fragezeichen
        if (t.resource == null) {
            drawUnknownTile(ctx, p.x, p.y, size);
            continue;
        }

        const resource = String(t.resource || " ").toUpperCase();
        const img = TILE_IMAGES[resource];

        

        if (img && img.complete && img.naturalWidth > 0) {

            // -------------------------------------------------
            // FELDBILDER
            // -------------------------------------------------


            if (resource.includes("WASSER")) {
                ctx.drawImage(
                    img,
                    p.x - size * 1.91,
                    p.y - size * 1.22,
                    size * 3.82,
                    size * 2.44
                );

            } else if (resource.includes("GOLD")) {
                ctx.drawImage(
                    img,
                    p.x - size * 1.54,
                    p.y - size * 1.05,
                    size * 3.08,
                    size * 2.1
                );

            } else {
                ctx.drawImage(
                    img,
                    p.x - size * 0.9,
                    p.y - size,
                    size * 1.8,
                    size * 2
                );
            }
        }

        // -------------------------------------------------
        // KEINE ZAHL AUF WASSER ODER WÜSTE
        // -------------------------------------------------

        if (
            resource.includes("WASSER") ||
            resource.includes("WÜSTE")
        ) {
            continue;
        }

        // -------------------------------------------------
        // ZAHLENKREIS
        // -------------------------------------------------

        if (t.number == null || t.number === "") {
            continue;
        }

        const numberCircleRadius = size * 0.28;

        ctx.fillStyle = "#f2dfbb";
        ctx.beginPath();
        ctx.arc(
            p.x,
            p.y,
            numberCircleRadius,
            0,
            Math.PI * 2
        );
        ctx.fill();

        // -------------------------------------------------
        // ZAHL
        // -------------------------------------------------

        ctx.fillStyle =
            Number(t.number) === 6 ||
            Number(t.number) === 8
                ? "#c33"
                : "#222";

        ctx.font = `bold ${size * 0.25}px Georgia`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        ctx.fillText(
            t.number,
            p.x,
            p.y
        );

        // -------------------------------------------------
        // RÄUBER
        // Nur zeichnen, wenn das Feld den Räuber enthält
        // und ROBBER_CANVAS geladen wurde.
        // -------------------------------------------------

        if (t.hasRobber && ROBBER_CANVAS.width > 0) {
            const robberHeight = size * 1.30;
            const robberWidth = robberHeight * (512 / 1280);

            const robberX = p.x - robberWidth / 2;
            const robberY = p.y - robberHeight * 0.55;

            ctx.save();

            ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
            ctx.beginPath();
            ctx.ellipse(
                p.x,
                p.y + robberHeight * 0.50,
                robberWidth * 0.50,
                robberHeight * 0.05,
                0,
                0,
                Math.PI * 2
            );
            ctx.fill();

            ctx.restore();

            ctx.drawImage(
                ROBBER_CANVAS,
                robberX - 3,
                robberY - 3,
                robberWidth + 6,
                robberHeight + 6
            );
        }
    }
}

function drawBoard(s) {
  const c = $("board"),
    r = c.getBoundingClientRect(),
    d = devicePixelRatio || 1;
  c.width = r.width * d;
  c.height = r.height * d;
  const ctx = c.getContext("2d");
  ctx.scale(d, d);
  const W = r.width,
    H = r.height;
  ctx.fillStyle = "#c7a36b";
  ctx.fillRect(0, 0, W, H);
  const b = getBoard(s),
    tiles = b.tiles || [];
  const radius = Math.max(
    ...tiles.map((t) =>
      Math.max(
        Math.abs(+t.q || 0),
        Math.abs(+t.r || 0),
        Math.abs(-(+t.q || 0) - (+t.r || 0)),
      ),
    ),
    3,
  );
const size = IS_IPHONE
    ? DESKTOP_BOARD_SIZE
    : Math.min(
        W / (radius * 3.1 + 2),
        H / (radius * 2.8 + 2),
        70
      );
        console.log("DESKTOP BOARD SIZE:", size, "W:", W, "H:", H, "radius:", radius);
  const center = {
      x: W * 0.5 + boardOffsetX,
      y: H * 0.5 + boardOffsetY
  };

const zoomedSize = size * boardZoom;

  const pos = (q, r) => ({
      x: center.x +
        zoomedSize *
        (Math.sqrt(3) * q + (Math.sqrt(3) / 2) * r),

      y: center.y +
        zoomedSize * 1.5 * r
  });

    const waterRadius = 50;

    for (let q = -waterRadius; q <= waterRadius; q++) {
        for (let r = -waterRadius; r <= waterRadius; r++) {

            // gültige Hex-Koordinaten
            if (Math.abs(q + r) > waterRadius) continue;

            const p = pos(q, r);

            const img = TILE_IMAGES.WASSER;

            if (img.complete && img.naturalWidth > 0) {
                ctx.drawImage(
                    img,
                    p.x - zoomedSize* 1.91,
                    p.y - zoomedSize*1.22,
                    zoomedSize * 3.82,
                    zoomedSize * 2.44,
                );
            }
        }
    }
  drawMapTiles(ctx, tiles, pos, zoomedSize);
// =========================================================
// HÄFEN
// =========================================================

drawHarbors(
    ctx,
    b,
    pos,
    zoomedSize,
    center
);

const edges = b.edges || [];
for (const e of edges) {
  const a = vertexPos(e.vertex1, e, b, pos),
    z = vertexPos(e.vertex2, e, b, pos);

  if (!a || !z) continue;

  const owner = getPlayerById(e.owner);

  ctx.strokeStyle = owner
    ? colorCss(owner.color)
    : "#8b704e";

ctx.lineWidth = owner
    ? zoomedSize * 0.12
    : zoomedSize * 0.04;  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(z.x, z.y);
  ctx.stroke();
    if (!owner && mode === "road") {
      const mep = (lastState.players || [])
          .find(p => p.name === me);

      if (mep && canBuildRoad(e, b, lastState, mep)) {
          const mx = (a.x + z.x) / 2;
          const my = (a.y + z.y) / 2;

          ctx.fillStyle = "#6ff";

          ctx.beginPath();
          ctx.arc(mx, my, zoomedSize * 0.17, 0, Math.PI * 2);     
          ctx.fill();
      }
  }
}
const vs = b.vertices || [];

for (const v of vs) {
  const p = vertexPoint(v, b, pos);
  if (!p) continue;

  const owner = getPlayerById(v.owner);

if (owner) {

    ctx.fillStyle = colorCss(owner.color);

    // =========================================================
    // STADT
    // =========================================================
    if (v.isCity) {

        const buildingSize = zoomedSize * 0.24;
        const offsetY = -zoomedSize * 0.07;

        // -----------------------------------------------------
        // NORMALE STADT
        // -----------------------------------------------------
        if (owner.name !== "Petra") {

            ctx.beginPath();

            ctx.moveTo(
                p.x - buildingSize,
                p.y + buildingSize + offsetY
            );

            ctx.lineTo(
                p.x + buildingSize,
                p.y + buildingSize + offsetY
            );

            ctx.lineTo(
                p.x + buildingSize,
                p.y + offsetY
            );

            ctx.lineTo(
                p.x,
                p.y + offsetY
            );

            ctx.lineTo(
                p.x - 0.5 * buildingSize,
                p.y - buildingSize + offsetY
            );

            ctx.lineTo(
                p.x - buildingSize,
                p.y + offsetY
            );

            ctx.closePath();

            ctx.fill();

            // weißer Rand
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = zoomedSize * 0.025;
            ctx.stroke();
        }
// -----------------------------------------------------
// 👑 MAMA-SCHLOSS
// -----------------------------------------------------
else {

    ctx.save();

    const s = buildingSize* 1.75;
    const x = p.x;
    const y = p.y + offsetY;

    // -------------------------------------------------
    // SCHATTEN
    // -------------------------------------------------

    ctx.shadowColor = "rgba(0,0,0,0.28)";
    ctx.shadowBlur = s * 0.18;
    ctx.shadowOffsetY = s * 0.10;

    // -------------------------------------------------
    // ROSA VERLAUF
    // -------------------------------------------------

    const pink = ctx.createLinearGradient(
        x - s,
        y - s,
        x + s,
        y + s
    );

    pink.addColorStop(0, "#ff9fc8");
    pink.addColorStop(0.45, "#f45b9b");
    pink.addColorStop(1, "#c92f70");

    // -------------------------------------------------
    // HAUPTGEBÄUDE
    // -------------------------------------------------

    ctx.beginPath();

    ctx.moveTo(
        x - s * 0.78,
        y + s
    );

    ctx.lineTo(
        x + s * 0.78,
        y + s
    );

    ctx.lineTo(
        x + s * 0.78,
        y - s * 0.05
    );

    ctx.lineTo(
        x + s * 0.42,
        y - s * 0.05
    );

    ctx.lineTo(
        x,
        y - s * 0.62
    );

    ctx.lineTo(
        x - s * 0.42,
        y - s * 0.05
    );

    ctx.lineTo(
        x - s * 0.78,
        y - s * 0.05
    );

    ctx.closePath();

    ctx.fillStyle = pink;
    ctx.fill();

    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // weißer Rand
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = s * 0.11;
    ctx.lineJoin = "round";
    ctx.stroke();


    // -------------------------------------------------
    // GOLDENER DACHRAND
    // -------------------------------------------------

    const gold = ctx.createLinearGradient(
        x - s,
        y,
        x + s,
        y
    );

    gold.addColorStop(0, "#a96b00");
    gold.addColorStop(0.3, "#ffd84a");
    gold.addColorStop(0.5, "#fff2a0");
    gold.addColorStop(0.7, "#ffd84a");
    gold.addColorStop(1, "#a96b00");

    ctx.beginPath();

    ctx.moveTo(
        x - s * 0.43,
        y - s * 0.04
    );

    ctx.lineTo(
        x,
        y - s * 0.62
    );

    ctx.lineTo(
        x + s * 0.43,
        y - s * 0.04
    );

    ctx.strokeStyle = gold;
    ctx.lineWidth = s * 0.075;
    ctx.stroke();


    // -------------------------------------------------
    // LINKER TURM
    // -------------------------------------------------

    ctx.beginPath();

    ctx.roundRect(
        x - s * 1.02,
        y - s * 0.38,
        s * 0.43,
        s * 1.38,
        s * 0.08
    );

    ctx.fillStyle = pink;
    ctx.fill();

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = s * 0.08;
    ctx.stroke();


    // -------------------------------------------------
    // RECHTER TURM
    // -------------------------------------------------

    ctx.beginPath();

    ctx.roundRect(
        x + s * 0.59,
        y - s * 0.38,
        s * 0.43,
        s * 1.38,
        s * 0.08
    );

    ctx.fillStyle = pink;
    ctx.fill();

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = s * 0.08;
    ctx.stroke();


    // -------------------------------------------------
    // LINKES TURMDACH
    // -------------------------------------------------

    ctx.beginPath();

    ctx.moveTo(
        x - s * 1.12,
        y - s * 0.34
    );

    ctx.lineTo(
        x - s * 0.805,
        y - s * 0.78
    );

    ctx.lineTo(
        x - s * 0.50,
        y - s * 0.34
    );

    ctx.closePath();

    ctx.fillStyle = gold;
    ctx.fill();

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = s * 0.07;
    ctx.stroke();


    // -------------------------------------------------
    // RECHTES TURMDACH
    // -------------------------------------------------

    ctx.beginPath();

    ctx.moveTo(
        x + s * 0.50,
        y - s * 0.34
    );

    ctx.lineTo(
        x + s * 0.805,
        y - s * 0.78
    );

    ctx.lineTo(
        x + s * 1.12,
        y - s * 0.34
    );

    ctx.closePath();

    ctx.fillStyle = gold;
    ctx.fill();

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = s * 0.07;
    ctx.stroke();


    // -------------------------------------------------
    // TURM-KUGELN
    // -------------------------------------------------

    ctx.fillStyle = "#fff0a0";

    ctx.beginPath();
    ctx.arc(
        x - s * 0.805,
        y - s * 0.84,
        s * 0.07,
        0,
        Math.PI * 2
    );
    ctx.fill();

    ctx.beginPath();
    ctx.arc(
        x + s * 0.805,
        y - s * 0.84,
        s * 0.07,
        0,
        Math.PI * 2
    );
    ctx.fill();


    // -------------------------------------------------
    // MITTLERES FENSTER
    // -------------------------------------------------

    const windowGradient = ctx.createLinearGradient(
        x,
        y - s * 0.25,
        x,
        y + s * 0.35
    );

    windowGradient.addColorStop(0, "#fff4d0");
    windowGradient.addColorStop(0.3, "#ffd86a");
    windowGradient.addColorStop(1, "#b87500");

    ctx.beginPath();

    ctx.roundRect(
        x - s * 0.18,
        y - s * 0.28,
        s * 0.36,
        s * 0.56,
        s * 0.08
    );

    ctx.fillStyle = windowGradient;
    ctx.fill();

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = s * 0.035;
    ctx.stroke();


    // Fensterkreuz
    ctx.beginPath();

    ctx.moveTo(x, y - s * 0.27);
    ctx.lineTo(x, y + s * 0.27);

    ctx.moveTo(
        x - s * 0.17,
        y - s * 0.01
    );

    ctx.lineTo(
        x + s * 0.17,
        y - s * 0.01
    );

    ctx.strokeStyle = "#b87500";
    ctx.lineWidth = s * 0.035;
    ctx.stroke();


    // -------------------------------------------------
    // LINKES FENSTER
    // -------------------------------------------------

    ctx.beginPath();

    ctx.roundRect(
        x - s * 0.89,
        y - s * 0.05,
        s * 0.16,
        s * 0.34,
        s * 0.05
    );

    ctx.fillStyle = "#ffe28a";
    ctx.fill();

    ctx.strokeStyle = "#b87500";
    ctx.lineWidth = s * 0.035;
    ctx.stroke();


    // -------------------------------------------------
    // RECHTES FENSTER
    // -------------------------------------------------

    ctx.beginPath();

    ctx.roundRect(
        x + s * 0.73,
        y - s * 0.05,
        s * 0.16,
        s * 0.34,
        s * 0.05
    );

    ctx.fillStyle = "#ffe28a";
    ctx.fill();

    ctx.strokeStyle = "#b87500";
    ctx.lineWidth = s * 0.035;
    ctx.stroke();


    // -------------------------------------------------
    // GROSSES TOR
    // -------------------------------------------------

    ctx.beginPath();

    ctx.moveTo(
        x - s * 0.22,
        y + s
    );

    ctx.lineTo(
        x - s * 0.22,
        y + s * 0.42
    );

    ctx.quadraticCurveTo(
        x,
        y + s * 0.10,
        x + s * 0.22,
        y + s * 0.42
    );

    ctx.lineTo(
        x + s * 0.22,
        y + s
    );

    ctx.closePath();

    const door = ctx.createLinearGradient(
        x - s * 0.22,
        y,
        x + s * 0.22,
        y
    );

    door.addColorStop(0, "#6b321e");
    door.addColorStop(0.5, "#a85b32");
    door.addColorStop(1, "#542718");

    ctx.fillStyle = door;
    ctx.fill();

    ctx.strokeStyle = "#ffd84a";
    ctx.lineWidth = s * 0.055;
    ctx.stroke();


    // -------------------------------------------------
    // GOLDENER TORRING
    // -------------------------------------------------

    ctx.beginPath();

    ctx.arc(
        x + s * 0.10,
        y + s * 0.70,
        s * 0.045,
        0,
        Math.PI * 2
    );

    ctx.fillStyle = "#ffd84a";
    ctx.fill();


    // -------------------------------------------------
    // KRONE OBEN
    // -------------------------------------------------

    const crownY = y - s * 1.03;
    const crownWidth = s * 0.72;
    const crownHeight = s * 0.42;

    ctx.beginPath();

    ctx.moveTo(
        x - crownWidth / 2,
        crownY + crownHeight
    );

    ctx.lineTo(
        x - crownWidth / 2,
        crownY + crownHeight * 0.35
    );

    ctx.lineTo(
        x - crownWidth * 0.25,
        crownY + crownHeight * 0.70
    );

    ctx.lineTo(
        x,
        crownY
    );

    ctx.lineTo(
        x + crownWidth * 0.25,
        crownY + crownHeight * 0.70
    );

    ctx.lineTo(
        x + crownWidth / 2,
        crownY + crownHeight * 0.35
    );

    ctx.lineTo(
        x + crownWidth / 2,
        crownY + crownHeight
    );

    ctx.closePath();

    ctx.fillStyle = gold;
    ctx.fill();

    ctx.strokeStyle = "#9c6500";
    ctx.lineWidth = s * 0.045;
    ctx.stroke();


    // -------------------------------------------------
    // KRONEN-JUWELEN
    // -------------------------------------------------

    ctx.fillStyle = "#fff5b5";

    for (const dx of [
        -crownWidth * 0.32,
        0,
        crownWidth * 0.32
    ]) {
        ctx.beginPath();

        ctx.arc(
            x + dx,
            crownY + crownHeight * 0.65,
            s * 0.035,
            0,
            Math.PI * 2
        );

        ctx.fill();
    }

    ctx.restore();
}

    }

    // =========================================================
    // NORMALE SIEDLUNG
    // =========================================================
    else {
    const settlementSize = zoomedSize * 0.17;
    const offsetY = -zoomedSize * 0.04;

        if (owner.name === "Petra"){
// -----------------------------------------------------
// 👑 MAMA-SIEDLUNG
// eigenes Design – kleines rosa/goldenes Haus
// -----------------------------------------------------

ctx.save();

const s = settlementSize * 2.5;
const x = p.x;
const y = p.y + offsetY;


// =====================================================
// FARBEN
// =====================================================

const pink = ctx.createLinearGradient(
    x - s,
    y - s,
    x + s,
    y + s
);

pink.addColorStop(0, "#ffb4d4");
pink.addColorStop(0.45, "#f45b9b");
pink.addColorStop(1, "#c92f70");


const roof = ctx.createLinearGradient(
    x - s,
    y - s,
    x + s,
    y
);

roof.addColorStop(0, "#fff0a0");
roof.addColorStop(0.35, "#ffd84a");
roof.addColorStop(0.65, "#f5b51b");
roof.addColorStop(1, "#b87500");


// =====================================================
// SCHATTEN
// =====================================================

ctx.shadowColor = "rgba(0,0,0,0.28)";
ctx.shadowBlur = s * 0.20;
ctx.shadowOffsetY = s * 0.12;


// =====================================================
// HAUSKÖRPER
// =====================================================

ctx.beginPath();

ctx.moveTo(
    x - s * 0.68,
    y + s * 0.72
);

ctx.lineTo(
    x + s * 0.68,
    y + s * 0.72
);

ctx.lineTo(
    x + s * 0.68,
    y - s * 0.05
);

ctx.lineTo(
    x - s * 0.68,
    y - s * 0.05
);

ctx.closePath();

ctx.fillStyle = pink;
ctx.fill();


// Schatten ausschalten
ctx.shadowColor = "transparent";
ctx.shadowBlur = 0;
ctx.shadowOffsetY = 0;


// =====================================================
// WEISSER RAND DES HAUSES
// =====================================================

ctx.strokeStyle = "#ffffff";
ctx.lineWidth = s * 0.085;
ctx.lineJoin = "round";
ctx.stroke();


// =====================================================
// GROSSES GESCHWUNGENES DACH
// =====================================================

ctx.beginPath();

ctx.moveTo(
    x - s * 0.82,
    y + s * 0.02
);

ctx.quadraticCurveTo(
    x - s * 0.52,
    y - s * 0.18,
    x,
    y - s * 0.72
);

ctx.quadraticCurveTo(
    x + s * 0.52,
    y - s * 0.18,
    x + s * 0.82,
    y + s * 0.02
);

ctx.lineTo(
    x + s * 0.70,
    y + s * 0.15
);

ctx.quadraticCurveTo(
    x + s * 0.42,
    y - s * 0.02,
    x,
    y - s * 0.50
);

ctx.quadraticCurveTo(
    x - s * 0.42,
    y - s * 0.02,
    x - s * 0.70,
    y + s * 0.15
);

ctx.closePath();

ctx.fillStyle = roof;
ctx.fill();

ctx.strokeStyle = "#ffffff";
ctx.lineWidth = s * 0.065;
ctx.lineJoin = "round";
ctx.stroke();


// =====================================================
// GOLDENE DACHKANTE
// =====================================================

ctx.beginPath();

ctx.moveTo(
    x - s * 0.78,
    y + s * 0.08
);

ctx.quadraticCurveTo(
    x - s * 0.42,
    y - s * 0.02,
    x,
    y - s * 0.62
);

ctx.quadraticCurveTo(
    x + s * 0.42,
    y - s * 0.02,
    x + s * 0.78,
    y + s * 0.08
);

ctx.strokeStyle = "#fff3a6";
ctx.lineWidth = s * 0.055;
ctx.stroke();


// =====================================================
// KLEINES RUNDES FENSTER
// =====================================================

const windowGradient = ctx.createRadialGradient(
    x,
    y - s * 0.13,
    s * 0.02,
    x,
    y - s * 0.13,
    s * 0.19
);

windowGradient.addColorStop(0, "#fff7cf");
windowGradient.addColorStop(0.45, "#ffd86a");
windowGradient.addColorStop(1, "#b87500");

ctx.beginPath();

ctx.arc(
    x,
    y - s * 0.13,
    s * 0.17,
    0,
    Math.PI * 2
);

ctx.fillStyle = windowGradient;
ctx.fill();

ctx.strokeStyle = "#ffffff";
ctx.lineWidth = s * 0.045;
ctx.stroke();


// =====================================================
// FENSTERKREUZ
// =====================================================

ctx.beginPath();

ctx.moveTo(
    x,
    y - s * 0.29
);

ctx.lineTo(
    x,
    y + s * 0.03
);

ctx.moveTo(
    x - s * 0.16,
    y - s * 0.13
);

ctx.lineTo(
    x + s * 0.16,
    y - s * 0.13
);

ctx.strokeStyle = "#b87500";
ctx.lineWidth = s * 0.025;
ctx.stroke();


// =====================================================
// TÜR
// =====================================================

ctx.beginPath();

ctx.moveTo(
    x - s * 0.19,
    y + s * 0.72
);

ctx.lineTo(
    x - s * 0.19,
    y + s * 0.38
);

ctx.quadraticCurveTo(
    x,
    y + s * 0.10,
    x + s * 0.19,
    y + s * 0.38
);

ctx.lineTo(
    x + s * 0.19,
    y + s * 0.72
);

ctx.closePath();


const door = ctx.createLinearGradient(
    x - s * 0.19,
    y,
    x + s * 0.19,
    y
);

door.addColorStop(0, "#64301e");
door.addColorStop(0.5, "#a85b32");
door.addColorStop(1, "#542718");

ctx.fillStyle = door;
ctx.fill();

ctx.strokeStyle = "#ffd84a";
ctx.lineWidth = s * 0.045;
ctx.stroke();


// =====================================================
// GOLDENER TÜRGRIFF
// =====================================================

ctx.beginPath();

ctx.arc(
    x + s * 0.08,
    y + s * 0.52,
    s * 0.035,
    0,
    Math.PI * 2
);

ctx.fillStyle = "#fff0a0";
ctx.fill();


// =====================================================
// KLEINE KRONE AUF DEM DACH
// =====================================================

const crownY = y - s * 0.78;
const crownWidth = s * 0.42;
const crownHeight = s * 0.25;

ctx.beginPath();

ctx.moveTo(
    x - crownWidth / 2,
    crownY + crownHeight
);

ctx.lineTo(
    x - crownWidth / 2,
    crownY + crownHeight * 0.40
);

ctx.lineTo(
    x - crownWidth * 0.25,
    crownY + crownHeight * 0.68
);

ctx.lineTo(
    x,
    crownY
);

ctx.lineTo(
    x + crownWidth * 0.25,
    crownY + crownHeight * 0.68
);

ctx.lineTo(
    x + crownWidth / 2,
    crownY + crownHeight * 0.40
);

ctx.lineTo(
    x + crownWidth / 2,
    crownY + crownHeight
);

ctx.closePath();

ctx.fillStyle = roof;
ctx.fill();

ctx.strokeStyle = "#9c6500";
ctx.lineWidth = s * 0.03;
ctx.stroke();


// =====================================================
// KRONEN-JUWELEN
// =====================================================

ctx.fillStyle = "#fff8c9";

for (const dx of [
    -crownWidth * 0.28,
    0,
    crownWidth * 0.28
]) {

    ctx.beginPath();

    ctx.arc(
        x + dx,
        crownY + crownHeight * 0.66,
        s * 0.022,
        0,
        Math.PI * 2
    );

    ctx.fill();
}


ctx.restore();        }
        else {

        ctx.beginPath();

        ctx.moveTo(
            p.x,
            p.y - settlementSize + offsetY
        );

        ctx.lineTo(
            p.x + settlementSize,
            p.y - settlementSize * 0.25 + offsetY
        );

        ctx.lineTo(
            p.x + settlementSize,
            p.y + settlementSize + offsetY
        );

        ctx.lineTo(
            p.x - settlementSize,
            p.y + settlementSize + offsetY
        );

        ctx.lineTo(
            p.x - settlementSize,
            p.y - settlementSize * 0.25 + offsetY
        );

        ctx.closePath();

        // Spielerfarbe
        ctx.fillStyle = colorCss(owner.color);
        ctx.fill();

        // weißer Rand
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = zoomedSize * 0.025;
        ctx.stroke();
    }
    }
}


// =============================================================
// BAUPLATZ FÜR SIEDLUNG
// =============================================================
else if (mode === "settlement") {

    const mep = (lastState.players || [])
        .find(p => p.name === me);

    if (mep && canBuildSettlement(v, b, lastState, mep)) {

        ctx.fillStyle = "#6ff";

        ctx.beginPath();

        ctx.arc(
            p.x,
            p.y,
            zoomedSize * 0.10,
            0,
            Math.PI * 2
        );

        ctx.fill();
    }
}


// =============================================================
// BAUPLATZ FÜR STADT
// =============================================================
if (mode === "city" && owner) {

    const mep = (lastState.players || [])
        .find(p => p.name === me);

    if (mep && canBuildCity(v, mep)) {

        ctx.fillStyle = "#6ff";

        ctx.beginPath();

        ctx.arc(
            p.x,
            p.y,
            zoomedSize * 0.10,
            0,
            Math.PI * 2
        );

        ctx.fill();
    }
}
}
}

$("board").addEventListener("wheel", (ev) => {
    ev.preventDefault();

    const rect = $("board").getBoundingClientRect();

    const mouseX = ev.clientX - rect.left;
    const mouseY = ev.clientY - rect.top;

    const oldZoom = boardZoom;

    if (ev.deltaY < 0) {
        boardZoom *= 1.02;
    } else {
        boardZoom /= 1.02;
    }

    boardZoom = Math.max(
        MIN_BOARD_ZOOM,
        Math.min(MAX_BOARD_ZOOM, boardZoom)
    );

    // Unter dem Mauszeiger zoomen
    const zoomFactor = boardZoom / oldZoom;

    boardOffsetX =
        mouseX - (mouseX - boardOffsetX) * zoomFactor;

    boardOffsetY =
        mouseY - (mouseY - boardOffsetY) * zoomFactor;

    drawBoard(lastState);
}, { passive: false });

$("board").addEventListener("mousedown", (ev) => {
    if (ev.button !== 0) return;

    isDraggingBoard = true;

    dragStartX = ev.clientX;
    dragStartY = ev.clientY;

    dragStartOffsetX = boardOffsetX;
    dragStartOffsetY = boardOffsetY;

    $("board").style.cursor = "grabbing";
});

window.addEventListener("mousemove", (ev) => {
    if (!isDraggingBoard) return;

    boardOffsetX =
        dragStartOffsetX + (ev.clientX - dragStartX);

    boardOffsetY =
        dragStartOffsetY + (ev.clientY - dragStartY);

    if (lastState) {
        drawBoard(lastState);
    }
});

window.addEventListener("mouseup", () => {
    isDraggingBoard = false;
    $("board").style.cursor = "grab";
});
$("board").style.cursor = "grab";
function poly(ctx, x, y, s) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + (i * Math.PI) / 3;
    const X = x + s * Math.cos(a),
      Y = y + s * Math.sin(a);
    i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
  }
  ctx.closePath();
}
function tileColor(r) {
  r = String(r || "").toUpperCase();
  return r.includes("HOLZ")
    ? "#4f9b51"
    : r.includes("LEHM")
      ? "#c66d4b"
      : r.includes("SCHAF")
        ? "#79bb5a"
        : r.includes("WEIZEN")
          ? "#dfbf55"
          : r.includes("ERZ")
            ? "#8e9294"
            : r.includes("WASSER")
              ? "#3186c7"
              : "#d8bd76";
}
function vertexPoint(v, b, pos) {
  if (v == null) return null;

  // Falls nur die ID des Vertex übergeben wurde:
  if (typeof v !== "object") {
    const vertices = b.vertices || [];
    const found = vertices.find((vertex) => vertex.id === v);
    if (!found) return null;
    v = found;
  }

  // Vertex enthält direkt q/r
  if (v.q != null && v.r != null) {
    return pos(+v.q, +v.r);
  }

  // Vertex wird über seine angrenzenden Tiles bestimmt
  const tiles = b.tiles || [];
  const tv = (v.adjacentTiles || [])
    .map((id) =>
      typeof id === "object"
        ? id
        : tiles.find((t) => t.id === id),
    )
    .filter(Boolean);

  if (!tv.length) return null;

  let x = 0;
  let y = 0;
  let n = 0;

  for (const t of tv) {
    if (t.q != null && t.r != null) {
      const p = pos(+t.q, +t.r);
      x += p.x;
      y += p.y;
      n++;
    }
  }

  return n ? { x: x / n, y: y / n } : null;
}
function vertexPos(ref, e, b, pos) {
  return vertexPoint(ref, b, pos);
}
function startAction(a) {
  if (!lastState) return;

  if (a === "roll_dice") {
    send("roll_dice", { playerName: me });
    return;
  }
  if (a === "buyDevelopmentCard") {
    send("buyDevelopmentCard", {
        playerName: me
    });
    return;
}

if (a === "endTurn") {
    mode = null;

    // eigenes Handelsfenster schließen
    $("tradeOffer").classList.add("hidden");

    // eigenes Handelsangebot schließen
    closeTradeBar();
    updatePrompt(lastState);

    send("endTurn", {
        playerName: me
    });

    return;
}
  
  mode =
    a === "buildSettlement"
      ? "settlement"
      : a === "buildRoad"
        ? "road"
        : a === "buildCity"
          ? "city"
          : null;

  updatePrompt(lastState);
  drawBoard(lastState);
}
function openTradeBar() {
    if (!lastState) return;

    tradeOpen = true;

    tradeOffer = {
        HOLZ: 0,
        LEHM: 0,
        SCHAF: 0,
        WEIZEN: 0,
        ERZ: 0
    };

    tradeRequest = {
        HOLZ: 0,
        LEHM: 0,
        SCHAF: 0,
        WEIZEN: 0,
        ERZ: 0
    };

    $("tradeBar").classList.remove("hidden");

    renderTradeBar();
}
function closeTradeBar() {
    tradeOpen = false;
    $("tradeBar").classList.add("hidden");

    tradeOffer = {
        HOLZ: 0,
        LEHM: 0,
        SCHAF: 0,
        WEIZEN: 0,
        ERZ: 0
    };

    tradeRequest = {
        HOLZ: 0,
        LEHM: 0,
        SCHAF: 0,
        WEIZEN: 0,
        ERZ: 0
    };
}
function renderTradeBar() {

    if (!tradeOpen) return;

    const give = Object.entries(tradeOffer)
        .filter(([_, amount]) => amount > 0)
        .map(([resource, amount]) =>
            resourceBox(resource, amount)
        )
        .join("");

    const get = Object.entries(tradeRequest)
        .filter(([_, amount]) => amount > 0)
        .map(([resource, amount]) =>
            resourceBox(resource, amount)
        )
        .join("");

    $("tradeGiveDisplay").innerHTML =
        give || '<span class="empty-trade">–</span>';

    $("tradeGetDisplay").innerHTML =
        get || '<span class="empty-trade">–</span>';

    // Rohstoffzahlen in den Auswahlreihen aktualisieren
    const mep = (lastState.players || [])
        .find((p) => p.name === me);

    if (!mep) return;

    document
        .querySelectorAll('.trade-resource[data-trade-side="offer"]')
        .forEach((box) => {

            const resource = box.dataset.resource;
            const amount = mep.resources?.[resource] || 0;

            box.innerHTML = `
                <div
                    class="resource-square"
                    style="background:${RESOURCE_COLORS[resource]}"
                >
                    ${amount}
                </div>
            `;
        });

    document
        .querySelectorAll('.trade-resource[data-trade-side="request"]')
        .forEach((box) => {

            const resource = box.dataset.resource;

            box.innerHTML = `
                <div
                    class="resource-square"
                    style="background:${RESOURCE_COLORS[resource]}"
                >
                </div>
            `;
        });
}
document.querySelectorAll(".trade-resource").forEach((box) => {

    box.addEventListener("click", () => {

        if (!tradeOpen || !lastState) return;

        const resource = box.dataset.resource;
        const side = box.dataset.tradeSide;

        const mep = (lastState.players || [])
            .find((p) => p.name === me);

        if (!mep) return;

        if (side === "offer") {

            const available = mep.resources?.[resource] || 0;

            // Nicht mehr anbieten können als man besitzt
            if (tradeOffer[resource] >= available) {
                return;
            }

            tradeOffer[resource]++;

        } else if (side === "request") {

            tradeRequest[resource]++;

        }

        renderTradeBar();
    });

});
$("tradePlayerBtn").onclick = () => {

    send("openPlayerTrade", {
        offer: tradeOffer,
        request: tradeRequest
    });

    closeTradeBar();
};
$("tradeBankBtn").onclick = () => {

    send("tradeWithBank", {
        offer: tradeOffer,
        request: tradeRequest
    });

    closeTradeBar();
};
function handleBoardClick(x, y, rect) {
    if (!lastState) return;

    const b = getBoard(lastState);
    const verts = b.vertices || [];
    const edges = b.edges || [];

    const s = lastState;
    const mep = (s.players || []).find(p => p.name === me);

    if (!mep) return;

    const myTurn = mep.id === s.currentPlayer;

    if (lastState.moveRobberMode && myTurn) {
        const tile = findTile(b.tiles || [], b, x, y, rect);

        if (tile) {
            send("moveRobber", {
                playerName: me,
                tileId: tile.id
            });
        }

        return;
    }

    if (lastState.stealMode) {
        const vertex = findVertex(verts, b, x, y, rect);

        if (!vertex) return;

        if (vertex.owner === null || vertex.owner === undefined) {
            return;
        }

        const victim = (lastState.players || [])
            .find(p => p.id === vertex.owner);

        if (!victim) return;
        if (victim.name === me) return;

        const resources = victim.resources || {};

        const totalResources = Object.values(resources)
            .reduce((sum, amount) => sum + (amount || 0), 0);

        if (totalResources <= 0) return;

        send("steal", {
            playerName: victim.name
        });

        return;
    }

    if (!mode) return;

    const p = findVertex(verts, b, x, y, rect);
    const e = findEdge(edges, b, x, y, rect);

    if (mode === "settlement" && p) {
        send("buildSettlement", {
            playerName: me,
            vertexId: p.id
        });

        mode = null;
    }

    if (mode === "city" && p) {
        send("buildCity", {
            playerName: me,
            vertexId: p.id
        });

        mode = null;
    }

    if (mode === "road" && e) {
        send("buildRoad", {
            playerName: me,
            edgeId: e.id
        });

        if (lastState.freeRoads > 0) {
            mode = "road";
        } else {
            mode = null;
        }
    }
}
$("board").addEventListener("click", (ev) => {
    const rect = $("board").getBoundingClientRect();

    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;

    handleBoardClick(x, y, rect);
});
function boardGeom(b, r) {
  const tiles = b.tiles || [];
  const radius = Math.max(
    3,
    ...tiles.map((t) =>
      Math.max(
        Math.abs(+t.q || 0),
        Math.abs(+t.r || 0),
        Math.abs(-(+t.q || 0) - (+t.r || 0)),
      ),
    ),
  );
const baseSize = IS_IPHONE
    ? DESKTOP_BOARD_SIZE
    : Math.min(
        r.width / (radius * 3.1 + 2),
        r.height / (radius * 2.8 + 2),
        70
      );

  const size = baseSize * boardZoom;
  const pos = (q, rr) => ({
      x: r.width * 0.5 +
        boardOffsetX +
        size * (
            Math.sqrt(3) * q +
            (Math.sqrt(3) / 2) * rr
        ),

      y: r.height * 0.5 +
        boardOffsetY +
        size * 1.5 * rr
  });
  return { radius, size, pos };
}
function findVertex(vs, b, x, y, r) {
  const { pos } = boardGeom(b, r);
  let best = null,
    bd = 20;
  for (const v of vs) {
    const p = vertexPoint(v, b, pos);
    if (!p) continue;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < bd) {
      bd = d;
      best = v;
    }
  }
  return best;
}
function findEdge(es, b, x, y, r) {
  const { pos } = boardGeom(b, r);
  let best = null,
    bd = 25;
  for (const e of es) {
    const a = vertexPoint(e.vertex1, b, pos),
      z = vertexPoint(e.vertex2, b, pos);
    console.log("EDGE:", e);
    console.log("A:", a, "Z:", z);
    if (!a || !z) continue;
    const d = segDist(x, y, a.x, a.y, z.x, z.y);
    if (d < bd) {
      bd = d;
      best = e;
    }
  }
  return best;
}
function segDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1,
    dy = y2 - y1,
    t = Math.max(
      0,
      Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)),
    );
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}
function findTile(ts, b, x, y, r) {
  const { size, pos } = boardGeom(b, r);
  return ts.find((t) => {
    const p = pos(+t.q, +t.r);
    return Math.hypot(x - p.x, y - p.y) < size;
  });
}
function updatePrompt(s) {
  let t = "";
  const mep = (s.players || []).find(p => p.name === me);

  if (!mep) return;

  const myTurn = mep.id === s.currentPlayer;
  if (s.moveRobberMode && myTurn) {
    t = "Klicke auf ein Feld, um den Räuber zu bewegen";
}
else if (s.stealMode && myTurn) {
    t = "Klicke auf eine gegnerische Siedlung, um zu stehlen";
}
else if (s.discardResourcesMode && mep.hasToDiscard > 0) {
    t = "Du musst Ressourcen abwerfen";
}
else if (s.buildPhase) {
    const raised =
        s.raisedHands?.[String(player_index)] === true;

    if (raised) {
        t = "Du bist in der Baurunde – du kannst bauen";
    } else {
        t = "";
    }
}
  else if (mode)
    t =
      mode === "settlement"
        ? "Siedlungsplatz wählen"
        : mode === "road"
          ? "Straße wählen"
          : "Stadt wählen";
  $("prompt").textContent = t;
  $("prompt").classList.toggle("hidden", !t);
}
function log(x) {
  $("log").innerHTML = `<div>${esc(x)}</div>` + $("log").innerHTML;
}
function bankTrade() {
  openModal(
    "Handel mit der Bank",
    `<p>Wähle Ressource zum Abgeben und Erhalten.</p><div class="choice-grid">${RES.map((a) => `<div class="choice" onclick="bankGive('${a}')">${a}</div>`).join("")}</div>`,
  );
}
function bankGive(g) {
  openModal(
    "Du gibst " + g,
    '<div class="choice-grid">' +
      RES.filter((x) => x !== g)
        .map(
          (x) =>
            `<div class="choice" onclick="send('tradeWithBank',{playerName:me,trade_offer:Object.fromEntries(RES.map(r=>[r,r===\'${g}\'?4:0])),trade_request:Object.fromEntries(RES.map(r=>[r,r===\'${x}\'?1:0]))});closeModal()">${x}</div>`,
        )
        .join("") +
      "</div>",
  );
}
function playerTrade() {
  const ps = (lastState.players || []).filter((p) => p.name !== me);
  openModal(
    "Spielerhandel",
    ps.length
      ? ps
          .map(
            (p) =>
              `<button onclick="openOffer('${esc(p.name)}')">${esc(p.name)}</button>`,
          )
          .join(" ")
      : "Keine anderen Spieler",
  );
}
function openOffer(name) {
  openModal(
    "Angebot an " + name,
    '<p>Die detaillierte Handelsauswahl kannst du hier erweitern; dein Python-Server bleibt für die Prüfung zuständig.</p><button onclick="closeModal()">Schließen</button>',
  );
}
function openModal(title, body) {
  $("modalTitle").textContent = title;
  $("modalBody").innerHTML = body;
  $("modal").classList.remove("hidden");
}
function closeModal() {
  $("modal").classList.add("hidden");
}
function getPlayerById(id) {
  if (id === null || id === undefined) return null;
  return (lastState?.players || []).find(p => p.id === id) || null;
}
function playDevelopmentCard(type) {
    const mep = (lastState.players || [])
        .find((p) => p.name === me);

    if (!mep) return;

    const amount = mep.developmentCards?.[type] || 0;

    // Keine Karte vorhanden
    if (amount <= 0) {
        return;
    }

    // ==========================================
    // RITTER
    // ==========================================

    if (type === "RITTER") {
        send("playDevelopmentCard", {
            card: "RITTER",
            res1: null,
            res2: null
        });

        return;
    }

    // ==========================================
    // SIEGPUNKT
    // ==========================================

    if (type === "1SIEGPUNKT") {
        return;
    }

    // ==========================================
    // MONOPOL
    // ==========================================

    if (type === "MONOPOL") {
        openDevelopmentResourceModal(
            "MONOPOL",
            "Wähle eine Ressource für dein Monopol",
            (resource) => {
                send("playDevelopmentCard", {
                    card:"MONOPOL",
                    res1: resource,
                    res2: null
                });
            }
        );

        return;
    }

    // ==========================================
    // ERFINDUNG
    // ==========================================

    if (type === "ERFINDUNG") {
        openInventionModal();
        return;
    }

    // ==========================================
    // STRAßENBAU
    // ==========================================

    if (type === "STRAßENBAU") {
    send("playDevelopmentCard", {
        card: "STRAßENBAU",
        res1: null,
        res2: null
    });

    mode = "road";

    updatePrompt(lastState);

    return;
}
}
function openDevelopmentResourceModal(title, text, callback) {
    const resources = [
        "HOLZ",
        "LEHM",
        "SCHAF",
        "WEIZEN",
        "ERZ"
    ];

    openModal(
        title,
        `
            <p>${text}</p>

            <div class="dev-resource-grid">
                ${resources.map(resource => `
<button
    class="dev-resource-button"
    data-resource="${resource}"
    style="background:${RESOURCE_COLORS[resource] || "#888"}"
    title="${resource}"
    aria-label="${resource}"
>
</button>
                `).join("")}
            </div>
        `
    );

    $("modalBody")
        .querySelectorAll(".dev-resource-button")
        .forEach((button) => {
            button.addEventListener("click", () => {
                const resource = button.dataset.resource;

                closeModal();

                callback(resource);
            });
        });
}
function openInventionModal() {
    const resources = [
        "HOLZ",
        "LEHM",
        "SCHAF",
        "WEIZEN",
        "ERZ"
    ];

    let firstResource = null;

    openModal(
        "ERFINDUNG",
        `
            <p id="inventionText">
                Wähle die erste Ressource.
            </p>

            <div class="dev-resource-grid">
                ${resources.map(resource => `
<button
    class="dev-resource-button"
    data-resource="${resource}"
    style="background:${RESOURCE_COLORS[resource] || "#888"}"
    title="${resource}"
    aria-label="${resource}"
>
</button>
                `).join("")}
            </div>
        `
    );

    $("modalBody")
        .querySelectorAll(".dev-resource-button")
        .forEach((button) => {

            button.addEventListener("click", () => {

                const resource = button.dataset.resource;

                if (firstResource === null) {

                    firstResource = resource;

                    $("inventionText").textContent =
                        `Erste Ressource: ${resource} – wähle die zweite Ressource.`;

                    return;
                }

                const secondResource = resource;

                closeModal();

                send("playDevelopmentCard", {
                    card: "ERFINDUNG",
                    res1: firstResource,
                    res2: secondResource
                });
            });
        });
}
function mustFinishAction(s) {
    if (!s) return false;

    // Nach einer 7 müssen alle Ressourcen abgegeben werden
    if (s.discardResourcesMode) {
        return true;
    }

    // Räuber muss bewegt werden
    if (s.moveRobberMode) {
        return true;
    }

    // Ein Opfer für den Räuber muss ausgewählt werden
    if (s.stealMode) {
        return true;
    }

    // Straßenbau-Karte: alle kostenlosen Straßen müssen gebaut werden
    if ((s.freeRoads || 0) > 0) {
        return true;
    }

    if (s.setupPhase){
        // Setup: notwendige Siedlung/Straße
      if (s.setUpSettlement || s.setUpRoad) {
          return true;
      } 
    }

    if (s.würfelMode) {
      return true;
    }

    return false;
}
function updateActionButtons(s) {
    if (isSpectator) {
        document.querySelectorAll(
            '[data-action], #buildRoundBtn, #tradeButton, #acceptTradeBtn, #declineTradeBtn'
        ).forEach(button => {
            button.disabled = true;
        });

        return;
    }
    const mep = (s.players || []).find(p => p.name === me);



    if (!mep) return;

    const myTurn = mep.id === s.currentPlayer;
    const inSetup = s.setupPhase === true;

    const buildRoundButton = $("buildRoundBtn");

    
    let goldChoices = false;
    for (player of s.players){
        if (player.goldChoices > 0){
            goldChoices = true;
        }
    }
    

if (buildRoundButton) {
    if (s.players.length> 4){
        buildRoundButton.style.display = "";
    }
    else{
        buildRoundButton.style.display = "none";
    }
    if (s.buildPhase) {
        // Wir sind gerade in der Sonderbauphase

        const raised =
            s.raisedHands?.[String(player_index)] === true;

        buildRoundButton.textContent = "Fertig";

        // Nur Spieler, die Baurunde gewählt haben,
        // dürfen FERTIG drücken.
        buildRoundButton.disabled = !raised || inSetup || goldChoices || s.würfelMode || isSpectator

    } else {
        // Normale Spielphase
        const raised =
            s.raisedHands?.[String(player_index)] === true;

        buildRoundButton.textContent = "Baurunde";
        buildRoundButton.disabled = raised || inSetup || goldChoices || s.würfelMode || isSpectator;
    }
}

    const buttons = {
        roll_dice: document.querySelector('[data-action="roll_dice"]'),
        buildSettlement: document.querySelector('[data-action="buildSettlement"]'),
        buildRoad: document.querySelector('[data-action="buildRoad"]'),
        buildCity: document.querySelector('[data-action="buildCity"]'),
        buyDevelopmentCard: document.querySelector('[data-action="buyDevelopmentCard"]'),
        endTurn: document.querySelector('[data-action="endTurn"]')
    };

    const resources = mep.resources || {};

    const discarding = s.discardResourcesMode === true;
    const mustRoll = s.würfelMode === true;
    const hasSettlementResources =
        (resources.HOLZ || 0) >= 1 &&
        (resources.LEHM || 0) >= 1 &&
        (resources.SCHAF || 0) >= 1 &&
        (resources.WEIZEN || 0) >= 1;

    const hasRoadResources =
        (resources.HOLZ || 0) >= 1 &&
        (resources.LEHM || 0) >= 1;

    const hasCityResources =
        (resources.WEIZEN || 0) >= 2 &&
        (resources.ERZ || 0) >= 3;

    const hasDevelopmentResources =
        (resources.SCHAF || 0) >= 1 &&
        (resources.WEIZEN || 0) >= 1 &&
        (resources.ERZ || 0) >= 1;

    const raised =
    s.raisedHands?.[String(player_index)] === true;
    const darfBauenBaurunde = raised && s.buildPhase;

    // Würfeln nur wenn man selbst dran ist
    if (buttons.roll_dice) {
        buttons.roll_dice.disabled = 
            (!myTurn || !s.würfelMode || goldChoices||s.stealMode || s.moveRobberMode);
    }


    // SETTLEMENT
    // In der Setup-Phase kostenlos
    if (buttons.buildSettlement) {
        buttons.buildSettlement.disabled =
            ((!(darfBauenBaurunde && !inSetup) || !hasSettlementResources)&&
            (!myTurn || discarding|| mustRoll || 
            (!(inSetup &&s.setUpSettlement) && !hasSettlementResources)))|| goldChoices || s.moveRobberMode ||s.stealMode;
    }


    // ROAD
    // In der Setup-Phase kostenlos
    if (buttons.buildRoad) {
        const canBuildFreeRoad =
            myTurn &&
            (
                (inSetup && s.setUpRoad) ||
                (s.freeRoads || 0) > 0
            );

        buttons.buildRoad.disabled =
            ((!(darfBauenBaurunde && !inSetup) || !hasRoadResources) &&
            (!myTurn || discarding|| mustRoll||
            (!hasRoadResources && !canBuildFreeRoad)))|| goldChoices|| s.moveRobberMode||s.stealMode;
    }


    // CITY gibt es in der Setup-Phase nicht
    if (buttons.buildCity) {
        buttons.buildCity.disabled =
            ((!(darfBauenBaurunde && !inSetup)|| !hasCityResources) &&
            (!myTurn ||
            inSetup || discarding|| mustRoll ||
            !hasCityResources))|| goldChoices|| s.moveRobberMode||s.stealMode;
    }


    // Entwicklungskarte gibt es in der Setup-Phase nicht
    if (buttons.buyDevelopmentCard) {
        buttons.buyDevelopmentCard.disabled =
            ((!(darfBauenBaurunde && !inSetup) || !hasDevelopmentResources) &&
            (!myTurn ||
            inSetup || discarding|| mustRoll||
            !hasDevelopmentResources))|| goldChoices|| s.moveRobberMode||s.stealMode;
    }

   const tradeButton = document.getElementById("tradeButton");

if (tradeButton) {
    tradeButton.disabled = !myTurn || mustFinishAction(s)|| goldChoices|| s.moveRobberMode || s.buildPhase||s.stealMode;
} 

    // Zug beenden
    if (buttons.endTurn) {
        buttons.endTurn.disabled =
            !myTurn || discarding|| s.buildPhase||
            mustFinishAction(s)|| goldChoices || s.moveRobberMode||s.stealMode;
    }
}
function checkVictory(s) {
    const winner = (s.players || []).find(
        p => (p.victoryPoints || 0) >= 10
    );

    const overlay = $("victoryOverlay");
    const text = $("victoryText");

    if (!overlay || !text) return;

    if (winner) {
        text.textContent = `${winner.name} hat gewonnen!`;
        overlay.classList.remove("hidden");
    } else {
        overlay.classList.add("hidden");
    }
}
// ======================================================
// TOUCH: HANDY
// ======================================================

$("board").addEventListener("touchstart", (ev) => {
    if (!lastState) return;

    ev.preventDefault();

    const rect = $("board").getBoundingClientRect();

    // ==========================================
    // 1 FINGER
    // ==========================================

    if (ev.touches.length === 1) {

        const touch = ev.touches[0];

        isDraggingBoard = true;
        touchMoved = false;

        dragStartX = touch.clientX;
        dragStartY = touch.clientY;

        touchStartX = touch.clientX;
        touchStartY = touch.clientY;

        dragStartOffsetX = boardOffsetX;
        dragStartOffsetY = boardOffsetY;

        return;
    }

    // ==========================================
    // 2 FINGER -> ZOOM
    // ==========================================

    if (ev.touches.length === 2) {

        isDraggingBoard = false;
        touchMoved = true;

        const t1 = ev.touches[0];
        const t2 = ev.touches[1];

        touchStartDistance = Math.hypot(
            t2.clientX - t1.clientX,
            t2.clientY - t1.clientY
        );

        touchStartZoom = boardZoom;

        touchStartOffsetX = boardOffsetX;
        touchStartOffsetY = boardOffsetY;

        touchStartCenterX =
            ((t1.clientX + t2.clientX) / 2) - rect.left;

        touchStartCenterY =
            ((t1.clientY + t2.clientY) / 2) - rect.top;
    }

}, { passive: false });


$("board").addEventListener("touchmove", (ev) => {
    if (!lastState) return;

    ev.preventDefault();

    const rect = $("board").getBoundingClientRect();

    // ==========================================
    // 1 FINGER -> VERSCHIEBEN
    // ==========================================

    if (ev.touches.length === 1 && isDraggingBoard) {

        const touch = ev.touches[0];

        const dx = touch.clientX - touchStartX;
        const dy = touch.clientY - touchStartY;

        // Erst ab 8 Pixel gilt es als Bewegung
        if (Math.hypot(dx, dy) > 8) {
            touchMoved = true;
        }

        if (!touchMoved) return;

        boardOffsetX =
            dragStartOffsetX +
            dx;

        boardOffsetY =
            dragStartOffsetY +
            dy;

        drawBoard(lastState);

        return;
    }

    // ==========================================
    // 2 FINGER -> ZOOM
    // ==========================================

    if (ev.touches.length === 2) {

        const t1 = ev.touches[0];
        const t2 = ev.touches[1];

        const distance = Math.hypot(
            t2.clientX - t1.clientX,
            t2.clientY - t1.clientY
        );

        if (touchStartDistance <= 0) return;

        const zoomFactor =
            distance / touchStartDistance;

        const oldZoom = boardZoom;

        boardZoom =
            touchStartZoom * zoomFactor;

        boardZoom = Math.max(
            MIN_BOARD_ZOOM,
            Math.min(MAX_BOARD_ZOOM, boardZoom)
        );

        const centerX =
            ((t1.clientX + t2.clientX) / 2) - rect.left;

        const centerY =
            ((t1.clientY + t2.clientY) / 2) - rect.top;

        const actualZoomFactor =
            boardZoom / oldZoom;

        boardOffsetX =
            centerX -
            (centerX - touchStartOffsetX) *
            actualZoomFactor;

        boardOffsetY =
            centerY -
            (centerY - touchStartOffsetY) *
            actualZoomFactor;

        drawBoard(lastState);
    }

}, { passive: false });


$("board").addEventListener("touchend", (ev) => {

    // ==========================================
    // 1-FINGER-TAP
    // ==========================================

    if (
        ev.touches.length === 0 &&
        !touchMoved
    ) {

        const touch = ev.changedTouches[0];

        const rect = $("board").getBoundingClientRect();

        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;

        handleBoardClick(x, y, rect);
    }

    isDraggingBoard = false;

    if (ev.touches.length < 2) {
        touchStartDistance = 0;
    }

}, { passive: false });


$("board").addEventListener("touchcancel", () => {

    isDraggingBoard = false;
    touchMoved = false;
    touchStartDistance = 0;

}, { passive: false });

// =========================================================
// HÄFEN
// =========================================================

function getHarborSymbol(resource) {
    switch (resource) {
        case "HOLZ":
            return "🌲";
        case "LEHM":
            return "🧱";
        case "SCHAF":
            return "🐑";
        case "WEIZEN":
            return "🌾";
        case "ERZ":
            return "⛏";
        default:
            return "★";
    }
}


function drawHarbor(ctx, harbor, p1, p2, boardCenter, size) {

    // Mittelpunkt der Küstenkante
    const mx = (p1.x + p2.x) / 2;
    const my = (p1.y + p2.y) / 2;

    // Richtung der Küstenkante
    const edgeX = p2.x - p1.x;
    const edgeY = p2.y - p1.y;
    const edgeLength = Math.hypot(edgeX, edgeY);

    if (edgeLength === 0) return;

    // Normale zur Küstenkante
    let nx = -edgeY / edgeLength;
    let ny = edgeX / edgeLength;

    // Richtige Außenseite bestimmen
// Normale immer nach innen ins Hexfeld richten
const inwardX = boardCenter.x - mx;
const inwardY = boardCenter.y - my;

if (nx * inwardX + ny * inwardY < 0) {
    nx = -nx;
    ny = -ny;
}

    // ------------------------------------------------
    // GEOMETRIE
    // ------------------------------------------------

    // Spitze des Hafens
    const dockLength = size * 1.05;

    const tipX = mx + nx * dockLength;
    const tipY = my + ny * dockLength;

    // Winkel der Küstenkante
    const edgeAngle = Math.atan2(edgeY, edgeX);

    // ------------------------------------------------
    // GESTRICHELTE HAFENLINIEN
    // ------------------------------------------------

    ctx.save();

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = Math.max(3, size * 0.05);
    ctx.setLineDash([
        size * 0.13,
        size * 0.11
    ]);
    ctx.lineCap = "butt";

    const curve = size * 0.22;

    // linke Linie
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);

    ctx.quadraticCurveTo(
        p1.x + nx * curve,
        p1.y + ny * curve,
        tipX,
        tipY
    );

    ctx.stroke();

    // rechte Linie
    ctx.beginPath();
    ctx.moveTo(p2.x, p2.y);

    ctx.quadraticCurveTo(
        p2.x + nx * curve,
        p2.y + ny * curve,
        tipX,
        tipY
    );

    ctx.stroke();

    ctx.restore();


// ------------------------------------------------
// HAFEN-KREIS
// Ressource = farbiger Kreis
// 3:1 = weißer Kreis mit schwarzem ?
// ------------------------------------------------

const circleRadius = size * 0.20;

ctx.save();

ctx.beginPath();
ctx.arc(
    tipX,
    tipY,
    circleRadius,
    0,
    Math.PI * 2
);

// 3:1 Hafen -> weißer Kreis
// Ressourcenhafen -> Ressourcenfarbe
if (harbor.resource) {
    ctx.fillStyle =
        RESOURCE_COLORS[harbor.resource] || "#888";
} else {
    ctx.fillStyle = "#ffffff";
}

ctx.fill();

// weiße Umrandung
ctx.strokeStyle = "#ffffff";
ctx.lineWidth = Math.max(2, size * 0.045);
ctx.stroke();

ctx.restore();


// ------------------------------------------------
// FRAGEZEICHEN BEIM 3:1-HAFEN
// ------------------------------------------------

if (!harbor.resource) {

    ctx.save();

    // Mittelpunkt des Kreises
    ctx.translate(tipX, tipY);

    // gleiche Ausrichtung wie der Hafen
    ctx.rotate(edgeAngle);

    // falls der Hafen um 180° gedreht wird:
    ctx.rotate(Math.PI);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.fillStyle = "#222";
    ctx.font = `bold ${size * 0.32}px Georgia`;
    ctx.fillText(
        "?",
        0,
        0
    );

    ctx.restore();
}


    // ------------------------------------------------
    // 3:1
    // ZWISCHEN DEN BEIDEN LINIEN
    // UND PARALLEL ZUR KÜSTENKANTE
    // ------------------------------------------------

    const ratioDistance = size * 0.62;

    const ratioX = mx + nx * ratioDistance;
    const ratioY = my + ny * ratioDistance;

    ctx.save();

    ctx.translate(ratioX, ratioY);

    // Parallel zur Küstenkante
    ctx.rotate(edgeAngle);
    ctx.rotate(Math.PI);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${size * 0.39}px Georgia`;

    ctx.fillText(
        `${harbor.ratio}:1`,
        0,
        size*0.4
    );

    ctx.restore();
}
// =========================================================
// ALLE HÄFEN ZEICHNEN
// Funktioniert auch ohne Tiles und Vertices
// =========================================================
// =========================================================
// ALLE HÄFEN ZEICHNEN
// =========================================================
function drawHarbors(ctx, boardState, pos, size, boardCenter) {
    if (!boardState || !Array.isArray(boardState.harbors)) {
        console.error("Keine Häfen gefunden!", boardState);
        return;
    }

    // Ecken entsprechend deiner Hexagon-Zeichnung:
    // 0 = rechts oben, 1 = rechts unten,
    // 2 = unten, 3 = links unten,
    // 4 = links oben, 5 = oben
    //
    // Tatsächliche Winkel: -30°, 30°, 90°, 150°, 210°, 270°
    // Kanten werden gegen den Uhrzeigersinn durchlaufen.
    const directionCorners = {
        1: [5, 0], // oben rechts
        2: [4, 5], // oben links
        3: [3, 4], // links
        4: [2, 3], // unten links
        5: [1, 2], // unten rechts
        6: [0, 1]  // rechts
    };

    for (const harbor of boardState.harbors) {
        const q = Number(harbor.q);
        const r = Number(harbor.r);
        const direction = Number(harbor.direction);

        if (
            !Number.isFinite(q) ||
            !Number.isFinite(r) ||
            !directionCorners[direction]
        ) {
            console.warn("Ungültiger Hafen:", harbor);
            continue;
        }

        const center = pos(q, r);

        const corners = Array.from({ length: 6 }, (_, i) => {
            const angle = (60 * i - 30) * Math.PI / 180;

            return {
                x: center.x + size * Math.cos(angle),
                y: center.y + size * Math.sin(angle)
            };
        });

        const [i1, i2] = directionCorners[direction];

        drawHarbor(
            ctx,
            harbor,
            corners[i1],
            corners[i2],
            center, // Mittelpunkt des zugehörigen Hexfeldes
            size
        );
    }
}

$("buildRoundBtn").onclick = () => {
    if (!lastState) return;

    // Außerhalb der Sonderbauphase:
    // für die nächste Sonderbauphase anmelden
    if (!lastState.buildPhase) {
        send("raiseHand", {
            playerName: me,
            value: true
        });
        return;
    }

    // Während der Sonderbauphase:
    // nur fertig melden, wenn man vorher Baurunde gewählt hat
    const raised = lastState.raisedHands?.[String(player_index)] === true;

    if (raised) {
        send("finishBuild", {
            playerName: me
        });
    }
};
function prepareRobberImage() {
    const outline = 11;

    ROBBER_CANVAS.width = ROBBER_IMAGE.naturalWidth + outline * 4;
    ROBBER_CANVAS.height = ROBBER_IMAGE.naturalHeight + outline * 4;

    ROBBER_CTX.clearRect(
        0,
        0,
        ROBBER_CANVAS.width,
        ROBBER_CANVAS.height
    );

    ROBBER_CTX.save();

    ROBBER_CTX.filter = `
        drop-shadow(${outline}px 0 0 white)
        drop-shadow(-${outline}px 0 0 white)
        drop-shadow(0 ${outline}px 0 white)
        drop-shadow(0 -${outline}px 0 white)
        drop-shadow(${outline}px ${outline}px 0 white)
        drop-shadow(-${outline}px ${outline}px 0 white)
        drop-shadow(${outline}px -${outline}px 0 white)
        drop-shadow(-${outline}px -${outline}px 0 white)
    `;

    ROBBER_CTX.drawImage(
        ROBBER_IMAGE,
        outline,
        outline
    );

    ROBBER_CTX.restore();
}

function openGoldResourceModal() {
    const modal = document.getElementById("goldResourceModal");
    const options = document.getElementById("goldResourceOptions");

    const resources = ["HOLZ", "LEHM", "SCHAF", "WEIZEN", "ERZ"];

    options.innerHTML = resources.map(resource => `
        <div
            class="resource-box gold-choice"
            style="background:${RESOURCE_COLORS[resource] || "#888"}"
            title="${resource}"
            onclick="chooseGoldResource('${resource}')"
        ></div>
    `).join("");

    modal.classList.remove("hidden");
}


function closeGoldResourceModal() {
    document
        .getElementById("goldResourceModal")
        .classList.add("hidden");
}

function chooseGoldResource(resource) {
    send("chooseGoldResource", {
        playerName: me,
        resource: resource
    });

    closeGoldResourceModal();
}



/* ========================================
   CHAT
   ======================================== */

let lastRenderedChat = "";

function sendChatMessage() {
    const input = $("chatInput");
    const message = input.value.trim();

    if (!message) return;

    // Ohne Verbindung nicht senden
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        return;
    }

    // Nachricht an den Python-Server schicken
    send("chat_message", {
        playerName: me,
        message: message
    });

    input.value = "";
    input.focus();
}

// Absenden-Button und Enter-Taste
$("chatForm").addEventListener("submit", (event) => {
    event.preventDefault();
    sendChatMessage();
});

function renderChatHistory(messages) {
    const container = $("chatMessages");

    if (!container || !Array.isArray(messages)) return;

    // Nicht bei jedem State den gesamten Chat neu zeichnen
    const signature = JSON.stringify(messages);

    if (signature === lastRenderedChat) return;

    // War der Spieler bereits am Ende des Chats?
    const wasAtBottom =
        container.scrollHeight -
        container.scrollTop -
        container.clientHeight < 40;

    lastRenderedChat = signature;

    // Sicher aufbauen, kein HTML aus Chatnachrichten ausführen
    const fragment = document.createDocumentFragment();

    for (const message of messages) {
        const entry = document.createElement("div");
        entry.className = "chat-message";

        const name = document.createElement("span");
        name.className = "chat-message-name";
        name.textContent = message.player || "Unbekannt";

        const text = document.createElement("div");
        text.className = "chat-message-text";
        text.textContent = message.message || "";

        entry.append(name, text);
        fragment.appendChild(entry);
    }

    container.replaceChildren(fragment);

    // Nur automatisch nach unten scrollen,
    // wenn man vorher schon am Ende war.
    if (wasAtBottom) {
        container.scrollTop = container.scrollHeight;
    }
}



function renderDiceStatistics(dices) {
    const chart = document.getElementById("diceChart");
    if (!chart) return;

    // Immer von 2 bis 12 sortieren
    const values = Array.from({ length: 11 }, (_, i) => i + 2);

    // Fehlende Werte als 0 behandeln
    const counts = values.map(number =>
        Number(dices?.[number] ?? dices?.[String(number)] ?? 0)
    );

    const maxCount = Math.max(0, ...counts);

    chart.replaceChildren();

    values.forEach((number, index) => {
        const count = counts[index];
        const percentage = maxCount > 0
            ? (count / maxCount) * 100
            : 0;

        const row = document.createElement("div");
        row.className = "dice-row";

        const label = document.createElement("div");
        label.className = "dice-number";
        label.textContent = number;

        const container = document.createElement("div");
        container.className = "dice-bar-container";

        const bar = document.createElement("div");
        bar.className = "dice-bar" + (count === 0 ? " empty" : "");
        bar.style.width = percentage + "%";

        bar.style.display = count === 0 ? "none" : "flex";
        // Anzahl steht innerhalb des Balkens
        if (count > 0) {
            bar.textContent = count;
        }

        container.appendChild(bar);
        row.append(label, container);
        chart.appendChild(row);
    });
}



async function enterFullscreen() {
    const element = document.documentElement;

    try {
        if (element.requestFullscreen) {
            await element.requestFullscreen();
        } else if (element.webkitRequestFullscreen) {
            // Ältere Safari-Versionen
            element.webkitRequestFullscreen();
        } else {
            // Beispielsweise iPhone-Safari:
            // Vollbild ist hier nicht per JS verfügbar.
            alert(
                "Bitte öffne das Spiel über 'Zum Home-Bildschirm hinzufügen', " +
                "um es möglichst im Vollbild zu spielen."
            );
        }
    } catch (error) {
        console.log("Vollbild konnte nicht aktiviert werden:", error);
    }
}


function createDiceOverlay() {
    const board = $("board");
    if (!board) return;

    const parent = board.parentElement;
    if (!parent) return;

    let overlay = $("diceOverlay");

    // Overlay nur erstellen, falls es noch nicht existiert
    if (!overlay) {
        if (getComputedStyle(parent).position === "static") {
            parent.style.position = "relative";
        }

        overlay = document.createElement("div");
        overlay.id = "diceOverlay";
        overlay.className = "dice-overlay";
        overlay.innerHTML = `
            <div class="die" id="die1"></div>
            <div class="die" id="die2"></div>
        `;

        parent.appendChild(overlay);
    }

    // Wichtig: Auch bei einem bereits vorhandenen Overlay aufrufen!
    setupDiceClick();
}

function renderDie(element, value) {
    if (!element) return;

    // Positionen der Augen im 3x3-Raster
    const patterns = {
        1: [5],
        2: [1, 9],
        3: [1, 5, 9],
        4: [1, 3, 7, 9],
        5: [1, 3, 5, 7, 9],
        6: [1, 3, 4, 6, 7, 9]
    };

    const number = Number(value);
    const pips = patterns[number] || [];

    element.innerHTML = Array.from(
        { length: 9 },
        (_, i) => `
            <span class="pip ${
                pips.includes(i + 1) ? "visible" : ""
            }"></span>
        `
    ).join("");
}

function updateDice(s) {
    createDiceOverlay();

    const overlay = $("diceOverlay");
    if (!overlay) return;

    const mep = (s.players || []).find(p => p.name === me);

    // Nur während des eigenen Würfel-Schritts animieren
    const myTurn = !!mep && mep.id === s.currentPlayer;
    const myRoll = myTurn && s.würfelMode === true;

    overlay.classList.toggle("my-roll", myRoll);

    renderDie($("die1"), s.dice1);
    renderDie($("die2"), s.dice2);
}

function setupDiceClick() {
    const overlay = $("diceOverlay");
    if (!overlay || overlay.dataset.clickReady) return;

    overlay.dataset.clickReady = "true";
    overlay.style.pointerEvents = "auto";
    overlay.style.cursor = "pointer";

    overlay.addEventListener("click", () => {
            console.log("WÜRFEL ANGEKLICKT");
    console.log("Spielzustand:", lastState);
        if (!lastState) return;

        const mep = (lastState.players || [])
            .find(p => p.name === me);

        if (!mep || mep.id !== lastState.currentPlayer) return;
        if (lastState.würfelMode !== true) return;

        const rollButton = document.querySelector(
            '[data-action="roll_dice"]'
        );

        if (rollButton) {
            rollButton.click();
        } else {
            console.error("Würfel-Button nicht gefunden!");
        }
    });
}




// MAPBUILDER


/* =========================================================
   MAP BUILDER
   Lokaler Editor – keine Servernachrichten beim Bearbeiten
   ========================================================= */

const mapBuilder = {
    active: false,
    tiles: new Map(),
    canvas: null,
    ctx: null,
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
    dragging: false,
    dragX: 0,
    dragY: 0,
    startOffsetX: 0,
    startOffsetY: 0,
    selectedResource: "HOLZ",
    harbors: new Map(),
    harborMode: false,
    touchCenter: null,
    pinching: false,
suppressNextTap: false,
touchStartDistance: 0,
touchStartZoom: 1,
touchStartOffsetX: 0,
touchStartOffsetY: 0,
};

const MAP_BUILDER_STORAGE_KEY = "catanMapBuilder";

function saveMapBuilder() {
        const data = {
            active: mapBuilder.active,

            harbors: Array.from(mapBuilder.harbors.entries()),
            harborMode: mapBuilder.harborMode,

            // Alle bearbeiteten Felder speichern
            tiles: Array.from(mapBuilder.tiles.entries()),
            selectedResource: mapBuilder.selectedResource,
            mapName: document.getElementById("mapName")?.value ?? "",

            // Ansicht speichern
            zoom: mapBuilder.zoom,
            offsetX: mapBuilder.offsetX,
            offsetY: mapBuilder.offsetY
        };

    localStorage.setItem(
        MAP_BUILDER_STORAGE_KEY,
        JSON.stringify(data)
    );
}

function loadMapBuilder() {
    const saved = localStorage.getItem(
        MAP_BUILDER_STORAGE_KEY
    );

    if (!saved) return false;

    try {
        const data = JSON.parse(saved);

        mapBuilder.active = data.active ?? false;
        mapBuilder.tiles = new Map(data.tiles ?? []);

        mapBuilder.zoom = data.zoom ?? 1;
        mapBuilder.offsetX = data.offsetX ?? 0;
        mapBuilder.offsetY = data.offsetY ?? 0;
        mapBuilder.savedMapName = data.mapName ?? "";
        mapBuilder.selectedResource = data.selectedResource ?? "HOLZ";
        mapBuilder.harbors = new Map(data.harbors ?? []);
        mapBuilder.harborMode = data.harborMode ?? false;

        return mapBuilder.active;
    } catch (error) {
        console.error(
            "Map Builder konnte nicht geladen werden:",
            error
        );

        return false;
    }
}

window.addEventListener("DOMContentLoaded", () => {
    if (loadMapBuilder()) {
        openMapBuilder(true);
    }
});

function onMapBuilderTileChanged() {
    saveMapBuilder();
    drawMapBuilder();
}
function clearMapBuilderSave() {
    localStorage.removeItem(MAP_BUILDER_STORAGE_KEY);
}
const MAP_BUILDER_RESOURCES = [
    "HOLZ",
    "LEHM",
    "SCHAF",
    "WEIZEN",
    "ERZ"
];

function mapKey(q, r) {
    return `${q},${r}`;
}

// Alle bebaubaren Positionen der Karte erzeugen.
function getMapBuilderCoordinates() {
    const coordinates = [];

    for (let q = -mapBuilder.radius; q <= mapBuilder.radius; q++) {
        for (let r = -mapBuilder.radius; r <= mapBuilder.radius; r++) {
            if (Math.abs(q + r) > mapBuilder.radius) continue;

            coordinates.push({ q, r });
        }
    }

    return coordinates;
}

// ---------------------------------------------------------
// EDITOR-OBERFLÄCHE
// ---------------------------------------------------------

function createMapBuilderUI() {
    if ($("mapBuilderScreen")) return;

    const style = document.createElement("style");

    style.textContent = `
        #mapBuilderScreen {
    position: fixed;
    inset: 0;
    z-index: 10000;
    display: grid;
    grid-template-columns: minmax(0, 1fr) 250px;
    background: #bd9a65;
    color: #f7ead1;
    font-family: system-ui, "Segoe UI", sans-serif;
}

#mapBuilderScreen.hidden {
    display: none !important;
}

#mapBuilderCanvas {
    grid-column: 1;
    grid-row: 1;
    display: block;
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    touch-action: none;
    cursor: crosshair;
}

#mapBuilderScreen .mb-toolbar {
    grid-column: 2;
    grid-row: 1;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 0;
    min-width: 0;
    overflow-y: auto;
    padding: 0 13px 16px;
    background: #211810;
    border-left: 2px solid #5d4128;
    box-shadow: -5px 0 16px rgba(0, 0, 0, 0.2);
}

#mapBuilderScreen .mb-heading {
    margin: 0 -13px 16px;
    padding: 18px 13px 14px;
    text-align: center;
    background: #241a12;
    border-bottom: 1px solid #6c4b2c;
}

#mapBuilderScreen .mb-title {
    font-family: Georgia, serif;
    font-size: 23px;
    font-weight: bold;
    color: #e9bf72;
    text-shadow: 0 2px 0 #432b17;
}

#mapBuilderScreen #mbTileCount {
    margin-top: 8px;
    color: #c6a477;
    font-size: 13px;
}

#mapBuilderScreen .mb-section-title {
    margin: 0 0 10px;
    padding-bottom: 7px;
    border-bottom: 1px solid #5d4128;
    color: #e9bf72;
    font-family: Georgia, serif;
    font-size: 16px;
}

#mapBuilderScreen .mb-buttons {
    display: grid;
    grid-template-columns: 1fr;
    gap: 8px;
    width: 100%;
}

#mapBuilderScreen .mb-button {
    width: 100%;
    min-height: 40px;
    padding: 10px 13px;
    font: inherit;
    border: 0;
    border-radius: 9px;
    background: #654421;
    color: #fff;
    box-shadow: none;
    cursor: pointer;
    transition: filter 0.12s;
}

#mapBuilderScreen .mb-button:hover {
    filter: brightness(1.2);
}

#mapBuilderScreen .mb-button:active {
    transform: translateY(1px);
    box-shadow: 0 1px 0 #75502e;
}

#mapBuilderScreen .mb-button.finish {
    background: #a66b20;
}


#mapBuilderScreen .mb-spacer {
    flex: 1;
    min-height: 20px;
}

@media (max-width: 700px) {
    #mapBuilderScreen {
        grid-template-columns: minmax(0, 1fr) 190px;
    }

    #mapBuilderScreen .mb-toolbar {
        padding-right: 9px;
        padding-left: 9px;
    }

    #mapBuilderScreen .mb-heading {
        margin-right: -9px;
        margin-left: -9px;
        padding-right: 9px;
        padding-left: 9px;
    }

    #mapBuilderScreen .mb-title {
        font-size: 19px;
    }

    #mapBuilderScreen .mb-button {
        font-size: 12px;
        padding: 8px 5px;
    }
}
    `;

    document.head.appendChild(style);

    const screen = document.createElement("div");
    screen.id = "mapBuilderScreen";
    screen.className = "hidden";

    screen.innerHTML = `
<canvas id="mapBuilderCanvas"></canvas>

<aside class="mb-toolbar">
    <div class="mb-heading">
        <div class="mb-title">COACHING</div>
    </div>

    
<h3 class="mb-section-title">Rohstoff:</h3>

<div class="mb-resource-grid">
    <button class="mb-button mb-resource active"
            data-resource="HOLZ">Holz</button>

    <button class="mb-button mb-resource"
            data-resource="LEHM">Lehm</button>

    <button class="mb-button mb-resource"
            data-resource="WEIZEN">Weizen</button>

    <button class="mb-button mb-resource"
            data-resource="ERZ">Erz</button>

    <button class="mb-button mb-resource"
            data-resource="SCHAF">Schaf</button>

    <button class="mb-button mb-resource"
            data-resource="GOLD">Gold</button>

    <button class="mb-button mb-resource"
            data-resource="RANDOM">Zufällig</button>

    <button class="mb-button mb-resource"
            data-resource="WÜSTE">Wüste</button>
</div>

    <div class="mb-buttons">
    <h3 class="mb-section-title">Hafen + Rohstoff</h3>

        <button class="mb-button" id="mbHarborMode">
            Häfen: Aus
        </button>

        <h3 class="mb-section-title">Andere Optionen</h3>


        <button class="mb-button" id="mbClear">
            Karte leeren
        </button>

        <button class="mb-button" id="mbBack">
            Zurück zur Lobby
        </button>
                <input
    id="mapName"
    type="text"
    placeholder="Name der Karte eingeben"
    maxlength="60"
    autocomplete="off"
/>
    </div>

    <div class="mb-spacer"></div>

    <div class="mb-buttons">
        <button class="mb-button finish" id="mbFinish">
            Karte speichern
        </button>
    </div>
</aside>
    `;

    document.body.appendChild(screen);
    screen.querySelectorAll(".mb-resource").forEach(button => {
    button.addEventListener("click", () => {
        mapBuilder.selectedResource = button.dataset.resource;

        screen.querySelectorAll(".mb-resource").forEach(btn => {
            btn.classList.toggle("active", btn === button);
        });
    });
});

    mapBuilder.canvas = $("mapBuilderCanvas");
    mapBuilder.ctx = mapBuilder.canvas.getContext("2d");

    $("mbBack").onclick = closeMapBuilder;

$("mbClear").onclick = () => {
    mapBuilder.tiles.clear();
    mapBuilder.harbors.clear();
    onMapBuilderTileChanged();
};

    $("mbHarborMode").onclick = () => {
    mapBuilder.harborMode = !mapBuilder.harborMode;

    $("mbHarborMode").textContent = mapBuilder.harborMode
        ? "Häfen: An"
        : "Häfen: Aus";

    mapBuilder.canvas.style.cursor = mapBuilder.harborMode
        ? "crosshair"
        : "default";

    saveMapBuilder();
    drawMapBuilder();
};
    $("mbFinish").onclick = finishMapBuilder;

    window.addEventListener("resize", drawMapBuilder);

    setupMapBuilderCanvas();
  Object.values(TILE_IMAGES).forEach(img => {
    if (!img) return;

    if (img.complete && img.naturalWidth > 0) {
        drawMapBuilder();
    } else {
        img.addEventListener("load", drawMapBuilder);
        img.addEventListener("error", () => {
            console.error("Kachelbild konnte nicht geladen werden:", img.src);
        });
    }
});

    drawMapBuilder();
}

// ---------------------------------------------------------
// LOBBY-BUTTON
// ---------------------------------------------------------

function installMapBuilderButton() {
    const actions = $("lobby-actions");

    if (!actions || $("mapBuilderOpenBtn")) return;

    const button = document.createElement("button");

    button.id = "mapBuilderOpenBtn";
    button.className = "mb-button";
    button.textContent = "🗺️ Map erstellen";

    button.onclick = openMapBuilder;

    actions.appendChild(button);
}

// ---------------------------------------------------------
// ÖFFNEN / SCHLIESSEN
// ---------------------------------------------------------

function openMapBuilder(restore = false) {
    createMapBuilderUI();
    mapBuilder.active = true;

    if (!restore) {
        mapBuilder.active = true;
        mapBuilder.tiles.clear();
        mapBuilder.zoom = 1;
        mapBuilder.offsetX = 0;
        mapBuilder.offsetY = 0;
        mapBuilder.harbors.clear();
        mapBuilder.harborMode = false;
    }

    $("mapBuilderScreen").classList.remove("hidden");
    $("mbHarborMode").textContent = mapBuilder.harborMode
    ? "⚓ Häfen: An"
    : "⚓ Häfen: Aus";

    const nameInput = document.getElementById("mapName");
    if (nameInput) {
        nameInput.value = mapBuilder.savedMapName ?? "";
    }

    drawMapBuilder();
    saveMapBuilder();
}

function closeMapBuilder() {
    mapBuilder.active = false;
    saveMapBuilder();

    $("mapBuilderScreen").classList.add("hidden");

    // Lobby wieder anzeigen, falls sie vorher aktiv war.
    if (!lastState || !(lastState.board || lastState.tiles || lastState.vertices)) {
        $("lobby").classList.remove("hidden");
    }
}

// ---------------------------------------------------------
// ZEICHNEN
// ---------------------------------------------------------

function drawMapBuilder() {
    console.log("drawMapBuilder aufgerufen");
    console.log("active:", mapBuilder.active);
    console.log("canvas:", mapBuilder.canvas);

    // Rest deiner bisherigen Funktion ...
    if (!mapBuilder.active || !mapBuilder.canvas) return;

    const canvas = mapBuilder.canvas;
    const rect = canvas.getBoundingClientRect();

    if (!rect.width || !rect.height) return;

    const dpr = window.devicePixelRatio || 1;

const targetWidth = Math.round(rect.width * dpr);
const targetHeight = Math.round(rect.height * dpr);

if (
    canvas.width !== targetWidth ||
    canvas.height !== targetHeight
) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
}


const ctx = mapBuilder.ctx;
ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

const W = rect.width;
const H = rect.height;

// Vor jedem Neuzeichnen die vorherigen Zoomstufen entfernen.
ctx.clearRect(0, 0, W, H);

// Hintergrund für den Karteneditor
ctx.fillStyle = "#bd9a65";
ctx.fillRect(0, 0, W, H);


    // Kachelgröße ist unabhängig von der Kartengröße.
    const baseSize = Math.min(W / 8, H / 6, 75);
    const size = baseSize * mapBuilder.zoom;

    const centerX = W / 2 + mapBuilder.offsetX;
    const centerY = H / 2 + mapBuilder.offsetY;

    function position(q, r) {
        return {
            x: centerX + size * (
                Math.sqrt(3) * q +
                Math.sqrt(3) / 2 * r
            ),
            y: centerY + size * 1.5 * r
        };
    }

const waterRadius = 50;
const waterImg = TILE_IMAGES.WASSER;

if (waterImg && waterImg.complete && waterImg.naturalWidth > 0) {
    // Nur Wasserfelder innerhalb des sichtbaren Canvas-Bereichs zeichnen.
    // Zusätzlicher Rand verhindert sichtbare Lücken beim Verschieben.
    const margin = size * 3;

    const minX = -margin;
    const maxX = W + margin;
    const minY = -margin;
    const maxY = H + margin;

    // Sichtbare Pixelgrenzen zurück in ungefähre Hexkoordinaten umrechnen.
    const corners = [
        { x: minX, y: minY },
        { x: maxX, y: minY },
        { x: minX, y: maxY },
        { x: maxX, y: maxY }
    ];

    const visibleHexes = corners.map(({ x, y }) => {
        const dx = x - centerX;
        const dy = y - centerY;

        const r = (2 / 3 * dy) / size;
        const q = dx / (Math.sqrt(3) * size) - r / 2;

        return { q, r };
    });

    const minQ = Math.max(
        -waterRadius,
        Math.floor(Math.min(...visibleHexes.map(p => p.q)) - 3)
    );
    const maxQ = Math.min(
        waterRadius,
        Math.ceil(Math.max(...visibleHexes.map(p => p.q)) + 3)
    );
    const minR = Math.max(
        -waterRadius,
        Math.floor(Math.min(...visibleHexes.map(p => p.r)) - 3)
    );
    const maxR = Math.min(
        waterRadius,
        Math.ceil(Math.max(...visibleHexes.map(p => p.r)) + 3)
    );

    for (let q = minQ; q <= maxQ; q++) {
        for (let r = minR; r <= maxR; r++) {
            if (Math.abs(q + r) > waterRadius) continue;

            const p = position(q, r);

            // Felder außerhalb des sichtbaren Bereichs überspringen.
            if (
                p.x < minX - size * 2 ||
                p.x > maxX + size * 2 ||
                p.y < minY - size * 2 ||
                p.y > maxY + size * 2
            ) continue;

            ctx.drawImage(
                waterImg,
                p.x - size * 1.91,
                p.y - size * 1.22,
                size * 3.82,
                size * 2.44
            );
        }
    }
}
console.log("Wasser-Zeichenblock beendet");

// Ausschließlich platzierte Landfelder zeichnen.
for (const tile of mapBuilder.tiles.values()) {
    const { q, r, resource } = tile;
    const p = position(q, r);

    if (resource == null) {
        // Weißes Feld für eine zufällige Ressource
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - size);

        for (let i = 1; i < 6; i++) {
            const angle = (Math.PI / 3) * i;
            ctx.lineTo(
                p.x + size * Math.cos(angle - Math.PI / 2),
                p.y + size * Math.sin(angle - Math.PI / 2)
            );
        }

        ctx.closePath();
        ctx.fill();

        // Dezente Umrandung
        ctx.strokeStyle = "#b8b8b8";
        ctx.lineWidth = Math.max(1, size * 0.025);
        ctx.stroke();

        // Fragezeichen zentriert zeichnen
        ctx.fillStyle = "#333333";
        ctx.font = `bold ${size * 0.85}px Arial`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("?", p.x, p.y);

        continue;
    }

    // Normale Ressourcenfelder
    const img = TILE_IMAGES[resource];

    if (img && img.complete && img.naturalWidth > 0) {
        if (tile.resource == "GOLD"){
            ctx.drawImage(
                    img,
                    p.x - size * 1.54,
                    p.y - size * 1.05,
                    size * 3.08,
                    size * 2.1
                );
        }
        ctx.drawImage(
            img,
            p.x - size * 0.9,
            p.y - size,
            size * 1.8,
            size * 2
        );
    }
}


    drawMapBuilderHarbors(ctx, position, size);
}

// ---------------------------------------------------------
// FELD ERMITTELN
// ---------------------------------------------------------

function findMapBuilderTile(x, y) {
    const canvas = mapBuilder.canvas;
    const rect = canvas.getBoundingClientRect();

    const W = rect.width;
    const H = rect.height;

    const size = Math.min(W / 8, H / 6, 75) * mapBuilder.zoom;

    const centerX = W / 2 + mapBuilder.offsetX;
    const centerY = H / 2 + mapBuilder.offsetY;

    const dx = x - centerX;
    const dy = y - centerY;

    // Pixelkoordinaten in axiale Hexkoordinaten umrechnen.
    const rf = (2 / 3 * dy) / size;
    const qf = dx / (Math.sqrt(3) * size) - rf / 2;

    // Auf das nächstgelegene Hexfeld runden.
    let q = Math.round(qf);
    let r = Math.round(rf);
    const s = Math.round(-qf - rf);

    const qError = Math.abs(q - qf);
    const rError = Math.abs(r - rf);
    const sError = Math.abs(s - (-qf - rf));

    let correctedQ = q;
    let correctedR = r;

    if (qError > rError && qError > sError) {
        correctedQ = -r - s;
    } else if (rError > sError) {
        correctedR = -q - s;
    }

    return { q: correctedQ, r: correctedR };
}
function cycleMapBuilderHarbor(q, r) {
    const key = mapKey(q, r);
    const existing = mapBuilder.harbors.get(key);

    // Ressource des Hafens anhand der aktuellen Auswahl bestimmen.
    const selected = mapBuilder.selectedResource;

    const harborResource =
        MAP_BUILDER_RESOURCES.includes(selected)
            ? selected
            : null;

    if (!existing || existing.resource != harborResource) {
        // Erster Klick: Hafen in Richtung 1
        mapBuilder.harbors.set(key, {
            q,
            r,
            direction: 1,
            resource: harborResource,
            ratio: harborResource ? 2 : 3
        });
    } else if (existing.direction < 6) {
        // Weitere Klicks: Richtung 2 bis 6
        mapBuilder.harbors.set(key, {
            ...existing,
            direction: existing.direction + 1
        });
    } else {
        // Nach Richtung 6: Hafen entfernen
        mapBuilder.harbors.delete(key);
    }

    saveMapBuilder();
    drawMapBuilder();
}

function drawMapBuilderHarbors(ctx, position, size) {
    const directionCorners = {
        1: [5, 0], // oben rechts
        2: [4, 5], // oben links
        3: [3, 4], // links
        4: [2, 3], // unten links
        5: [1, 2], // unten rechts
        6: [0, 1]  // rechts
    };

    for (const harbor of mapBuilder.harbors.values()) {


        const center = position(harbor.q, harbor.r);

        const corners = Array.from({ length: 6 }, (_, i) => {
            const angle = (60 * i - 30) * Math.PI / 180;

            return {
                x: center.x + size * Math.cos(angle),
                y: center.y + size * Math.sin(angle)
            };
        });

        const indices = directionCorners[harbor.direction];
        if (!indices) continue;

        drawHarbor(
            ctx,
            harbor,
            corners[indices[0]],
            corners[indices[1]],
            center,
            size
        );
    }
}
// ---------------------------------------------------------
// KLICK: WASSER <-> LAND
// ---------------------------------------------------------


function toggleMapBuilderTile(q, r) {
    const key = mapKey(q, r);
    const existing = mapBuilder.tiles.get(key);

    const resource =
        mapBuilder.selectedResource === "RANDOM"
            ? null
            : mapBuilder.selectedResource;

    if (existing) {
        if (existing.resource !== resource) {
            // Vorhandenes Feld in die ausgewählte Ressource umwandeln.
            mapBuilder.tiles.set(key, {
                q,
                r,
                resource
            });
        } else {
            // Dieselbe Ressource erneut anklicken → Feld entfernen.
            mapBuilder.tiles.delete(key);
            mapBuilder.harbors.delete(key);
        }
    } else {
        // Neues Landfeld platzieren.
        mapBuilder.tiles.set(key, {
            q,
            r,
            resource
        });
    }

    onMapBuilderTileChanged();
}

// ---------------------------------------------------------
// MAUS, ZOOM UND VERSCHIEBEN
// ---------------------------------------------------------
function setupMapBuilderCanvas() {
    const canvas = mapBuilder.canvas;

    // Verhindert Browser-Gesten, die den Canvas beeinflussen.
    canvas.style.touchAction = "none";

    let pointerStartX = 0;
    let pointerStartY = 0;
    let pointerStartOffsetX = 0;
    let pointerStartOffsetY = 0;
    let activePointerId = null;
    let pointerMoved = false;

    const DRAG_THRESHOLD = 6;

    canvas.addEventListener("pointerdown", (ev) => {
        if (!mapBuilder.active) return;
        if (mapBuilder.pinching || mapBuilder.suppressNextTap) return;

        // Nur linke Maustaste; Touch und Stift ebenfalls erlauben.
        if (ev.pointerType === "mouse" && ev.button !== 0) return;

        activePointerId = ev.pointerId;
        pointerStartX = ev.clientX;
        pointerStartY = ev.clientY;

        pointerStartOffsetX = mapBuilder.offsetX;
        pointerStartOffsetY = mapBuilder.offsetY;

        pointerMoved = false;
        mapBuilder.dragging = false;

        canvas.setPointerCapture(ev.pointerId);
    });

    canvas.addEventListener("pointermove", (ev) => {
        if (!mapBuilder.active) return;
        if (ev.pointerId !== activePointerId) return;
        if (mapBuilder.pinching || mapBuilder.suppressNextTap) return;

        const dx = ev.clientX - pointerStartX;
        const dy = ev.clientY - pointerStartY;

        if (
            Math.hypot(dx, dy) > DRAG_THRESHOLD
        ) {
            pointerMoved = true;
            mapBuilder.dragging = true;
        }

        if (pointerMoved) {
            mapBuilder.offsetX = pointerStartOffsetX + dx;
            mapBuilder.offsetY = pointerStartOffsetY + dy;

            drawMapBuilder();
        }
    });

    function finishPointer(ev) {
        if (ev.pointerId !== activePointerId) return;

        if (
            mapBuilder.active &&
            !mapBuilder.pinching &&
            !mapBuilder.suppressNextTap &&
            !pointerMoved
        ) {
            const rect = canvas.getBoundingClientRect();

            const tile = findMapBuilderTile(
                ev.clientX - rect.left,
                ev.clientY - rect.top
            );

            if (mapBuilder.harborMode) {
                cycleMapBuilderHarbor(tile.q, tile.r);
            } else {
                toggleMapBuilderTile(tile.q, tile.r);
            }
        }

        activePointerId = null;
        pointerMoved = false;
        mapBuilder.dragging = false;
    }

    canvas.addEventListener("pointerup", finishPointer);

    canvas.addEventListener("pointercancel", () => {
        activePointerId = null;
        pointerMoved = false;
        mapBuilder.dragging = false;
    });

    canvas.addEventListener("lostpointercapture", () => {
        activePointerId = null;
        pointerMoved = false;
        mapBuilder.dragging = false;
    });

    // Mausrad-Zoom um die Mitte des sichtbaren Canvas.
    canvas.addEventListener("wheel", (ev) => {
        if (!mapBuilder.active) return;

        ev.preventDefault();

        const rect = canvas.getBoundingClientRect();

        const mouseX = ev.clientX - rect.left;
        const mouseY = ev.clientY - rect.top;

        const oldZoom = mapBuilder.zoom;

        const factor = ev.deltaY < 0 ? 1.02 : 1 / 1.02;

        const newZoom = Math.max(
            0.2,
            Math.min(2.5, oldZoom * factor)
        );

        // Den Punkt unter dem Mauszeiger festhalten.
        const worldX =
            (mouseX - rect.width / 2 - mapBuilder.offsetX) /
            oldZoom;

        const worldY =
            (mouseY - rect.height / 2 - mapBuilder.offsetY) /
            oldZoom;

        mapBuilder.zoom = newZoom;

        mapBuilder.offsetX =
            mouseX - rect.width / 2 - worldX * newZoom;

        mapBuilder.offsetY =
            mouseY - rect.height / 2 - worldY * newZoom;

        saveMapBuilder();
        drawMapBuilder();
    }, { passive: false });

    // Touch-Zoom mit zwei Fingern.
    function getTouchDistance(touches) {
        return Math.hypot(
            touches[1].clientX - touches[0].clientX,
            touches[1].clientY - touches[0].clientY
        );
    }

    function getTouchCenter(touches, rect) {
        return {
            x: (touches[0].clientX + touches[1].clientX) / 2 - rect.left,
            y: (touches[0].clientY + touches[1].clientY) / 2 - rect.top
        };
    }

    canvas.addEventListener("touchstart", (ev) => {
        if (!mapBuilder.active || ev.touches.length !== 2) return;

        ev.preventDefault();

        mapBuilder.pinching = true;
        mapBuilder.suppressNextTap = true;
        mapBuilder.dragging = false;

        activePointerId = null;
        pointerMoved = false;

        const rect = canvas.getBoundingClientRect();

        mapBuilder.touchStartDistance =
            getTouchDistance(ev.touches);

        mapBuilder.touchStartZoom = mapBuilder.zoom;
        mapBuilder.touchStartOffsetX = mapBuilder.offsetX;
        mapBuilder.touchStartOffsetY = mapBuilder.offsetY;

        mapBuilder.touchCenter =
            getTouchCenter(ev.touches, rect);
    }, { passive: false });

    canvas.addEventListener("touchmove", (ev) => {
        if (
            !mapBuilder.active ||
            !mapBuilder.pinching ||
            ev.touches.length !== 2
        ) return;

        ev.preventDefault();

        const rect = canvas.getBoundingClientRect();
        const center = getTouchCenter(ev.touches, rect);
        const distance = getTouchDistance(ev.touches);

        const factor =
            distance / Math.max(1, mapBuilder.touchStartDistance);

        const newZoom = Math.max(
            0.2,
            Math.min(2.5, mapBuilder.touchStartZoom * factor)
        );

        // Weltkoordinate unter dem ursprünglichen Fingermittelpunkt.
        const worldX =
            (
                mapBuilder.touchCenter.x -
                rect.width / 2 -
                mapBuilder.touchStartOffsetX
            ) / mapBuilder.touchStartZoom;

        const worldY =
            (
                mapBuilder.touchCenter.y -
                rect.height / 2 -
                mapBuilder.touchStartOffsetY
            ) / mapBuilder.touchStartZoom;

        mapBuilder.zoom = newZoom;

        // Aktuellen Mittelpunkt der Finger berücksichtigen.
        mapBuilder.offsetX =
            center.x - rect.width / 2 - worldX * newZoom;

        mapBuilder.offsetY =
            center.y - rect.height / 2 - worldY * newZoom;

        drawMapBuilder();
    }, { passive: false });

    function endPinch(ev) {
        if (ev.touches.length < 2 && mapBuilder.pinching) {
            mapBuilder.pinching = false;
            mapBuilder.dragging = false;
            activePointerId = null;

            saveMapBuilder();

            // Pointer-Ereignisse erst nach Ende der Geste zulassen.
            window.setTimeout(() => {
                mapBuilder.suppressNextTap = false;
            }, 300);
        }
    }

    canvas.addEventListener("touchend", endPinch, {
        passive: false
    });

    canvas.addEventListener("touchcancel", endPinch, {
        passive: false
    });
}

function finishMapBuilder() {
    if (!mapBuilder.active) return;

    if (mapBuilder.tiles.size === 0) {
        alert("Bitte setze zuerst mindestens ein Landfeld.");
        return;
    }

    const nameInput = document.getElementById("mapName");
    const name = nameInput?.value.trim();

    // Ohne Namen nichts senden und im Builder bleiben.
    if (!name) {
        nameInput?.focus();
        return;
    }

const tiles = Array.from(
    mapBuilder.tiles.entries(),
    ([key, tile]) => {
        const [q, r] = key.split(",").map(Number);

        return {
            q,
            r,
            resource: tile.resource ?? null
        };
    }
);
const harbors = Array.from(
    mapBuilder.harbors.values(),
    harbor => ({
        q: harbor.q,
        r: harbor.r,
        direction: harbor.direction,
        resource: harbor.resource,
        ratio: harbor.ratio
    })
);


console.log("MAPBUILDER: Karte übernehmen gestartet");
console.log("Name:", name);
console.log("Landfelder:", tiles.length);
console.log("Häfen:", harbors.length);
console.log("WebSocket:", ws?.readyState);
console.log("WebSocket OPEN:", WebSocket.OPEN);

    if (!ws || ws.readyState !== WebSocket.OPEN) {
        alert("Keine Serververbindung. Die Karte wurde nicht gespeichert.");
        return;
    }

    // Name und Felder gemeinsam an den Server senden.
send("custom_map", {
    name,
    tiles,
    harbors
});

    closeMapBuilder();

}


function drawUnknownTile(ctx, x, y, size) {
    const corners = [];

    // Gleiche Hexagon-Ausrichtung wie bei den anderen Feldern
    for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 180) * (60 * i - 30);

        corners.push({
            x: x + size * Math.cos(angle),
            y: y + size * Math.sin(angle)
        });
    }

    ctx.beginPath();
    corners.forEach((point, i) => {
        if (i === 0) {
            ctx.moveTo(point.x, point.y);
        } else {
            ctx.lineTo(point.x, point.y);
        }
    });
    ctx.closePath();

    ctx.fillStyle = "#ffffff";
    ctx.fill();

    ctx.strokeStyle = "#8a8a8a";
    ctx.lineWidth = Math.max(1, size * 0.035);
    ctx.stroke();

    ctx.fillStyle = "#333333";
    ctx.font = `bold ${size * 0.85}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("?", x, y + size * 0.03);
}

const MAP_RESOURCE_IMAGES = {
    HOLZ: "HOLZ",
    LEHM: "LEHM",
    SCHAF: "SCHAF",
    WEIZEN: "WEIZEN",
    ERZ: "ERZ",
    WÜSTE: "WÜSTE",
    GOLD: "GOLD",
    WASSER: "WASSER"
};

// =========================================================
// MAP PREVIEW
// Verwendet dieselbe Feldzeichnung wie drawBoard()
// =========================================================

function drawMapPreview(canvas, tiles, harbors = []) {
    const ctx = canvas.getContext("2d");

    const width = 340;
    const height = 270;

    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);

    if (!tiles || tiles.length === 0) return;

    const baseSize = 27;

    // -----------------------------------------------------
    // WASSERFELDER ALS NACHBARN DER LAND-FELDER ERMITTELN
    // -----------------------------------------------------

    const land = new Set(
        tiles.map(t => `${t.q},${t.r}`)
    );

    const directions = [
        [1, 0],
        [1, -1],
        [0, -1],
        [-1, 0],
        [-1, 1],
        [0, 1]
    ];

    const water = new Set();

    for (const tile of tiles) {
        for (const [dq, dr] of directions) {
            const q = +tile.q + dq;
            const r = +tile.r + dr;
            const key = `${q},${r}`;

            if (!land.has(key)) {
                water.add(key);
            }
        }
    }

    const allTiles = [
        ...Array.from(water, key => {
            const [q, r] = key.split(",").map(Number);

            return {
                q,
                r,
                resource: "WASSER"
            };
        }),
        ...tiles
    ];

    // -----------------------------------------------------
    // HEX-KOORDINATEN
    // Gleiche Orientierung wie drawBoard()
    // -----------------------------------------------------

    const rawPos = (q, r) => ({
        x: baseSize * (
            Math.sqrt(3) * q +
            (Math.sqrt(3) / 2) * r
        ),
        y: baseSize * 1.5 * r
    });

    const positions = allTiles.map(t => ({
        tile: t,
        ...rawPos(+t.q, +t.r)
    }));

    // -----------------------------------------------------
    // BEGRENZUNGSRAHMEN ERMITTELN
    // -----------------------------------------------------

    const minX = Math.min(...positions.map(p => p.x));
    const maxX = Math.max(...positions.map(p => p.x));
    const minY = Math.min(...positions.map(p => p.y));
    const maxY = Math.max(...positions.map(p => p.y));

    const padding = 12;

    const mapWidth =
        maxX - minX + baseSize * Math.sqrt(3);

    const mapHeight =
        maxY - minY + baseSize * 2;

    const scale = Math.min(
        (width - padding * 2) / mapWidth,
        (height - padding * 2) / mapHeight
    );

    const size = baseSize * scale;

    const centerX = width / 2;
    const centerY = height / 2;

    // -----------------------------------------------------
    // POSITIONEN FÜR DIE GEMEINSAME ZEICHENFUNKTION
    // -----------------------------------------------------

    const pos = (q, r) => {
        const p = rawPos(q, r);

        return {
            x: centerX + (p.x - (minX + maxX) / 2) * scale,
            y: centerY + (p.y - (minY + maxY) / 2) * scale
        };
    };

    // -----------------------------------------------------
    // WASSERHINTERGRUND
    // -----------------------------------------------------

    ctx.fillStyle = "#c7a36b";
    ctx.fillRect(0, 0, width, height);

    // -----------------------------------------------------
    // FELDER ZEICHNEN
    // Gemeinsame Funktion aus drawBoard()
    // -----------------------------------------------------

    drawMapTiles(
        ctx,
        allTiles,
        pos,
        size
    );
    // Häfen ebenfalls in der Vorschau zeichnen
drawHarbors(
    ctx,
    { harbors: harbors || [] },
    pos,
    size
);
}


function renderMapPicker(maps, selectedMap) {
    const container = document.getElementById("map-list");
    if (!container) return;

    container.replaceChildren();

    for (const map of maps) {
        const card = document.createElement("button");
        card.type = "button";
        card.className = "map-card";

        if (map.name === selectedMap) {
            card.classList.add("selected");
        }

        const canvas = document.createElement("canvas");
        canvas.setAttribute("aria-label", `Vorschau von ${map.name}`);

        const name = document.createElement("span");
        name.className = "map-card-name";
        name.textContent = map.name;

        card.append(canvas, name);

        card.addEventListener("click", () => {
            if (!ws || ws.readyState !== WebSocket.OPEN) {
                alert("Keine Serververbindung.");
                return;
            }

            send("choosemap", { name: map.name });
        });

        container.appendChild(card);
        drawMapPreview(canvas, map.tiles, map.harbors || []);    
    }
}

// Button hinzufügen, sobald das Script ausgeführt wird.
installMapBuilderButton();
enterFullscreen();
initializeLobbyUi();
connect();
