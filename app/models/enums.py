import enum

class HandleLocation(str, enum.Enum):
    TOP = "top"
    SIDE = "side"
    BACK = "back"
    NONE = "none"

class AngleType(str, enum.Enum):
    STRAIGHT = "straight"
    ANGLED = "angled"
    SLANT = "slant"
    NONE = "none"

class Carrier(str, enum.Enum):
    USPS = "usps"
    UPS = "ups"
    FEDEX = "fedex"

class Marketplace(str, enum.Enum):
    AMAZON = "amazon"
    EBAY = "ebay"
    REVERB = "reverb"
