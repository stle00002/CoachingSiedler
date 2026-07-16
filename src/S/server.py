import random
import select
import socket
import threading
import pickle
from bot import Bot
from player import Player
from logic import Logic

HOST = "0.0.0.0"  # alle Interfaces
PORT = 5555

logic = Logic()


clients = []
client_players = {}
players = []
bots = []
game_state = "lobby"
client_ready = {}

# -------------------------
# Hilfsfunktionen für TCP
# -------------------------
import struct

def send_msg(conn, obj):
    data = pickle.dumps(obj)
    length = struct.pack(">I", len(data))
    try:
        conn.sendall(length + data)
    except:
        print("error while sending")
        pass

def recv_msg(conn):
    print("resv_msg")
    raw_len = conn.recv(4)
    if not raw_len:
        return None
    msg_len = struct.unpack(">I", raw_len)[0]
    data = b""
    while len(data) < msg_len:
        packet = conn.recv(msg_len - len(data))
        if not packet:
            return None
        data += packet
    return pickle.loads(data)

# -------------------------
# Client-Handler
# -------------------------
def handle_client(conn, addr):
    print(f"Client verbunden: {addr}")

    try:
        while True:
            msg = recv_msg(conn)
            if msg is None:
                break
            handle_message(conn, msg)
    finally:
        #print(f"Client getrennt: {addr}")
        #clients.remove(conn)
        #if conn in client_players:
        #    players.remove(client_players[conn])
        #
        #     del client_players[conn]
        #    del client_ready[conn]
        #conn.close()
        pass

# -------------------------
# Nachrichten verarbeiten
# -------------------------
def handle_message(conn, message):
    if message == None:
        return
    action = message.get("action")
    print(action)
    if action == "join":
        name = message["name"]
        for old_conn, player in client_players.items():
            if player.name == name:
                print("Reconnected: " + player.name)
                if old_conn in clients:
                    clients.remove(old_conn)
                if old_conn in client_players:
                    del client_players[old_conn]
                if old_conn in client_ready:
                    del client_ready[old_conn]
                try:
                    old_conn.close()
                except:
                    pass
                client_players[conn] = player
                client_ready[conn] = True
                send_msg(conn, {
                    "action": "welcome",
                    "player_index": logic.players.index(player)
                })
                broadcast_state()
                return

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
        color = colors[len(players) % len(colors)]
        is_host = len(players) == 0
        new_player = Player(name, color, is_host)
        players.append(new_player)
        client_players[conn] = new_player
        client_ready[conn] = False

        send_msg(conn, {
            "action": "welcome",
            "player_index": len(players) - 1
        })

        broadcast_lobby()
        return
    elif action == "ready":
        client_ready[conn] = not client_ready[conn]
        broadcast_lobby()
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
        broadcast_lobby()
        return
    elif action == "removeBot":
        if not len(bots) == 0:
            bots.pop(len(bots)-1)
        broadcast_lobby()
        return

    elif action == "change_color":
        client_players[conn].color = message["color"]
        broadcast_lobby()
        return

    elif action == "start_game":
        noDoubleColor = True
        colors = []
        players_and_bots = players + bots
        for p in players_and_bots:
            for c in colors:
                if c == p.color:
                    noDoubleColor = False
            colors.append(p.color)
        if all(client_ready.values()) and len(players) + len(bots) >= 2 and noDoubleColor:
            start_game()
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
        type = message["type"]
        logic.playDevelopmentCard(type, message["res1"], message["res2"],logic.current_player)
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
            trade_offer, trade_request = logic.playerTrade
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
    broadcast_state()


def start_game():
    global game_state
    game_state = "running"

    logic.createBoard(len(players) + len(bots))
    shuffled_player_connections = []
    shuffled_players = []
    for conn, player in client_players.items():
        shuffled_player_connections.append((conn,player))
    for bot in bots:
        shuffled_player_connections.append((None, bot))
    random.shuffle(shuffled_player_connections)
    for i in range(len(players)+ len(bots)):
        conn, player = shuffled_player_connections[i]
        if conn != None:
            send_msg(conn, {
                "action": "welcome",
                "player_index": i
            })
        shuffled_players.append(player)
        
    logic.players = shuffled_players
    logic.start()
    logic.startSetupPhase()

    broadcast_state()


def broadcast_lobby():
    lobby_data = []

    for conn, player in client_players.items():
        lobby_data.append({
            "name": player.name,
            "ready": client_ready[conn],
            "color": player.color
        })
    for bot in bots:
        lobby_data.append({
            "name": bot.name,
            "ready": True,
            "color": bot.color
        })
    for client in clients:
        send_msg(client, {
            "action": "lobby_update",
            "players": lobby_data
        })
# -------------------------
# Spielstand an alle senden
# -------------------------
def broadcast_state():
    dead_clients = []

    for client in clients:
        try:
            send_msg(client, logic)
        except:
            dead_clients.append(client)

# -------------------------
# Server starten
# -------------------------
server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
server.bind((HOST, PORT))

#server = socket.socket(socket.AF_INET6, socket.SOCK_STREAM)
#server.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)  # erlaubt IPv4-Verbindungen
#server.bind(("::", 5555))

server.listen()
print(f"Server läuft auf {HOST}:{PORT}")

sockets = [server]

while True:

    readable, _, _ = select.select(sockets, [], [], 2)

    if not readable:

        if game_state == "running":
            for player in logic.players:
                if isinstance(player, Bot):

                    if not logic.discardResourcesMode:
                        action = player.take_turn(logic)

                        if action:
                            handle_message(None, action)

        continue

    for sock in readable:

        if sock == server:
            conn, addr = server.accept()
            sockets.append(conn)
            clients.append(conn)    

        else:
            try:
                msg = recv_msg(sock)

                if msg is None:
                    raise ConnectionError("Client weg")

                handle_message(sock, msg)

            except Exception as e:
                print("Client disconnected:", e)

                if sock in sockets:
                    sockets.remove(sock)


                if sock in client_players:
                    player = client_players[sock]
                    print("Player offline:", player.name)

                try:
                    sock.close()
                except:
                    pass