const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");


// ============================================================
// Einstellungen aus deinem Pygame-Spiel
// ============================================================

const WIDTH = 1540;
const HEIGHT = 900;

const HEX_SIZE = 50;


// ============================================================
// Farben aus deinem Pygame-Spiel
// ============================================================

const COLORS = {
    forest: "#378741",
    hills: "#d2693c",
    pasture: "#41ff23",
    fields: "#ffca28",
    mountains: "#969696",
    desert: "#e0c878",
    water: "#1976d2"
};


// ============================================================
// Dein Pygame axial_to_pixel()
// ============================================================

function axialToPixel(q, r) {

    const x =
        HEX_SIZE *
        (Math.sqrt(3) * q + Math.sqrt(3) / 2 * r);

    const y =
        HEX_SIZE *
        (3 / 2 * r);

    return {
        x: x + WIDTH / 2,
        y: y + HEIGHT / 2
    };
}


// ============================================================
// Dein Pygame hex_corners()
// ============================================================

function hexCorners(centerX, centerY, size) {

    const corners = [];

    for (let i = 0; i < 6; i++) {

        const angleDeg = 60 * i - 30;
        const angleRad = angleDeg * Math.PI / 180;

        corners.push({
            x: centerX + size * Math.cos(angleRad),
            y: centerY + size * Math.sin(angleRad)
        });
    }

    return corners;
}


// ============================================================
// Hexagon zeichnen
// ============================================================

function drawHex(q, r, color) {

    const position = axialToPixel(q, r);

    const corners =
        hexCorners(
            position.x,
            position.y,
            HEX_SIZE
        );

    ctx.beginPath();

    ctx.moveTo(
        corners[0].x,
        corners[0].y
    );

    for (let i = 1; i < corners.length; i++) {

        ctx.lineTo(
            corners[i].x,
            corners[i].y
        );
    }

    ctx.closePath();

    ctx.fillStyle = color;
    ctx.fill();

    ctx.lineWidth = 3;
    ctx.strokeStyle = "#000000";
    ctx.stroke();
}


// ============================================================
// Beispiel-Catan-Karte
//
// Diese Daten werden später NICHT mehr hier stehen.
// Sie kommen dann vom Python-Server.
// ============================================================

const tiles = [

    // obere Reihe
    { q: 0,  r: -2, type: "forest",    number: 11 },
    { q: 1,  r: -2, type: "hills",     number: 4 },
    { q: 2,  r: -2, type: "pasture",   number: 8 },

    // zweite Reihe
    { q: -1, r: -1, type: "fields",    number: 5 },
    { q: 0,  r: -1, type: "forest",    number: 10 },
    { q: 1,  r: -1, type: "mountains", number: 6 },
    { q: 2,  r: -1, type: "fields",    number: 9 },

    // mittlere Reihe
    { q: -2, r: 0, type: "pasture",    number: 3 },
    { q: -1, r: 0, type: "fields",     number: 11 },
    { q: 0,  r: 0, type: "desert",     number: null },
    { q: 1,  r: 0, type: "forest",     number: 8 },
    { q: 2,  r: 0, type: "hills",      number: 5 },

    // vierte Reihe
    { q: -2, r: 1, type: "forest",     number: 10 },
    { q: -1, r: 1, type: "pasture",    number: 6 },
    { q: 0,  r: 1, type: "mountains",  number: 4 },
    { q: 1,  r: 1, type: "fields",     number: 3 },

    // untere Reihe
    { q: -2, r: 2, type: "hills",      number: 9 },
    { q: -1, r: 2, type: "pasture",    number: 12 },
    { q: 0,  r: 2, type: "forest",     number: 2 }
];


// ============================================================
// Zahl zeichnen
// ============================================================

function drawNumber(x, y, number) {

    if (number === null) {
        return;
    }

    // Genau wie bei deinem Pygame:
    // 8 und 6 werden rot dargestellt.

    let textColor = "#000000";

    if (number === 6 || number === 8) {
        textColor = "#c80000";
    }

    let fontSize = 15;

    if (number === 3 || number === 11) {
        fontSize = 20;
    }

    if (number === 4 || number === 10) {
        fontSize = 25;
    }

    if (
        number === 5 ||
        number === 9 ||
        number === 6 ||
        number === 8
    ) {
        fontSize = 30;
    }

    ctx.beginPath();

    ctx.arc(
        x,
        y,
        15,
        0,
        Math.PI * 2
    );

    ctx.fillStyle = "#ffffff";
    ctx.fill();

    ctx.lineWidth = 2;
    ctx.strokeStyle = "#000000";
    ctx.stroke();

    ctx.fillStyle = textColor;

    ctx.font =
        `bold ${fontSize}px Arial`;

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.fillText(
        number,
        x,
        y
    );
}


// ============================================================
// Spielfeld zeichnen
// ============================================================

function drawBoard() {

    // Hintergrund
    ctx.fillStyle = "#1e1e1e";

    ctx.fillRect(
        0,
        0,
        WIDTH,
        HEIGHT
    );


    // Terrains
    for (const tile of tiles) {

        const position =
            axialToPixel(
                tile.q,
                tile.r
            );

        drawHex(
            tile.q,
            tile.r,
            COLORS[tile.type]
        );

        drawNumber(
            position.x,
            position.y,
            tile.number
        );
    }
}


// ============================================================
// Test
// ============================================================

console.log("Siedler Web-Client gestartet");

drawBoard();