import sys
import math
from typing import List, Optional, Tuple
import random


# pylint: disable=missing-module-docstring
# pylint: disable=missing-class-docstring
# pylint: disable=missing-function-docstring

## CONSTANTE
DEBUG = True
MAX_DIST_BY_ROUND = 600
BIG_LIGHT_RADIUS = 2000
SMALL_LIGHT_RADIUS = 800
Y_TO_REGISTER = 500
Y_DOWNEST_TO_GET_CREATURE = 9200



def log(str: str):
    if(DEBUG): print(str, file=sys.stderr, flush=True)
    
class Zone:
    def __init__(self, type: int, range_x: Tuple[int, int], range_y: Tuple[int, int]):
        self.type: int = type
        self._range_x: Tuple[int, int] = range_x
        self._range_y: Tuple[int, int] = range_y
    
    def is_in_zone(self, p: 'Point'):
        return (p.coord and
            (p.coord[0] >= self._range_x[0]) and (p.coord[0] <= self._range_x[1])
                 and (p.coord[1] >= self._range_y[0]) and (p.coord[1] <= self._range_y[1]))
        
    def go_to_next_in_zone(self, p: 'Point') -> Optional['Point']:
        if p.coord is None:
            return None

        if(self.is_in_zone(p)):
            y = self._range_y[0] if(p.coord[1] >= self._range_y[1]) else self._range_y[1]
            x = min(p.coord[0] + BIG_LIGHT_RADIUS, self._range_x[1])
            return Point((x, y))
            
        return Point((self._range_x[0], self._range_y[0]))
         
    def __str__(self):
        return f"Zone(type={self.type}, range_y={self._range_y})"

class Point:
    def __init__(self, coord: Optional[Tuple[int, int]]):
        self._coord: Optional[Tuple[int, int]] = coord

    @property
    def coord(self) -> Optional[Tuple[int, int]]:
        return self._coord

    @coord.setter
    def coord(self, value: Optional[Tuple[int, int]]):
        self._coord = value

    def __str__(self):
        return f"{self._coord}"

    def calculate_distance(self, other_point: 'Point') -> float:
        if self._coord is not None and other_point.coord is not None:
            return math.sqrt((self._coord[0] - other_point.coord[0]) ** 2 + (self._coord[1] - other_point.coord[1]) ** 2)
        return float('inf')  # Placeholder for handling None or invalid coordinates

class Item(Point):
    def __init__(self, item_id: int, coord: Optional[Tuple[int, int]]):
        super().__init__(coord)
        self._item_id = item_id

    def update(self, item_id, coord: Optional[Tuple[int, int]]):
        self._item_id = item_id
        self._coord = coord

    @property
    def item_id(self) -> int:
        return self._item_id

    def __str__(self):
        return f"Item(id={self._item_id}, coord={self._coord})"

class Creature(Item):
    def __init__(self, item_id: int, color: int, type: int):
        self._item_id = item_id
        self._coord = None
        self._color = color
        self._type = type
        self._speed = None
        
    def update_with_coordinate(self, coord: Optional[Tuple[int, int]], speed: Optional[Tuple[int, int]]):
        self._coord = coord
        self._speed = speed

    @property
    def speed(self):
        return self._speed

    @speed.setter
    def speed(self, value):
        self._speed = value

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
        return f"Creature(id={self._item_id}, coord={self._coord}, color={self._color}, type={self._type}, speed={self._speed})"
    
