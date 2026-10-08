from resource import Resource
from player import Player
import random
SETTLEMENT_COST = {
    "HOLZ": 1,
    "LEHM": 1,
    "SCHAF": 1,
    "WEIZEN": 1
}

CITY_COST = {
    "WEIZEN": 2,
    "ERZ": 3
}

ROAD_COST = {
    "HOLZ": 1,
    "LEHM": 1
}
DEVELOPMENT_COST = {
    "SCHAF": 1,
    "WEIZEN": 1,
    "ERZ": 1
}

class Bot(Player):
    def __init__(self, name, color, is_host=False):
        super().__init__(name, color, is_host)
        self.logic = None
        self.resourceStrength = {
            Resource.HOLZ : 0,
            Resource.LEHM : 0,
            Resource.SCHAF: 0,
            Resource.WEIZEN: 0,
            Resource.ERZ: 0,
        }
        self.tradeOffers = []
        self.trades = []
    
    def take_turn(self, logic):
        actions = []
        self.logic = logic

        if self.logic.goldChoices.get(self, 0) > 0:
            resource = None
            missing = self.missingResource(CITY_COST)
            if missing:
                resource = missing
            else:
                missing = self.missingResource(SETTLEMENT_COST)
                if missing:
                    resource = missing
                else:
                    missing = self.missingResource(DEVELOPMENT_COST)
                    if missing:
                        resource = missing
            if resource == None:
                self.updateResourceStrength()

                needed_res = None
                max_need = -999

                for res in self.resources:
                    value = (10 - self.resourceStrength[Resource[res]]) - self.resources[res]
                    if res == "ERZ" or res == "WEIZEN":
                        value + 1
                    if value > max_need:
                        max_need = value
                        needed_res = res
                if needed_res == None:
                    print("NO GOOD RESOURCE TOO NEED")
                    resource = "WEIZEN"
                else:
                    resource = needed_res
                
                

            return {
                "action": "chooseGoldResource",
                "playerName": self.name,
                "resource": resource,
            }
        if self.logic.current_player != self or self.logic.buildPhase:
            if self.logic.playerTrade != None:
                if self.wantsPlayerTrade():
                    return {
                        "action": "acceptTrade",
                        "playerName": self.name
                    }
                else:
                    for player in self.logic.playersDeclined:
                        if player == self:
                            return None
                    return {
                        "action": "declineTrade",
                        "playerName": self.name
                    }
            if self.logic.buildPhase == False and self.logic.raisedHands[self] == False:
                success1 = self.tryToBuildCity()
                success2 = self.tryToBuildSettlement()
                success3 = self.tryToBuyDevelopmentCard()
                success4 = self.tryToBuildRoad()
                if success1 or success2 or success3 or success4:
                    return {
                        "action": "raiseHand",
                        "playerName": self.name,
                        "value": True
                    }
                else:
                    return None
            elif self.logic.raisedHands[self] == True and self.logic.buildPhase == True:
                success = self.tryToBuildCity()
                if success:
                    return success
                success = self.tryToBuildSettlement()
                if success:
                    return success
                success = self.tryToBuyDevelopmentCard()
                if success:
                    return success
                success = self.tryToBuildRoad()
                if success:
                    return success
                return {
                        "action": "finishBuild",
                        "playerName": self.name
                    }
            return None

        self.updateResourceStrength()

        if logic.setupPhase:
            if len(self.settlements) == 0:
                return self.getBestPlace()
            if len(self.settlements) == 1 and len(self.roads) == 0:
                vertex = self.getCurrentStartSettlement()
                return self.getBestRoadFromVertex(vertex)
            if len(self.settlements) == 1 and len(self.roads) == 1:
                return self.getBestPlace()
            if len(self.settlements) == 2 and len(self.roads)== 1:
                vertex = self.getCurrentStartSettlement()
                return self.getBestRoadFromVertex(vertex)
            print("something went wrong since in setupphase i can only build 2 settlements and two roads")
        if logic.würfelMode and logic.current_player == self:
            self.trades = []
            self.tradeOffers = []
            return{"action": "roll_dice"}
        
        if logic.moveRobberMode and logic.current_player == self:
            max_tile, max_value = (None, 0)

            #determine best player and add value+2 to the tile with him
            max_player, max_points = (None, 0)
            for player in self.logic.players:
                if player.victoryPoints > max_points and player != self:
                    max_player = player
                    max_points = player.victoryPoints
            for tile in logic.board.tiles:
                if tile.resource == Resource.WÜSTE or tile.resource == Resource.WASSER or logic.robberTile == tile:
                    continue
                value = self.getValue(tile.number)
                if tile.resource == Resource.ERZ or tile.resource == Resource.WEIZEN:
                    value += 1
                if tile.resource == Resource.GOLD:
                    value += 3
                for vertex in tile.vertices:
                    if vertex.owner != None and vertex.owner != self:
                        value += 2
                        if vertex.isCity:
                            value += 1
                    if vertex.owner == max_player:
                        value += 4
                    if vertex.owner == self:
                        value -= 10
                if value > max_value:
                    max_tile = tile
                    max_value = value
            return {"action": "moveRobber",
                    "tileId": max_tile.id}
        if logic.stealMode and logic.current_player == self:
            vertices = logic.robberTile.vertices
            possibleEnemiesToStealFrom = []
            for vertex in vertices:
                if not vertex.owner == None and vertex.owner != self:
                    possibleEnemiesToStealFrom.append(vertex.owner)
            max_player, max_points = (None, 0)
            for player in possibleEnemiesToStealFrom:
                if player.victoryPoints > max_points:
                    max_player = player
                    max_points = player.victoryPoints
            #wenn kein player gefunden wurde zum ziehen, muss man ausversehen bei sich selbst gesetzt haben
            if max_player == None:
                max_player = self
            return {
                "action": "steal",
                "playerName": max_player.name
            }
        if self.logic.playerTrade != None:
            return None
        if self.developmentCards["RITTER"]> 0:
            return{
                "action": "playDevelopmentCard",
                "card": "RITTER",
                "res1": None,
                "res2": None
            }
        if self.developmentCards["STRAßENBAU"] > 0:
            print("straßenbau ausgeführt")
            return{
                "action": "playDevelopmentCard",
                "card": "STRAßENBAU",
                "res1": None,
                "res2": None               
            }
        if self.developmentCards["ERFINDUNG"] > 0:
            print("erfindung ausgeführt")
            success = self.tryToPlayInvention()
            if success:
                return success
            
        if self.developmentCards["MONOPOL"] > 0:
            success = self.tryToPlayMonopol()
            if success:
                return success

        success = self.tryToBuildCity()
        if success:
            return success
        success = self.tryToBuildSettlement()
        if success:
            return success
        success = self.tryToBuyDevelopmentCard()
        if success:
            return success
        success = self.tryToBuildRoad()
        if success:
            return success
        if len(self.trades) < 3:
            success = self.tryToTrade()
            if success:
                self.trades.append(success)
                print(self.resources)
                print(success)
                return success
        for res, count in self.resources.items():
            if count >= 4:
                trade_offer = {
                "HOLZ": 0,
                "LEHM": 0,
                "SCHAF": 0,
                "WEIZEN": 0,
                "ERZ": 0
                }
                trade_request = {
                "HOLZ": 0,
                "LEHM": 0,
                "SCHAF": 0,
                "WEIZEN": 0,
                "ERZ": 0
                }
                ratio = self.logic.getRatio(res, self)
                trade_offer[res] = ratio
                min_res, min_strength = (None, 1000)
                for resource, strength in self.resourceStrength.items():
                    if strength < min_strength and resource.name != res:
                        min_res = resource
                        min_strength = strength
                trade_request[min_res.name] = 1
                return{
                    "action": "tradeWithBank",
                    "request": trade_request,
                    "offer": trade_offer,
                }
        actions.append({"action": "endTurn"})
        if actions:
            return random.choice(actions)  # einfache Auswahl
        return None
    def getValue(self, number):
        match number:
            case 2: 
                return 1
            case 12: 
                return 1
            case 3:
                return 2
            case 11:
                return 2
            case 4:
                return 3
            case 10:
                return 3
            case 5:
                return 4
            case 9:
                return 4
            case 6:
                return 5
            case 8:
                return 5
        return 0

    def getBestPlace(self):
        max_vertex, max_value, max_resourcesStrength = (None, 0, self.resourceStrength.copy())
        for vertex in self.logic.board.vertices:
            resourceStrengthWithCurrentField = self.resourceStrength.copy()
            if not self.logic.board.canBuildSettlement(self, vertex, True):
                continue
            value = 0
            for tile in vertex.adjacentTiles:
                value += self.getValue(tile.number)
                if tile.resource == Resource.ERZ or tile.resource == Resource.WEIZEN:
                    value += 1
                if tile.resource == Resource.GOLD:
                    value += 4
                elif not (tile.resource == Resource.GOLD or tile.resource == Resource.WASSER or tile.resource == Resource.WÜSTE) and resourceStrengthWithCurrentField[tile.resource] == 0: 
                    value += 2
                    resourceStrengthWithCurrentField[tile.resource] += self.getValue(tile.number)
            if value > max_value:
                max_vertex = vertex
                max_value = value
                max_resourcesStrength = resourceStrengthWithCurrentField.copy()
        self.resourceStrength = max_resourcesStrength.copy()
        print(max_value)
        return{
            "action": "buildSettlement",
            "playerName": self.name,
            "vertexId": max_vertex.id
        }
    def discardCard(self):
        self.updateResourceStrength()
        scores = {}
        for res in self.resources:

            score = 0
            score += self.resources[res] * 2
            score += self.resourceStrength[Resource[res]]

            if res in ("ERZ", "WEIZEN"):
                score -= 3
            if res == "SCHAF" and self.resources[res] > 1:
                score += 15

            scores[res] = score

        possible = [res for res in self.resources if self.resources[res] > 0]

        discard_res = max(possible, key=lambda r: scores[r])

        if self.resources[discard_res] == 0:
            print(self.resources)
            raise Exception("negative resources")
        self.resources[discard_res] -= 1

    def roadLeadsToSettlementSpot(self, edge):
        newVertex = None
        for vertex in (edge.vertex1, edge.vertex2):
            noconnectedRoads = True
            for edge2 in vertex.connectedEdges:
                if edge2.owner != None:
                    noconnectedRoads = False
            if noconnectedRoads:
                newVertex = vertex
        if newVertex == None:
            return False
        if self.logic.board.settlementSpot(newVertex):
                return True
        return False
    def updateResourceStrength(self):
        self.resourceStrength = {
            Resource.HOLZ : 0,
            Resource.LEHM : 0,
            Resource.SCHAF: 0,
            Resource.WEIZEN: 0,
            Resource.ERZ: 0,
        }
        for vertex in self.logic.board.vertices:
            if vertex.owner == self:
                for tile in vertex.adjacentTiles:
                    if tile.resource == Resource.WÜSTE or tile.resource == Resource.WASSER or tile.resource == Resource.GOLD:
                        continue
                    self.resourceStrength[tile.resource] += self.getValue(tile.number)
                    if vertex.isCity:
                        self.resourceStrength[tile.resource] += self.getValue(tile.number)
    def wantsPlayerTrade(self):

        offer, request, id, tradingPlayer = self.logic.playerTrade

        give_value = 0
        get_value = 0

        for res, count in request.items():

            if self.resources[res] < count:
                return False

            value = (10 - self.resourceStrength[Resource[res]]) - self.resources[res]
            give_value += count * value

        for res, count in offer.items():

            value = (10 - self.resourceStrength[Resource[res]]) - self.resources[res]
            get_value += count * value

        return get_value > give_value + 3
    
    def getBestRoadFromVertex(self, vertex):
        # determines the best decision for a road in the setupphase
        best_edge = None
        best_value = -1

        for edge in vertex.connectedEdges:
            other_vertex = edge.vertex1 if edge.vertex2 == vertex else edge.vertex2

            # prüfe mögliche zukünftige Settlement Spots
            for edge2 in other_vertex.connectedEdges:
                value = 0
                next_vertex = edge2.vertex1 if edge2.vertex2 == other_vertex else edge2.vertex2

                if self.logic.board.canBuildSettlement(self, next_vertex, True):
                    for tile in next_vertex.adjacentTiles:
                        value += self.getValue(tile.number)
                print(value)
                if value > best_value and value < 11:
                    best_value = value
                    best_edge = edge
        print(f"Best Value {best_value}")
        return{
            "action": "buildRoad",
            "playerName": self.name,
            "edgeId": best_edge.id
        }
    def getCurrentStartSettlement(self):
        for vertex in self.logic.board.vertices:
            if vertex.owner == self:
                roadAlreadyBuilt = False
                for edge in vertex.connectedEdges:
                    if edge.owner == self:
                        roadAlreadyBuilt = True
                if not roadAlreadyBuilt:
                    return vertex
        print("Error there must be one settlement with one road missing")
    def tryToBuildCity(self):
        max_vertex, max_value = None, 0
        for vertex in self.logic.board.vertices:
            if self.logic.board.canBuildCity(self, vertex) and self.logic.board.has_resources(self, CITY_COST):
                value = 0
                for tile in vertex.adjacentTiles:
                    value += self.getValue(tile.number)
                    if tile.resource == Resource.ERZ or tile.resource == Resource.WEIZEN:
                        value += 1
                    if tile.resource == Resource.GOLD:
                        value += 4
                    elif not (tile.resource == Resource.WASSER or tile.resource == Resource.WÜSTE) and self.resourceStrength[tile.resource] < 2: 
                        value += 2
                if value > max_value:
                    max_vertex = vertex
                    max_value = value
        if max_vertex == None:
            return None
        return{
            "action": "buildCity",
            "playerName": self.name,
            "vertexId": max_vertex.id
        }        
    def tryToBuildSettlement(self):
        max_vertex, max_value = None, 0
        for vertex in self.logic.board.vertices:
            if self.logic.board.canBuildSettlement(self, vertex, False) and self.logic.board.has_resources(self, SETTLEMENT_COST):
                value = 0
                for tile in vertex.adjacentTiles:
                    value += self.getValue(tile.number)
                    if tile.resource == Resource.ERZ or tile.resource == Resource.WEIZEN:
                        value += 1
                    if tile.resource == Resource.GOLD:
                        value += 4
                    elif not (tile.resource == Resource.WASSER or tile.resource == Resource.WÜSTE) and self.resourceStrength[tile.resource] < 2: 
                        value += 2
                if value > max_value:
                    max_vertex = vertex
                    max_value = value
        if max_vertex == None:
            return None
        return{
            "action": "buildSettlement",
            "playerName": self.name,
            "vertexId": max_vertex.id
        }
    def tryToBuyDevelopmentCard(self):
        notMostKnights = False
        for player in self.logic.players:
            if player != self and player.knights >= self.knights:
                notMostKnights = True
        if self.logic.board.has_resources(self, DEVELOPMENT_COST) and (self.knights < 3 or notMostKnights) and len(self.logic.board.development_deck) > 0 and self.resourceStrength[Resource.ERZ] > 5 and  self.victoryPoints + self.secretVictoryPoints >= 1:
            return {
                "action": "buyDevelopmentCard",
                "playerName": self.name
            }
    def tryToBuildRoad(self):
        if not (self.logic.board.has_resources(self, ROAD_COST) or self.logic.freeRoads> 0):
            return None
        #first look if you can reach a settlement spot directly with one road
        for edge in self.logic.board.edges:
            #if edge is owned continue
            if edge.owner == self:
                continue
            #if edge cannont be build because its not connected continue
            if not self.logic.board.canBuildRoad(self, edge, False):
                continue
            if self.roadLeadsToSettlementSpot(edge):
                if self.logic.board.canBuildRoad(self, edge, False)and (self.logic.board.has_resources(self, ROAD_COST) or self.logic.freeRoads > 0):
                    return{
                        "action": "buildRoad",
                        "playerName": self.name,
                        "edgeId": edge.id
                    }
        #then look for settlement spots in reach 2
        for edge in self.logic.board.edges:
            #if edge is owned continue
            if edge.owner == self:
                continue
            #if edge cannont be build because its not connected continue
            if not self.logic.board.canBuildRoad(self, edge, False):
                continue
            if self.roadLeadsToSettlementSpot(edge):
                if self.logic.board.canBuildRoad(self, edge, False)and (self.logic.board.has_resources(self, ROAD_COST) or self.logic.freeRoads > 0):
                    return{
                        "action": "buildRoad",
                        "playerName": self.name,
                        "edgeId": edge.id
                    }
            edges1 = edge.vertex1.connectedEdges
            edges2 = edge.vertex2.connectedEdges
            leadsToSettlementSpot = False
            for edge2 in edges1 + edges2:
                if edge2.owner == self:
                    continue
                if self.roadLeadsToSettlementSpot(edge2):
                    leadsToSettlementSpot = True
            if self.logic.board.canBuildRoad(self, edge, False)and (self.logic.board.has_resources(self, ROAD_COST) or self.logic.freeRoads > 0) and leadsToSettlementSpot:
                return{
                    "action": "buildRoad",
                    "playerName": self.name,
                    "edgeId": edge.id
                }
    def tryToTrade(self):
        if self.logic.playerTrade != None:
            return None
        # CITY PRIORITÄT
        missing = self.missingResource(CITY_COST)

        if missing:
            offer = self.getTradeOfferResource()

            if offer and offer != missing:
                self.tradeOffers.append(offer)

                return {
                    "action": "openPlayerTrade",
                    "offer": {"HOLZ":0,"LEHM":0,"SCHAF":0,"WEIZEN":0,"ERZ":0, offer:1},
                    "request": {"HOLZ":0,"LEHM":0,"SCHAF":0,"WEIZEN":0,"ERZ":0, missing:1}
                }

        # SETTLEMENT
        missing = self.missingResource(SETTLEMENT_COST)

        if missing:
            offer = self.getTradeOfferResource()

            if offer and offer != missing:
                self.tradeOffers.append(offer)

                return {
                    "action": "openPlayerTrade",
                    "offer": {"HOLZ":0,"LEHM":0,"SCHAF":0,"WEIZEN":0,"ERZ":0, offer:1},
                    "request": {"HOLZ":0,"LEHM":0,"SCHAF":0,"WEIZEN":0,"ERZ":0, missing:1}
                }

        # DEVELOPMENT CARD
        missing = self.missingResource(DEVELOPMENT_COST)

        if missing:
            offer = self.getTradeOfferResource()

            if offer and offer != missing:
                self.tradeOffers.append(offer)
                return {
                    "action": "openPlayerTrade",
                    "offer": {"HOLZ":0,"LEHM":0,"SCHAF":0,"WEIZEN":0,"ERZ":0, offer:1},
                    "request": {"HOLZ":0,"LEHM":0,"SCHAF":0,"WEIZEN":0,"ERZ":0, missing:1}
                }


        needed_res = None
        max_need = -999

        for res in self.resources:
            value = (10 - self.resourceStrength[Resource[res]]) - self.resources[res]

            if value > max_need:
                max_need = value
                needed_res = res
        offer_res = None
        min_value = 999

        for res in self.resources:

            if self.resources[res] < 2:
                continue

            value = (10 - self.resourceStrength[Resource[res]]) - self.resources[res]

            for alreadyOffered in self.tradeOffers:
                if res == alreadyOffered:
                    value += 90
            if value < min_value:
                min_value = value
                offer_res = res
        if offer_res == None or needed_res == None:
            return None
        self.tradeOffers.append(offer_res)  

        offer = {
        "HOLZ":0,
        "LEHM":0,
        "SCHAF":0,
        "WEIZEN":0,
        "ERZ":0
        }

        request = {
        "HOLZ":0,
        "LEHM":0,
        "SCHAF":0,
        "WEIZEN":0,
        "ERZ":0
        }

        offer[offer_res] = 1
        request[needed_res] = 1

        return {
        "action": "openPlayerTrade",
        "offer": offer,
        "request": request
        }
    
    def tryToPlayInvention(self):
        res1 = None
        res2 = None
        # CITY PRIORITÄT
        missing = self.missingResource(CITY_COST)

        if missing:
            res1 = missing
        else:
            missing1, missing2 = self.missingTwoResources(CITY_COST)
            if missing1 and missing2:
                res1 = missing1
                res2 = missing2
        # SETTLEMENT
        missing = self.missingResource(SETTLEMENT_COST)

        if missing:
            if res1 == None:
                res1 = missing
            elif res2 == None:
                res2 = missing
        else:
            missing1, missing2 = self.missingTwoResources(SETTLEMENT_COST)
            if missing1 and missing2:
                res1 = missing1
                res2 = missing2

        #fill with rare resources
        min_res, min_value = None, 999
        for res, strength in self.resourceStrength.items():
            if strength < min_value:
                min_res = res
                min_value = strength
        if res1 == None:
            res1 = min_res.name
        if res2 == None:
            res2 = min_res.name
        print("Erfindung:")
        print(self.resources)
        print(res1)
        print(res2)
        return {
            "action": "playDevelopmentCard",
            "card": "ERFINDUNG",
            "res1": res1,
            "res2": res2
        }

    def missingTwoResources(self, cost):
        missing1 = None
        missing2 = None
        missing_count = 0
        for res, amount in cost.items():
            if self.resources[res] == amount - 2:
                if missing1 == None and missing2 == None:
                    missing1 = res
                    missing2 = res
                missing_count += 2
            elif self.resources[res] < amount:
                if missing1 == None:
                    missing1 = res
                else:
                    missing2 = res
                missing_count += amount - self.resources[res]

        if missing_count == 2:
            return missing1, missing2

        return None, None
    def missingResource(self, cost):
        missing = None
        missing_count = 0

        for res, amount in cost.items():
            if self.resources[res] < amount:
                missing = res
                missing_count += amount - self.resources[res]

        if missing_count == 1:
            return missing

        return None

    def getTradeOfferResource(self):

        worst_res = None
        worst_value = 999

        for res in self.resources:

            if self.resources[res] < 2:
                continue

            value = (10 - self.resourceStrength[Resource[res]]) - self.resources[res]
            for alreadyOffered in self.tradeOffers:
                if res == alreadyOffered:
                    value += 90
            if value < worst_value:
                worst_value = value
                worst_res = res

        return worst_res
    def chooseMonopolResource(self):
        resource_counts = {
            "HOLZ": 0,
            "LEHM": 0,
            "SCHAF": 0,
            "WEIZEN": 0,
            "ERZ": 0
        }

        for player in self.logic.players:
            if player == self:
                continue

            for res, count in player.resources.items():
                resource_counts[res] += count

        best_res = max(resource_counts, key=resource_counts.get)

        return best_res, resource_counts[best_res]

    def tryToPlayMonopol(self):
        res,count = self.chooseMonopolResource()
        if count > 8:
            return {
                "action": "playDevelopmentCard",
                "card": "MONOPOL",
                "res1": res,
                "res2": None
            }
