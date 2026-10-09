import asyncio
import json
import random
import websockets

from bot import Bot
from player import Player
from logic import Logic
import os
import re
from pathlib import Path

HOST = "0.0.0.0"  # alle Interfaces
PORT = 5555



MAPS_DIR = Path(__file__).resolve().parent / "maps"
MAPS_DIR.mkdir(exist_ok=True)

selected_map_name = None

logic = Logic()


clients = set()
client_players = {}
players = []
bots = []
game_state = "lobby"
client_ready = {}
loading = False
# -------------------------
# Hilfsfunktionen für TCP
# -------------------------




def get_map_path(name):
    """Erzeugt einen sicheren Dateinamen für eine Karte."""
    if not isinstance(name, str):
        return None

    name = name.strip()

    if not name or len(name) > 60:
        return None

    if not re.fullmatch(r"[\w äöüÄÖÜß-]+", name):
        return None

    return MAPS_DIR / f"{name}.json"


def save_custom_map(name, tiles):
    """Speichert eine eigene Karte als JSON-Datei."""
    path = get_map_path(name)

    if path is None:
        return False, "Ungültiger Kartenname."

    if not isinstance(tiles, list) or not tiles:
        return False, "Die Karte enthält keine Landfelder."

    valid_resources = {
        "HOLZ", "LEHM", "SCHAF", "WEIZEN", "ERZ",
        "GOLD", "WÜSTE"
    }

    cleaned_tiles = []
    seen_positions = set()

    for tile in tiles:
        if not isinstance(tile, dict):
            return False, "Ungültiges Landfeld."

        q = tile.get("q")
        r = tile.get("r")
        resource = tile.get("resource")

        if type(q) is not int or type(r) is not int:
            return False, "Ungültige Hex-Koordinaten."

        if abs(q) > 50 or abs(r) > 50:
            return False, "Die Karte ist zu groß."

        # None bedeutet: zufälliges/unbekanntes Feld
        if resource is not None and resource not in valid_resources:
            return False, f"Ungültige Ressource: {resource}"

        position = (q, r)

        if position in seen_positions:
            return False, "Zwei Landfelder haben dieselben Koordinaten."

        seen_positions.add(position)

        cleaned_tiles.append({
            "q": q,
            "r": r,
            "resource": resource
        })

    data = {
        "name": name.strip(),
        "tiles": cleaned_tiles
    }

    try:
        with path.open("w", encoding="utf-8") as file:
            json.dump(data, file, ensure_ascii=False, indent=4)

        return True, "Karte gespeichert."

    except OSError as error:
        print("Fehler beim Speichern der Karte:", error)
        return False, "Die Karte konnte nicht gespeichert werden."


def load_custom_map(name):
    """Lädt eine gespeicherte Karte."""
    path = get_map_path(name)

    if path is None or not path.is_file():
        return None

    try:
        with path.open("r", encoding="utf-8") as file:
            data = json.load(file)

        if data.get("name") != name or not isinstance(data.get("tiles"), list):
            return None

        return data

    except (OSError, json.JSONDecodeError):
        return None


def get_saved_maps():
    """Gibt die Namen aller gespeicherten Karten zurück."""
    result = []

    for path in MAPS_DIR.glob("*.json"):
        try:
            with path.open("r", encoding="utf-8") as file:
                data = json.load(file)

            name = data.get("name")

            if isinstance(name, str) and get_map_path(name) == path:
                result.append(name)

        except (OSError, json.JSONDecodeError):
            continue

    return sorted(set(result), key=str.casefold)


def get_saved_map_previews():
    maps = []

    for path in MAPS_DIR.glob("*.json"):
        custom_map = load_custom_map(path.stem)

        if custom_map is not None:
            maps.append({
                "name": custom_map["name"],
                "tiles": custom_map["tiles"]
            })

    return sorted(maps, key=lambda m: m["name"].lower())

