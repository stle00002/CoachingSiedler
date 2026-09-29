const TILE_IMAGES = {
  HOLZ: new Image(),
  LEHM: new Image(),
  SCHAF: new Image(),
  WEIZEN: new Image(),
  ERZ: new Image(),
  WÜSTE: new Image(),
  WASSER: new Image(),
};
const RESOURCE_COLORS = {
    HOLZ: "#4f9b51",
    LEHM: "#c66d4b",
    SCHAF: "#79bb5a",
    WEIZEN: "#dfbf55",
    ERZ: "#8e9294"
};

let tradeOpen = false;

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

TILE_IMAGES.HOLZ.src = "images/forestBright.png";
TILE_IMAGES.LEHM.src = "images/hillBright.png";
TILE_IMAGES.SCHAF.src = "images/pastureBright.png";
TILE_IMAGES.WEIZEN.src = "images/fieldBright.png";
TILE_IMAGES.ERZ.src = "images/mountain.png";
TILE_IMAGES.WÜSTE.src = "images/desert.png";
TILE_IMAGES.WASSER.src = "images/water.png";

const WS_URL = "wss://especially-ordinary-prague-advertising.trycloudflare.com";
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
  if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type, ...extra }));
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
    renderLobby(m.players);

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
    send("declineTrade", {
        playerName: me
    });

    $("tradeOffer").classList.add("hidden");
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
function renderLobby(players) {
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
        tradeOffer.classList.add("hidden");
        return;
    }

    console.log("TRADE ELEMENT:", tradeOffer);
    console.log("PARENT:", tradeOffer.parentElement);

    $("tradeTitle").textContent = "HANDELSANGEBOT";

    $("tradeOfferResources").innerHTML =
        `<div class="trade-resources">
            ${Object.entries(trade.offer || {})
                .filter(([_, amount]) => amount > 0)
                .map(([resource, amount]) => resourceBox(resource, amount))
                .join("")}
        </div>`;

    $("tradeRequestResources").innerHTML =
        `<div class="trade-resources">
            ${Object.entries(trade.request || {})
                .filter(([_, amount]) => amount > 0)
                .map(([resource, amount]) => resourceBox(resource, amount))
                .join("")}
        </div>`;

    tradeOffer.classList.remove("hidden");

    console.log("HANDELSFENSTER SICHTBAR");
    console.log("POSITION:", getComputedStyle(tradeOffer).position);
    console.log("DISPLAY:", getComputedStyle(tradeOffer).display);
    console.log("RECT:", tradeOffer.getBoundingClientRect());
}function acceptPlayerTrade() {
  send("acceptTrade", {
    playerName: me
  });

  closeModal();
}
function declinePlayerTrade() {
  send("declineTrade", {
    playerName: me
  });

  closeModal();
}
function renderState(s) {
  lastState = s;
  console.log("PLAYER TRADE:", s.playerTrade);
  if (s.playerTrade) {
    renderPlayerTrade(s.playerTrade);
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
        ${esc(p.name)}
        ${isCurrent(p) ? ' <span class="turn-arrow">←</span>' : ''}
      </b>
      <br>
      <span>${p.victoryPoints || 0} VP</span>
      · Ritter ${p.knights || 0}
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
  const size = Math.min(W / (radius * 3.1 + 2), H / (radius * 2.8 + 2), 70);
  const center = { x: W * 0.5, y: H * 0.5 };
  const pos = (q, r) => ({
    x: center.x + size * (Math.sqrt(3) * q + (Math.sqrt(3) / 2) * r),
    y: center.y + size * 1.5 * r,
  });
  for (const t of tiles) {
  const p = pos(+t.q, +t.r);

  const resource = String(t.resource || "").toUpperCase();
  const img = TILE_IMAGES[resource];

  if (img && img.complete && img.naturalWidth > 0) {
    if (resource.includes("WASSER")) {
  ctx.drawImage(
    img,
    p.x - size * 1.1,
    p.y - size * 1.1,
    size * 2.2,
    size * 2.2
  );
} else {
  ctx.drawImage(
    img,
    p.x - size*0.9,
    p.y - size,
    size * 1.8,
    size * 2
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

  // Zahl
  ctx.fillStyle = "#f2dfbb";
  ctx.beginPath();
  ctx.arc(p.x, p.y, 20, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle =
    t.number === 6 || t.number === 8
      ? "#c33"
      : "#222";

  ctx.font = "bold 18px Georgia";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(t.number ?? "", p.x, p.y);

  if (t.hasRobber) {
    ctx.fillStyle = "#222";

    ctx.beginPath();
    ctx.arc(
        p.x,
        p.y - size * 0.35,
        size * 0.22,
        0,
        Math.PI * 2
    );
    ctx.fill();

    ctx.fillStyle = "#111";
    ctx.fillRect(
        p.x - size * 0.12,
        p.y - size * 0.15,
        size * 0.24,
        size * 0.5
    );
}
}
const edges = b.edges || [];
for (const e of edges) {
  const a = vertexPos(e.vertex1, e, b, pos),
    z = vertexPos(e.vertex2, e, b, pos);

  if (!a || !z) continue;

  const owner = getPlayerById(e.owner);

  ctx.strokeStyle = owner
    ? colorCss(owner.color)
    : "#8b704e";

  ctx.lineWidth = owner ? 9 : 3;

  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(z.x, z.y);
  ctx.stroke();
}
const vs = b.vertices || [];

for (const v of vs) {
  const p = vertexPoint(v, b, pos);
  if (!p) continue;

  const owner = getPlayerById(v.owner);

  if (owner) {
    ctx.fillStyle = colorCss(owner.color);

    if (v.isCity) {
      ctx.beginPath();
      ctx.rect(p.x - 10, p.y - 10, 20, 20);
      ctx.fill();

      ctx.fillStyle = "#fff";
      ctx.fillRect(p.x - 5, p.y - 7, 10, 5);

    } else {
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - 12);
      ctx.lineTo(p.x + 12, p.y + 10);
      ctx.lineTo(p.x - 12, p.y + 10);
      ctx.closePath();
      ctx.fill();
    }

  } else if (mode === "settlement") {
    ctx.fillStyle = "#6ff";

    ctx.beginPath();
    ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
    ctx.fill();
  }
}
}
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

  if (a === "endTurn") {
    send("endTurn", { playerName: me });
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
$("board").addEventListener("click", (ev) => {
    if (!lastState) return;

    const c = $("board");
    const rect = c.getBoundingClientRect();

    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;

    const b = getBoard(lastState);
    const verts = b.vertices || [];
    const edges = b.edges || [];

    // ==========================================
    // 1. RÄUBER BEWEGEN
    // ==========================================

    if (lastState.moveRobberMode) {
        const tile = findTile(b.tiles || [], b, x, y, rect);

        if (tile) {
            send("moveRobber", {
                playerName: me,
                tileId: tile.id
            });
        }

        return;
    }

    // ==========================================
    // 2. SPIELER FÜR RÄUBER AUSWÄHLEN
    // ==========================================

    if (lastState.stealMode) {
        const vertex = findVertex(verts, b, x, y, rect);

        if (!vertex) return;

        // Nur Siedlungen/Städte auf dem angeklickten
        // Vertex berücksichtigen
        if (vertex.owner === null || vertex.owner === undefined) {
            return;
        }

        const victim = (lastState.players || [])
            .find((p) => p.id === vertex.owner);

        if (!victim) return;

        // Man darf nicht sich selbst bestehlen
        if (victim.name === me) {
            return;
        }

        // Prüfen, ob der Spieler überhaupt Ressourcen besitzt
        const resources = victim.resources || {};
        const totalResources = Object.values(resources)
            .reduce((sum, amount) => sum + (amount || 0), 0);

        if (totalResources <= 0) {
            return;
        }

        send("steal", {
            playerName: victim.name
        });

        return;
    }

    // ==========================================
    // 3. NORMALE BAUAKTIONEN
    // ==========================================

    if (!mode) return;

    const p = findVertex(verts, b, x, y, rect);
    const e = findEdge(edges, b, x, y, rect);

    if (mode === "settlement" && p) {
        send("buildSettlement", {
            playerName: me,
            vertexId: p.id
        });
    }

    if (mode === "city" && p) {
        send("buildCity", {
            playerName: me,
            vertexId: p.id
        });
    }

    if (mode === "road" && e) {
        send("buildRoad", {
            playerName: me,
            edgeId: e.id
        });
    }

    mode = null;
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
  const size = Math.min(
    r.width / (radius * 3.1 + 2),
    r.height / (radius * 2.8 + 2),
    70,
  );
  const pos = (q, rr) => ({
    x: r.width * 0.5 + size * (Math.sqrt(3) * q + (Math.sqrt(3) / 2) * rr),
    y: r.height * 0.5 + size * 1.5 * rr,
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
  if (s.moveRobberMode) {
    t = "Klicke auf ein Feld, um den Räuber zu bewegen";
}
else if (s.stealMode) {
    t = "Klicke auf eine gegnerische Siedlung, um zu stehlen";
}
else if (s.discardResourcesMode) {
    t = "Du musst Ressourcen abwerfen";
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
            type: "RITTER",
            res1: null,
            res2: null
        });

        return;
    }

    // ==========================================
    // SIEGPUNKT
    // ==========================================

    if (type === "1SIEGPUNKT") {
        send("playDevelopmentCard", {
            type: "1SIEGPUNKT",
            res1: null,
            res2: null
        });

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
                    type: "MONOPOL",
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
        type: "STRAßENBAU",
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
                    type: "ERFINDUNG",
                    res1: firstResource,
                    res2: secondResource
                });
            });
        });
}
connect();
