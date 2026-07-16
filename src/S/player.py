class Player:
    def __init__(self, name, color,  is_host = False):
        self.name = name
        self.color = color
        self.resources = {
            "HOLZ": 0,
            "LEHM": 0,
            "SCHAF": 0,
            "WEIZEN":0,
            "ERZ": 0
        }
        self.developmentCards = {
            "RITTER": 0,
            "1SIEGPUNKT": 0,
            "MONOPOL": 0,
            "ERFINDUNG": 0,
            "STRAßENBAU": 0
        }
        self.victoryPoints = 0
        self.secretVictoryPoints = 0
        self.roads = []
        self.settlements = []
        self.cities = []
        self.hasToDiscard = 0
        self.is_host = is_host
        self.knights = 0

    def countResources(self):
        countResources = 0
        for res, count in self.resources.items():
            countResources += count
        return countResources