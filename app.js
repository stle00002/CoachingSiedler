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

ROBBER_IMAGE.src = "images/ritter.png";

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
const MAX_BOARD_ZOOM = 4;

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

const WS_URL = "wss://bradley-scales-decade-render.trycloudflare.com";
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
  ["schwarz", "#111"],
  ["weiß", "#eee"],
];
const state = { players: [], board: null };
let ws = null,
  me = localStorage.getItem("catanName") || "",
  myColor = localStorage.getItem("catanColor") || "rot",
  mode = null,
  lastState = null;
const $ = (id) => document.getElementById(id);
$("name").value = me;
function send(type, extra = {}) {
  if (ws && ws.readyState === 1) {
    console.log("message is definetly send");ws.send(JSON.stringify({ type, ...extra }))};
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

    // Wenn wir schon einen Namen haben, wieder beim Server anmelden
    if (me) {
      send("join", { name: me });
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

      if (m.type === "state") {
        renderState(m.state);
      }

      else if (m.type === "error") {
        log(m.message || "Fehler");
      }
else if (m.action === "lobby_update") {
    console.log("LOBBY UPDATE:", m.players);

    // Lobby-Spielerliste aktualisieren
    renderLobby(m.players, m.loading);

    // Lobby anzeigen
    $("lobby").classList.remove("hidden");
    $("game").classList.add("hidden");
}


else if (m.action === "welcome") {

  document.getElementById("join-row").style.display = "none";

  player_index = m.player_index;

  if (m.in_game) {
    // Wir sind bereits mitten im Spiel.
    // KEINE Lobby anzeigen.
    document.getElementById("lobby-actions").style.display = "none";
    document.getElementById("colors").style.display = "none";
  } else {
    // Normales Verbinden in der Lobby
    document.getElementById("lobby-actions").style.display = "block";
    document.getElementById("colors").style.display = "block";
  }

  log("Verbunden");
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
$("joinBtn").onclick = () => {
  me = $("name").value.trim();
  if (!me) return;
  localStorage.setItem("catanName", me);
  send("join", { name: me});
};
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
    myColor = n;
    localStorage.setItem("catanColor", n);
    send("change_color", { playerName: me, color: n });
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
    if (tradeDeclined) {
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
function renderState(s) {
  lastState = s;
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
        `<div class="player-row"><span class="dot" style="background:${colorCss(p.color)}"></span><b>${esc(p.name)}</b><span>${p.ready ? "✓ bereit" : ""}${p.is_host ? " 👑" : ""}</span></div>`,
    )
    .join("");
  $("playerList").innerHTML = players
  .map(
  (p) => `
    <div class="player-card ${isCurrent(p) ? "current" : ""}">
      <b style="color:${colorCss(p.color)}">
        ${esc(p.name)} ${esc(p.victoryPoints || 0)}
        ${isCurrent(p) ? ' <span class="turn-arrow">←</span>' : ''}
      </b>
      <br>
      <span>${p.countResources || 0} Karten<br><span>${p.countDevelopmentCards || 0} Entwicklungskarten<br></span>${p.knights || 0} Ritter 
    </div>
  `,
)
.join("");
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
  $("diceText").textContent = s.dice ? `Wurf: ${s.dice}` : "–";
  updatePrompt(s);
}
function phaseText(s) {
  if (s.setupPhase) return "Aufbauphase";
  if (s.buildPhase) return "Sonderbauphase";
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
  for (const t of tiles) {
  const p = pos(+t.q, +t.r);

  const resource = String(t.resource || "").toUpperCase();
  const img = TILE_IMAGES[resource];

  if (img && img.complete && img.naturalWidth > 0) {
if (resource.includes("WASSER")) {
    ctx.drawImage(
        img,
        p.x - zoomedSize * 1.91,
        p.y - zoomedSize * 1.22,
        zoomedSize * 3.82,
        zoomedSize * 2.44
    );
} else if (resource.includes("GOLD")) {
    ctx.drawImage(
        img,
        p.x - zoomedSize * 1.54,
        p.y - zoomedSize * 1.05,
        zoomedSize * 3.08,
        zoomedSize * 2.1
    );
} else{
    ctx.drawImage(
        img,
        p.x - zoomedSize * 0.9,
        p.y - zoomedSize ,
        zoomedSize * 1.8,
        zoomedSize * 2
    );
}
  }

  // Keine Zahl auf Wasser oder Wüste
  if (
    resource.includes("WASSER") ||
    resource.includes("WÜSTE")
  ) {
    continue;
  }

// =========================================================
// ZAHLENKREIS
// =========================================================

// Größe relativ zum tatsächlichen Hexfeld
const numberCircleRadius = zoomedSize * 0.28;

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

// =========================================================
// ZAHL
// =========================================================

ctx.fillStyle =
    t.number === 6 || t.number === 8
        ? "#c33"
        : "#222";

ctx.font = `bold ${zoomedSize * 0.25}px Georgia`;
ctx.textAlign = "center";
ctx.textBaseline = "middle";

ctx.fillText(
    t.number ?? "",
    p.x,
    p.y
);

if (t.hasRobber) {
    const robberHeight = zoomedSize * 1.30;
    const robberWidth = robberHeight * (512 / 1280);

    const robberX = p.x - robberWidth / 2;
    const robberY = p.y - robberHeight * 0.55;

    // Schatten unter dem Räuber
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
    if (ROBBER_CANVAS.width > 0) {
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
        if (owner.name !== "Mama") {

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

    const s = buildingSize* 1.5;
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

        if (owner.name === "Mama"){
// -----------------------------------------------------
// 👑 MAMA-SIEDLUNG
// -----------------------------------------------------


    ctx.save();

    const s = settlementSize * 1.45;
    const x = p.x;
    const y = p.y + offsetY;

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
    // GOLDVERLAUF
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


    // -------------------------------------------------
    // SCHATTEN
    // -------------------------------------------------

    ctx.shadowColor = "rgba(0,0,0,0.28)";
    ctx.shadowBlur = s * 0.18;
    ctx.shadowOffsetY = s * 0.10;


    // -------------------------------------------------
    // HAUPTGEBÄUDE
    // -------------------------------------------------

    ctx.beginPath();

    ctx.moveTo(
        x - s * 0.72,
        y + s * 0.72
    );

    ctx.lineTo(
        x + s * 0.72,
        y + s * 0.72
    );

    ctx.lineTo(
        x + s * 0.72,
        y - s * 0.10
    );

    ctx.lineTo(
        x + s * 0.35,
        y - s * 0.10
    );

    ctx.lineTo(
        x,
        y - s * 0.60
    );

    ctx.lineTo(
        x - s * 0.35,
        y - s * 0.10
    );

    ctx.lineTo(
        x - s * 0.72,
        y - s * 0.10
    );

    ctx.closePath();

    ctx.fillStyle = pink;
    ctx.fill();

    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;


    // -------------------------------------------------
    // WEISSER RAND
    // -------------------------------------------------

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = s * 0.10;
    ctx.lineJoin = "round";
    ctx.stroke();


    // -------------------------------------------------
    // GOLDENER DACHRAND
    // -------------------------------------------------

    ctx.beginPath();

    ctx.moveTo(
        x - s * 0.36,
        y - s * 0.08
    );

    ctx.lineTo(
        x,
        y - s * 0.60
    );

    ctx.lineTo(
        x + s * 0.36,
        y - s * 0.08
    );

    ctx.strokeStyle = gold;
    ctx.lineWidth = s * 0.065;
    ctx.stroke();


    // -------------------------------------------------
    // LINKER KLEINER TURM
    // -------------------------------------------------

    ctx.beginPath();

    ctx.roundRect(
        x - s * 0.82,
        y - s * 0.38,
        s * 0.34,
        s * 1.10,
        s * 0.06
    );

    ctx.fillStyle = pink;
    ctx.fill();

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = s * 0.07;
    ctx.stroke();


    // -------------------------------------------------
    // RECHTER KLEINER TURM
    // -------------------------------------------------

    ctx.beginPath();

    ctx.roundRect(
        x + s * 0.48,
        y - s * 0.38,
        s * 0.34,
        s * 1.10,
        s * 0.06
    );

    ctx.fillStyle = pink;
    ctx.fill();

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = s * 0.07;
    ctx.stroke();


    // -------------------------------------------------
    // LINKES TURMDACH
    // -------------------------------------------------

    ctx.beginPath();

    ctx.moveTo(
        x - s * 0.90,
        y - s * 0.35
    );

    ctx.lineTo(
        x - s * 0.65,
        y - s * 0.70
    );

    ctx.lineTo(
        x - s * 0.40,
        y - s * 0.35
    );

    ctx.closePath();

    ctx.fillStyle = gold;
    ctx.fill();

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = s * 0.06;
    ctx.stroke();


    // -------------------------------------------------
    // RECHTES TURMDACH
    // -------------------------------------------------

    ctx.beginPath();

    ctx.moveTo(
        x + s * 0.40,
        y - s * 0.35
    );

    ctx.lineTo(
        x + s * 0.65,
        y - s * 0.70
    );

    ctx.lineTo(
        x + s * 0.90,
        y - s * 0.35
    );

    ctx.closePath();

    ctx.fillStyle = gold;
    ctx.fill();

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = s * 0.06;
    ctx.stroke();


    // -------------------------------------------------
    // TURM-KUGELN
    // -------------------------------------------------

    ctx.fillStyle = "#fff0a0";

    ctx.beginPath();

    ctx.arc(
        x - s * 0.65,
        y - s * 0.75,
        s * 0.055,
        0,
        Math.PI * 2
    );

    ctx.fill();


    ctx.beginPath();

    ctx.arc(
        x + s * 0.65,
        y - s * 0.75,
        s * 0.055,
        0,
        Math.PI * 2
    );

    ctx.fill();


    // -------------------------------------------------
    // MITTLERES FENSTER
    // -------------------------------------------------

    const windowGradient = ctx.createLinearGradient(
        x,
        y - s * 0.30,
        x,
        y + s * 0.20
    );

    windowGradient.addColorStop(0, "#fff4d0");
    windowGradient.addColorStop(0.35, "#ffd86a");
    windowGradient.addColorStop(1, "#b87500");

    ctx.beginPath();

    ctx.roundRect(
        x - s * 0.14,
        y - s * 0.25,
        s * 0.28,
        s * 0.43,
        s * 0.05
    );

    ctx.fillStyle = windowGradient;
    ctx.fill();

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = s * 0.025;
    ctx.stroke();


    // -------------------------------------------------
    // FENSTERKREUZ
    // -------------------------------------------------

    ctx.beginPath();

    ctx.moveTo(
        x,
        y - s * 0.24
    );

    ctx.lineTo(
        x,
        y + s * 0.16
    );

    ctx.moveTo(
        x - s * 0.13,
        y - s * 0.04
    );

    ctx.lineTo(
        x + s * 0.13,
        y - s * 0.04
    );

    ctx.strokeStyle = "#b87500";
    ctx.lineWidth = s * 0.025;
    ctx.stroke();


    // -------------------------------------------------
    // LINKES FENSTER
    // -------------------------------------------------

    ctx.beginPath();

    ctx.roundRect(
        x - s * 0.72,
        y - s * 0.02,
        s * 0.13,
        s * 0.27,
        s * 0.035
    );

    ctx.fillStyle = "#ffe28a";
    ctx.fill();

    ctx.strokeStyle = "#b87500";
    ctx.lineWidth = s * 0.025;
    ctx.stroke();


    // -------------------------------------------------
    // RECHTES FENSTER
    // -------------------------------------------------

    ctx.beginPath();

    ctx.roundRect(
        x + s * 0.59,
        y - s * 0.02,
        s * 0.13,
        s * 0.27,
        s * 0.035
    );

    ctx.fillStyle = "#ffe28a";
    ctx.fill();

    ctx.strokeStyle = "#b87500";
    ctx.lineWidth = s * 0.025;
    ctx.stroke();


    // -------------------------------------------------
    // KLEINES TOR
    // -------------------------------------------------

    ctx.beginPath();

    ctx.moveTo(
        x - s * 0.17,
        y + s * 0.72
    );

    ctx.lineTo(
        x - s * 0.17,
        y + s * 0.35
    );

    ctx.quadraticCurveTo(
        x,
        y + s * 0.08,
        x + s * 0.17,
        y + s * 0.35
    );

    ctx.lineTo(
        x + s * 0.17,
        y + s * 0.72
    );

    ctx.closePath();

    const door = ctx.createLinearGradient(
        x - s * 0.17,
        y,
        x + s * 0.17,
        y
    );

    door.addColorStop(0, "#6b321e");
    door.addColorStop(0.5, "#a85b32");
    door.addColorStop(1, "#542718");

    ctx.fillStyle = door;
    ctx.fill();

    ctx.strokeStyle = "#ffd84a";
    ctx.lineWidth = s * 0.045;
    ctx.stroke();


    // -------------------------------------------------
    // GOLDENER TORRING
    // -------------------------------------------------

    ctx.beginPath();

    ctx.arc(
        x + s * 0.075,
        y + s * 0.53,
        s * 0.035,
        0,
        Math.PI * 2
    );

    ctx.fillStyle = "#ffd84a";
    ctx.fill();


    // -------------------------------------------------
    // KLEINE KRONE
    // -------------------------------------------------

    const crownY = y - s * 0.92;
    const crownWidth = s * 0.58;
    const crownHeight = s * 0.34;

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
    ctx.lineWidth = s * 0.035;
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
            s * 0.025,
            0,
            Math.PI * 2
        );

        ctx.fill();
    }

    ctx.restore();
        }
        else {

        const settlementSize = zoomedSize * 0.17;
        const offsetY = -zoomedSize * 0.04;

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
        boardZoom *= 1.1;
    } else {
        boardZoom /= 1.1;
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
        t = "Sonderbauphase";
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
                    >
                        ${resource}
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
                    >
                        ${resource}
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
    const mep = (s.players || []).find(p => p.name === me);

    if (!mep) return;

    const myTurn = mep.id === s.currentPlayer;
    const inSetup = s.setupPhase === true;

    const buildRoundButton = $("buildRoundBtn");

if (buildRoundButton) {
    if (s.buildPhase) {
        // Wir sind gerade in der Sonderbauphase

        const raised =
            s.raisedHands?.[String(player_index)] === true;

        buildRoundButton.textContent = "Fertig";

        // Nur Spieler, die Baurunde gewählt haben,
        // dürfen FERTIG drücken.
        buildRoundButton.disabled = !raised || inSetup;

    } else {
        // Normale Spielphase
        const raised =
            s.raisedHands?.[String(player_index)] === true;

        buildRoundButton.textContent = "Baurunde";
        buildRoundButton.disabled = raised || inSetup;
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
            (!myTurn || !s.würfelMode);
    }


    // SETTLEMENT
    // In der Setup-Phase kostenlos
    if (buttons.buildSettlement) {
        buttons.buildSettlement.disabled =
            (!(darfBauenBaurunde && !inSetup) || !hasSettlementResources)&&
            (!myTurn || discarding|| mustRoll ||
            (!(inSetup &&s.setUpSettlement) && !hasSettlementResources));
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
            (!(darfBauenBaurunde && !inSetup) || !hasRoadResources) &&
            (!myTurn || discarding|| mustRoll||
            (!hasRoadResources && !canBuildFreeRoad));
    }


    // CITY gibt es in der Setup-Phase nicht
    if (buttons.buildCity) {
        buttons.buildCity.disabled =
            (!(darfBauenBaurunde && !inSetup)|| !hasCityResources) &&
            (!myTurn ||
            inSetup || discarding|| mustRoll ||
            !hasCityResources);
    }


    // Entwicklungskarte gibt es in der Setup-Phase nicht
    if (buttons.buyDevelopmentCard) {
        buttons.buyDevelopmentCard.disabled =
            (!(darfBauenBaurunde && !inSetup) || !hasDevelopmentResources) &&
            (!myTurn ||
            inSetup || discarding|| mustRoll||
            !hasDevelopmentResources);
    }

   const tradeButton = document.getElementById("tradeButton");

if (tradeButton) {
    tradeButton.disabled = !myTurn || mustFinishAction(s);
} 

    // Zug beenden
    if (buttons.endTurn) {
        buttons.endTurn.disabled =
            !myTurn || discarding|| s.buildPhase||
            mustFinishAction(s);
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
    const outwardX = mx - boardCenter.x;
    const outwardY = my - boardCenter.y;

    if (nx * outwardX + ny * outwardY < 0) {
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
    ctx.font =
        `bold ${Math.max(18, size * 0.32)}px Georgia`;

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
    ctx.font =
        `bold ${Math.max(16, size * 0.39)}px Georgia`;

    ctx.fillText(
        `${harbor.ratio}:1`,
        0,
        size*0.4
    );

    ctx.restore();
}
// =========================================================
// ALLE HÄFEN ZEICHNEN
// =========================================================

function drawHarbors(ctx, boardState, pos, size, boardCenter) {

    if (!boardState || !boardState.harbors) {
        return;
    }

    const vertices = boardState.vertices || [];


    for (const harbor of boardState.harbors) {

        const vertex1 = vertices.find(
            v => v.id === harbor.vertex1
        );

        const vertex2 = vertices.find(
            v => v.id === harbor.vertex2
        );


        if (!vertex1 || !vertex2) {
            continue;
        }


        const p1 = vertexPoint(vertex1, boardState, pos);
        const p2 = vertexPoint(vertex2, boardState, pos);


        if (!p1 || !p2) {
            continue;
        }


        drawHarbor(
            ctx,
            harbor,
            p1,
            p2,
            boardCenter,
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
    const options = document.getElementById("goldResourceOptions");

    const resources = [
        "HOLZ",
        "LEHM",
        "SCHAF",
        "WEIZEN",
        "ERZ"
    ];

    options.innerHTML = resources
        .map(resource => `
            <div
                class="resource-box gold-choice"
                style="background:${RESOURCE_COLORS[resource] || "#888"}"
                title="${resource}"
                onclick="chooseGoldResource('${resource}')"
            >
            </div>
        `)
        .join("");

    document
        .getElementById("goldResourceModal")
        .classList.remove("hidden");
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
connect();