class Drone(Item):
    def __init__(self, id: int, coord: Tuple[int, int],  battery: int, emergency):
        super().__init__(id, coord)
        self._battery = battery
        self._emergency = emergency
        self._target = None
        self._nb_creature_to_register: int = 0

    def update(self, item_id: str, coord: Tuple[int, int], battery: int, emergency, nb_creature_to_register):
        super().update(item_id, coord)
        self._battery = battery
        self._emergency = emergency
        self._nb_creature_to_register = nb_creature_to_register

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
    def target(self) -> Optional[Point]:
        return self._target

    @target.setter
    def target(self, value: Optional[Point]):
        self._target = value

    def is_down(self): 
        return self._coord and self._coord[1] >= Y_DOWNEST_TO_GET_CREATURE

    def is_up(self): 
        log(f"IS UP ? {self._coord and self._coord[1] <= Y_TO_REGISTER}")
        return self._coord and self._coord[1] <= Y_TO_REGISTER
    
    def remove_creature_all_to_register(self):
        self._nb_creature_to_register = 0

    def __str__(self):
        return f"Drone(id={self._item_id}, coord={self._coord}, battery={self._battery}, emergency={self._emergency})"    
    
    def debug_info(self):
        log("==== Drone Debug Info ====")
        log(f"Drone: {self}")
        
        if self.target:
            log(f"Target: {self.target}")
        else:
            log("No target")

        log(f"Creatures To Register: {self._nb_creature_to_register}")

        log("===========================")

class MyDrone(Drone):    
    def __init__(self, id: int, coord: Tuple[int, int],  battery: int, emergency, zone: List[Zone]):
        super().__init__(id, coord, battery, emergency)
        self.target = Point((2000, 3750))
        self._zone_iter = iter(zone)
        self._zone = next(self._zone_iter)

    def get_light(self):
        should_light = self.battery > 10
        return 1 if(should_light) else 0 

    def generate_random_target(self, range_x: Tuple[int, int], range_y: Tuple[int, int]):
        min_distance = 800

        x = random.randint(range_x[0], range_x[1])
        y = random.randint(range_y[0], range_y[1])
        target = Point((x, y))

        distance_to_drone = self.calculate_distance(target)

        while distance_to_drone < min_distance:
            x = random.randint(range_x[0], range_x[1])
            y = random.randint(range_y[0], range_y[1])
            target = Point((x, y))
            distance_to_drone = self.calculate_distance(target)
        
        return target

    def go_to_next_zone(self):
        self._zone = next(self._zone_iter)

    def get_up_target(self):
        if self._coord is None:
            return None
        return Point((self._coord[0], Y_TO_REGISTER))

          
    def is_at_target(self): 
        return (self._target and self._target.coord and self._coord and
                self._coord[1] == self._target.coord[1] and
                self._coord[0] == self._target.coord[0])

    def go_to_target(self):
        if self.target is None or self.target.coord is None:
            self.wait()
            return
        print(f"MOVE {str(self.target.coord[0])} {str(self.target.coord[1])} {str(self.get_light())}")

    def wait(self):
        print(f"WAIT {str(self.get_light())}")


