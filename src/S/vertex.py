class Vertex:
    def __init__(self, id):
        self.id = id
        self.owner = None
        self.isCity = False
        self.adjacentTiles = (None, None, None)
        self.neighbourVertices = []
        self.connectedEdges = []
    def isFree(self):
        return self.owner == None