import sys
import math
from typing import List, Optional



MAX_DIST_BY_ROUND = 600


# A priori pas besoin d'aller en haut pour sauvegarder les poissons
# 1ère idée déterminer un poisson rare pas trop loin de nous et plus loin de l'adversaire 
# aller vers se poisson 
# si plusieurs poissons sur le chemin à + de 800u et -de 2000u et batterie à + de 5 alors on met 1 de light
# sinon on met 0
# 
#

class Item:
    def __init__(self, item_id=None, x=None, y=None):
        self._item_id = item_id
        self._x = x
        self._y = y

    def update(self, item_id, x, y):
        self._item_id = item_id
        self._x = x
        self._y = y

    @property
    def item_id(self):
        return self._item_id

    @property
    def x(self):
        return self._x

    @x.setter
    def x(self, value):
        self._x = value

    @property
    def y(self):
        return self._y

    @y.setter
    def y(self, value):
        self._y = value

    def __str__(self):
        return f"Item(id={self._item_id}, x={self._x}, y={self._y})"

    def calculate_distance(self, other_item):
        return math.sqrt((self._x - other_item.x)**2 + (self._y - other_item.y)**2)
    
class Creature(Item):
    def __init__(self, item_id, color, type):
        super().__init__(item_id)
        self._color = color
        self._type = type
        
    def update_with_coordinate(self, x, y, vx, vy):
        self._x = x
        self._y = y
        self._vx = vx
        self._vy = vy

    @property
    def vx(self):
        return self._vx

    @vx.setter
    def vx(self, value):
        self._vx = value

    @property
    def vy(self):
        return self._vy

    @vy.setter
    def vy(self, value):
        self._vy = value

    @property
    def color(self):
        return self._color

    @color.setter
    def color(self, value):
        self._color = value
    
    @property
    def type(self):
        return self._type

    @type.setter
    def type(self, value):
        self._type = value
    
    def __str__(self):
        return f"Creature(id={self._item_id}, x={self._x}, y={self._y}, color={self._color}, type={self._type}, vx={self._vx}, vy={self._vy})"

class Drone(Item):
    MAX_DIST_BY_ROUND = 600
    BIG_LIGHT_RADIUS = 2000
    SMALL_LIGHT_RADIUS = 800

    def __init__(self):
        super().__init__()
        self._creatures_seen = []
        self._target = None

    def update(self, item_id, x, y, battery, emergency):
        super().update(item_id, x, y)
        self._battery = battery
        self._emergency = emergency

    @property
    def battery(self):
        return self._battery

    @battery.setter
    def battery(self, value):
        self._battery = value

    @property
    def emergency(self):
        return self._emergency

    @emergency.setter
    def emergency(self, value):
        self._emergency = value

    @property
    def target(self) -> Optional[Creature]:
        return self._target

    @target.setter
    def target(self, value: Creature):
        self._target = value

    def add_seen_creature(self, creature: Creature):
        if creature not in self._creatures_seen:
            self._creatures_seen.append(creature)
    
    def is_creature_seen(self, creature: Creature):
        return creature in self._creatures_seen

    def __str__(self):
        return f"Drone(id={self._item_id}, x={self._x}, y={self._y}, battery={self._battery}, emergency={self._emergency})"    
    
    def debug_info(self):
        print("==== Drone Debug Info ====", file=sys.stderr, flush=True)
        print(f"Drone: {self}", file=sys.stderr, flush=True)
        print(f"Battery: {self.battery}", file=sys.stderr, flush=True)
        print(f"Emergency: {self.emergency}", file=sys.stderr, flush=True)
        
        if self.target:
            print(f"Target: {self.target}", file=sys.stderr, flush=True)
        else:
            print("No target", file=sys.stderr, flush=True)

        print("Creatures Seen:", file=sys.stderr, flush=True)
        for creature in self._creatures_seen:
            print(f"  Creature {creature.item_id}: {creature}", file=sys.stderr, flush=True)

        print("===========================", file=sys.stderr, flush=True)