# makes the logic class into a json
def getState(obj):
    self = obj
    # =========================================================
    # PLAYERS
    # =========================================================

    players_state = []

    for player_id, player in enumerate(self.players):

        countResources = player.resources.get("HOLZ", 0)+player.resources.get("LEHM", 0) +player.resources.get("SCHAF", 0) +player.resources.get("WEIZEN", 0) + player.resources.get("ERZ", 0)
        countDevelopmentCards = player.developmentCards.get("RITTER", 0) + player.developmentCards.get("1SIEGPUNKT", 0) + player.developmentCards.get("MONOPOL", 0)+ player.developmentCards.get("ERFINDUNG", 0)+player.developmentCards.get("STRAßENBAU", 0)
        
        player_state = {
            "id": player_id,

            "name": player.name,
            "color": player.color,
            "isHost": player.is_host,

            # -------------------------
            # Ressourcen
            # -------------------------

            "resources": {
                "HOLZ": player.resources.get("HOLZ", 0),
                "LEHM": player.resources.get("LEHM", 0),
                "SCHAF": player.resources.get("SCHAF", 0),
                "WEIZEN": player.resources.get("WEIZEN", 0),
                "ERZ": player.resources.get("ERZ", 0)
            },

            "goldChoices": logic.goldChoices.get(player, 0),

            "countResources": countResources,
            # -------------------------
            # Entwicklungskarten
            # -------------------------

            "developmentCards": {
                "RITTER": player.developmentCards.get("RITTER", 0),
                "1SIEGPUNKT": player.developmentCards.get("1SIEGPUNKT", 0),
                "MONOPOL": player.developmentCards.get("MONOPOL", 0),
                "ERFINDUNG": player.developmentCards.get("ERFINDUNG", 0),
                "STRAßENBAU": player.developmentCards.get("STRAßENBAU", 0)
            },

            "countDevelopmentCards": countDevelopmentCards,
            # -------------------------
            # Punkte
            # -------------------------

            "victoryPoints": player.victoryPoints,
            "secretVictoryPoints": player.secretVictoryPoints,

            # -------------------------
            # Ritter
            # -------------------------

            "knights": player.knights,

            # -------------------------
            # Sonstiges
            # -------------------------

            "hasToDiscard": player.hasToDiscard,

            # Anzahl der Straßen/Siedlungen/Städte
            # Die eigentlichen Objekte werden unten über
            # ihre IDs gespeichert.

            "roads": [
                edge.id
                for edge in player.roads
            ],

            "settlements": [
                vertex.id
                for vertex in player.settlements
            ],

            "cities": [
                vertex.id
                for vertex in player.cities
            ]
        }

        players_state.append(player_state)


    # =========================================================
    # BOARD
    # =========================================================

    board_state = None

    if self.board is not None:

        # -----------------------------------------------------
        # TILES
        # -----------------------------------------------------

        tiles_state = []

        for tile in self.board.tiles:

            tile_state = {
                "id": tile.id,

                # Hex-Koordinaten
                "q": tile.q,
                "r": tile.r,

                # Resource als String statt Enum
                "resource": (
                    tile.resource.name
                    if tile.resource is not None
                    else None
                ),

                "number": tile.number,

                # Ist hier der Räuber?
                "hasRobber": tile == self.robberTile,

                # IDs der angrenzenden Vertices
                "vertices": [
                    vertex.id
                    for vertex in tile.vertices
                ],

                # IDs der angrenzenden Edges
                "edges": [
                    edge.id
                    for edge in tile.edges
                ]
            }

            tiles_state.append(tile_state)


        # -----------------------------------------------------
        # VERTICES
        # -----------------------------------------------------

        vertices_state = []

        for vertex in self.board.vertices:

            owner_id = None

            if vertex.owner is not None:
                try:
                    owner_id = self.players.index(vertex.owner)
                except ValueError:
                    # Owner existiert nicht in self.players
                    owner_id = None

            vertex_state = {
                "id": vertex.id,

                # Spieler-ID statt Player-Objekt
                "owner": owner_id,

                # false = Siedlung
                # true  = Stadt
                "isCity": vertex.isCity,

                # Welche Tiles grenzen an?
                "adjacentTiles": [
                    tile.id
                    for tile in vertex.adjacentTiles
                    if tile is not None
                ],

                # Benachbarte Vertices
                "neighbourVertices": [
                    neighbour.id
                    for neighbour in vertex.neighbourVertices
                ],

                # Angeschlossene Straßen
                "connectedEdges": [
                    edge.id
                    for edge in vertex.connectedEdges
                ]
            }

            vertices_state.append(vertex_state)


        # -----------------------------------------------------
        # EDGES / ROADS
        # -----------------------------------------------------

        edges_state = []

        for edge in self.board.edges:

            owner_id = None

            if edge.owner is not None:
                try:
                    owner_id = self.players.index(edge.owner)
                except ValueError:
                    # Owner existiert nicht in self.players
                    owner_id = None

            edge_state = {
                "id": edge.id,

                # Spieler-ID statt Player-Objekt
                "owner": owner_id,

                # Die beiden Endpunkte der Straße
                "vertex1": (
                    edge.vertex1.id
                    if edge.vertex1 is not None
                    else None
                ),

                "vertex2": (
                    edge.vertex2.id
                    if edge.vertex2 is not None
                    else None
                ),

                # Welche Tiles grenzen an diese Edge?
                "adjacentTiles": [
                    tile.id
                    for tile in edge.adjacentTiles
                    if tile is not None
                ]
            }

            edges_state.append(edge_state)


        # -----------------------------------------------------
        # HARBORS
        # -----------------------------------------------------

        harbors_state = []

        for harbor in self.board.harbors:

            harbor_state = {
                # Falls Harbor eine eigene ID hat, kannst du hier
                # harbor.id verwenden.
                #
                # Da wir deine Harbor-Klasse noch nicht gesehen
                # haben, benutze ich zunächst keinen ID-Wert.

                "resource": (
                    harbor.resource.name
                    if harbor.resource is not None
                    else None
                ),

                "ratio": harbor.ratio,

                "vertex1": (
                    harbor.vertex1.id
                    if harbor.vertex1 is not None
                    else None
                ),

                "vertex2": (
                    harbor.vertex2.id
                    if harbor.vertex2 is not None
                    else None
                ),

                # Die Position des Hafens kennst du aus deinem
                # Harbor-Konstruktor:
                #
                # Harbor(x, y, vertex1, vertex2, resource, ratio)
                #
                # Falls diese Werte bei Harbor als x/y gespeichert
                # werden, kannst du das aktivieren:
                #
                # "x": harbor.x,
                # "y": harbor.y
            }

            harbors_state.append(harbor_state)


        # -----------------------------------------------------
        # BOARD STATE
        # -----------------------------------------------------

        board_state = {

            "radius": self.board.radius,

            "secondSetupPhase": self.board.secondSetupPhase,

            "currentLongestRoad": self.board.currentLongestRoad,

            "currentPlayerWithLongestRoad": (
                self.players.index(
                    self.board.currentPlayerWithLongestRoad
                )
                if self.board.currentPlayerWithLongestRoad in self.players
                else None
            ),

            "currentId": self.board.currentId,

            # Anzahl verbleibender Entwicklungskarten
            "developmentDeckSize": len(
                self.board.development_deck
            ),

            "tiles": tiles_state,
            "vertices": vertices_state,
            "edges": edges_state,
            "harbors": harbors_state
        }


    # =========================================================
    # CURRENT PLAYER
    # =========================================================

    current_player_id = None

    if self.current_player is not None:

        try:
            current_player_id = self.players.index(
                self.current_player
            )
        except ValueError:
            current_player_id = None


    # =========================================================
    # SETUP ORDER
    # =========================================================

    setup_order = []

    for player in self.setUpOrder:

        try:
            setup_order.append(
                self.players.index(player)
            )
        except ValueError:
            # Sollte eigentlich nicht vorkommen
            pass


    # =========================================================
    # RAISED HANDS
    # =========================================================

    raised_hands = {}

    for player, value in self.raisedHands.items():

        try:
            player_id = self.players.index(player)

            # JSON object keys müssen Strings sein
            raised_hands[str(player_id)] = value

        except ValueError:
            pass


    # =========================================================
    # PLAYER TRADE
    # =========================================================

    player_trade_state = None

    if self.playerTrade is not None:

        offer, request, id, tradingPlayer = self.playerTrade

        player_trade_state = {
            "offer": offer,
            "request": request,
            "tradeId": id,
            "tradingPlayer": tradingPlayer.name
        }


    # =========================================================
    # PLAYERS WHO DECLINED
    # =========================================================

    players_declined = []

    for player in self.playersDeclined:

        try:
            players_declined.append(
                self.players.index(player)
            )
        except ValueError:
            pass


    # =========================================================
    # PLAYER WITH MOST KNIGHTS
    # =========================================================

    most_knights_player = None
    most_knights_count = 0

    if self.currentPlayerWithMostKnights is not None:

        player, count = self.currentPlayerWithMostKnights

        try:
            most_knights_player = self.players.index(player)
            most_knights_count = count
        except ValueError:
            pass


    # =========================================================
    # COMPLETE GAME STATE
    # =========================================================

    state = {

        # -----------------------------------------------------
        # PLAYERS
        # -----------------------------------------------------

        "players": players_state,
        "playerCount": self.player_count,

        # -----------------------------------------------------
        # BOARD
        # -----------------------------------------------------

        "board": board_state,

        # -----------------------------------------------------
        # TURN
        # -----------------------------------------------------

        "currentPlayer": current_player_id,
        "currentPlayerName": logic.current_player.name,

        "currentPlayerIndex": self.current_player_index,

        # -----------------------------------------------------
        # GAME STATUS
        # -----------------------------------------------------

        "setupPhase": self.setupPhase,
        "isNotFinished": self.isNotFinished,
        "finished": self.finished,

        # -----------------------------------------------------
        # MODES
        # -----------------------------------------------------

        "moveRobberMode": self.moveRobberMode,
        "discardResourcesMode": self.discardResourcesMode,
        "stealMode": self.stealMode,

        "login": self.login,

        "setUpSettlement": self.setUpSettlement,
        "setUpRoad": self.setUpRoad,

        "buildPhase": self.buildPhase,
        "würfelMode": self.würfelMode,

        # -----------------------------------------------------
        # SETUP
        # -----------------------------------------------------

        "setUpOrder": setup_order,

        # -----------------------------------------------------
        # DICE
        # -----------------------------------------------------

        "dice": self.dice,

        "dices": self.dices,

        # -----------------------------------------------------
        # DEVELOPMENT CARDS
        # -----------------------------------------------------

        "playedCard": self.playedCard,

        "freeRoads": self.freeRoads,

        # -----------------------------------------------------
        # TRADING
        # -----------------------------------------------------

        "playerTrade": player_trade_state,

        "playersDeclined": players_declined,

        # -----------------------------------------------------
        # READY / RAISED HANDS
        # -----------------------------------------------------

        "raisedHands": raised_hands,

        # -----------------------------------------------------
        # KNIGHTS
        # -----------------------------------------------------

        "currentPlayerWithMostKnights": most_knights_player,

        "mostKnightsCount": most_knights_count
    }

    return state

