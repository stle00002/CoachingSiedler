import math
import os
import pygame
import sys
from settings import WIDTH
from settings import HEIGHT
from logic import Logic
from resource import Resource

from player import Player
HEX_SIZE = 50
RESOURCE_COLORS = {
    #Resource.HOLZ: (46, 125, 50),
    Resource.HOLZ: (55, 135, 65),
    #Resource.LEHM: (183, 28, 28),
    Resource.LEHM: (210, 105, 60),
    #Resource.SCHAF: (102, 187, 106),
    Resource.SCHAF: (65, 255, 35),
    Resource.WEIZEN:  (255, 202, 40),
    #Resource.ERZ: (97, 97, 97),
    Resource.ERZ: (150, 150, 150),
    Resource.WÜSTE: (224, 200, 120),
    Resource.WASSER:(25, 118, 210)
}

class Game:
    def __init__(self, player_index):
        pygame.init()
        self.screen = pygame.display.set_mode((WIDTH, HEIGHT))
        pygame.display.set_caption("Siedler")
        self.clock= pygame.time.Clock()
        self.running = True
        self.logic = Logic()
        self.build_mode = None
        self.selectingSettlement = False
        self.selectingRoad = False
        self.dice = None
        self.trade_mode = False
        self.select_trade_partner_mode = False
        self.chooseMonopolResourceMode = False
        self.chooseInventionResource1Mode = False
        self.chooseInventionResource2Mode = False
        self.chosenResource1 = None
        self.player_circle_rects = [] 
        self.trade_request = {}
        self.player_index = player_index
        self.player = None
        self.trade_offer = {
    "HOLZ": 0,
    "LEHM": 0,
    "SCHAF": 0,
    "WEIZEN": 0,
    "ERZ": 0
}
        self.player_button_rect = None
        self.bank_button_rect = None
        self.trade_accept_rect = None
        self.trade_decline_rect = None
        self.active_input = 0
        self.mode = "lobby"
        self.lobbyPlayers = []
        self.ready = False
        self.ready_button_rect = pygame.Rect(WIDTH//2 - 100, HEIGHT - 120, 200, 50)
        self.addBot_button_rect = pygame.Rect(WIDTH//2 - 100, HEIGHT - 220, 200, 50)
        self.removeBot_button_rect = pygame.Rect(WIDTH//2 - 100, HEIGHT - 170, 200, 50)
        self.start_button_rect = None
        self.available_colors = [
    (255, 0, 0),    # Rot
    (0, 0, 255),   # Blau
    (0, 255, 0),    # Grün
    (255, 255, 0),    # Gelb
    (255, 140, 0),    # Orange
    (148, 0, 211),    # Lila
    (0, 206, 209),    # Türkis
    (255, 105, 180),   # Pink
    (0, 0, 0),
    (255, 255, 255)
]

        self.color_circle_rects = []
        try:
            self.images = {
    "HOLZ": pygame.transform.smoothscale(pygame.image.load(self.resource_path("forestBright.png")).convert_alpha(),(HEX_SIZE*2, HEX_SIZE*2)),
    "SCHAF": pygame.transform.smoothscale(pygame.image.load(self.resource_path("pastureBright.png")).convert_alpha(),(HEX_SIZE*2, HEX_SIZE*2)),
    "WEIZEN": pygame.transform.smoothscale(pygame.image.load(self.resource_path("fieldBright.png")).convert_alpha(),(HEX_SIZE*2, HEX_SIZE*2)),
    "ERZ": pygame.transform.smoothscale(pygame.image.load(self.resource_path("mountain.png")).convert_alpha(),(HEX_SIZE*2, HEX_SIZE*2)),
    "LEHM": pygame.transform.smoothscale(pygame.image.load(self.resource_path("hillBright.png")).convert_alpha(),(HEX_SIZE*2, HEX_SIZE*2)),
    "WÜSTE": pygame.transform.smoothscale(pygame.image.load(self.resource_path("desert.png")).convert_alpha(),(HEX_SIZE*2, HEX_SIZE*2)),
    "WASSER": pygame.transform.smoothscale(pygame.image.load(self.resource_path("water.png")).convert_alpha(),(HEX_SIZE*2 + 13, HEX_SIZE*2 + 8)),
    "BACKGROUND": pygame.transform.smoothscale(pygame.image.load(self.resource_path("background.jpeg")).convert_alpha(),(WIDTH, HEIGHT)),
    "BACKGROUND2": pygame.transform.smoothscale(pygame.image.load(self.resource_path("background2.png")).convert_alpha(),(WIDTH, HEIGHT - 100)),
    "POKAL": pygame.transform.smoothscale(pygame.image.load(self.resource_path("pokal.png")).convert_alpha(),(HEIGHT - 200, HEIGHT-200))
}       
        except:
            self.images = {
    "HOLZ": pygame.transform.smoothscale(pygame.image.load("src/S/forestBright.png").convert_alpha(),(HEX_SIZE*2, HEX_SIZE*2)),
    "SCHAF": pygame.transform.smoothscale(pygame.image.load("src/S/pastureBright.png").convert_alpha(),(HEX_SIZE*2, HEX_SIZE*2)),
    "WEIZEN": pygame.transform.smoothscale(pygame.image.load("src/S/fieldBright.png").convert_alpha(),(HEX_SIZE*2, HEX_SIZE*2)),
    "ERZ": pygame.transform.smoothscale(pygame.image.load("src/S/mountain.png").convert_alpha(),(HEX_SIZE*2, HEX_SIZE*2)),
    "LEHM": pygame.transform.smoothscale(pygame.image.load("src/S/hillBright.png").convert_alpha(),(HEX_SIZE*2, HEX_SIZE*2)),
    "WÜSTE": pygame.transform.smoothscale(pygame.image.load("src/S/desert.png").convert_alpha(),(HEX_SIZE*2, HEX_SIZE*2)),
    "WASSER": pygame.transform.smoothscale(pygame.image.load("src/S/water.png").convert_alpha(),(HEX_SIZE*2 + 13, HEX_SIZE*2 + 8)),
    "BACKGROUND": pygame.transform.smoothscale(pygame.image.load("src/S/background.jpeg").convert_alpha(),(WIDTH, HEIGHT)),
    "BACKGROUND2": pygame.transform.smoothscale(pygame.image.load("src/S/background2.png").convert_alpha(),(WIDTH, HEIGHT- 100)),
    "POKAL": pygame.transform.smoothscale(pygame.image.load("src/S/pokal.png").convert_alpha(),(HEIGHT - 200, HEIGHT-200))
}       
        self.raise_hand_rect = None

    def handle_login(self):
        for event in pygame.event.get():

            if event.type == pygame.QUIT:
                pygame.quit()
                sys.exit()
            if self.logic.finished:
                return

            if event.type == pygame.KEYDOWN:
                if event.key == pygame.K_BACKSPACE:
                    self.name_inputs[self.active_input] = \
                        self.name_inputs[self.active_input][:-1]

                elif event.key == pygame.K_RETURN:
                    self.active_input += 1
                    if self.active_input >= self.player_count:
                        self.active_input = 0

                else:
                    if len(self.name_inputs[self.active_input]) < 12:
                        self.name_inputs[self.active_input] += event.unicode

            if event.type == pygame.MOUSEBUTTONDOWN:
                mx, my = event.pos

                # Spieleranzahl minus
                if 300 < mx < 340 and 150 < my < 190:
                    self.player_count = max(2, self.player_count - 1)

                # Spieleranzahl plus
                if 460 < mx < 500 and 150 < my < 190:
                    self.player_count = min(8, self.player_count + 1)

                # Start Button
                if 750 < mx < 900 and 450 < my < 500:
                    self.create_players()
                    self.login = False

    def draw_login(self):
        self.screen.fill((40, 40, 40))
        font = pygame.font.SysFont(None, 40)

        # Titel
        title = font.render("Siedler Login", True, (255,255,255))
        self.screen.blit(title, (WIDTH//2 - 120, 50))

        # Spieleranzahl
        count_text = font.render(f"Spieler: {self.player_count}", True, (255,255,255))
        self.screen.blit(count_text, (350, 150))

        pygame.draw.rect(self.screen, (200,200,200), (300,150,40,40))
        pygame.draw.rect(self.screen, (200,200,200), (460,150,40,40))

        minus = font.render("-", True, (0,0,0))
        plus = font.render("+", True, (0,0,0))

        self.screen.blit(minus, (312,152))
        self.screen.blit(plus, (472,152))

        # Eingabefelder
        for i in range(self.player_count):
            y = 250 + i*60

            color = (255,255,255)
            if i == self.active_input:
                color = (255,255,0)

            pygame.draw.rect(self.screen, color, (300, y, 300, 40), 2)

            name_surface = font.render(self.name_inputs[i], True, (255,255,255))
            self.screen.blit(name_surface, (310, y+5))

        # Start Button
        pygame.draw.rect(self.screen, (0,150,0), (750, 450, 150, 50))
        start_text = font.render("Start", True, (255,255,255))
        self.screen.blit(start_text, (785,460))

        pygame.display.flip()
    
    
    def cycle(self):
        if self.mode == "lobby":
            return
        self.player= self.logic.players[self.player_index]
        if self.logic.setupPhase == True:
            if self.logic.current_player == self.logic.players[self.player_index]:
                if self.logic.setUpSettlement:
                    self.build_mode = "SETTLEMENT"
                if self.logic.setUpRoad:
                    self.build_mode = "ROAD"
            else:
                self.build_mode = None
    def handle_events(self):
        if self.mode == "lobby":
            return self.handle_lobby_events()
        for event in pygame.event.get():

            if event.type == pygame.QUIT:
                pygame.quit()
                sys.exit()
            if event.type == pygame.MOUSEBUTTONDOWN and self.raise_hand_rect and self.raise_hand_rect.collidepoint(event.pos):
                return self.handleSpecialBuildPhaseButtonClick(event.pos)
                
            if self.logic.freeRoads:
                if event.type == pygame.MOUSEBUTTONDOWN:
                    return self.handle_click(event.pos)
                else:
                    return
                
                
            if self.logic.würfelMode and self.logic.current_player == self.logic.players[self.player_index]:
                if event.type == pygame.KEYDOWN and event.key == pygame.K_w:
                    return{
                        "action": "roll_dice"
                    }
                elif event.type == pygame.MOUSEBUTTONDOWN:
                    return self.handle_click(event.pos)
                return
            
            if event.type == pygame.KEYDOWN and self.logic.playerTrade != None:
                if event.key == pygame.K_x:
                    if self.trade_decline_rect:
                        return { "action": "declineTrade", "playerName": self.logic.players[self.player_index].name }
                if event.key == pygame.K_v:
                    if self.trade_accept_rect:
                        return { "action": "acceptTrade", "playerName": self.logic.players[self.player_index].name }
                    

            if not self.logic.setupPhase and not self.logic.moveRobberMode and not self.logic.stealMode and event.type == pygame.KEYDOWN and self.logic.current_player == self.logic.players[self.player_index] or (self.logic.buildPhase and self.logic.raisedHands[self.logic.players[self.player_index]] == True and event.type == pygame.KEYDOWN):
                if event.key == pygame.K_s: 
                    self.build_mode = "SETTLEMENT"
                elif event.key == pygame.K_r: 
                    self.build_mode = "ROAD"
                elif event.key == pygame.K_c:
                    self.build_mode = "CITY"
                elif event.key == pygame.K_d:
                    return{
                        "action": "buyDevelopmentCard",
                        "playerName": self.logic.players[self.player_index].name,
                    }
                elif event.key == pygame.K_f and self.logic.current_player == self.logic.players[self.player_index]:
                    self.build_mode = None
                    self.trade_mode = False
                    return {
                "action": "endTurn",
                }
                elif event.key == pygame.K_t and self.logic.current_player == self.logic.players[self.player_index]:
                    self.trade_mode = not self.trade_mode
                    self.select_trade_partner_mode = False
                    self.trade_offer = {
    "HOLZ": 0,
    "LEHM": 0,
    "SCHAF": 0,
    "WEIZEN": 0,
    "ERZ": 0
}
                    
                self.trade_request = {}
            if event.type == pygame.MOUSEBUTTONDOWN:
                return self.handle_click(event.pos) 


    def handle_click(self, mouse_pos):
        player = self.logic.players[self.player_index]
        if self.logic.playerTrade is not None:
            if self.trade_accept_rect and self.trade_accept_rect.collidepoint(mouse_pos): 
                return { "action": "acceptTrade", "playerName": self.logic.players[self.player_index].name }
            if self.trade_decline_rect and self.trade_decline_rect.collidepoint(mouse_pos):
                return { "action": "declineTrade", "playerName": self.logic.players[self.player_index].name }
        if self.chooseInventionResource1Mode or self.chooseInventionResource2Mode:
            return self.handleInventionClick(mouse_pos)
        if self.chooseMonopolResourceMode:
            return self.handleMonopolClick(mouse_pos)

        if self.logic.discardResourcesMode and self.logic.players[self.player_index].hasToDiscard > 0:
            return self.handleDiscardClick(mouse_pos)

        if self.logic.moveRobberMode and self.player == self.logic.current_player:
            tile = self.get_clicked_tile(mouse_pos)
            if tile and tile != self.logic.robberTile:  
                return {"action": "moveRobber","tileId": tile.id}
            return None
        
        if self.logic.stealMode and self.player == self.logic.current_player:
            vertex = self.get_clicked_vertex(mouse_pos)
            robberTile = self.logic.robberTile
            if vertex in robberTile.vertices:
                if vertex.owner is not None and vertex.owner != self.logic.current_player:   
                    return {
                "action": "steal",
                "playerName": vertex.owner.name
            }
            return None
        if self.logic.current_player == self.logic.players[self.player_index]:
            nachricht = self.handleDevelopmentCardsClick(mouse_pos)
            if nachricht:
                return nachricht

        if self.trade_mode:
            return self.handleTradeClick(mouse_pos)
        if self.build_mode == "SETTLEMENT":
            vertex = self.get_clicked_vertex(mouse_pos)
            if vertex and self.logic.board.canBuildSettlement(player, vertex, self.logic.setupPhase):
                self.build_mode = None
                return {
                "action": "buildSettlement",
                "playerName": player.name,
                "vertexId": vertex.id,
            }
        elif self.build_mode == "ROAD":
            edge = self.get_clicked_edge(mouse_pos)
            if edge and self.logic.board.canBuildRoad(player, edge, self.logic.setupPhase): 
                
                if self.logic.freeRoads < 2:
                    self.build_mode = None
                return {
                "action": "buildRoad",
                "playerName": player.name,
                "edgeId": edge.id
            }
        elif self.build_mode == "CITY":
            vertex = self.get_clicked_vertex(mouse_pos)
            if vertex and self.logic.board.canBuildCity(player, vertex):  
                self.build_mode = None
                return {
                "action": "buildCity",
                "playerName": player.name,
                "vertexId": vertex.id
            }

    def handleInventionClick(self, mouse_pos):
        mx, my = mouse_pos
        padding = 40
        spacing = 120
        bar_height = 100
        x_start = padding
        y = HEIGHT - bar_height // 2

        resources_order = ["HOLZ", "LEHM", "SCHAF", "WEIZEN", "ERZ"]

        for i, res in enumerate(resources_order):

            rect_x = x_start + i * spacing
            rect_y = y - 20
            width = 40
            height = 40

            if rect_x <= mx <= rect_x + width and rect_y <= my <= rect_y + height:
                if self.chooseInventionResource1Mode:
                    self.chosenResource1 = res
                    self.chooseInventionResource1Mode = False
                    self.chooseInventionResource2Mode = True
                else:
                    self.chooseInventionResource2Mode = False
                    return {
                    "action": "playDevelopmentCard",
                    "type": "ERFINDUNG",
                    "res1": self.chosenResource1,
                    "res2": res
                        }
        return None
    def handleMonopolClick(self, mouse_pos):
        mx, my = mouse_pos
        padding = 40
        spacing = 120
        bar_height = 100
        x_start = padding
        y = HEIGHT - bar_height // 2

        resources_order = ["HOLZ", "LEHM", "SCHAF", "WEIZEN", "ERZ"]

        for i, res in enumerate(resources_order):

            rect_x = x_start + i * spacing
            rect_y = y - 20
            width = 40
            height = 40

            if rect_x <= mx <= rect_x + width and rect_y <= my <= rect_y + height:
                self.chooseMonopolResourceMode = False
                return {
                    "action": "playDevelopmentCard",
                    "type": "MONOPOL",
                    "res1": res,
                    "res2": None
                        }
        return None
    def handleDiscardClick(self, mouse_pos):
        mx, my = mouse_pos
        padding = 40
        spacing = 120
        bar_height = 100
        x_start = padding
        y = HEIGHT - bar_height // 2

        resources_order = ["HOLZ", "LEHM", "SCHAF", "WEIZEN", "ERZ"]

        for i, res in enumerate(resources_order):

            rect_x = x_start + i * spacing
            rect_y = y - 20
            width = 40
            height = 40

            if rect_x <= mx <= rect_x + width and rect_y <= my <= rect_y + height:

                return {"action": "discardResource",
                        "playerName": self.logic.players[self.player_index].name,
                        "res": res}
        return None
    def handleDevelopmentCardsClick(self, mouse_pos):
        mx, my = mouse_pos
        padding = 40
        spacing = 120
        bar_height = 100
        x_start = padding
        y = HEIGHT - bar_height // 2

        developmentCardsOrder = ["RITTER","1SIEGPUNKT", "MONOPOL","ERFINDUNG","STRAßENBAU"]

        x_start = x_start + 6 * spacing
        for i, res in enumerate(developmentCardsOrder):
            
            rect_x = x_start + i * spacing
            rect_y = y - 20
            width = 40
            height = 40

            # Manuelle Kollisionsprüfung
            if rect_x <= mx <= rect_x + width and rect_y <= my <= rect_y + height:
                if not self.logic.würfelMode or res == "RITTER":
                    if res == "MONOPOL":
                        self.chooseMonopolResourceMode = True
                    elif res == "ERFINDUNG":
                        self.chooseInventionResource1Mode = True
                    else:
                        if res == "STRAßENBAU":
                            self.build_mode = "ROAD"
                        return {
                        "action": "playDevelopmentCard",
                        "type": res,
                        "res1": None,
                        "res2": None
                            }
    def handleTradeClick(self, mouse_pos):

        if not self.trade_mode:
            return None


        if self.select_trade_partner_mode == True:
            mx, my = mouse_pos
            for rect, p in self.player_circle_rects:
                if rect.collidepoint(mx, my):
                    self.select_trade_partner_mode = False
                    return {
                "action": "tradeWithPlayer",
                "playerName": p.name,
                "offer": self.trade_offer,
                "request": self.trade_request
            }     
        if self.bank_button_rect.collidepoint(mouse_pos):
            self.trade_mode = False
            return {
                "action": "tradeWithBank",
                "offer": self.trade_offer,
                "request": self.trade_request
            }
        elif self.player_button_rect.collidepoint(mouse_pos):
            self.trade_mode = False
            return {
                "action": "openPlayerTrade",
                "offer": self.trade_offer,
                "request": self.trade_request
            }
        mx, my = mouse_pos

        padding = 40
        spacing = 120
        bar_height = 100
        x_start = padding
        y = HEIGHT - 5 * bar_height // 2

        resources_order = ["HOLZ", "LEHM", "SCHAF", "WEIZEN", "ERZ"]

        for i, res in enumerate(resources_order):

            rect_x = x_start + i * spacing
            rect_y = y - 20
            width = 40
            height = 40

            # Manuelle Kollisionsprüfung
            if rect_x <= mx <= rect_x + width and rect_y <= my <= rect_y + height:

                # Beispiel: Ressource auswählen
                current = self.trade_request.get(res, 0)
                self.trade_request[res] = current + 1

                #return
        
        padding = 40
        spacing = 120
        bar_height = 100
        x_start = padding
        y = HEIGHT - bar_height // 2

        resources_order = ["HOLZ", "LEHM", "SCHAF", "WEIZEN", "ERZ"]

        for i, res in enumerate(resources_order):

            rect_x = x_start + i * spacing
            rect_y = y - 20
            width = 40
            height = 40

            if rect_x <= mx <= rect_x + width and rect_y <= my <= rect_y + height:

                player = self.logic.current_player

                # nur wenn Spieler genug Ressourcen hat
                if player.resources[res] > self.trade_offer[res]:
                    self.trade_offer[res] += 1
                    return None
        return None
                
    def handle_player_trade(self):
        self.select_trade_partner_mode = True
        
    def handleSpecialBuildPhaseButtonClick(self, mouse_pos):
            if self.logic.buildPhase:
                return {"action": "finishBuild",
                        "playerName": self.logic.players[self.player_index].name
                    }

            else:
                return {
                    "action": "raiseHand",
                    "value": not self.logic.raisedHands[self.logic.players[self.player_index]],
                    "playerName": self.logic.players[self.player_index].name
                }
    def get_clicked_vertex(self, mouse_pos):

        mx, my = mouse_pos

        for vertex in self.logic.board.vertices:
            x, y = self.axial_to_pixel_vertex(vertex)

            if (mx - x)**2 + (my - y)**2 < 12**2:
                return vertex

        return None
    
    def get_clicked_tile(self, mouse_pos):
        mx, my = mouse_pos

        for tile in self.logic.board.tiles:
            x, y = self.axial_to_pixel(tile.q, tile.r)

            dx = mx - x
            dy = my - y

            if dx*dx + dy*dy < HEX_SIZE**2:
                return tile

        return None
    def get_clicked_edge(self, mouse_pos):

        mx, my = mouse_pos

        for edge in self.logic.board.edges:
            x1, y1 = self.axial_to_pixel_vertex(edge.vertex1)
            x2, y2 = self.axial_to_pixel_vertex(edge.vertex2)

            if self.point_near_line(mx, my, x1, y1, x2, y2):
                return edge

        return None
    def point_near_line(self, px, py, x1, y1, x2, y2, threshold=8):

        # Abstand Punkt zu Linie
        line_len = ((x2-x1)**2 + (y2-y1)**2)**0.5
        if line_len == 0:
            return False

        t = ((px-x1)*(x2-x1)+(py-y1)*(y2-y1)) / line_len**2
        t = max(0, min(1, t))

        nearest_x = x1 + t*(x2-x1)
        nearest_y = y1 + t*(y2-y1)

        dist = ((px-nearest_x)**2 + (py-nearest_y)**2)**0.5
        return dist < threshold
    def update(self):
        pass

    
    
    def resource_path(self, relative_path):
        """Gibt den absoluten Pfad zu einer Ressource, auch in einer PyInstaller-EXE."""
        try:
            # PyInstaller erstellt ein temporäres Verzeichnis
            base_path = sys._MEIPASS
        except AttributeError:
            base_path = os.path.abspath(".")
        return os.path.join(base_path, relative_path)

    def draw(self):
        if self.mode == "lobby":
            self.draw_lobby()
            pygame.display.flip()
            return
        self.screen.fill((30, 30, 30))
        image = self.images.get("BACKGROUND2")
        self.screen.blit(image, (0, 0))

        overlay = pygame.Surface((WIDTH, HEIGHT), pygame.SRCALPHA)
        overlay.fill((190, 105, 60, 120))  # RGBA (letzter Wert = Transparenz)
        self.screen.blit(overlay, (0, 0))


        for tile in self.logic.board.tiles:
            x, y = self.axial_to_pixel(tile.q, tile.r)

            corners = self.hex_corners(x, y, HEX_SIZE)
            color = RESOURCE_COLORS.get(tile.resource, (200, 200, 150))
            pygame.draw.polygon(self.screen, color, corners)
            match tile.resource:
                case Resource.WÜSTE:
                    image = self.images.get("WÜSTE")
                case Resource.SCHAF:
                    image = self.images.get("SCHAF")
                case Resource.HOLZ:
                    image = self.images.get("HOLZ")
                case Resource.LEHM:
                    image = self.images.get("LEHM")
                case Resource.WEIZEN:
                    image = self.images.get("WEIZEN")
                case Resource.ERZ:
                    image = self.images.get("ERZ")
                case Resource.WASSER:
                    image = self.images.get("WASSER")
            
            rect = image.get_rect()
            if tile.resource == Resource.WASSER:
                rect.center = (x-1, y)
            else:
                rect.center = (x+4, y)
            self.screen.blit(image, rect)

            pygame.draw.polygon(self.screen, (0,0,0), corners, 3)



            if tile.number is not None:
                font = pygame.font.SysFont(None, 15)
                match tile.number:
                    case 2:
                        font = pygame.font.SysFont(None, 15)
                    case 12:
                        font = pygame.font.SysFont(None, 15)
                    case 3:
                        font = pygame.font.SysFont(None, 20)
                    case 11:
                        font = pygame.font.SysFont(None, 20)
                    case 4:
                        font = pygame.font.SysFont(None, 25)
                    case 10:
                        font = pygame.font.SysFont(None, 25)
                    case 5:
                        font = pygame.font.SysFont(None, 30)
                    case 9:
                        font = pygame.font.SysFont(None, 30)
                    case 6:
                        font = pygame.font.SysFont(None, 30)
                    case 8:
                        font = pygame.font.SysFont(None, 30)

                color = (0, 0, 0)
                match tile.number:
                    case 8:
                        color = (200, 0, 0)
                    case 6: 
                        color = (200, 0 , 0)
                radius = 15  # Größe des Kreises
                pygame.draw.circle(self.screen, (255, 255, 255), (x, y), radius)  # weißer Kreis
                pygame.draw.circle(self.screen, (0,0,0), (x, y) , radius, 2) 
                text = font.render(str(tile.number), True, color)
                text_rect = text.get_rect(center=(x, y))
                self.screen.blit(text, text_rect)
            if tile.id == self.logic.robberTile.id:
                pygame.draw.circle(self.screen, (0,0,0), (int(x), int(y)), 15)
    
        if self.chooseMonopolResourceMode:
            font = pygame.font.SysFont(None, 40)
            text = font.render("Wähle eine Resource für dein Monopol", True, (255, 255, 255))
            self.screen.blit(text, (50, 100))
        if self.chooseInventionResource1Mode:
            font = pygame.font.SysFont(None, 40)
            text = font.render("Wähle zwei Resourcen für deine Erfindung", True, (255, 255, 255))
            self.screen.blit(text, (50, 100))
        if self.chooseInventionResource2Mode:
            font = pygame.font.SysFont(None, 40)
            text = font.render("Wähle noch eine Resource für deine Erfindung", True, (255, 255, 255))
            self.screen.blit(text, (50, 100))
        player = self.logic.players[self.player_index]

        if self.logic.buildPhase:
            font = pygame.font.SysFont(None, 40)
            text = font.render(f"Es ist Baurunde!", True, (255, 255, 255))
            self.screen.blit(text, (50, 50))           
        if self.logic.würfelMode:
            font = pygame.font.SysFont(None, 40)
            if player.name == self.logic.current_player.name:
                text = font.render(f"Du bist dran mit Würfeln!", True, self.logic.current_player.color)
            else:
                text = font.render(f"{self.logic.current_player.name} ist dran mit Würfeln!", True, self.logic.current_player.color)
            self.screen.blit(text, (50, 50))

        if self.logic.discardResourcesMode:
            if player.hasToDiscard > 0:
                font = pygame.font.SysFont(None, 40)
                text = font.render(f"Du musst noch {player.hasToDiscard} Karten abgeben ", True, (255, 255, 255))
                self.screen.blit(text, (50, 100))
            else:
                font = pygame.font.SysFont(None, 40)
                text = font.render("Andere Spieler müssen noch Karten abgeben", True, (255, 255, 255))
                self.screen.blit(text, (50, 100))
        if self.logic.moveRobberMode:
            font = pygame.font.SysFont(None, 40)
            if player == self.logic.current_player:
                text = font.render(f"Du musst den Räuber versetzen!", True, self.logic.current_player.color)
            else:
                text = font.render(f"{self.logic.current_player.name} muss den Räuber versetzen!", True, self.logic.current_player.color)
            self.screen.blit(text, (50, 100))
        if self.logic.stealMode:
            font = pygame.font.SysFont(None, 40)
            if player == self.logic.current_player:
                text = font.render(f"Du musst bei jemandem ziehen!", True, self.logic.current_player.color)
            else:
                text = font.render(f"{self.logic.current_player.name} muss bei jemandem ziehen!", True, self.logic.current_player.color)
            self.screen.blit(text, (50, 100))

        self.draw_harbors()

        for edge in self.logic.board.edges:
            if edge.owner is not None:
                x1, y1 = self.axial_to_pixel_vertex(edge.vertex1)
                x2, y2 = self.axial_to_pixel_vertex(edge.vertex2)
                pygame.draw.line(self.screen, edge.owner.color, (x1, y1), (x2, y2), 8)

        for vertex in self.logic.board.vertices:
            if vertex.owner is not None:
                x, y = self.axial_to_pixel_vertex(vertex)
                if not vertex.isCity:
                    points = [
                        (x+10, y-3),
                        (x+10,y+8),
                        (x-10,y+8),
                        (x-10,y-3),
                        (x,y-12),
                        ]
                    pygame.draw.polygon(self.screen, vertex.owner.color, points)
                    pygame.draw.polygon(self.screen, (0,0,0), points, 2)
                else:
                    points = [
                        (x, y-5),
                        (x+16,y-5),
                        (x+16,y+11),
                        (x,y+11),
                        (x-16,y+11),
                        (x-16,y-5),
                        (x-8,y-21),
                        ]
                    pygame.draw.polygon(self.screen, vertex.owner.color, points)
                    pygame.draw.polygon(self.screen, (0,0,0), points, 2)

        if self.build_mode == "SETTLEMENT":
            for vertex in self.logic.board.vertices:
                if self.logic.board.canBuildSettlement(
                    self.player,
                    vertex,
                    self.logic.setupPhase
                ):
                    x, y = self.axial_to_pixel_vertex(vertex)
                    pygame.draw.circle(self.screen, (0,255,255), (x,y), 6)
        elif self.build_mode == "CITY":
            for vertex in self.logic.board.vertices:
                if self.logic.board.canBuildCity(
                    self.player,
                    vertex
                ):
                    x, y = self.axial_to_pixel_vertex(vertex)
                    pygame.draw.circle(self.screen, (0,255,255), (int(x),int(y)), 8)


        elif self.build_mode == "ROAD":
            for edge in self.logic.board.edges:
                if self.logic.board.canBuildRoad(
                    self.player,
                    edge,
                    self.logic.setupPhase
                ):
                    x1, y1 = self.axial_to_pixel_vertex(edge.vertex1)
                    x2, y2 = self.axial_to_pixel_vertex(edge.vertex2)

                    pygame.draw.line(
                        self.screen,
                        (0,255,255),
                        (x1,y1),
                        (x2,y2),
                        4
                    )   
        self.draw_player_side_bar() 
        self.draw_dice()     
        self.draw_player_resources()
        self.draw_trade_resources() 
        self.draw_trade_middle()
        self.draw_trade_partner_selector()
        self.draw_trade_popup()
        self.draw_dice_histogram()
        self.draw_raise_hand_button()
        if self.logic.finished:
            self.drawWinner()
        pygame.display.flip()

    def axial_to_pixel(self, q, r):
        x = HEX_SIZE * (math.sqrt(3) * q + math.sqrt(3)/2 * r)
        y = HEX_SIZE * (3/2 * r)

        # Board zentrieren
        return x + WIDTH//2, y + HEIGHT//2

    def hex_corners(self, center_x, center_y, size):
        corners = []
        for i in range(6):
            angle_deg = 60 * i - 30
            angle_rad = math.radians(angle_deg)
            x = center_x + size * math.cos(angle_rad)
            y = center_y + size * math.sin(angle_rad)
            corners.append((x, y))
        return corners
    
    def axial_to_pixel_vertex(self, vertex):
    # Mittelpunkte der Vertex anhand der Hexes berechnen
    # Einfacher Ansatz: Mittelwert der angrenzenden Tiles
        xs = []
        ys = []
        for tile in vertex.adjacentTiles:
            x, y = self.axial_to_pixel(tile.q, tile.r)
            xs.append(x)
            ys.append(y)
        return sum(xs)/len(xs), sum(ys)/len(ys)
    
    def draw_player_side_bar(self):
        font = pygame.font.SysFont(None, 24)
        padding = 10
        x = WIDTH - 250  # Sidebar rechts
        y = 50

        for player in self.logic.players:

            # Spielername + aktuelle Farbe
            turn_indicator = "<--" if player == self.logic.current_player else ""
            if player == self.logic.players[self.player_index]:
                text = font.render(f"{player.name} ({player.victoryPoints + player.secretVictoryPoints} Punkte) {turn_indicator}", True, player.color)
                self.screen.blit(text, (x, y))
            else:
                text = font.render(f"{player.name} ({player.victoryPoints} Punkte) {turn_indicator}", True, player.color)
                self.screen.blit(text, (x, y))

            y += 20
            countResources = 0
            for res, count in player.resources.items():
                countResources += count
            text = font.render(f"{countResources} Karten", True, (255, 255, 255))
            self.screen.blit(text, (x, y))
            y += 20
            countResources = 0
            for res, count in player.developmentCards.items():
                countResources += count
            text = font.render(f"{countResources} Entwicklungskarten", True, (255, 255, 255))
            self.screen.blit(text, (x, y))
            y+= 20
            text = font.render(f"{player.knights} Ritter", True, (255, 255, 255))
            self.screen.blit(text, (x, y))
            y += 25

    def draw_dice(self):
        font = pygame.font.SysFont(None, 40)
        if self.logic.dice is not None and not self.logic.würfelMode and not self.logic.buildPhase:
            if self.logic.current_player == self.player:
                text = font.render(f"Du hast eine {self.logic.dice} gewürfelt!", True, self.logic.current_player.color)
            else:
                text = font.render(f"{self.logic.current_player.name} hat eine {self.logic.dice} gewürfelt!", True, self.logic.current_player.color)
            self.screen.blit(text, (50, 50))
    def draw_player_resources(self):

        font = pygame.font.SysFont(None, 28)

        # Hintergrundleiste unten
        bar_height = 100
        pygame.draw.rect(
            self.screen,
            (40, 40, 40),
            (0, HEIGHT - bar_height, WIDTH, bar_height)
        )

        padding = 40
        spacing = 120
        x_start = padding
        y = HEIGHT - bar_height // 2

        resources_order = ["HOLZ", "LEHM", "SCHAF", "WEIZEN", "ERZ"]

        for i, res in enumerate(resources_order):
            amount = self.logic.players[self.player_index].resources.get(res, 0)

            # Farbe vom RESOURCE_COLORS Dictionary holen
            color = RESOURCE_COLORS[Resource[res]]


            # kleines Farbfeld
            pygame.draw.rect(
                self.screen,
                color,
                (x_start + i * spacing, y - 20, 40, 40)
            )

            pygame.draw.rect(
                self.screen,
                (0, 0, 0),
                (x_start + i * spacing, y - 20, 40, 40),
                2
            )

            # Zahl daneben
            text = font.render(str(amount), True, (255, 255, 255))
            self.screen.blit(
                text,
                (x_start + i * spacing + 50, y - 15)
            )
        
        developmentCardsOrder = ["RITTER","1SIEGPUNKT", "MONOPOL","ERFINDUNG","STRAßENBAU"]

        x_start = x_start + 6 * spacing
        for i, res in enumerate(developmentCardsOrder):
            amount = self.logic.players[self.player_index].developmentCards.get(res, 0)

            # Farbe vom RESOURCE_COLORS Dictionary holen
            color = (148,0,211)


            # kleines Farbfeld
            pygame.draw.rect(
                self.screen,
                color,
                (x_start + i * spacing, y - 20, 40, 40)
            )

            pygame.draw.rect(
                self.screen,
                (0, 0, 0),
                (x_start + i * spacing, y - 20, 40, 40),
                2
            )

            letter = font.render(res[0], True, (255, 255, 255))
            self.screen.blit(letter, (x_start+ i* spacing + 12, y - 10))

            # Zahl daneben
            text = font.render(str(amount), True, (255, 255, 255))
            self.screen.blit(
                text,
                (x_start + i * spacing + 50, y - 15)
            )
        

        
    def draw_trade_resources(self):
        if not self.trade_mode: 
            return
        if self.player is None:
            return

        font = pygame.font.SysFont(None, 28)

        # Hintergrundleiste unten
        bar_height = 100
        pygame.draw.rect(
            self.screen,
            (40, 40, 40),
            (0, HEIGHT - 3*bar_height , WIDTH /2 - 2* bar_height + 150, bar_height*2)
        )

        padding = 40
        spacing = 120
        x_start = padding
        y = HEIGHT - 5*bar_height // 2

        resources_order = ["HOLZ", "LEHM", "SCHAF", "WEIZEN", "ERZ"]

        for i, res in enumerate(resources_order):

            # Farbe vom RESOURCE_COLORS Dictionary holen
            color = RESOURCE_COLORS[Resource[res]]

            # kleines Farbfeld
            pygame.draw.rect(
                self.screen,
                color,
                (x_start + i * spacing, y - 20, 40, 40)
            )

            pygame.draw.rect(
                self.screen,
                (0, 0, 0),
                (x_start + i * spacing, y - 20, 40, 40),
                2
            )
        button_width = 60

        button_height = 50
        spacing_y = 15

        right_margin = 20
        x_button = WIDTH/2 - 2*bar_height + 150 - button_width - right_margin
        y_button_top = HEIGHT - 5*bar_height // 2 - 20

        font_big = pygame.font.SysFont(None, 36)

        # Button B (Bank)
        self.bank_button_rect = pygame.Rect(
            x_button,
            y_button_top,
            button_width,
            button_height
        )

        pygame.draw.rect(self.screen, (70, 70, 70), self.bank_button_rect)
        pygame.draw.rect(self.screen, (0, 0, 0), self.bank_button_rect, 2)

        text = font_big.render("B", True, (255, 255, 255))
        text_rect = text.get_rect(center=self.bank_button_rect.center)
        self.screen.blit(text, text_rect)

        # Button P (Player)
        self.player_button_rect = pygame.Rect(
            x_button,
            y_button_top + button_height + spacing_y,
            button_width,
            button_height
        )

        pygame.draw.rect(self.screen, (70, 70, 70), self.player_button_rect)
        pygame.draw.rect(self.screen, (0, 0, 0), self.player_button_rect, 2)

        text = font_big.render("P", True, (255, 255, 255))
        text_rect = text.get_rect(center=self.player_button_rect.center)
        self.screen.blit(text, text_rect)
    def draw_trade_middle(self):

        if not self.trade_mode:
            return

        square_size = 28
        spacing = 6

        player_bar_height = 100
        trade_bar_height = 100

        # Bereich zwischen Player-Bar und Trade-Bar
        area_top = HEIGHT - player_bar_height - trade_bar_height
        area_bottom = HEIGHT - player_bar_height

        base_y = area_top   # etwas Abstand nach oben
        x_start = 40            # ganz links mit etwas Padding

        resources_order = ["HOLZ", "LEHM", "SCHAF", "WEIZEN", "ERZ"]

        font = pygame.font.SysFont(None, 28)

        # ---------- REQUEST (oben) ----------
        y = base_y

        #label = font.render("Request:", True, (255,255,255))
        #self.screen.blit(label, (x_start, y - 30))

        x = x_start

        for res in resources_order:
            amount = self.trade_request.get(res, 0)

            for _ in range(amount):
                pygame.draw.rect(
                    self.screen,
                    RESOURCE_COLORS[Resource[res]],
                    (x, y, square_size, square_size)
                )
                pygame.draw.rect(
                    self.screen,
                    (0, 0, 0),
                    (x, y, square_size, square_size),
                    2
                )
                x += square_size + spacing

        # ---------- OFFER (unten) ----------
        y = base_y + square_size + 40

        #label = font.render("Offer:", True, (255,255,255))
        #self.screen.blit(label, (x_start, y - 30))

        x = x_start

        for res in resources_order:
            amount = self.trade_offer.get(res, 0)

            for _ in range(amount):
                pygame.draw.rect(
                    self.screen,
                    RESOURCE_COLORS[Resource[res]],
                    (x, y, square_size, square_size)
                )
                pygame.draw.rect(
                    self.screen,
                    (0, 0, 0),
                    (x, y, square_size, square_size),
                    2
                )
                x += square_size + spacing


    def draw_trade_partner_selector(self):
        if self.select_trade_partner_mode== False:
            return

        player = self.logic.current_player
        other_players = [p for p in self.logic.players if p != player]

        font = pygame.font.SysFont(None, 24)

        # Hintergrundrechteck für das Mini-Fenster
        window_width = 300
        window_height = 100
        right_margin = 20
        window_x = WIDTH/2 - 2* 100 + 150 - 60 - right_margin
        window_y = HEIGHT - 5*100 // 2 - 20 + 65
        pygame.draw.rect(
            self.screen,
            (50, 50, 50),
            (window_x, window_y, window_width, window_height)
        )
        pygame.draw.rect(
            self.screen,
            (255, 255, 255),
            (window_x, window_y, window_width, window_height),
            2
        )

        # Kreise für die Spielerfarben
        radius = 25
        spacing = 60
        x_start = window_x + 30
        y = window_y + window_height // 2

        self.player_circle_rects = []  # speichern für Klick-Handling

        for i, p in enumerate(other_players):
            cx = x_start + i * spacing
            cy = y
            pygame.draw.circle(self.screen, p.color, (cx, cy), radius)
            pygame.draw.circle(self.screen, (255, 255, 255), (cx, cy), radius, 2)

            # Namen drunter schreiben
            #text = font.render(p.name, True, (255, 255, 255))
            #text_rect = text.get_rect(center=(cx, cy + radius + 10))
            #self.screen.blit(text, text_rect)

            # Rechteck speichern für Klick-Erkennung
            self.player_circle_rects.append((pygame.Rect(cx - radius, cy - radius, radius*2, radius*2), p))

    def draw_harbors(self):
        for harbor in self.logic.board.harbors:

            # Position der beiden Vertices
            x1, y1 = self.axial_to_pixel_vertex(harbor.vertex1)
            x2, y2 = self.axial_to_pixel_vertex(harbor.vertex2)

            # Mittelpunkt der Kante
            edge_mid_x = (x1 + x2) / 2
            edge_mid_y = (y1 + y2) / 2

            # Mittelpunkt des Tiles (Wasser-Tile)
            tile_x, tile_y = self.axial_to_pixel(harbor.q, harbor.r)

            # Richtung vom Rand ins Tile
            dir_x = tile_x - edge_mid_x
            dir_y = tile_y - edge_mid_y
            length = (dir_x**2 + dir_y**2) ** 0.5
            if length == 0:
                continue

            dir_x /= length
            dir_y /= length

            # Hafen INS Tile verschieben
            offset = 55
            harbor_x = edge_mid_x + dir_x * offset
            harbor_y = edge_mid_y + dir_y * offset
            radius = 18
            font = pygame.font.SysFont(None, 18)

            # Farbe bestimmen
            if harbor.resource is not None:
                color = RESOURCE_COLORS[harbor.resource]  # 2:1
            else:
                color = (220, 220, 220)  # 3:1 neutral


            # 🔹 Zwei Linien zu den Vertices
            pygame.draw.line(self.screen, (0, 0, 0),
                             (harbor_x, harbor_y),
                             (x1, y1), 2)

            pygame.draw.line(self.screen, (0, 0, 0),
                             (harbor_x, harbor_y),
                             (x2, y2), 2)

            # 🔵 Hafen-Kreis
            pygame.draw.circle(self.screen, color, (int(harbor_x), int(harbor_y)), radius)
            pygame.draw.circle(self.screen, (0, 0, 0), (int(harbor_x), int(harbor_y)), radius, 2)


            # Ratio Text
            text = f"{harbor.ratio}:1"
            text_surface = font.render(text, True, (0, 0, 0))
            text_rect = text_surface.get_rect(center=(harbor_x, harbor_y))
            self.screen.blit(text_surface, text_rect)

            # Klickbereich speichern
            harbor.rect = pygame.Rect(
                harbor_x - radius,
                harbor_y - radius,
                radius * 2,
                radius * 2
            )
    def handle_event(self, event):

        if event.type == pygame.MOUSEBUTTONDOWN:

            pos = pygame.mouse.get_pos()

            return {
                "action": "click",
                "pos": pos
            }
        if event.type == pygame.KEYDOWN:
            if event.key == pygame.K_s: 
                    self.build_mode = "SETTLEMENT"
            elif event.key == pygame.K_r: 
                    self.build_mode = "ROAD"
            elif event.key == pygame.K_c:
                    self.build_mode = "CITY"
            elif event.key == pygame.K_f:
                return{
                    "action": "next_turn"
                }
        return None
    def update_lobby(self, players):
        self.lobbyPlayers = players
        self.mode = "lobby"
    def handle_lobby_events(self):
        for event in pygame.event.get():

            if event.type == pygame.QUIT:
                pygame.quit()
                sys.exit()

            if event.type == pygame.MOUSEBUTTONDOWN:
                if self.ready_button_rect.collidepoint(event.pos):
                    return {"action": "ready"}
                if self.addBot_button_rect.collidepoint(event.pos):
                    return {"action": "addBot"}
                if self.removeBot_button_rect.collidepoint(event.pos):
                    return {"action": "removeBot"}
                if self.start_button_rect.collidepoint(event.pos):
                    return {"action": "start_game"}
                for rect, color in self.color_circle_rects:
                    if rect.collidepoint(event.pos):
                        return {
                        "action": "change_color",
                        "color": color
                        }

        return None
    def draw_lobby(self):
        self.screen.fill((30, 30, 30))
        image = self.images.get("BACKGROUND")
        self.screen.blit(image, (0, 0))

        font_title = pygame.font.SysFont(None, 60)
        font = pygame.font.SysFont(None, 36)

        # Titel
        title = font_title.render("Lobby", True, (255,255,255))
        self.screen.blit(title, (WIDTH//2 - 65, 50))

        # Spielerliste
        y_start = 150

        for i, player in enumerate(self.lobbyPlayers):
            name = player["name"]
            ready = player["ready"]

            color = (0, 200, 0) if ready else (255, 0, 0)

            text = font.render(f"{name}", True, player["color"])
            self.screen.blit(text, (WIDTH//2 - 150, y_start + i*50))

            status = font.render("READY" if ready else "NOT READY", True, color)
            self.screen.blit(status, (WIDTH//2 +50, y_start + i*50))

        # Ready Button
        pygame.draw.rect(self.screen, (70,70,70), self.ready_button_rect)
        pygame.draw.rect(self.screen, (255,255,255), self.ready_button_rect, 2)

        btn_text = font.render("READY", True, (255,255,255))
        text_rect = btn_text.get_rect(center=self.ready_button_rect.center)
        self.screen.blit(btn_text, text_rect)

        # AddBot Button
        pygame.draw.rect(self.screen, (70,70,70), self.addBot_button_rect)
        pygame.draw.rect(self.screen, (255,255,255), self.addBot_button_rect, 2)

        btn_text = font.render("Add Bot", True, (255,255,255))
        text_rect = btn_text.get_rect(center=self.addBot_button_rect.center)
        self.screen.blit(btn_text, text_rect)

        # RemoveBot Button
        pygame.draw.rect(self.screen, (70,70,70), self.removeBot_button_rect)
        pygame.draw.rect(self.screen, (255,255,255), self.removeBot_button_rect, 2)

        btn_text = font.render("Remove Bot", True, (255,255,255))
        text_rect = btn_text.get_rect(center=self.removeBot_button_rect.center)
        self.screen.blit(btn_text, text_rect)

        # Start Button NUR für Host
        host_player = True
        if host_player:
            start_rect = pygame.Rect(WIDTH//2 - 100, HEIGHT - 60, 200, 50)
            pygame.draw.rect(self.screen, (0,150,0), start_rect)
            pygame.draw.rect(self.screen, (255,255,255), start_rect, 2)
            start_text = font.render("START GAME", True, (255,255,255))
            text_rect = start_text.get_rect(center=start_rect.center)
            self.screen.blit(start_text, text_rect)
            self.start_button_rect = start_rect

        
        #Farbauswahlmodus
        color_title = font.render("Farbe wählen:", True, (255,255,255))
        self.screen.blit(color_title, (WIDTH//2 - 90, HEIGHT - 330))

        radius = 20
        spacing = 60
        start_x = WIDTH//2 - (len(self.available_colors) * spacing)//2 + 30
        y = HEIGHT - 270

        self.color_circle_rects = []

        for i, color in enumerate(self.available_colors):
            cx = start_x + i * spacing
            cy = y

            pygame.draw.circle(self.screen, color, (cx, cy), radius)
            pygame.draw.circle(self.screen, (255,255,255), (cx, cy), radius, 2)

            # Rect für Klick speichern
            rect = pygame.Rect(cx - radius, cy - radius, radius*2, radius*2)
            self.color_circle_rects.append((rect, color))

    def drawWinner(self):
        
        # Halbtransparentes schwarzes Overlay
        overlay = pygame.Surface((WIDTH, HEIGHT), pygame.SRCALPHA)
        overlay.fill((0, 0, 0, 180))  # RGBA (letzter Wert = Transparenz)
        self.screen.blit(overlay, (0, 0))

        # Pokal zeichnen
        self.draw_trophy()


        
    def draw_trophy(self):
        center_x = WIDTH // 2
        center_y = HEIGHT // 2
        
        image = self.images.get("POKAL")
        rect = image.get_rect()
        rect.center = (center_x, center_y + 50)
        self.screen.blit(image, rect)
        gold = (212, 175, 55)
        dark_gold = (180, 140, 40)

        # Kelch (oben)
        #pygame.draw.ellipse(self.screen, gold, (center_x - 200, center_y - 250, 400, 200))
    
        # Hals
        #pygame.draw.rect(self.screen, gold, (center_x - 75, center_y - 100, 150, 150))
    
        # Fuß
        #pygame.draw.rect(self.screen, dark_gold, (center_x - 200, center_y + 50, 400, 80))
        #pygame.draw.rect(self.screen, gold, (center_x - 120, center_y + 130, 240, 60))

        # Henkel links
        #pygame.draw.arc(self.screen, gold, (center_x - 320, center_y - 200, 200, 250),
        #                1.5, 4.5, 15)

        # Henkel rechts
        #pygame.draw.arc(self.screen, gold, (center_x + 120, center_y - 200, 200, 250),
        #                -1.5, 1.5, 15)

        # Gewinner-Text
        font = pygame.font.SysFont("arial", 100, bold=True)
        winner = None
        for player in self.logic.players:
            if player.victoryPoints>= 10:
                winner = player 
        text = font.render(f"SIEG für {winner.name}", True, (255, 255, 255))
        text_rect = text.get_rect(center=(center_x, center_y - 300))
        self.screen.blit(text, text_rect)

    def draw_trade_popup(self):
        for playerDeclined in self.logic.playersDeclined:
            if playerDeclined == self.logic.players[self.player_index]:
                return
        if self.logic.playerTrade is None:
            return

        offer, request = self.logic.playerTrade


        # Für den empfangenden Spieler muss es umgedreht werden
        if self.logic.current_player == self.logic.players[self.player_index]:
            inverted_offer = offer
            inverted_request = request
        else:
            inverted_offer = request
            inverted_request = offer

        popup_width = 350
        popup_height = 200
        margin = 270  # weiter nach links verschoben (überdeckt Sidebar nicht)

        popup_x = WIDTH - popup_width - margin
        popup_y = 20

        # Hintergrund
        pygame.draw.rect(self.screen, (50, 50, 50),
                         (popup_x, popup_y, popup_width, popup_height))
        pygame.draw.rect(self.screen, (255, 255, 255),
                         (popup_x, popup_y, popup_width, popup_height), 2)

        font = pygame.font.SysFont(None, 28)

        # Titel
        title = font.render("Handelsangebot", True, (255, 255, 255))
        self.screen.blit(title, (popup_x + 20, popup_y + 15))

        square_size = 28
        spacing = 6
        resources_order = ["HOLZ", "LEHM", "SCHAF", "WEIZEN", "ERZ"]

        # -------- DU BEKOMMST --------
        y = popup_y + 75
        x = popup_x + 20

        label_get = font.render("Du bekommst:", True, (255, 255, 255))
        self.screen.blit(label_get, (x, y - 30))

        for res in resources_order:
            amount = inverted_request.get(res, 0)
            for _ in range(amount):
                pygame.draw.rect(
                    self.screen,
                    RESOURCE_COLORS[Resource[res]],
                    (x, y, square_size, square_size)
                )
                pygame.draw.rect(
                    self.screen,
                    (0, 0, 0),
                    (x, y, square_size, square_size),
                    2
                )
                x += square_size + spacing

        # -------- DU GIBST --------
        y = popup_y + 140
        x = popup_x + 20

        label_give = font.render("Du gibst:", True, (255, 255, 255))
        self.screen.blit(label_give, (x, y - 30))

        for res in resources_order:
            amount = inverted_offer.get(res, 0)
            for _ in range(amount):
                pygame.draw.rect(
                    self.screen,
                    RESOURCE_COLORS[Resource[res]],
                    (x, y, square_size, square_size)
                )
                pygame.draw.rect(
                    self.screen,
                    (0, 0, 0),
                    (x, y, square_size, square_size),
                    2
                )
                x += square_size + spacing

        # -------- Buttons --------
        button_size = 35
        if self.logic.players[self.player_index] != self.logic.current_player:
            self.trade_accept_rect = pygame.Rect(
                popup_x + popup_width - 90,
                popup_y + popup_height - 50,
                button_size,
                button_size
            )
            pygame.draw.rect(self.screen, (0, 150, 0), self.trade_accept_rect)
            pygame.draw.rect(self.screen, (0, 0, 0), self.trade_accept_rect, 2)

            check = font.render("V", True, (255, 255, 255))
            self.screen.blit(check, check.get_rect(center=self.trade_accept_rect.center))

        self.trade_decline_rect = pygame.Rect(
            popup_x + popup_width - 45,
            popup_y + popup_height - 50,
            button_size,
            button_size
        )
        pygame.draw.rect(self.screen, (150, 0, 0), self.trade_decline_rect)
        pygame.draw.rect(self.screen, (0, 0, 0), self.trade_decline_rect, 2)

        cross = font.render("X", True, (255, 255, 255))
        self.screen.blit(cross, cross.get_rect(center=self.trade_decline_rect.center))

    def draw_dice_histogram(self):

        dices = self.logic.dices 

        x_start = 40
        y_start = 180
        bar_height = 28
        spacing = 10
        max_width = 300

        font = pygame.font.SysFont(None, 30)

        max_value = max(dices.values()) if dices.values() else 1
        if max_value == 0:
            max_value = 1

        for i, number in enumerate(sorted(dices.keys())):
            value = dices[number]

            # Balkenlänge relativ zum Maximum
            width = int((value / max_value) * max_width)

            y = y_start + i * (bar_height + spacing)

            # Balken
            pygame.draw.rect(
                self.screen,
                (255, 255, 255),
                (x_start, y, width, bar_height)
            )

            # Zahl links (Würfelzahl)
            number_text = font.render(str(number), True, (255,255,255))
            self.screen.blit(number_text, (x_start - 25, y))

            # Häufigkeit rechts
            value_text = font.render(str(value), True, (255,255,255))
            self.screen.blit(value_text, (x_start + width + 10, y))

    def draw_raise_hand_button(self):
        player = self.logic.players[self.player_index]
        if len(self.logic.players) <= 4 or self.logic.setupPhase:
            return
        button_width = 90
        button_height = 45

        x = WIDTH - 110
        y = HEIGHT - 70

        # wenn fertig mit bauen in der bauphase oder hand schon gehoben, wird kein button mehr angezeigt
        if ((self.logic.buildPhase and self.logic.raisedHands[player] == False) or (not self.logic.buildPhase) and self.logic.raisedHands[player] == True):
            self.raise_hand_rect = None
            return
        
        self.raise_hand_rect = pygame.Rect(x, y, button_width, button_height)

        pygame.draw.rect(self.screen, (70,70,70), self.raise_hand_rect)
        pygame.draw.rect(self.screen, (255,255,255), self.raise_hand_rect, 2)

        font = pygame.font.SysFont(None, 28)

        if self.logic.buildPhase:
            text = font.render("Fertig", True, (255,255,255))
        else:
            if self.logic.raisedHands[player]:
                text = font.render("Hand ✓", True, (255,255,255))
            else:
                text = font.render("Hand", True, (255,255,255))

        text_rect = text.get_rect(center=self.raise_hand_rect.center)
        self.screen.blit(text, text_rect)