class GameAction: 
    def __init__(self):
        super()
        self._creatures: List[Creature] = []
        self._my_drone = Drone()

    @property
    def my_drone(self) -> Drone:
        return self._my_drone

    @my_drone.setter
    def my_drone(self, value: Drone):
        self._my_drone = value
    
    def add_creature(self, creature: Creature): 
        self._creatures.append(creature)

    def update_creature_by_id(self,creature_id, creature_x, creature_y, creature_vx, creature_vy):
        matching_creature = next((creature for creature in self._creatures if creature.item_id == creature_id), None)
        if matching_creature:
            matching_creature.update_with_coordinate(creature_x, creature_y, creature_vx, creature_vy)

    def update_target(self, creature):
        self.my_drone.add_seen_creature(creature)
        self.my_drone.target = None
            
    def debug_info(self):
        print("==== Debug Info ====", file=sys.stderr, flush=True)
        self._my_drone.debug_info()

        print("Creatures:", file=sys.stderr, flush=True)
        for creature in self._creatures:
            print(f"  Creature {creature.item_id}: {creature}", file=sys.stderr, flush=True)

        if self._my_drone.target:
            print(f"Target: {self._my_drone.target}", file=sys.stderr, flush=True)
        else:
            print("No target", file=sys.stderr, flush=True)

        print("===================", file=sys.stderr, flush=True)


    
    def go_to_target(self):
        target = self._my_drone.target
        distance_to_target = self._my_drone.calculate_distance(self._my_drone.target)
        if(distance_to_target > Drone.BIG_LIGHT_RADIUS):
            print("MOVE " + str(target.x) + " " + str(target.y) + " 0" )
        else: 
            print("MOVE " + str(target.x) + " " + str(target.y) + " 1" )
            self.update_target(target)
    
    def wait(self):
        print("WAIT 0")

    def find_next_target(self):
        unseen_creatures = [creature for creature in self._creatures if not self._my_drone.is_creature_seen(creature)]

        if not unseen_creatures:
            return None
        
        closest_creature = min(unseen_creatures, key=lambda creature: self._my_drone.calculate_distance(creature))
        return closest_creature
    
    def round(self):
        self.debug_info()

        if(self._my_drone.target == None or self.my_drone.is_creature_seen(self._my_drone.target)):
            self._my_drone.target = self.find_next_target()
        
        if(self._my_drone.target):
            self.go_to_target()
        else: 
            self.wait()


# Score points by scanning valuable fish faster than your opponent.

game = GameAction()

creature_count = int(input())
for i in range(creature_count):
    creature_id, color, _type = [int(j) for j in input().split()]
    game.add_creature(Creature(creature_id, color, _type))

# game loop
while True:
    my_score = int(input())
    foe_score = int(input())
    my_scan_count = int(input())
   
    for i in range(my_scan_count):
        creature_id = int(input())
    foe_scan_count = int(input())
    for i in range(foe_scan_count):
        creature_id = int(input())
    my_drone_count = int(input())
    for i in range(my_drone_count):
        drone_id, drone_x, drone_y, emergency, battery = [int(j) for j in input().split()]
        game.my_drone.update(drone_id, drone_x, drone_y, emergency, battery )
    foe_drone_count = int(input())
    for i in range(foe_drone_count):
        drone_id, drone_x, drone_y, emergency, battery = [int(j) for j in input().split()]
    drone_scan_count = int(input())
    for i in range(drone_scan_count):
        drone_id, creature_id = [int(j) for j in input().split()]
    visible_creature_count = int(input())
    for i in range(visible_creature_count):
        creature_id, creature_x, creature_y, creature_vx, creature_vy = [int(j) for j in input().split()]
        game.update_creature_by_id(creature_id, creature_x, creature_y, creature_vx, creature_vy)

    radar_blip_count = int(input())
    for i in range(radar_blip_count):
        inputs = input().split()
        drone_id = int(inputs[0])
        creature_id = int(inputs[1])
        radar = inputs[2]
    for i in range(my_drone_count):


        # Write an action using print
        # To debug: print("Debug messages...", file=sys.stderr, flush=True)

        game.round()



            # MOVE <x> <y> <light (1|0)> | WAIT <light (1|0)>



