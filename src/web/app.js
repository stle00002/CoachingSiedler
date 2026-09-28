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

TILE_IMAGES.HOLZ.src = "images/forestBright.png";
TILE_IMAGES.LEHM.src = "images/hillBright.png";
TILE_IMAGES.SCHAF.src = "images/pastureBright.png";
TILE_IMAGES.WEIZEN.src = "images/fieldBright.png";
TILE_IMAGES.ERZ.src = "images/mountain.png";
TILE_IMAGES.WÜSTE.src = "images/desert.png";
TILE_IMAGES.WASSER.src = "images/water.png";

const WS_URL =
  (location.protocol === "https:" ? "wss://" : "ws://") +
  (location.hostname || "localhost") +
  ":8765";
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
$("bankTrade").onclick = bankTrade;
$("playerTrade").onclick = playerTrade;
function normalize(s) {
  return s || {};
}
function resourceBox(resource, amount) {
    const color = RESOURCE_COLORS[resource] || "#888";

    return `
        <div
            class="resource-box"
            style="background:${color}"
            title="${resource}"
        >
            ${amount > 1 ? amount : ""}
        </div>
    `;
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
        (r) =>
          `<div class="res">${r}<b style="float:right">${mep.resources?.[r] || 0}</b></div>`,
      ).join("") +
      "</div>";
    $("devCards").innerHTML = Object.entries(mep.developmentCards || {})
      .map(
        ([k, v]) => `<div class="cardline"><span>${k}</span><b>${v}</b></div>`,
      )
      .join("");
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
$("board").addEventListener("click", (ev) => {
  if (!lastState || !mode) return;
  const c = $("board"),
    rect = c.getBoundingClientRect(),
    x = ev.clientX - rect.left,
    y = ev.clientY - rect.top;
  const b = getBoard(lastState),
    verts = b.vertices || [],
    edges = b.edges || [];
  const p = findVertex(verts, b, x, y, rect),
    e = findEdge(edges, b, x, y, rect);
  if (mode === "settlement" && p)
    send("buildSettlement", { playerName: me, vertexId: p.id });
  if (mode === "city" && p)
    send("buildCity", { playerName: me, vertexId: p.id });
  if (mode === "road" && e) send("buildRoad", { playerName: me, edgeId: e.id });
  if (lastState.moveRobberMode) {
    const t = findTile(b.tiles || [], b, x, y, rect);
    if (t) send("moveRobber", { playerName: me, tileId: t.id });
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
  if (s.moveRobberMode) t = "Klicke auf ein Feld, um den Räuber zu bewegen";
  else if (s.discardResourcesMode) t = "Du musst Ressourcen abwerfen";
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
connect();
