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

    def createBoard(self, playerCount):
        self.board = Board(playerCount)
        
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
        pygame.mixer.init()
        pygame.mixer.music.load("src/S/YourTurn.wav")
        pygame.mixer.music.play()
        for player in self.players:
            if player.victoryPoints + player.secretVictoryPoints >= 10:
                self.finished = True
                self.revealVictoryPoints()

    def roll_dice(self):
        self.würfelMode = False
        self.dice = random.randint(1, 6) + random.randint(1, 6)
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
                    if vertex.owner is not None:

                        player = vertex.owner

                        if not vertex.isCity:
                            player.resources[tile.resource.name] += 1

                        else:
                            player.resources[tile.resource.name] += 2
    def checkWinner(self):
        for player in self.players:
            if player.victoryPoints >= 10:
                return player
        return None
    def can_trade_with_bank(self, player, give_resource):
        cost = 4
        for harbor in self.board.harbors:
            if harbor.resource == Resource[give_resource] and (harbor.vertex1.owner == player or harbor.vertex2.owner == player):
                cost = min(harbor.ratio, cost)
            if harbor.resource == None and (harbor.vertex1.owner == player or harbor.vertex2.owner == player):
                cost = min(harbor.ratio, cost)
        return player.resources.get(give_resource, 0) >= cost

    def trade_with_bank(self, give_resource, get_resource):
        if give_resource == None or get_resource == None:
            return False
        player = self.current_player

        if give_resource == get_resource:
            return False

        if not self.can_trade_with_bank(player, give_resource):
            return False
        cost = 4
        for harbor in self.board.harbors:
            if harbor.resource == Resource[give_resource] and (harbor.vertex1.owner == player or harbor.vertex2.owner == player):
                cost = min(harbor.ratio, cost)
            if harbor.resource == None and (harbor.vertex1.owner == player or harbor.vertex2.owner == player):
                cost = min(harbor.ratio, cost)
        player.resources[give_resource] -= cost

        player.resources[get_resource] += 1

        return True
    
    def tradeWithBank(self, trade_request, trade_offer):
        player = self.current_player
        giveResource = None
        for resource, count in trade_offer.items():
            if count > 0:
                if giveResource is not None:
                    return False
                giveResource = resource
                cost = 4
                for harbor in self.board.harbors:
                    if harbor.resource == Resource[giveResource] and (harbor.vertex1.owner == player or harbor.vertex2.owner == player):
                        cost = min(harbor.ratio, cost)
                    if harbor.resource == None and (harbor.vertex1.owner == player or harbor.vertex2.owner == player):
                        cost = min(harbor.ratio, cost)
                if count != cost:
                    return False
        getResource = None   
        for resource, count in trade_request.items():
            if count > 0:
                if getResource is not None:
                    return False
                getResource = resource
                if count != 1:
                    return False
        return self.trade_with_bank(giveResource, getResource)


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
        self.playerTrade = offer,request
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

    def getRatio(self, giveResource, player):
        cost = 4
        for harbor in self.board.harbors:
            if harbor.resource == Resource[giveResource] and (harbor.vertex1.owner == player or harbor.vertex2.owner == player):
                cost = min(harbor.ratio, cost)
            if harbor.resource == None and (harbor.vertex1.owner == player or harbor.vertex2.owner == player):
                cost = min(harbor.ratio, cost)
        return cost
    
