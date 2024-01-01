const DEBUG = true;
const MAX_DIST_BY_ROUND = 600;
const BIG_LIGHT_RADIUS = 2000;
const SMALL_LIGHT_RADIUS = 800;
const Y_TO_REGISTER = 500;
const Y_DOWNEST_TO_GET_CREATURE = 9200;
const RADIUS_COLLISION = 500;
const MIN_BORDER_MAP = 0;
const MAX_BORDER_MAP = 10000;

// seed monster down seed=-5177691760985842000

function calculateDistance(point1: Point, point2: Point) {
  const dx = point1[0] - point2[0];
  const dy = point1[1] - point2[1];
  return Math.sqrt(dx * dx + dy * dy);
}

function calculateBarycenter(points: Point[]): Point | null {
  const totalPoints = points.length;

  if (totalPoints === 0) {
    return null; // No points to compute the barycenter
  }

  // Calculate the sum of x and y coordinates
  const sumX = points.reduce((acc, point) => acc + point[0], 0);
  const sumY = points.reduce((acc, point) => acc + point[1], 0);

  // Calculate the average coordinates
  const centerX = Math.round(sumX / totalPoints);
  const centerY = Math.round(sumY / totalPoints);

  return [centerX, centerY];
}

function createVectorFromPoints(point1: Point, point2: Point) {
  const x = point2[0] - point1[0];
  const y = point2[1] - point1[1];
  return [x, y];
}

function inRange(p1: Point, p2: Point, radius: number) {
  const [x, y] = p1;
  const [x2, y2] = p2;
  return (x2 - x) * (x2 - x) + (y2 - y) * (y2 - y) <= radius * radius;
}

type Radar = "TR" | "TL" | "BL" | "BR";
type CreatureStatus = "registered" | "scanned" | "deleted" | "available";
type CreatureInfo = {
  id: number;
  type: number;
  pos: Point;
  droneClosest: number;
};
type Point = [number, number];

class Creature {
  public id: number;
  public color: number;
  public type: number;
  public speed: Point | null;
  public pos: Point | null;
  public status: CreatureStatus;
  public isScannedByFoe: boolean;
  private rangeX: Point;
  private rangeY: Point;

  constructor(id: number, color: number, type: number) {
    this.id = id;
    this.color = color;
    this.type = type;
    this.speed = null;
    this.pos = null;
    this.rangeX = [MIN_BORDER_MAP, MAX_BORDER_MAP];
    this.rangeY = Game.rangeY[type];
  }

  updateWithCoordinate(pos: Point, speed) {
    this.pos = pos;
    this.speed = speed;
  }

  updateZone(posDrone: Point, radar: string) {
    const [x, y] = posDrone;
    const isInTop = radar.includes("T");
    const isInLeft = radar.includes("L");

    const [xmin, xmax] = this.rangeX;
    const [ymin, ymax] = this.rangeY;
    if (isInLeft) {
      this.rangeX[1] = Math.min(xmax, x);
    } else {
      this.rangeX[0] = Math.max(xmin, x);
    }

    if (isInTop) {
      // ymax = min(ymax, yDrone)
      this.rangeY[1] = Math.min(ymax, y);
    } else {
      // ymin = max(ymin, yDrone)
      this.rangeY[0] = Math.max(ymin, y);
    }
  }

  getEstimatedPosition(): Point {
    if (this.pos) {
      return this.pos;
    }

    // compute barycentre
    const [xmin, xmax] = this.rangeX;
    const [ymin, ymax] = this.rangeY;

    const centerX = Math.round((xmin + xmax) / 2);
    const centerY = Math.round((ymin + ymax) / 2);

    return [centerX, centerY];
  }

