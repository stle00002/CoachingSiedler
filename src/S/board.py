from collections import deque
import random
from resource import Resource, toString
import pygame
from harbor import Harbor
from edge import Edge
from vertex import Vertex
from tile import Tile
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


class Board:
    def __init__(self, playerCount):
        self.secondSetupPhase = False
        self.currentLongestRoad = 0
        self.currentPlayerWithLongestRoad = None
        self.currentId = 0
        self.development_deck = (
            ["RITTER"] * 14 +
            ["1SIEGPUNKT"] * 5 +
            ["STRAßENBAU"] * 2 +
            ["MONOPOL"] * 2 +
            ["ERFINDUNG"] * 2
        )
        random.shuffle(self.development_deck)
        self.tiles:list[Tile] = []
        self.vertices:list[Vertex] = []
        self.edges:list[Edge] = []
        self.harbors:list[Harbor] = []
        if playerCount <= 4:
            self.radius = 3
            self.resources = (
        [Resource.HOLZ]*4 +
        [Resource.LEHM]*3 +
        [Resource.SCHAF]*4 +
        [Resource.WEIZEN]*4 +
        [Resource.ERZ]*3 +
        [Resource.WÜSTE]
    )
            self.tiles_positions = [
    # obere Wasser-Rand-Reihe (q = -3)
    (-3, 0), (-3, 1), (-3, 2), (-3, 3),
    # zweite Reihe (q = -2)
    (-2, -1), (-2, 0), (-2, 1), (-2, 2), (-2, 3),
    # dritte Reihe (q = -1)
    (-1, -2), (-1, -1), (-1, 0), (-1, 1), (-1, 2), (-1, 3),
    # mittlere Reihe (q = 0)
    (0, -3), (0, -2), (0, -1), (0, 0), (0, 1), (0, 2), (0, 3),
    # untere mittlere Reihe (q = 1)
    (1, -3), (1, -2), (1, -1), (1, 0), (1, 1), (1, 2),
    # untere Reihe (q = 2)
    (2, -3), (2, -2), (2, -1), (2, 0), (2, 1),
    # unterer Wasser-Rand (q = 3)
    (3, -3), (3, -2), (3, -1), (3, 0)
]
        else: 
            self.radius = 4
            self.resources = (
        [Resource.HOLZ]*7 +
        [Resource.LEHM]*7 +
        [Resource.SCHAF]*7 +
        [Resource.WEIZEN]*7 +
        [Resource.ERZ]*7 +
        [Resource.WÜSTE]*2
    )
            self.tiles_positions = [
        # q = -4
        (-4, 0), (-4, 1), (-4, 2), (-4, 3), (-4, 4),

        # q = -3
        (-3, -1), (-3, 0), (-3, 1), (-3, 2), (-3, 3), (-3, 4),

        # q = -2
        (-2, -2), (-2, -1), (-2, 0), (-2, 1), (-2, 2), (-2, 3), (-2, 4),

        # q = -1
        (-1, -3), (-1, -2), (-1, -1), (-1, 0), (-1, 1), (-1, 2), (-1, 3), (-1, 4),

        # q = 0
        (0, -4), (0, -3), (0, -2), (0, -1), (0, 0), (0, 1), (0, 2), (0, 3), (0, 4),

        # q = 1
        (1, -4), (1, -3), (1, -2), (1, -1), (1, 0), (1, 1), (1, 2), (1, 3),

        # q = 2
        (2, -4), (2, -3), (2, -2), (2, -1), (2, 0), (2, 1), (2, 2),

        # q = 3
        (3, -4), (3, -3), (3, -2), (3, -1), (3, 0), (3, 1),

        # q = 4
        (4, -4), (4, -3), (4, -2), (4, -1), (4, 0),
    ]
        self.HEX_DIRECTIONS = [
    (1, 0),
    (1, -1),
    (0, -1),
    (-1, 0),
    (-1, 1),
    (0, 1)
]
        

        self.createTiles()
        self.createNumbers()
        self.createEdges()
        while self.incorrectNumbers():
            self.createNumbers()
        self.createVertices()
        self.connectEdgesAndVertices()
        self.connectNeighbourVertices()
        self.createHarbors()
    def createTiles(self):
        random.shuffle(self.resources)
        for q, r in self.tiles_positions:

            if abs(q) == self.radius or abs(r) == self.radius or abs(-q-r) == self.radius:
                resource = Resource.WASSER
            else:
                resource = self.resources.pop()


            tile = Tile(q, r, resource, None, self.currentId)
            self.currentId += 1
            self.tiles.append(tile)
    def incorrectNumbers(self):
        for tile in self.tiles:
            for edge in tile.edges:
                for possibleNeighbourTile in edge.adjacentTiles:
                    if possibleNeighbourTile != tile:
                        neighbourTile = possibleNeighbourTile
                        if (neighbourTile.number == 6 or neighbourTile.number == 8) and (tile.number == 6 or tile.number == 8):
                            return True
        return False
    
    def createNumbers(self):
        if self.radius == 3:
            numbers = [2,3,3,4,4,5,5,6,6,8,8,9,9,10,10,11,11,12]
        else:
            numbers = [
    2, 2,
    3, 3, 3,
    4, 4, 4,
    5, 5, 5, 5,
    6, 6, 6, 6, 6,
    8, 8, 8, 8, 8,
    9, 9, 9, 9, 9,
    10, 10, 10,
    11, 11, 11,
    12, 12
]       
        random.shuffle(numbers)
        for tile in self.tiles:
            if not tile.resource == Resource.WASSER and not tile.resource == Resource.WÜSTE:
                tile.number = numbers.pop()

    def createEdges(self):
        self.tile_map = {(tile.q, tile.r): tile for tile in self.tiles}
        edge_map = {}
        for tile in self.tiles:
            if tile.resource is not Resource.WASSER:
             for dq, dr in self.HEX_DIRECTIONS:
                neighbourPos = (tile.q + dq, tile.r + dr)
                if neighbourPos in self.tile_map:
                        neighbour = self.tile_map[neighbourPos]
                        key = tuple(sorted([
                            (tile.q, tile.r),
                            (neighbour.q, neighbour.r)
                        ]))
                        if key not in edge_map:
                            newEdge = Edge(self.currentId)
                            self.currentId += 1
                            newEdge.adjacentTiles = (tile, neighbour)
                            edge_map[key] = newEdge
                            self.edges.append(newEdge)
                            tile.edges.append(newEdge)
                            neighbour.edges.append(newEdge)

    def createVertices(self):
            vertex_map = {}
            for tile in self.tiles:
             if tile.resource is not Resource.WASSER:
                for i in range(6):
                    dq1, dr1 = self.HEX_DIRECTIONS[i]
                    dq2, dr2 = self.HEX_DIRECTIONS[(i + 1) % 6]

                    neighbor1_pos = (tile.q + dq1, tile.r + dr1)
                    neighbor2_pos = (tile.q + dq2, tile.r + dr2)

                    neighbors = []
                    if neighbor1_pos in self.tile_map:
                        neighbors.append(self.tile_map[neighbor1_pos])
                    if neighbor2_pos in self.tile_map:
                        neighbors.append(self.tile_map[neighbor2_pos])

                    # Vertex-Tiles = center tile + vorhandene Nachbarn (mind. 1 oder 2)
                    vertex_tiles = [tile] + neighbors
                    if len(vertex_tiles) == 3:
                        # Sortiere um Duplikate zu vermeiden
                        vertex_key = tuple(sorted((t.q, t.r) for t in vertex_tiles))
                        
                        if vertex_key not in vertex_map:
                            vertex = Vertex(self.currentId)
                            self.currentId += 1
                            vertex.adjacentTiles = tuple(vertex_tiles)
                            vertex_map[vertex_key] = vertex
                            self.vertices.append(vertex)
                        else:
                            vertex = vertex_map[vertex_key]

                        # Vertex dem Tile hinzufügen
                        tile.vertices.append(vertex)
                    else:
                        v = 5

    def connectEdgesAndVertices(self):
        for edge in self.edges:
            tile1, tile2 = edge.adjacentTiles

            matching_vertices = []

            for vertex in self.vertices:
                if tile1 in vertex.adjacentTiles and tile2 in vertex.adjacentTiles:
                    matching_vertices.append(vertex)

            if len(matching_vertices) == 2:
                v1, v2 = matching_vertices
                edge.vertex1 = v1
                edge.vertex2 = v2

                v1.connectedEdges.append(edge)
                v2.connectedEdges.append(edge)
            else:
                print("Fehler: Edge hat nicht genau 2 Vertices")
    
    def connectNeighbourVertices(self):
        for edge in self.edges:
            v1 = edge.vertex1
            v2 = edge.vertex2

            if v1 is None or v2 is None:
                continue

            if v2 not in v1.neighbourVertices:
                v1.neighbourVertices.append(v2)

            if v1 not in v2.neighbourVertices:
                v2.neighbourVertices.append(v1)
            
    def createHarbors(self):
        if self.radius == 3:
         for tile in self.tiles:
            if tile.q == 2 and tile.r == -2:
                testHarbor = Harbor(3, -3, tile.vertices[0], tile.vertices[1], Resource.HOLZ, 2)
                self.harbors.append(testHarbor)
            if tile.q == 0 and tile.r == -2:
                testHarbor = Harbor(1, -3, tile.vertices[0], tile.vertices[1], None, 3)
                self.harbors.append(testHarbor)
            if tile.q == -1 and tile.r == -1:
                testHarbor = Harbor(-1, -2, tile.vertices[1], tile.vertices[2], Resource.LEHM, 2)
                self.harbors.append(testHarbor)
            if tile.q == -2 and tile.r == 0:
                testHarbor = Harbor(-3, 0, tile.vertices[2], tile.vertices[3], None, 3)
                self.harbors.append(testHarbor)
            if tile.q == -2 and tile.r == 1:
                testHarbor = Harbor(-3, 2, tile.vertices[3], tile.vertices[4], Resource.ERZ, 2)
                self.harbors.append(testHarbor)
            if tile.q == -2 and tile.r == 2:
                testHarbor = Harbor(-2, 3, tile.vertices[4], tile.vertices[5],  None, 3)
                self.harbors.append(testHarbor)
            if tile.q == 0 and tile.r == 2:
                testHarbor = Harbor(0, 3, tile.vertices[4], tile.vertices[5], Resource.WEIZEN, 2)
                self.harbors.append(testHarbor)
            if tile.q == 2 and tile.r == 0:
                testHarbor = Harbor(2, 1, tile.vertices[4], tile.vertices[5],  None, 3)
                self.harbors.append(testHarbor)
            if tile.q == 2 and tile.r == -1:
                testHarbor = Harbor(3, -1, tile.vertices[0], tile.vertices[5], Resource.SCHAF, 2)
                self.harbors.append(testHarbor)
        else:
            if self.radius == 4:
             for tile in self.tiles:

                if tile.q == 0 and tile.r == -3:
                    self.harbors.append(Harbor(1, -4, tile.vertices[0], tile.vertices[1], None, 3))

                if tile.q == -1 and tile.r == -2:
                    self.harbors.append(Harbor(-1, -3, tile.vertices[1], tile.vertices[2], Resource.HOLZ, 2))

                if tile.q == -2 and tile.r == -1:
                    self.harbors.append(Harbor(-3, -1, tile.vertices[2], tile.vertices[3], None, 3))

                if tile.q == -3 and tile.r == -0:
                    self.harbors.append(Harbor(-4, 1, tile.vertices[4], tile.vertices[3], Resource.LEHM, 2))

                if tile.q == -3 and tile.r == 2:
                    self.harbors.append(Harbor(-4, 3, tile.vertices[3], tile.vertices[4], None, 3))

                if tile.q == -3 and tile.r == 3:
                    self.harbors.append(Harbor(-3, 4, tile.vertices[4], tile.vertices[5], Resource.SCHAF, 2))

                if tile.q == 0 and tile.r == 3:
                    self.harbors.append(Harbor(-1, 4, tile.vertices[3], tile.vertices[4], None, 3))

                if tile.q == 0 and tile.r == 3:
                    self.harbors.append(Harbor(1, 3, tile.vertices[5], tile.vertices[0], Resource.WEIZEN, 2))

                if tile.q == 3 and tile.r == 0:
                    self.harbors.append(Harbor(3, 1, tile.vertices[4], tile.vertices[5], None, 3))

                if tile.q == 3 and tile.r == -1:
                    self.harbors.append(Harbor(4, -1, tile.vertices[0], tile.vertices[5], Resource.ERZ, 2))

                if tile.q == 3 and tile.r == -2:
                    self.harbors.append(Harbor(4, -3, tile.vertices[1], tile.vertices[0], None, 3))

                if tile.q == 3 and tile.r == -3:
                    self.harbors.append(Harbor(3, -4, tile.vertices[2], tile.vertices[1], Resource.HOLZ, 2))
                

    def canBuildSettlement(self, player, vertex, setupPhase):
        if len(player.settlements) == 5:
            return False
        if vertex.owner != None:
            return False
        for neighbour in vertex.neighbourVertices:
            if neighbour.owner != None:
                return False
        if setupPhase:  
            return True
        for connectedEdge in vertex.connectedEdges:
            if connectedEdge.owner == player:
                return True
        return False
        
    def buildSettlement(self, player, vertex, setupPhase):
        if not self.canBuildSettlement(player, vertex, setupPhase):
            return False
        if not self.has_resources(player, SETTLEMENT_COST) and not setupPhase:
            return False
        if not setupPhase:
            self.pay_resources(player, SETTLEMENT_COST)
        elif self.secondSetupPhase:
            for tile in vertex.adjacentTiles:
                try:
                    player.resources[toString(tile.resource)] += 1
                except:
                    pass
        vertex.owner = player
        player.settlements.append(vertex)
        player.victoryPoints += 1
        pygame.mixer.init()
        pygame.mixer.music.load("src/S/Siedlung.mp3")
        pygame.mixer.music.play()
        return True

    def canBuildCity(self, player, vertex):
        if len(player.cities) == 4:
            return False
        if vertex.owner != player:
            return False

        if vertex.isCity:
            return False

        return True
    def buildCity(self, player, vertex):
        if not self.canBuildCity(player, vertex):
            return False

        if not self.has_resources(player, CITY_COST):
            return False

        self.pay_resources(player, CITY_COST)

        vertex.isCity = True

        player.settlements.remove(vertex)
        player.cities.append(vertex)

        player.victoryPoints += 1

        return True
    def canBuildRoad(self, player, edge, setupPhase):
        if len(player.roads) == 15:
            return False
        if edge.owner != None:
            return False
        if setupPhase:
            #check that second road is at second settlement (meaning it is at a settlement and not connected to a road)
            x = []
            edges1 = edge.vertex1.connectedEdges.copy()
            edges2 = edge.vertex2.connectedEdges.copy()
            edges1.remove(edge)
            edges2.remove(edge)
            for e in edges1 + edges2:
                if e.owner == player:
                    return False
            return (
                edge.vertex1.owner == player or
                edge.vertex2.owner == player
            )
        for adjacent in edge.vertex1.connectedEdges:
            if adjacent.owner == player:
                return True

        for adjacent in edge.vertex2.connectedEdges:
            if adjacent.owner == player:
                return True
            
        if edge.vertex1.owner == player or edge.vertex2.owner == player:
            return True
        return False
    def buildRoad(self, player, edge, setupPhase, free):
        if not self.canBuildRoad(player, edge, setupPhase):
            return False
        if not self.has_resources(player, ROAD_COST) and not setupPhase and not free:
            return False
        if not setupPhase and not free:
            self.pay_resources(player, ROAD_COST)
        edge.owner = player
        player.roads.append(edge)
        self.checkLongestRoad(player, edge)
        return True
    
    def checkLongestRoad(self, player, edge):
        for edge in self.edges:
            if edge.owner == player:
                queue = deque()
                queue.append((edge, 1))
                visitedEdgesPlusLength = [(edge, 1)]
                visitedEdges = [edge]

                while len(queue) != 0:
                    current, length = queue.popleft()
                    for vertex in (current.vertex1, current.vertex2):
                        for edge in vertex.connectedEdges:
                            if edge not in visitedEdges and edge.owner == player:
                                visitedEdgesPlusLength.append((edge, length + 1))
                                visitedEdges.append(edge)
                                queue.append((edge, length + 1))
                maxEdge, maxLength = visitedEdgesPlusLength.pop()
                for (edge, length) in visitedEdgesPlusLength:
                    if length > maxLength:
                        maxEdge = edge
                        maxLength = length
                if maxLength > self.currentLongestRoad and maxLength >= 5:
                    self.currentLongestRoad = maxLength
                    if self.currentPlayerWithLongestRoad != player:
                        player.victoryPoints += 2
                        if self.currentPlayerWithLongestRoad is not None:
                            self.currentPlayerWithLongestRoad.victoryPoints -= 2
                        self.currentPlayerWithLongestRoad = player
                    
    def has_resources(self, player, cost):
        for resource, amount in cost.items():
            if player.resources.get(resource, 0) < amount:
                return False
        return True


    def pay_resources(self, player, cost):
        for resource, amount in cost.items():
            player.resources[resource] -= amount

    def buyDevelopmentCard(self, player):
        if not self.has_resources(player, DEVELOPMENT_COST):
            return False
        if len(self.development_deck) == 0:
            return False
        self.pay_resources(player, DEVELOPMENT_COST)
        card = self.development_deck.pop()
        if card == "1SIEGPUNKT":
            player.secretVictoryPoints += 1
        player.developmentCards[card] += 1
    def settlementSpot(self, vertex):
        if vertex.owner != None:
            return False
        for neighbour in vertex.neighbourVertices:
            if neighbour.owner != None:
                return False
        return True
    