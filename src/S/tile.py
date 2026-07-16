from typing import TYPE_CHECKING

from resource import Resource
if TYPE_CHECKING:
    from edge import Edge
    from vertex import Vertex
class Tile:
    def __init__(self, q, r, resource, number, id):
        self.id = id
        self.q = q
        self.r = r
        self.resource = resource
        self.number = number
        self.vertices:list[Vertex] = []
        self.edges:list[Edge]= []
    def isDesert(self):
        return self.resource == Resource.WÜSTE