  willCollide(point: Point, [vx, vy]: Point) {
    if (!this.pos || !this.speed) return false;

    if (inRange(this.pos, point, RADIUS_COLLISION)) {
      return true;
    }

    // Change referencial
    const [x, y] = this.pos;
    const [ux, uy] = point;

    const x2 = x - ux;
    const y2 = y - uy;
    const vx2 = this.speed[0] - vx;
    const vy2 = this.speed[1] - vy;

    // Resolving: sqrt((x + t*vx)^2 + (y + t*vy)^2) = radius <=> t^2*(vx^2 + vy^2) + t*2*(x*vx + y*vy) + x^2 + y^2 - radius^2 = 0
    // at^2 + bt + c = 0;
    // a = vx^2 + vy^2
    // b = 2*(x*vx + y*vy)
    // c = x^2 + y^2 - radius^2

    const a = vx2 * vx2 + vy2 * vy2;

    if (a <= 0.0) {
      return false;
    }

    const b = 2.0 * (x2 * vx2 + y2 * vy2);
    const c = x2 * x2 + y2 * y2 - RADIUS_COLLISION * RADIUS_COLLISION;
    const delta = b * b - 4.0 * a * c;

    if (delta < 0.0) {
      return false;
    }

    const t = (-b - Math.sqrt(delta)) / (2.0 * a);

    if (t <= 0.0) {
      return false;
    }

    if (t > 1.0) {
      return false;
    }
  }
}

interface IGame {
  type: number;
  rangeY: Point[];
  fishes: Creature[];
  monsters: Creature[];
  myDrones: Drone[];
}

const Game: IGame = {
  type: 0,
  rangeY: [
    [2500, 5000],
    [5000, 7500],
    [7500, 10000],
  ],
  fishes: [],
  monsters: [],
  myDrones: [],
};

class Drone {
  public id: number;
  public pos: Point;
  public battery: number;
  public emergency: number;
  public target: Point | null;
  public nbScanToRegister: number;
  public coolDownLight: number;
  public creatureTargets: number[];
  public type: number;

  constructor(id: number, pos: Point, battery: number, emergency: number) {
    this.id = id;
    this.pos = pos;
    this.battery = battery;
    this.emergency = emergency;
    this.target = null;
    this.creatureTargets = [];
    this.coolDownLight = 2;
    this.type = 0;
  }

  update(pos: Point, battery: number, emergency: number) {
    this.pos = pos;
    this.battery = battery;
    this.emergency = emergency;
    this.nbScanToRegister = 0;

    if (emergency === 1) {
      this.creatureTargets = [];
    }
  }

  getLight(hasCreatureClosed: boolean): number {
    const isAroundCreatureTarget = this.creatureTargets.some((creatureId) => {
      const matchingCreature = Game.fishes.find(({ id }) => id === creatureId);
      if (matchingCreature) {
        return (
          calculateDistance(
            matchingCreature.getEstimatedPosition(),
            this.pos
          ) <= BIG_LIGHT_RADIUS
        );
      }
      return false;
    });

    const shouldLight =
      this.battery >= 5 &&
      !hasCreatureClosed &&
      this.coolDownLight <= 0 &&
      isAroundCreatureTarget;

    if (shouldLight) {
      this.coolDownLight = 2;
    } else {
      this.coolDownLight--;
    }
    return shouldLight ? 1 : 0;
  }

  isDown(): boolean {
    return this.pos && this.pos[1] >= Y_DOWNEST_TO_GET_CREATURE;
  }

  isUp(): boolean {
    return this.pos?.[1] <= Y_TO_REGISTER;
  }

  debugInfo() {
    console.error(`==== Drone ${this.id} Target: ${this.target}`);
    console.error("creatureTarget", this.creatureTargets);
  }

  isGoingUp() {
    return this.target && this.target[1] === Y_TO_REGISTER;
  }

  getUpTarget(): Point | null {
    if (!this.pos) {
      return null;
    }
    return [this.pos[0], Y_TO_REGISTER];
  }

  isAtTarget(): boolean {
    return (
      !!this.target &&
      !!this.pos &&
      this.pos[1] === this.target[1] &&
      this.pos[0] === this.target[0]
    );
  }

