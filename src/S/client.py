import socket
import threading
import pickle
import struct
import pygame
from game import Game  # dein GUI

#HOST = "127.0.0.1"  #Lokal
HOST = "172.25.64.132"  #Lokal
#HOST = "2a02:810b:439f:e400:bf88:e607:3d1b:7d8b"  # Global
PORT = 5555

class Client:
    def __init__(self, name):
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        #self.sock = socket.socket(socket.AF_INET6, socket.SOCK_STREAM)
        self.sock.connect((HOST, PORT))

        self.name = name
        self.logic = None
        self.running = True
        self.game = None   
        self.clock = None
        self.player_index = None
        
        self.send_msg({
            "action": "join",
            "name": self.name
        })

        # 🔥 Erst welcome BLOCKIEREND empfangen
        msg = self.recv_msg()
        if msg.get("action") == "welcome":
            self.player_index = msg["player_index"]

        # Jetzt pygame starten (IM MAIN THREAD)
        pygame.init()
        self.game = Game(self.player_index)
        self.clock = pygame.time.Clock()

        # Jetzt erst Networking Thread starten
        threading.Thread(target=self.receive_loop, daemon=True).start()

        # Und Game-Loop im Main Thread
        self.main_loop()

    # -------------------------
    # TCP Hilfsfunktionen
    # -------------------------
    def send_msg(self, obj):
        data = pickle.dumps(obj)
        length = struct.pack(">I", len(data))
        self.sock.sendall(length + data)

    def recv_msg(self):
        raw_len = self.sock.recv(4)
        if not raw_len:
            return None
        msg_len = struct.unpack(">I", raw_len)[0]
        data = b""
        while len(data) < msg_len:
            packet = self.sock.recv(msg_len - len(data))
            if not packet:
                return None
            data += packet
        return pickle.loads(data)

    # -------------------------
    # Nachrichten vom Server empfangen
    # -------------------------
    def receive_loop(self):
        while self.running:
            try:
                msg = self.recv_msg()
                if not msg:
                    continue

                if isinstance(msg, dict):
                    action = msg.get("action")

                    if action == "lobby_update":
                        self.game.update_lobby(msg["players"])
                    if action == "welcome":
                        self.game.player_index = msg["player_index"]

                # 🔵 FALL 2: Logic-Objekt (Game-State)
                else:
                    if self.game:
                        self.game.logic = msg
                        self.game.mode = "game"

            except Exception as e:
                print(e)
                pass
    # -------------------------
    # Hauptloop
    # -------------------------
    def main_loop(self):
        while self.running:
            self.clock.tick(60)

            # Events
            action = None
            try:
                action = self.game.handle_events()  # deine bestehende Funktion
            except Exception as e:
                print(e)
            if action:
                try:
                    self.send_msg(action)
                except Exception as e:
                    print(e)

            # Draw
            try:
                self.game.cycle()
                self.game.draw()
            except Exception as e:
                print(e)
                pass
            pygame.display.flip()

        pygame.quit()
        self.sock.close()


if __name__ == "__main__":
    name = input("Dein Name (max. 15 Zeichen): ")
    while len(name) > 15:
        name = input("Name zu lang, nochmal eingeben:")
    Client(name)