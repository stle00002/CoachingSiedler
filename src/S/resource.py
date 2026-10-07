from enum import Enum

class Resource(Enum):
    HOLZ = 1
    LEHM = 2
    SCHAF = 3
    WEIZEN = 4
    ERZ = 5
    WÜSTE = 6
    WASSER = 7
    GOLD = 8
def toString(resource):
    if resource == Resource.HOLZ:
        return "HOLZ"
    if resource == Resource.LEHM:
        return "LEHM"
    if resource == Resource.SCHAF:
        return "SCHAF"
    if resource == Resource.WEIZEN:
        return "WEIZEN"
    if resource == Resource.ERZ:
        return "ERZ"
    if resource == Resource.WÜSTE:
        return "WÜSTE"
    if resource == Resource.WASSER:
        return "WASSER"
    
