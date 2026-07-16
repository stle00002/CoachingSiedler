from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from tile import Tile
    from vertex import Vertex
class Edge:
    def __init__(self, id):
        self.id = id
        self.owner = None
        self.vertex1 :Vertex| None= None
        self.vertex2 :Vertex| None= None
        self.adjacentTiles: tuple[Tile, Tile] = (None, None)