  getNextPosition(): Point {
    if (this.target === null) {
      throw Error("TARGET SHOULD NOT BE NULL");
    }

    const distanceToTarget = calculateDistance(this.pos, this.target);
    if (distanceToTarget > 600) {
      const [vx, vy] = createVectorFromPoints(this.pos, this.target);
      const [ux, uy] = [vx / distanceToTarget, vy / distanceToTarget];
      return [
        Math.round(this.pos[0] + ux * 600),
        Math.round(this.pos[1] + uy * 600),
      ];
    }
    return this.target;
  }

  findNextTarget(): Point | null {
    if (this.creatureTargets.length > 0) {
      const positions = this.creatureTargets.map((id) =>
        Game.fishes.find((c) => c.id === id)!.getEstimatedPosition()
      );
      return calculateBarycenter(positions);
    }

    return null;
  }
}

// @ts-ignore
const creatureCount = parseInt(readline());
for (let i = 0; i < creatureCount; i++) {
  // @ts-ignore
  const [creatureId, color, type] = readline().split(" ").map(Number);
  const creature = new Creature(creatureId, color, type);
  if (type === -1) {
    Game.monsters.push(creature);
  } else {
    Game.fishes.push(creature);
  }
}

while (true) {
  // @ts-ignore
  const myScore = parseInt(readline());
  // @ts-ignore
  const foeScore = parseInt(readline());
  // @ts-ignore
  const myScanCount = parseInt(readline());

  // init round
  Game.fishes.forEach((c) => {
    c.status = "deleted";
  });

  for (let i = 0; i < myScanCount; i++) {
    // @ts-ignore
    const creatureId = parseInt(readline());
    const matchingCreature = Game.fishes.find(({ id }) => id === creatureId);
    if (matchingCreature) {
      matchingCreature.status = "registered";
    }
  }

  // @ts-ignore
  const foeScanCount = parseInt(readline());
  for (let i = 0; i < foeScanCount; i++) {
    // @ts-ignore
    const creatureId = parseInt(readline());
    const matchingCreature = Game.fishes.find(({ id }) => id === creatureId);
    if (matchingCreature) {
      matchingCreature.isScannedByFoe = true;
    }
  }

  // @ts-ignore
  const myDroneCount = parseInt(readline());
  for (let i = 0; i < myDroneCount; i++) {
    // @ts-ignore
    const [droneId, droneX, droneY, emergency, battery] = readline()
      .split(" ")
      .map(Number);
    if (Game.myDrones.length >= myDroneCount) {
      Game.myDrones[i].update([droneX, droneY], battery, emergency);
    } else {
      Game.myDrones.push(
        new Drone(droneId, [droneX, droneY], battery, emergency)
      );
    }
  }

  // @ts-ignore
  const foeDroneCount = parseInt(readline());
  for (let i = 0; i < foeDroneCount; i++) {
    // @ts-ignore
    const [droneId, droneX, droneY, emergency, battery] = readline()
      .split(" ")
      .map(Number);
  }

  // @ts-ignore
  const droneScanCount = parseInt(readline());
  for (let i = 0; i < droneScanCount; i++) {
    // @ts-ignore
    const [droneId, creatureId] = readline().split(" ").map(Number);
    const drone = Game.myDrones.find(({ id }) => id === droneId);

    if (drone) {
      drone.nbScanToRegister++;

      const matchingCreature = Game.fishes.find(({ id }) => id === creatureId);
      if (matchingCreature) {
        matchingCreature.status = "scanned";
      }

      // clean already scanned target
      drone.creatureTargets = drone.creatureTargets.filter(
        (id) => creatureId !== id
      );
    }
  }

  // @ts-ignore
  const visibleCreatureCount = parseInt(readline());
  for (let i = 0; i < visibleCreatureCount; i++) {
    const [creatureId, creatureX, creatureY, creatureVX, creatureVY] = // @ts-ignore
      readline().split(" ").map(Number);

    const matchingCreature = Game.fishes.find(
      (creature) => creature.id === creatureId
    );
    if (matchingCreature) {
      matchingCreature.updateWithCoordinate(
        [creatureX, creatureY],
        [creatureVX, creatureVY]
      );
    }
  }

  // ============== RADAR LOOP ============
  // @ts-ignore
  const radarBlipCount = parseInt(readline());
  for (let i = 0; i < radarBlipCount; i++) {
    // @ts-ignore
    const [droneId, creatureId, radar] = readline().split(" ");
    const creatureIdInt = parseInt(creatureId);
    const droneIdInt = parseInt(droneId);
    const matchingCreature = Game.fishes.find(({ id }) => creatureIdInt === id);
    const drone = Game.myDrones.find(({ id }) => id === droneIdInt);

    if (matchingCreature && drone) {
      if (matchingCreature.status === "deleted") {
        matchingCreature.status = "available";
      }
      matchingCreature.updateZone(drone.pos, radar);
    }
  }

  let targetsAvailable = Game.fishes
    .reduce<CreatureInfo[]>((acc, creature) => {
      if (creature.status === "available") {
        const pos = creature.getEstimatedPosition();
        const droneClosest =
          calculateDistance(Game.myDrones[0].pos, pos) <
          calculateDistance(Game.myDrones[1].pos, pos)
            ? Game.myDrones[0].id
            : Game.myDrones[1].id;
        acc.push({
          id: creature.id,
          type: creature.type,
          droneClosest,
          pos,
        });
      }
      return acc;
    }, [])
    .sort((a, b) => a.pos[0] - b.pos[0])
    .sort((a, b) => a.droneClosest - b.droneClosest)
    .sort((a, b) => a.type - b.type);

  console.error(
    `targetsAvailable ${JSON.stringify(targetsAvailable, null, 2)}`
  );

  for (let i = 0; i < myDroneCount; i++) {
    const drone = Game.myDrones[i];
    const monstersInRadius = Game.monsters.filter((monster) => !!monster.pos);
    drone.creatureTargets = [];
    let type = Game.type;

    while (type <= 2 && drone.creatureTargets.length === 0) {
      const targetsForType = targetsAvailable.filter((t) => t.type === type);
      const maxCreatureForDrone = Math.round(
        Game.fishes.filter(
          (f) => f.status === "available" && f.type === Game.type
        ).length / 2
      );
      while (
        drone.creatureTargets.length < maxCreatureForDrone &&
        targetsForType.length > 0
      ) {
        // TODO refaire

        const targetForDrone = targetsForType.shift();
        if (targetForDrone) {
          drone.creatureTargets.push(targetForDrone.id);
        }
      }
      type++;
    }
    targetsAvailable = targetsAvailable.filter(
      (t) => !drone.creatureTargets.includes(t.id)
    );

    const isTypeBeenScanned =
      Game.fishes.filter(
        (f) => f.status === "available" && f.type === Game.type
      ).length === 0;
    const shouldGoUp =
      isTypeBeenScanned && drone.nbScanToRegister > 0 && Game.type >= 1; // TODO ESTIMATED SCORE 64 and some drone doesn't go up
    if (isTypeBeenScanned) {
      Game.type = Game.type + 1;
      console.error("isTypeBeenScanned change to type", Game.type);
    }
    const hasCreatureClosed = Game.fishes.some(
      ({ pos }) => !!pos && calculateDistance(pos, drone.pos) <= 800
    );

    if (shouldGoUp || (drone.isGoingUp() && !drone.isUp())) {
      console.error("shouldGoUp");
      drone.target = drone.getUpTarget();
    } else {
      console.error("find next target");
      drone.target = drone.findNextTarget();
    }

    drone.debugInfo();

    // AVOID MONSTER
    if (drone.target && monstersInRadius.length > 0) {
      const nextPosition = drone.getNextPosition();
      monstersInRadius.forEach((monster) => {
        if (monster.willCollide(drone.pos, nextPosition)) {
          console.error(`C EST LA MERDE ${monster.id}`);
        }
      });
    }

    const light = drone.getLight(hasCreatureClosed);
    if (drone.target) {
      const idsCreaturesTarget = drone.creatureTargets;
      console.log(
        `MOVE ${drone.target[0]} ${drone.target[1]} ${light} ${idsCreaturesTarget}`
      );
    } else {
      console.log(`WAIT ${light}`);
    }
  }
}
