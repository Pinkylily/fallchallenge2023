import sys
import math

import math

def distance(x1, y1, x2, y2):
    return math.sqrt((x2 - x1)**2 + (y2 - y1)**2)


MAX_DIST_BY_ROUND = 600


# A priori pas besoin d'aller en haut pour sauvegarder les poissons
# 1ère idée déterminer un poisson rare pas trop loin de nous et plus loin de l'adversaire 
# aller vers se poisson 
# si plusieurs poissons sur le chemin à + de 800u et -de 2000u et batterie à + de 5 alors on met 1 de light
# sinon on met 0
# 
#

class Drone:
    def __init__(self, drone_id, drone_x, drone_y, emergency, battery):
        self.drone_id = drone_id
        self.drone_x = drone_x
        self.drone_y = drone_y
        self.emergency = emergency
        self.battery = battery

    # Getter methods
    def get_drone_id(self):
        return self.drone_id

    def get_drone_x(self):
        return self.drone_x

    def get_drone_y(self):
        return self.drone_y

    def get_emergency(self):
        return self.emergency

    def get_battery(self):
        return self.battery

    # Setter methods
    def set_drone_id(self, drone_id):
        self.drone_id = drone_id

    def set_drone_x(self, drone_x):
        self.drone_x = drone_x

    def set_drone_y(self, drone_y):
        self.drone_y = drone_y

    def set_emergency(self, emergency):
        self.emergency = emergency

    def set_battery(self, battery):
        self.battery = battery

    def should_go_to_up(self):
        print("drone_y: " + str(self.drone_y) + "drone_x" + str(self.drone_x), file=sys.stderr, flush=True)
        print("battery: " + str(self.battery), file=sys.stderr, flush=True)
        return self.battery == 0 
        
    def go_up(self): 
        print("MOVE " + str(self.drone_x) + " " +  str(max(self.drone_y - MAX_DIST_BY_ROUND, 0)) + " 0")
        


# Score points by scanning valuable fish faster than your opponent.

creature_count = int(input())
for i in range(creature_count):
    creature_id, color, _type = [int(j) for j in input().split()]

# game loop
while True:
    my_score = int(input())
    foe_score = int(input())
    my_scan_count = int(input())
    my_drone = None
    for i in range(my_scan_count):
        creature_id = int(input())
    foe_scan_count = int(input())
    for i in range(foe_scan_count):
        creature_id = int(input())
    my_drone_count = int(input())
    for i in range(my_drone_count):
        drone_id, drone_x, drone_y, emergency, battery = [int(j) for j in input().split()]
        my_drone = Drone(drone_id, drone_x, drone_y, emergency, battery )
    foe_drone_count = int(input())
    for i in range(foe_drone_count):
        drone_id, drone_x, drone_y, emergency, battery = [int(j) for j in input().split()]
    drone_scan_count = int(input())
    for i in range(drone_scan_count):
        drone_id, creature_id = [int(j) for j in input().split()]
    visible_creature_count = int(input())
    for i in range(visible_creature_count):
        creature_id, creature_x, creature_y, creature_vx, creature_vy = [int(j) for j in input().split()]
    radar_blip_count = int(input())
    for i in range(radar_blip_count):
        inputs = input().split()
        drone_id = int(inputs[0])
        creature_id = int(inputs[1])
        radar = inputs[2]
    for i in range(my_drone_count):

        # Write an action using print
        # To debug: print("Debug messages...", file=sys.stderr, flush=True)



        if(my_drone):
            if(my_drone.should_go_to_up()):
                my_drone.go_up()
            else : 
                print("WAIT 1")
        else:
            # MOVE <x> <y> <light (1|0)> | WAIT <light (1|0)>
            print("WAIT 1")



