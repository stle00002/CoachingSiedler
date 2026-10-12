import random
from resource import Resource
from bot import Bot
from player import Player
from board import Board
import pygame

class Logic:
    def __init__(self):
        self.players = []
        self.board = None
        self.current_player = None
        self.current_player_index = 0
        self.robberTile = None
        self.setupPhase = True
        self.isNotFinished = True
        self.moveRobberMode = False
        self.discardResourcesMode = False
        self.stealMode = False
        self.login = True
        self.setUpSettlement = False
        self.setUpRoad = False
        self.setUpOrder = []
        self.player_count = 2
        self.dice1 = None
        self.dice2 = None
        self.dice = None
        self.name_inputs = ["", "", "", "", "", "", "", "", ""]
        self.playedCard = None
        self.finished = False
        self.freeRoads = 0
        self.playerTrade = None
        self.playersDeclined = []
        self.raisedHands= {}
        self.buildPhase = False
        self.currentPlayerWithMostKnights = None
        self.würfelMode = False
        self.goldChoices = {}
        self.dices = {
            2: 0,
            3: 0,
            4: 0,
            5: 0,
            6: 0,
            7: 0,
            8: 0,
            9: 0,
            10: 0,
            11: 0,
            12: 0,
        }
        self.tradeId = 0

    def createBoard(self, playerCount, custom_map=None):
        self.board = Board(playerCount, custom_map)
        
    def start(self):
        for player in self.players:
            self.raisedHands[player] = False
        self.current_player = self.players[0]

        for tile in self.board.tiles:
            if tile.resource.name == "WÜSTE":
                self.robberTile = tile
                break
    def startSetupPhase(self):
        self.setupPhase = True
        self.current_player_index = 0
        self.current_player = self.players[0]
        self.setUpSettlement = True
        self.setUpRoad = False
        self.setUpOrder = []
        for player in self.players:
            self.setUpOrder.append(player)
        rev = self.players.copy()
        rev.reverse()
        for player in rev:
            self.setUpOrder.append(player)
        self.current_player = self.setUpOrder.pop()

    def nextStepSetupPhase(self):

        if self.setUpSettlement:
            self.setUpSettlement = False
            self.setUpRoad = True
        else:
            if self.setUpRoad:
                self.setUpSettlement = True
                self.setUpRoad = False
                if len(self.setUpOrder) > 0:
                    self.current_player = self.setUpOrder.pop()
                    if len(self.setUpOrder) < len(self.players):
                        self.board.secondSetupPhase = True
                else:
                    self.setupPhase = False
                    self.würfelMode = True

    def next_turn(self):
        self.buildPhase = False
        self.freeRoads = 0

        self.current_player_index = (self.current_player_index + 1) % len(self.players)
        self.current_player = self.players[self.current_player_index]
        self.isNotFinished = True
        self.würfelMode = True
        self.playerTrade = None
        self.playersDeclined = []
        #pygame.mixer.init()
        #pygame.mixer.music.load("src/S/YourTurn.wav")
        #pygame.mixer.music.play()
        for player in self.players:
            if player.victoryPoints + player.secretVictoryPoints >= 10:
                self.finished = True
                self.revealVictoryPoints()

    def roll_dice(self):
        self.würfelMode = False
        self.dice1 =  random.randint(1, 6)
        self.dice2 =  random.randint(1, 6)
        self.dice = self.dice1 + self.dice2
        self.dices[self.dice] += 1
        pygame.mixer.init()
        pygame.mixer.music.load("src/S/Dice.wav")
        pygame.mixer.music.play()
        if self.dice == 7:
            doneWithDiscarding = True
            if len(self.players)> 4:
                discardLimit = 7
            else:
                discardLimit = 7
            for p in self.players:
                if p.countResources() > discardLimit:
                    p.hasToDiscard = p.countResources() // 2
                    if isinstance(p, Bot):
                        while p.hasToDiscard > 0:
                            p.discardCard()
                            p.hasToDiscard -= 1
                    if p.hasToDiscard > 0:
                        doneWithDiscarding = False
            if doneWithDiscarding:
                self.moveRobberMode = True
            else:
                self.discardResourcesMode = True
            return 7


        self.distributeResources(self.dice)
        return self.dice
    def distributeResources(self, dice_number):
        for tile in self.board.tiles:
            if tile.number == dice_number and tile != self.robberTile:

                for vertex in tile.vertices:
                    if vertex.owner is None:
                        continue

                    player = vertex.owner

                    amount = 2 if vertex.isCity else 1

                    if tile.resource.name == "GOLD":
                        self.goldChoices[player] = (
                            self.goldChoices.get(player, 0) + amount
                        )
                    else:
                        player.resources[tile.resource.name] += amount
    def checkWinner(self):
        for player in self.players:
            if player.victoryPoints >= 10:
                return player
        return None



    def getHarborVertices(self, harbor):
        """Findet die zwei Vertices der Küstenkante eines Wasser-Hafens."""

        directions = self.board.HEX_DIRECTIONS
        harbor_pos = (harbor.q, harbor.r)

        tile_map = {
            (tile.q, tile.r): tile
            for tile in self.board.tiles
        }

        # Das Land-Tile suchen, dessen Nachbarposition der Hafen ist.
        for tile in self.board.tiles:
            if tile.resource is Resource.WASSER:
                continue

            for direction, (dq, dr) in enumerate(directions):
                water_pos = (tile.q + dq, tile.r + dr)

                if water_pos != harbor_pos:
                    continue

                # Die Küstenkante liegt zwischen den beiden Ecken
                # direction-1 und direction.
                corner_indices = (
                    (direction - 1) % 6,
                    direction
                )

                found_vertices = []

                for corner_index in corner_indices:
                    # Ein Vertex aus createVertices() wird über die
                    # beiden benachbarten Tile-Positionen identifiziert.
                    prev_direction = corner_index
                    next_direction = (corner_index + 1) % 6

                    d1 = directions[prev_direction]
                    d2 = directions[next_direction]

                    pos1 = (tile.q + d1[0], tile.r + d1[1])
                    pos2 = (tile.q + d2[0], tile.r + d2[1])

                    vertex_found = None

                    for vertex in tile.vertices:
                        adjacent_positions = {
                            (t.q, t.r)
                            for t in vertex.adjacentTiles
                        }

                        if pos1 in adjacent_positions and pos2 in adjacent_positions:
                            vertex_found = vertex
                            break

                    found_vertices.append(vertex_found)

                if all(v is not None for v in found_vertices):
                    return found_vertices[0], found_vertices[1]

                print(
                    "Küstenkante gefunden, aber Vertices fehlen:",
                    "Land-Tile =", (tile.q, tile.r),
                    "Wasser =", harbor_pos,
                    "Richtung =", direction + 1
                )

        print(
            "Kein angrenzendes Land-Tile für Hafen gefunden:",
            harbor_pos
        )
        return None, None

    def getRatio(self, giveResource, player):
        """Berechnet das beste Tauschverhältnis des Spielers."""
        if giveResource not in Resource.__members__:
            return 4

        cost = 4

        for harbor in self.board.harbors:
            vertex1, vertex2 = self.getHarborVertices(harbor)

            if vertex1 is None and vertex2 is None:
                continue

            # Der Spieler muss an mindestens einem Hafen-Eckpunkt
            # eine Siedlung oder Stadt besitzen.
            owns_harbor = (
                vertex1.owner == player
                or vertex2.owner == player
            )

            if not owns_harbor:
                continue

            # Allgemeiner Hafen, z. B. 3:1
            if harbor.resource is None:
                cost = min(cost, harbor.ratio)

            # Ressourcenspezifischer Hafen, z. B. Holz 2:1
            elif harbor.resource == Resource[giveResource]:
                cost = min(cost, harbor.ratio)

        return cost


    def can_trade_with_bank(self, player, give_resource):
        """Prüft, ob der Spieler genug Ressourcen abgeben kann."""
        if give_resource not in player.resources:
            return False

        cost = self.getRatio(give_resource, player)

        return player.resources[give_resource] >= cost


    def trade_with_bank(self, give_resource, get_resource):
        """Führt den Banktausch tatsächlich aus."""
        player = self.current_player

        if player is None:
            return False

        if give_resource is None or get_resource is None:
            return False

        if give_resource == get_resource:
            return False

        if (
            give_resource not in player.resources
            or get_resource not in player.resources
        ):
            return False

        cost = self.getRatio(give_resource, player)

        # Genug Ressourcen vorhanden?
        if player.resources[give_resource] < cost:
            return False

        # Tausch durchführen
        player.resources[give_resource] -= cost
        player.resources[get_resource] += 1

        return True


    def tradeWithBank(self, trade_request, trade_offer):
        """Prüft die Handelsanfrage und führt den Banktausch aus."""
        player = self.current_player

        if player is None:
            return False

        give_resource = None
        give_count = 0

        # Genau eine Ressourcenart abgeben
        for resource, count in trade_offer.items():
            if count < 0:
                return False

            if count > 0:
                if give_resource is not None:
                    return False

                give_resource = resource
                give_count = count

        if give_resource is None:
            return False

        if give_resource not in player.resources:
            return False

        # Genau eine Ressource erhalten
        get_resource = None
        get_count = 0

        for resource, count in trade_request.items():
            if count < 0:
                return False

            if count > 0:
                if get_resource is not None:
                    return False

                get_resource = resource
                get_count = count

        if get_resource is None or get_count != 1:
            return False

        if get_resource not in player.resources:
            return False

        if give_resource == get_resource:
            return False

        # Die angebotene Anzahl muss exakt dem Tauschverhältnis entsprechen.
        cost = self.getRatio(give_resource, player)

        if give_count != cost:
            return False

        return self.trade_with_bank(give_resource, get_resource)
    
    def canTradeWithPlayer(self, player, trade_request, trade_offer):
        for resource,count in trade_offer.items():
            if self.current_player.resources[resource] < count:
                return False
        for resource, count in trade_request.items():
            if player.resources[resource] < count:
                return False
        return True
    def tradeWithPlayer(self, player, trade_request, trade_offer):
        if not self.canTradeWithPlayer(player, trade_request, trade_offer):
            return False
        for resource, count in trade_offer.items():
            player.resources[resource] += count
            self.current_player.resources[resource] -= count
        for resource, count in trade_request.items():
            self.current_player.resources[resource] += count
            player.resources[resource] -= count
        return True

    def getPlayersOnTile(self, tile):
        players = set()

        for vertex in tile.vertices:
            if vertex.owner and vertex.owner != self.current_player:
                players.add(vertex.owner)

        return list(players)
    
    def stealFromPlayer(self, victim):
        possible_resources = []

        for resource, amount in victim.resources.items():
            if amount > 0:
                possible_resources.append(resource)

        if not possible_resources:
            return

        stolen_resource = random.choice(possible_resources)

        victim.resources[stolen_resource] -= 1
        self.current_player.resources[stolen_resource] += 1

    def playDevelopmentCard(self, type, res1, res2, player):
        if self.current_player.developmentCards.get(type) == 0 or type == "SIEGPUNKT" or self.playedCard is not None:
            return
        else:
            self.current_player.developmentCards[type] -= 1
            if type == "RITTER":
                self.moveRobberMode = True

                self.current_player.knights += 1
                
                if self.currentPlayerWithMostKnights == None:
                    self.currentPlayerWithMostKnights = self.current_player, self.current_player.knights
                
                else:
                    player, count = self.currentPlayerWithMostKnights
                    if self.current_player.knights > count:
                        if count >= 3:
                            player.victoryPoints -= 2
                        if self.current_player.knights >= 3:
                            self.current_player.victoryPoints += 2
                        self.currentPlayerWithMostKnights = self.current_player, self.current_player.knights
                
            if type == "MONOPOL":
                count = 0
                for p in self.players:
                    count += p.resources[res1]
                    p.resources[res1] = 0
                self.current_player.resources[res1] = count
            if type == "ERFINDUNG":
                self.current_player.resources[res1] += 1
                self.current_player.resources[res2] += 1
            if type == "STRAßENBAU":
                if len(player.roads) <= 13:
                    self.freeRoads = 2
                elif len(player.roads) == 14:
                    self.freeRoads = 1

    def openPlayerTrade(self, offer, request):
        self.playerTrade = offer,request, self.tradeId, self.current_player
        self.playersDeclined = []
        self.tradeId += 1
    def revealVictoryPoints(self):
        for player in self.players:
            player.victoryPoints = player.victoryPoints + player.secretVictoryPoints
            player.secretVictoryPoints = 0
    def specialBuildPhase(self):
        self.buildPhase = True
    def raiseHand(self,player, value):
        self.raisedHands[player] = value
    def checkFinishedSpecialBuildPhase(self):
        ready = True
        for player, raised  in self.raisedHands.items():
            if raised:
                ready = False
        if ready:
            self.next_turn()

    def chooseGoldResource(self, player, resource):
        valid_resources = [
            "HOLZ",
            "LEHM",
            "SCHAF",
            "WEIZEN",
            "ERZ"
        ]

        if resource not in valid_resources:
            return False

        choices = self.goldChoices.get(player, 0)

        if choices <= 0:
            return False

        player.resources[resource] += 1

        choices -= 1

        if choices <= 0:
            self.goldChoices.pop(player, None)
        else:
            self.goldChoices[player] = choices

        return True
    