class GameAction: 
    def __init__(self):
        super()
        self._creatures: List[Creature] = [] #Maybe useless
        self._my_drones: List[MyDrone] = []
        self._creature_scanned: List[Creature] = []
        self.zones = [[Zone(2,(790, 4500), (7500, 9999)), Zone(1,(790, 4500),(5000, 7500)), Zone(0,(790, 4500),(2500, 5000))],
         [Zone(2,(5000, 9250), (7500, 9999)), Zone(1,(5000, 9250),(5000, 7500)), Zone(0,(5000, 9250),(2500, 5000))]]
    
    def update_drone(self, drone_id, coord, emergency, battery, nb_creature_to_register ):
        drone_to_update = self.get_drone(drone_id)
        if drone_to_update:
            drone_to_update.update(drone_id, coord, battery, emergency, nb_creature_to_register)
        else: 
            self._my_drones.append(MyDrone(drone_id, coord, emergency, battery, self.zones.pop()))

    def add_creature(self, creature: Creature): 
        self._creatures.append(creature)

    def get_drone(self, drone_id_to_find: int)-> Optional[MyDrone]:
        for drone in self._my_drones:
            if drone.item_id == drone_id_to_find:
                return drone
        return None  

    def update_creature_by_id(self,creature_id: int, coord: Optional[Tuple[int, int]], speed: Optional[Tuple[int, int]]):
        matching_creature = next((creature for creature in self._creatures if creature.item_id == creature_id), None)
        if matching_creature:
            matching_creature.update_with_coordinate(coord, speed)
            self.add_creature_scanned(matching_creature) 

    def is_type_been_scanned(self, type: int):
        nb_creature_for_type = 0
        for creature in self._creature_scanned:
            if creature.type == type:
                nb_creature_for_type += 1
        log(f"========== nb_creature_for_type {nb_creature_for_type} {type}")
        return nb_creature_for_type >= 4

    def add_creature_scanned(self, creature: Creature):
        if creature not in self._creature_scanned:
            self._creature_scanned.append(creature)
                        
    def debug_info(self):
        log("==== Debug Info ====")
        for drone in self._my_drones:
            drone.debug_info()

        log(f"Creatures: {self._creatures}")
        log(f"Creatures Scanned: {self._creature_scanned}")

        log("===================")

    def find_next_target(self, drone: MyDrone):
        try:
            if self.is_type_been_scanned(drone._zone.type):
                drone.go_to_next_zone()
                return drone.get_up_target()
            return drone._zone.go_to_next_in_zone(drone)
        except StopIteration:
            return drone.generate_random_target((0, 9500), (2500, 9500))
    

    def should_go_up(self, drone: MyDrone):
        return (self.is_type_been_scanned(drone._zone.type) or
                self._my_drones[0]._nb_creature_to_register + self._my_drones[1]._nb_creature_to_register == 12) # TODO en fonction des types de s'ils ont deja ete sauvegarder et sil y a des poissons encore visible ?
   

    def round(self, index: int):
        # TODO chek if all fish have been scanned in zone
        drone = self._my_drones[index]
        if(drone.is_up()): 
            drone.remove_creature_all_to_register()
            drone.target = self.find_next_target(drone) # or none ?
        elif(self.should_go_up(drone)):
            drone.target = drone.get_up_target()
        elif(drone.is_at_target()):
            drone.target = self.find_next_target(drone)
        
        
        if(drone.target):
            drone.go_to_target()
        else: 
            drone.wait()



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
    #log(f"=================== my_scan_count {my_scan_count}")
   
    for i in range(my_scan_count):
        creature_id = int(input())
    foe_scan_count = int(input())
    for i in range(foe_scan_count):
        creature_id = int(input())
    my_drone_count = int(input())
    for i in range(my_drone_count):
        drone_id, drone_x, drone_y, emergency, battery = [int(j) for j in input().split()]
        game.update_drone(drone_id, (drone_x, drone_y), emergency, battery, my_drone_count )
    foe_drone_count = int(input())
    for i in range(foe_drone_count):
        drone_id, drone_x, drone_y, emergency, battery = [int(j) for j in input().split()]
    drone_scan_count = int(input())
    #log(f"=================== drone_scan_count {drone_scan_count}")
    for i in range(drone_scan_count):
        drone_id, creature_id = [int(j) for j in input().split()]
    visible_creature_count = int(input())
    #log(f"=================== visible_creature_count {visible_creature_count}")
    for i in range(visible_creature_count):
        creature_id, creature_x, creature_y, creature_vx, creature_vy = [int(j) for j in input().split()]
        game.update_creature_by_id(creature_id, (creature_x, creature_y), (creature_vx, creature_vy))

    radar_blip_count = int(input())
    for i in range(radar_blip_count):
        inputs = input().split()
        drone_id = int(inputs[0])
        creature_id = int(inputs[1])
        radar = inputs[2]
    game.debug_info()
    for i in range(my_drone_count):
        game.round(i)

        # Write an action using print
        # To debug: print("Debug messages...", file=sys.stderr, flush=True)
        #game.round()



            # MOVE <x> <y> <light (1|0)> | WAIT <light (1|0)>