async def send_json(conn, data):
    await conn.send(
        json.dumps(data, ensure_ascii=False)
    )


async def send_state(conn):
    await send_json(conn, {
        "type": "state",
        "state": getState(logic)
    })


# -------------------------
# Client-Handler    
# -------------------------
async def handle_client(websocket):
    print("Client verbunden")

    clients.add(websocket)

    try:
        async for message in websocket:

            print("Nachricht:", message)

            try:
                data = json.loads(message)
            except json.JSONDecodeError:
                print("Ungültiges JSON")
                continue

            await handle_message(websocket, data)

    except websockets.exceptions.ConnectionClosed:
        print("Client getrennt")

    finally:
        clients.discard(websocket)

        if websocket in client_players:
            player = client_players[websocket]

            print("Player offline:", player.name)

            del client_players[websocket]

        if websocket in client_ready:
            del client_ready[websocket]

# -------------------------
# Nachrichten verarbeiten
# -------------------------
async def handle_message(conn, message):
    if message == None:
        return
    print("Nachricht:", message)
    action = message.get("type") or message.get("action")

    global selected_map_name

    if action == "custom_map":
        # Eigene Karten nur in der Lobby speichern.
        if game_state != "lobby":
            return

        player = client_players.get(conn)

        # Nur der Host darf Karten speichern.
        if player is None:
            await send_json(conn, {
                "type": "error",
                "message": "Nur der Host darf Karten speichern."
            })
            return

        print (message.get("tiles"))
        success, result_message = save_custom_map(
            message.get("name"),
            message.get("tiles")
        )


        if success:
            await broadcast_lobby()
        return

    elif action == "choosemap":
        if game_state != "lobby":
            return

        player = client_players.get(conn)

        # Nur der Host entscheidet, welche Karte gespielt wird.
        if player is None or not player.is_host:
            await send_json(conn, {
                "type": "error",
                "message": "Nur der Host darf die Karte auswählen."
            })
            return

        name = message.get("name")
        custom_map = load_custom_map(name)
        await broadcast_lobby()

        if custom_map is None:
            await send_json(conn, {
                "type": "error",
                "message": "Diese Karte existiert nicht."
            })
            return

        selected_map_name = custom_map["name"]

        # Allen Clients die Auswahl mitteilen.
        for client in list(clients):
            await send_json(client, {
                "type": "map_selected",
                "name": selected_map_name,
                "maps": get_saved_maps()
            })

        print("Ausgewählte Karte:", selected_map_name)
        return

    if action == "join":
        name = message["name"]

        print(f"Join-Anfrage: {name}")

        # =====================================================
        # RECONNECT WÄHREND EINES LAUFENDEN SPIELS
        # =====================================================

        if game_state == "running":

            existing_player = None

            for player in logic.players:
                if player.name == name:
                    existing_player = player
                    break

            if existing_player is not None:

                print(
                    f"Spieler im laufenden Spiel gefunden: "
                    f"{existing_player.name}"
                )

                clients.add(conn)
                client_players[conn] = existing_player

                player_index = logic.players.index(existing_player)

                print(
                    f"Reconnect erfolgreich: "
                    f"{existing_player.name}, "
                    f"Index: {player_index}, "
                    f"Farbe: {existing_player.color}"
                )

                await send_json(conn, {
                    "action": "welcome",
                    "player_index": player_index,
                    "in_game": True
                })

                await send_state(conn)

                return

            await send_json(conn, {
                "type": "error",
                "message": "Spieler nicht im laufenden Spiel gefunden."
            })

            return
    # Während der Würfelphase darf noch keine normale Aktion
    # ausgeführt werden.
    if logic.würfelMode and not logic.setupPhase:
        allowed_actions = {
            "roll_dice",
            "playDevelopmentCard"
        }

        if action not in allowed_actions:
            return
    if logic.discardResourcesMode:
        if action != "discardResource":
            return
    print (logic.goldChoices)
    if logic.goldChoices != {}:
        if action != "chooseGoldResource":
            return
    if action == "join":
        name = message["name"]

        print(f"Join-Anfrage: {name}")

        # =====================================================
        # RECONNECT WÄHREND EINES LAUFENDEN SPIELS
        # =====================================================

        if game_state == "running":

            existing_player = None

            for player in logic.players:
                if player.name == name:
                    existing_player = player
                    break

            if existing_player is not None:

                print(
                    f"Spieler im laufenden Spiel gefunden: "
                    f"{existing_player.name}"
                )

                # Neue WebSocket-Verbindung diesem Spieler zuordnen
                clients.add(conn)
                client_players[conn] = existing_player
                client_ready[conn] = False

                # Position im laufenden Spiel
                player_index = logic.players.index(existing_player)

                print(
                    f"Reconnect erfolgreich: "
                    f"{existing_player.name}, "
                    f"Index: {player_index}, "
                    f"Farbe: {existing_player.color}"
                )

                # Browser informieren
                await send_json(conn, {
                    "action": "welcome",
                    "player_index": player_index,
                    "in_game": True
                })

                # Aktuellen kompletten Spielstand schicken
                await send_state(conn)

                return

            # Falls Spiel läuft, aber dieser Name nicht im Spiel ist
            await send_json(conn, {
                "type": "error",
                "message": "Spieler nicht im laufenden Spiel gefunden."
            })

            return

        # =====================================================
        # NORMALES JOIN IN DER LOBBY
        # =====================================================

        # Prüfen, ob Spieler bereits in der Lobby existiert
        existing_player = None

        for player in players:
            if player.name == name:
                existing_player = player
                break

        if existing_player is not None:

            client_players[conn] = existing_player
            clients.add(conn)

            player_index = players.index(existing_player)

            await send_json(conn, {
                "action": "welcome",
                "player_index": player_index,
                "in_game": False
            })

            await broadcast_lobby()
            return

        # =====================================================
        # NEUER SPIELER
        # =====================================================

        colors = [
            (255, 0, 0),
            (0, 0, 255),
            (0, 255, 0),
            (255, 255, 0),
            (255, 140, 0),
            (148, 0, 211),
            (0, 206, 209),
            (255, 105, 180),
            (0, 0, 0),
            (255, 255, 255)
        ]

        used_colors = [player.color for player in players]

        available_colors = [
            color for color in colors
            if color not in used_colors
        ]

        if available_colors:
            color = available_colors[0]
        else:
            color = colors[len(players) % len(colors)]

        is_host = len(players) == 0

        new_player = Player(
            name,
            color,
            is_host
        )

        players.append(new_player)

        clients.add(conn)
        client_players[conn] = new_player
        client_ready[conn] = False

        print(
            f"Neuer Spieler hinzugefügt: "
            f"{new_player.name}, "
            f"Farbe: {new_player.color}, "
            f"Host: {new_player.is_host}"
        )

        await send_json(conn, {
            "action": "welcome",
            "player_index": len(players) - 1,
            "in_game": False
        })

        await broadcast_lobby()

        return

    elif action == "ready":
        client_ready[conn] = not client_ready.get(conn, False)
        await broadcast_lobby()
        return
    elif action == "addBot":
        colors = [    (255, 0, 0), #Rot
    (0, 0, 255),   # Blau
    (0, 255, 0),    # Grün
    (255, 255, 0),    # Gelb
    (255, 140, 0),    # Orange
    (148, 0, 211),    # Lila
    (0, 206, 209),    # Türkis
    (255, 105, 180),
     (0, 0, 0),
     (255, 255, 255) ]
        notAvailableColors = []
        for color in colors:
            for player in players:
                if player.color == color:
                    notAvailableColors.append(color)
        for color in notAvailableColors:
            colors.remove(color)
        if len(bots) == 0:
            newBot = Bot(f"Nila", colors[(len(players)+ len(bots)) % len(colors)])
        elif len(bots) == 1:
            newBot = Bot(f"Amy", colors[(len(players)+ len(bots)) % len(colors)])
        elif len(bots) == 2:
            newBot = Bot(f"Fiona", colors[(len(players)+ len(bots)) % len(colors)])
        elif len(bots) == 3:
            newBot = Bot(f"Melissa", colors[(len(players)+ len(bots)) % len(colors)])
        elif len(bots) == 4:
            newBot = Bot(f"Basti", colors[(len(players)+ len(bots)) % len(colors)])
        else:
            newBot = Bot(f"Bot{len(bots) + 1}", colors[(len(players)+ len(bots)) % len(colors)])
        bots.append(newBot)
        await broadcast_lobby()
        return
    elif action == "removeBot":
        if not len(bots) == 0:
            bots.pop(len(bots)-1)
        await broadcast_lobby()
        return

    elif action == "change_color":
        color_name = message["color"]

        color_map = {
        "rot": (255, 0, 0),
        "blau": (0, 0, 255),
        "grün": (0, 255, 0),
        "gelb": (255, 255, 0),
        "orange": (255, 140, 0),
        "lila": (148, 0, 211),
        "türkis": (0, 206, 209),
        "pink": (255, 105, 180),
        "schwarz": (0, 0, 0),
        "weiß": (255, 255, 255)
        }

        client_players[conn].color = color_map[color_name]

        await broadcast_lobby()
        return

    elif action == "start_game":
        global loading
        if game_state != "lobby" or loading:
            return
        noDoubleColor = True
        colors = []
        players_and_bots = players + bots
        for p in players_and_bots:
            for c in colors:
                if c == p.color:
                    noDoubleColor = False
            colors.append(p.color)
        if all(client_ready.values()) and len(players) + len(bots) >= 2 and noDoubleColor:
            loading = True
            await broadcast_lobby()
            await start_game()
        return
    
    if action == "roll_dice":
        if logic.würfelMode:
            dice = logic.roll_dice()

    elif action == "buildSettlement":
        name = message["playerName"]
        for p in logic.players:
            if p.name == name:
                player = p
        vertexId = message["vertexId"]
        for v in logic.board.vertices:
            if v.id == vertexId:
                vertex = v

        success = logic.board.buildSettlement(
            player,
            vertex,
            logic.setupPhase
        )
        if logic.setupPhase and success:
            logic.nextStepSetupPhase()

    elif action == "buildRoad":
        name = message["playerName"]
        for p in logic.players:
            if p.name == name:
                player = p
        edgeId = message["edgeId"]
        for e in logic.board.edges:
            if e.id == edgeId:
                edge= e

        success = logic.board.buildRoad(
            player,
            edge,
            logic.setupPhase,
            logic.freeRoads > 0
        )
        if success and logic.freeRoads > 0:
            logic.freeRoads -= 1
        if logic.setupPhase and success:
            logic.nextStepSetupPhase()

    elif action == "buildCity":
        vertexId = message["vertexId"]
        name = message["playerName"]
        for p in logic.players:
            if p.name == name:
                player = p
        for v in logic.board.vertices:
            if v.id == vertexId:
                vertex = v
        logic.board.buildCity(player, vertex)

    elif action == "endTurn":

        # Pflichtaktionen müssen zuerst abgeschlossen werden
        if logic.discardResourcesMode:
            return

        if logic.würfelMode:
            return

        if logic.moveRobberMode:
            return

        if logic.stealMode:
            return

        if logic.freeRoads > 0:
            return
        # Setup-Aktionen nur während der Setup-Phase blockieren
        if logic.setupPhase:
            if logic.setUpSettlement:
                return

            if logic.setUpRoad:
                return

        if len(logic.players) <= 4:
            logic.next_turn()
        else:
            logic.specialBuildPhase()
            logic.checkFinishedSpecialBuildPhase()
            
    elif action == "raiseHand":
        name = message["playerName"]
        for p in logic.players:
            if p.name == name:
                player = p
        logic.raiseHand(player, message["value"])
    elif action == "finishBuild":
        name = message["playerName"]
        for p in logic.players:
            if p.name == name:
                player = p
        logic.raiseHand(player, False)
        logic.checkFinishedSpecialBuildPhase()

    elif action == "tradeWithPlayer":
        name = message["playerName"]
        for p in logic.players:
            if p.name == name:
                player = p
        logic.tradeWithPlayer(player, message["request"], message["offer"])
    elif action == "tradeWithBank":
        logic.tradeWithBank(message["request"], message["offer"])

    elif action == "moveRobber":
        tileId = message["tileId"]
        for t in logic.board.tiles:
            if t.id == tileId:
                tile = t
        if (tile != logic.robberTile):
            logic.robberTile = tile
            for vertex in tile.vertices:
                if vertex.owner != None and vertex.owner != logic.current_player:
                    logic.stealMode = True
            logic.moveRobberMode = False

    elif action == "steal":
        name = message["playerName"]
        for p in logic.players:
            if p.name == name:
                player = p
        if logic.stealMode == True:
            logic.stealFromPlayer(player)
        logic.stealMode = False
    elif action == "playDevelopmentCard":
        card = message["card"]
        logic.playDevelopmentCard(card, message["res1"], message["res2"],logic.current_player)
    elif action == "buyDevelopmentCard":
        name = message["playerName"]
        for p in logic.players:
            if p.name == name:
                player = p
        logic.board.buyDevelopmentCard(player)
    elif action == "discardResource":
        name = message["playerName"]
        for p in logic.players:
            if p.name == name:
                player = p
        if player.resources[message["res"]] > 0:
            player.resources[message["res"]] -= 1
            player.hasToDiscard -= 1
        doneWithDiscarding = True
        for p in logic.players:
            if p.hasToDiscard > 0:
                doneWithDiscarding = False
        if doneWithDiscarding:
            logic.discardResourcesMode = False
            logic.moveRobberMode = True
    elif action == "openPlayerTrade":
        logic.openPlayerTrade(message["offer"], message["request"])
    elif action == "acceptTrade":
        name = message["playerName"]
        for p in logic.players:
            if p.name == name:
                player = p
        try:
            trade_offer, trade_request, id, tradingPlayer = logic.playerTrade
            success = logic.tradeWithPlayer(player, trade_request, trade_offer)
            if success:
                logic.playerTrade = None
                logic.playersDeclined = []
        except:
            return
    elif action == "declineTrade":
        name = message["playerName"]
        for p in logic.players:
            if p.name == name:
                player = p
        if player == logic.current_player:
            logic.playerTrade = None
            logic.playersDeclined = []
            
        else:
            logic.playersDeclined.append(player)
            if len(logic.playersDeclined) >= len(logic.players) -1:
                logic.playerTrade = None
                logic.playersDeclined = []
    elif action == "chooseGoldResource":
        name = message["playerName"]
        for p in logic.players:
            if p.name == name:
                player = p
        logic.chooseGoldResource(player, message["resource"])
    await broadcast_state()


