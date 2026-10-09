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
    def __init__(self, playerCount, custom_map=None):
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
        self.custom_map = custom_map

        if custom_map is not None:
            self.earthMap = False

            self.tiles_positions = [
                (tile["q"], tile["r"])
                for tile in custom_map["tiles"]
            ]


            self.custom_resources = {
                (tile["q"], tile["r"]): (
                    Resource[tile["resource"]]
                    if tile["resource"] is not None
                    else None
                )
                for tile in custom_map["tiles"]
            }

            # Genug Platz für alle axialen Hex-Koordinaten.
            self.radius = max(
                max(abs(q), abs(r), abs(q + r))
                for q, r in self.tiles_positions
            )

            self.resources = []
        else:
            if playerCount <= 1:
                self.earthMap = False
                self.radius = 3

                self.resources = (
                    [Resource.HOLZ] * 4 +
                    [Resource.LEHM] * 3 +
                    [Resource.SCHAF] * 4 +
                    [Resource.WEIZEN] * 4 +
                    [Resource.ERZ] * 3 +
                    [Resource.WÜSTE]
                )

                self.tiles_positions = [

                    (-2, 0), (-2, 1), (-2, 2),

                    (-1, -1), (-1, 0),
                    (-1, 1), (-1, 2),

                    (0, -2), (0, -1),
                    (0, 0), (0, 1), (0, 2),

                    (1, -2), (1, -1),
                    (1, 0), (1, 1),

                    (2, -2), (2, -1),
                    (2, 0)

                ]
                print("EARTH Landfelder:", len(self.tiles_positions))
                print("EARTH Ressourcen:", len(self.resources))

            elif playerCount < 2:
                self.earthMap = False
                self.radius = 4

                self.resources = (
                    [Resource.HOLZ] * 7 +
                    [Resource.LEHM] * 7 +
                    [Resource.SCHAF] * 7 +
                    [Resource.WEIZEN] * 7 +
                    [Resource.ERZ] * 7 +
                    [Resource.WÜSTE] * 2
                )

                self.tiles_positions = [
                    (-3, 0), (-3, 1),
                    (-3, 2), (-3, 3),

                    (-2, -1), (-2, 0),
                    (-2, 1), (-2, 2), (-2, 3),

                    (-1, -2), (-1, -1),
                    (-1, 0), (-1, 1), (-1, 2),
                    (-1, 3), 

                    (0, -3), (0, -2), (0, -1),
                    (0, 0), (0, 1), (0, 2), (0, 3),

                    (1, -3), (1, -2), (1, -1),
                    (1, 0), (1, 1), (1, 2), 

                    (2, -3), (2, -2), (2, -1),
                    (2, 0), (2, 1),

                    (3, -3), (3, -2),
                    (3, -1), (3, 0),

                ]
                print("EARTH Landfelder:", len(self.tiles_positions))
                print("EARTH Ressourcen:", len(self.resources))

            else:
                # =========================
                # EARTH / WORLD MAP
                # =========================
                # Aufbau angelehnt an die Weltkarte von Colonist:
                #
                #             NORDAMERIKA
                #
                #                         EUROPA ---- ASIEN
                #
                #       SÜDAMERIKA       AFRIKA             AUSTRALIEN
                #
                #                         ANTARKTIS
                #
                # Insgesamt genau 81 Landfelder.
                # Die Wasserfelder werden später automatisch um
                # die gesamte Landmasse herum erzeugt.

                self.earthMap = True
                self.radius = 10

                # 81 Landfelder:
                # 16 Holz + 16 Lehm + 16 Schaf + 16 Weizen
                # + 16 Erz + 1 Wüste = 81
                self.resources = (
                    [Resource.HOLZ] * 16 +
                    [Resource.LEHM] * 16 +
                    [Resource.SCHAF] * 15 +
                    [Resource.WEIZEN] * 15 +
                    [Resource.ERZ] * 15 +
                    [Resource.WÜSTE] + 
                    [Resource.GOLD] * 3
                )
                #self.resources = (
                #    [Resource.WÜSTE] +
                #    [Resource.GOLD] * 80
                #)




                self.tiles_positions = [

                    # =====================================
                    # NORDAMERIKA
                    # =====================================
                    # Norden / Alaska bis Kanada
                    (-10, 0), (-9, 0), (-8, 0),

                    (-11, 1), (-10, 1), (-9, 1),
                    (-8, 1), (-7, 1),

                    # USA / östliches Kanada
                    (-11, 2), (-10, 2), (-9, 2),
                    (-8, 2), (-7, 2), (-6, 2),

                    (-10, 3), (-9, 3), (-8, 3),
                    (-7, 3), (-6, 3),

                    # Süden / Mexiko
                    (-9, 4), (-8, 4), (-7, 4), (-6, 4),

                    # Mittelamerika
                    (-7, 5),

                    # =====================================
                    # EUROPA
                    # =====================================
                    # Westeuropa
                    (-3, -1), (-2, -1),

                    # Mitteleuropa
                    (-3, 0), (-2, 0),

                    # Südeuropa
                    (-3, 1),

                    # =====================================
                    # ASIEN
                    # =====================================
                    # Westasien
                    (4, -1), (5, -1), (6, -1),

                    # Zentralasien
                    (4, 0), (5, 0), (6, 0), (7, 0),

                    # Südasien / China
                    (3, 1), (4, 1), (5, 1),
                    (6, 1), (7, 1), (8, 1),

                    # Südostasien
                    (4, 2), (5, 2), (6, 2), (7, 2),

                    # Indonesien / Ostasien
                    (5, 3), (6, 3),

                    # =====================================
                    # AFRIKA
                    # =====================================
                    # Nordafrika
                    (0, 3), (1, 3), (2, 3),

                    # Westafrika bis Zentralafrika
                    (-1, 4), (0, 4), (1, 4),
                    (2, 4), (3, 4),

                    # Zentral- und Ostafrika
                    (-1, 5), (0, 5), (1, 5),
                    (2, 5), (3, 5),

                    # Südafrika
                    (0, 6), (1, 6), (2, 6),

                    # =====================================
                    # SÜDAMERIKA
                    # =====================================
                    # Nord-Südamerika
                    (-7, 6), (-6, 6),

                    (-7, 7), (-6, 7), (-5, 7),

                    # Südamerika
                    (-7, 8), (-6, 8), (-5, 8),

                    # =====================================
                    # AUSTRALIEN
                    # =====================================
                    (8, 5), (9, 5),

                    (8, 6), (9, 6),

                    (9, 7),

                    # =====================================
                    # ANTARKTIS
                    # =====================================
                    (-3, 9), (-2, 9),
                    (-1, 9), (0, 9),
                ]
                self.tiles_positions = [
        # r = -4
        (-2,-4),(-1,-4),(1,-4),(2,-4),(4,-4),(7,-4),

        # r = -3
        (-5,-3),(-4,-3),(-3,-3),(-2,-3),(1,-3),(2,-3),(5,-3),(6,-3),(7,-3),

        # r = -2
        (-6,-2),(-5,-2),(-4,-2),(-3,-2),(-2,-2),(-1,-2),(1,-2),(3,-2),(4,-2),(5,-2),(6,-2),(7,-2),(8,-2),(9,-2),

        # r = -1
        (-6,-1),(-5,-1),(-4,-1),(-3,-1),(-2,-1),(2,-1),(3,-1),(4,-1),(5,-1),(6,-1),(7,-1),

        # r = 0
        (-5,0),(-4,0),(-3,0),(0,0),(1,0),(2,0),(3,0),(4,0),(5,0),(6,0),(8,0),

        # r = 1
        (-5,1),(-1,1),(0,1),(1,1),(3,1),(5,1),(7,1),

        # r = 2
        (-5,2),(-4,2),(-2,2),(-1,2),(0,2),(1,2),

        # r = 3
        (-5,3),(-4,3),(-1,3),(0,3),(3,3),(4,3),

        # r = 4
        (-6,4),(-5,4),(-2,4),(-1,4),(2,4),(3,4),(4,4),

        # r = 5
        (-6,5),(-2,5),(0,5),(3,5),
                ]

                print("EARTH Landfelder:", len(self.tiles_positions))
                print("EARTH Ressourcen:", len(self.resources))
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
        self.tile_map = {
    (tile.q, tile.r): tile
    for tile in self.tiles
}
        self.createVertices()

        self.createEdges()
        while self.incorrectNumbers():
            self.createNumbers()
        self.connectEdgesAndVertices()
        self.connectNeighbourVertices()
        self.createHarbors()
    def createTiles(self):
        if self.custom_map is None:
            random.shuffle(self.resources)

        land_positions = set(self.tiles_positions)
        water_positions = set()

        for q, r in land_positions:
            for dq, dr in self.HEX_DIRECTIONS:
                neighbour = (q + dq, r + dr)

                if neighbour not in land_positions:
                    water_positions.add(neighbour)

        all_positions = land_positions | water_positions

        for q, r in sorted(all_positions):
            if (q, r) in land_positions:
                if self.custom_map is not None:
                    resource = self.custom_resources[(q, r)]

                    # None bedeutet: zufällige Ressource beim Spielstart
                    if resource is None:
                        resource = random.choice([
                            Resource.HOLZ,
                            Resource.LEHM,
                            Resource.SCHAF,
                            Resource.WEIZEN,
                            Resource.ERZ
                        ])
                else:
                    resource = self.resources.pop()

            else:
                resource = Resource.WASSER

            tile = Tile(
                q,
                r,
                resource,
                None,
                self.currentId
            )

            self.currentId += 1
            self.tiles.append(tile)
    def incorrectNumbers(self):
        for tile in self.tiles:
            for edge in tile.edges:
                for possibleNeighbourTile in edge.adjacentTiles:
                    if possibleNeighbourTile is None or possibleNeighbourTile == tile:
                        continue

                    neighbourTile = possibleNeighbourTile

                    if (
                        neighbourTile.number in (6, 8)
                        and tile.number in (6, 8)
                    ):
                        return True

        return False
    
    def createNumbers(self):
        if self.custom_map is not None:
            numbered_tiles = [
                tile for tile in self.tiles
                if tile.resource not in (
                    Resource.WASSER,
                    Resource.WÜSTE
                )
            ]

            # Übliche Häufigkeitsverteilung für Würfelzahlen.
            number_bag = (
                [2] * 1 +
                [3] * 2 +
                [4] * 3 +
                [5] * 4 +
                [6] * 5 +
                [8] * 5 +
                [9] * 4 +
                [10] * 3 +
                [11] * 2 +
                [12] * 1
            )

            numbers = []

            while len(numbers) < len(numbered_tiles):
                numbers.extend(number_bag)

            random.shuffle(numbers)

            for tile, number in zip(numbered_tiles, numbers):
                tile.number = number

            return
        if self.earthMap:
            # 80 Zahlen für 81 Landfelder
            # Die Wüste bekommt keine Zahl.
            numbers = (
                [2] * 4 +
                [3] * 6 +
                [4] * 8 +
                [5] * 10 +
                [6] * 10 +
                [8] * 10 +
                [9] * 10 +
                [10] * 8 +
                [11] * 8 +
                [12] * 6
            )
            

        elif self.radius == 3:
            numbers = [
                2, 3, 3, 4, 4,
                5, 5, 6, 6,
                8, 8, 9, 9,
                10, 10, 11, 11, 12
            ]

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

                    # Keine Straßenkante zwischen Land und Wasser
                    if neighbour.resource is Resource.WASSER:
                        continue
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
        # ==========================================
        # KÜSTENKANTEN
        # ==========================================

        for tile in self.tiles:

            if tile.resource is Resource.WASSER:
                continue

            # Ein Tile hat durch deine ursprüngliche
            # Vertex-Erzeugung genau 6 Vertices.
            if len(tile.vertices) != 6:
                print(
                    "FEHLER: Land-Tile hat nicht 6 Vertices:",
                    tile.q, tile.r,
                    len(tile.vertices)
                )
                continue

            for i, (dq, dr) in enumerate(self.HEX_DIRECTIONS):

                neighbourPos = (
                    tile.q + dq,
                    tile.r + dr
                )

                # Nur echte Küste
                if neighbourPos in self.tile_map:
                    neighbour = self.tile_map[neighbourPos]

                    if neighbour.resource is not Resource.WASSER:
                        continue

                # Die Seite in Richtung i liegt zwischen
                # den Ecken i-1 und i.
                vertex1 = tile.vertices[(i - 1) % 6]
                vertex2 = tile.vertices[i]

                # Edge eindeutig über die beiden Vertices bestimmen
                key = tuple(sorted([
                    vertex1.id,
                    vertex2.id
                ]))

                if key in edge_map:
                    continue

                newEdge = Edge(self.currentId)
                self.currentId += 1

                # Nur ein Land-Tile grenzt an diese Edge
                newEdge.adjacentTiles = (tile, None)

                newEdge.vertex1 = vertex1
                newEdge.vertex2 = vertex2

                edge_map[key] = newEdge
                self.edges.append(newEdge)

                tile.edges.append(newEdge)

                vertex1.connectedEdges.append(newEdge)
                vertex2.connectedEdges.append(newEdge)

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

            # Küstenkante wurde bereits direkt verbunden
            if edge.vertex1 is not None and edge.vertex2 is not None:
                continue

            tile1, tile2 = edge.adjacentTiles

            if tile1 is None or tile2 is None:
                continue

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
        if not self.earthMap and not self.custom_map:
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
                        testHarbor = Harbor(3, -1, tile.vertices[5], tile.vertices[0], Resource.SCHAF, 2)
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
                            self.harbors.append(Harbor(-4, 1, tile.vertices[3], tile.vertices[4], Resource.LEHM, 2))

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
                            self.harbors.append(Harbor(4, -1, tile.vertices[5], tile.vertices[0], Resource.ERZ, 2))

                        if tile.q == 3 and tile.r == -2:
                            self.harbors.append(Harbor(4, -3, tile.vertices[0], tile.vertices[1], None, 3))

                        if tile.q == 3 and tile.r == -3:
                            self.harbors.append(Harbor(3, -4, tile.vertices[1], tile.vertices[2], Resource.HOLZ, 2))
            return
      
        # =========================================================
        # EARTH / WORLD MAP
        # =========================================================

        # Wir definieren die Häfen über:
        #
        # (Land-tile-q, Land-tile-r, Richtung)
        #
        # Die Richtung bestimmt automatisch die beiden richtigen
        # Vertices und die Position des Hafens auf der Wasserseite.
        #
        # direction:
        #
        #       2       1
        #        \     /
        #         \   /
        #       3-- TILE --0
        #         /   \
        #        /     \
        #       4       5
        #
        # Der Hafen liegt beim Wasser-Nachbarn in dieser Richtung.
        #
        # Das ist für DEINE schräge Axialdarstellung wichtig:
        # Richtung 0/3 ist NICHT einfach "senkrecht".
        # =========================================================

        earth_harbors = [

            # =====================================================
            # NORDAMERIKA / WESTLICHE KÜSTE
            # =====================================================

            (-2, -4, 3),     # -> (-3,-4)
            (-6, -2, 3),     # -> (-7,-2)
            (-6, -1, 4),     # -> (-7, 0)
            (-5,  1, 4),     # -> (-6, 2)
            (-6,  4, 4),     # -> (-7, 5)


            # =====================================================
            # SÜDAMERIKA / SÜDLICHER WESTEN
            # =====================================================

            (-2, 5, 4),      # -> (-3,6)
            (-6, 5, 5),      # -> (-6,6)


            # =====================================================
            # EUROPA / NORDATLANTIK
            # =====================================================

            (-5, -3, 2),     # -> (-5,-4)
            #(-4,  0, 5),     # -> (-4,1)
            (-2,  2, 5),     # -> (-2,3)


            # =====================================================
            # AFRIKA
            # =====================================================

            (0, 5, 5),       # -> (0,6)
            (0, 5, 4),       # -> (-1,6)


            # =====================================================
            # ASIEN - NORD / OST
            # =====================================================

            (2, -4, 1),      # -> (3,-5)
            (7, -4, 1),      # -> (8,-5)
            (9, -2, 1),      # -> (10,-3)
            (8,  0, 0),      # -> (9,0)

            # =====================================================
            # SCHMALE WASSERPASSAGE
            #
            # Diese beiden dürfen bewusst nebeneinander liegen.
            # =====================================================

            (8, 0, 5),       # -> (8,1)


            # =====================================================
            # ASIEN / SÜDOSTEN
            # =====================================================

            (4, 4, 5),       # -> (4,5)
            (4, 4, 0),       # -> (5,4)


            # =====================================================
            # WESTLICHER ASIEN-BEREICH
            # =====================================================



            # =====================================================
            # ANTARKTIS / SÜDOSTEN
            # =====================================================

            (3, 5, 4),       # -> (2,6)
            (4, -4, 0),      # -> (5,-4)


            # =====================================================
            # WEITERE NÖRDLICHE / ÖSTLICHE KÜSTE
            # =====================================================

            (-1, -4, 1),     # -> (0,-5)
            (4,  4, 5),      # -> (4,5)
        ]
        # =========================================================
        # HÄFEN ZWISCHEN DEN KONTINENTEN
        # =========================================================

        earth_harbors += [

            # -----------------------------------------------------
            # NORDAMERIKA <-> EUROPA / NORDATLANTIK
            #
            # Zwei gegenüberliegende Küsten
            # -----------------------------------------------------

            ( 1, -4, 3),    # Richtung (-1, 0)


            # -----------------------------------------------------
            # EUROPA <-> ASIEN / MITTELMEER-BEREICH
            # -----------------------------------------------------
    
            (0, 0, 2),      # Richtung (0, -1)


            # -----------------------------------------------------
            # AFRIKA <-> EUROPA
            #
            # gegenüberliegende Küsten
            # -----------------------------------------------------

            (-2, 2, 3),     # Richtung (-1, 0)


            # -----------------------------------------------------
            # AFRIKA <-> ASIEN
            # -----------------------------------------------------

            (3, 3, 1),      # Richtung (1, -1)
            (5, 1, 4),      # Richtung (-1, 1)


            # -----------------------------------------------------
            # AFRIKA <-> ANTARKTIS / SÜDLICHER OZEAN
            # -----------------------------------------------------

            (-1, 4, 0),     # Richtung (1, 0)


            # -----------------------------------------------------
            # ASIEN <-> AUSTRALIEN
            # -----------------------------------------------------

            (6, 0, 5),      # Richtung (0, 1)
        ]


        # =========================================================
        # HAFENTYPEN
        # =========================================================
        #
        # 2:1 für die fünf Ressourcen
        # 3:1 für den normalen Hafen
        #
        # Bei 24 Häfen:
        # 3x Holz
        # 3x Lehm
        # 3x Schaf
        # 3x Weizen
        # 3x Erz
        # 9x 3:1
        #
        # =========================================================

        harbor_types = [

            (Resource.HOLZ,   2),
            (None,            3),
            (Resource.LEHM,   2),
            (None,            3),
            (Resource.SCHAF,  2),
            (None,            3),
            (Resource.WEIZEN, 2),
            (None,            3),
            (Resource.ERZ,    2),

            (None,            3),
            (Resource.HOLZ,   2),
            (Resource.LEHM,   2),
            (Resource.SCHAF,  2),
            (Resource.WEIZEN, 2),
            (Resource.ERZ,    2),

            (None,            3),
            (Resource.HOLZ,   2),
            (None,            3),
            (Resource.LEHM,   2),
            (None,            3),
            (Resource.SCHAF,  2),
            (None,            3),
            (Resource.WEIZEN, 2),
            (Resource.ERZ,    2),

            # =====================================================
            # INNENHÄFEN ZWISCHEN DEN KONTINENTEN
            # =====================================================

            # Nordamerika <-> Europa
            (None,            3),
            (Resource.HOLZ,   2),

            # Europa <-> Asien
            (None,            3),
            (Resource.ERZ,    2),

            # Afrika <-> Europa
            (Resource.LEHM,   2),
            (None,            3),

            # Afrika <-> Asien
            (Resource.WEIZEN, 2),
            (None,            3),

            # Afrika <-> Antarktis
            (Resource.SCHAF,  2),
            (None,            3),

            # Asien <-> Australien
            (Resource.HOLZ,   2),
            (Resource.ERZ,    2),
        ]


        # =========================================================
        # TILE-MAP
        # =========================================================

        tile_map = {
            (tile.q, tile.r): tile
            for tile in self.tiles
        }


        # =========================================================
        # HÄFEN ERZEUGEN
        # =========================================================

        for i, (q, r, direction) in enumerate(earth_harbors):

            tile = tile_map.get((q, r))

            if tile is None:
                print(
                    "FEHLER: Earth-Hafen-Tile nicht gefunden:",
                    q, r
                )
                continue


            # -----------------------------------------------------
            # Wasserposition
            # -----------------------------------------------------

            dq, dr = self.HEX_DIRECTIONS[direction]

            harbor_q = q + dq
            harbor_r = r + dr


            # -----------------------------------------------------
            # Die beiden richtigen Küsten-Vertices
            #
            # Das ist genau die Geometrie deiner normalen Häfen.
            # -----------------------------------------------------

            # -----------------------------------------------------
            # Die beiden Küsten-Vertices automatisch finden
            # -----------------------------------------------------

            vertex1 = None
            vertex2 = None

            # Die beiden Vertices liegen an der Seite in Richtung `direction`.
            # Wir suchen sie über die beiden Ecken, die an diese Seite grenzen.

            corner1 = direction
            corner2 = (direction + 1) % 6

            # Die Vertex-Liste eines Tiles enthält nicht zwingend 6 Einträge.
            # Deshalb suchen wir die passenden Vertices über ihre angrenzenden Tiles.

            for vertex in tile.vertices:

                adjacent_positions = {
                    (t.q, t.r)
                    for t in vertex.adjacentTiles
                }

                # Ecke zwischen direction und direction+1
                d1 = self.HEX_DIRECTIONS[corner1]
                d2 = self.HEX_DIRECTIONS[corner2]

                pos1 = (q + d1[0], r + d1[1])
                pos2 = (q + d2[0], r + d2[1])

                if pos1 in adjacent_positions and pos2 in adjacent_positions:
                    vertex1 = vertex

                # andere Ecke der gewünschten Seite
                d1 = self.HEX_DIRECTIONS[(direction - 1) % 6]
                d2 = self.HEX_DIRECTIONS[direction]

                pos1 = (q + d1[0], r + d1[1])
                pos2 = (q + d2[0], r + d2[1])

                if pos1 in adjacent_positions and pos2 in adjacent_positions:
                    vertex2 = vertex

            # Sicherheitsprüfung
            if vertex1 is None or vertex2 is None:
                print(
                    "FEHLER: Küsten-Vertices nicht gefunden:",
                    q, r, direction
                )
                continue


            # -----------------------------------------------------
            # Typ
            # -----------------------------------------------------

            resource, ratio = harbor_types[i]


            vertex1, vertex2 = vertex2, vertex1

            harbor = Harbor(
                harbor_q,
                harbor_r,
                vertex1,
                vertex2,
                resource,
                ratio
            )

            self.harbors.append(harbor)


        print(
            "EARTH Häfen:",
            len(self.harbors)
        )
    
                

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
    