async def start_game():
    global game_state

    # Tatsächlich vorhandene Lobby-Spieler einsammeln.
    # Pro Spieler nur einen Eintrag verwenden.
    connected_players = []

    seen_players = set()

    for conn, player in list(client_players.items()):
        if conn is None:
            continue

        if conn not in clients:
            continue

        if player in seen_players:
            continue

        connected_players.append((conn, player))
        seen_players.add(player)

    all_participants = connected_players + [
        (None, bot) for bot in bots
    ]

    if len(all_participants) < 2:
        print("Spielstart abgebrochen: Zu wenige Spieler.")
        return

    # Tatsächliche Teilnehmerzahl verwenden.
    random.shuffle(all_participants)

    print("Spieler in Lobby:", len(players))
    print("Verbundene Spieler:", len(connected_players))
    print("Bots:", len(bots))
    print("Teilnehmer beim Spielstart:", len(all_participants))

    custom_map = None

    if selected_map_name is not None:
        custom_map = load_custom_map(selected_map_name)

        if custom_map is None:
            print(
                "Ausgewählte Karte konnte nicht geladen werden:",
                selected_map_name
            )
            return

    logic.createBoard(
        len(all_participants),
        custom_map
    )

    shuffled_players = []

    for i, (conn, player) in enumerate(all_participants):
        if conn is not None:
            try:
                await send_json(conn, {
                    "action": "welcome",
                    "player_index": i,
                    "in_game": True
                })
            except websockets.exceptions.ConnectionClosed:
                print(f"Spieler {player.name} beim Start getrennt.")

        shuffled_players.append(player)

    logic.players = shuffled_players

    game_state = "running"

    logic.start()
    logic.startSetupPhase()

    await broadcast_state()



async def broadcast_lobby():
    lobby_data = []

    for conn, player in client_players.items():
        lobby_data.append({
            "name": player.name,
            "ready": client_ready.get(conn, False),
            "color": player.color
        })
    for bot in bots:
        lobby_data.append({
            "name": bot.name,
            "ready": True,
            "color": bot.color
        })
    for client in clients:
        print (get_saved_map_previews())
        await send_json(client, {
    "action": "lobby_update",
    "players": lobby_data,
    "maps": get_saved_map_previews(),
    "selected_map": selected_map_name,
    "loading": loading
})
# -------------------------
# Spielstand an alle senden
# -------------------------
async def broadcast_state():
    dead_clients = []

    for client in clients:
        try:
            await send_state(client)
        except Exception:
            dead_clients.append(client)

    for client in dead_clients:
        clients.discard(client)

async def bot_loop():

    while True:

        if game_state == "running":

            for player in logic.players:

                if isinstance(player, Bot):

                    if not logic.discardResourcesMode:

                        action = player.take_turn(logic)

                        if action:
                            await handle_message(None, action)

        await asyncio.sleep(0.1)

async def main():
    asyncio.create_task(bot_loop())
    async with websockets.serve(
        handle_client,
        "0.0.0.0",
        8765
    ):
        print("WebSocket-Server läuft auf Port 8765")

        await asyncio.Future()



# -------------------------
# Server starten
# -------------------------
asyncio.run(main())


