const DEBUG = true;
const MAX_DIST_BY_ROUND = 600;
const BIG_LIGHT_RADIUS = 2000;
const SMALL_LIGHT_RADIUS = 800;
const Y_TO_REGISTER = 500;
const Y_DOWNEST_TO_GET_CREATURE = 9200;
const RADIUS_COLLISION = 500;
const MIN_BORDER_MAP = 0;
const MAX_BORDER_MAP = 9999;
const FISH_SPEED = 200;
const SCORE_BY_TYPE = [1, 2, 3];
const NB_COLOR = 4;
const NB_TYPES = 3;

// seed monster down seed=-5177691760985842000

const FirstFiveTurns = new Map([
  [
    0,
    new Map([
      [0, { X: 2756, Y: 3700, Light: false }],
      [1, { X: 2659, Y: 3709, Light: false }],
      [2, { X: 2629, Y: 3719, Light: false }],
      [3, { X: 2624, Y: 3731, Light: true }],
      [4, { X: 1597, Y: 6207, Light: false }],
    ]),
  ],
  [
    1,
    new Map([
      [0, { X: 7249, Y: 3701, Light: false }],
      [1, { X: 7341, Y: 3709, Light: false }],
      [2, { X: 7368, Y: 3719, Light: false }],
      [3, { X: 7375, Y: 3731, Light: false }],
      [4, { X: 7352, Y: 3917, Light: true }],
    ]),
  ],
  [
    2,
    new Map([
      [0, { X: 7271, Y: 3846, Light: false }],
      [1, { X: 7256, Y: 3916, Light: false }],
      [2, { X: 7197, Y: 3944, Light: false }],
      [3, { X: 7119, Y: 3929, Light: false }],
      [4, { X: 7108, Y: 4057, Light: true }],
    ]),
  ],
  [
    3,
    new Map([
      [0, { X: 2736, Y: 3849, Light: false }],
      [1, { X: 2744, Y: 3916, Light: false }],
      [2, { X: 2803, Y: 3944, Light: false }],
      [3, { X: 2881, Y: 3929, Light: true }],
      [4, { X: 2540, Y: 4554, Light: false }],
    ]),
  ],
]);

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

function inMap([x, y]: Point): boolean {
  return x >= 0 && x <= MAX_BORDER_MAP && y >= 0 && y <= MAX_BORDER_MAP;
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
type ScoreBonusCount = Record<
  number,
  { scannedOrRegister: number; isScannedByFoe: boolean }
>;
type ScoreCount = {
  scoreScanned: number;
  typeBonusCount: ScoreBonusCount;
  colorBonusCount: ScoreBonusCount;
};

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

  debug() {
    console.error(
      `Creature id: ${this.id} pos: ${this.getEstimatedPosition()} rangeX ${
        this.rangeX
      } rangeY ${this.rangeY}`
    );
  }

  updateWithCoordinate(pos: Point, speed: Point) {
    this.pos = pos;
    const [x, y] = pos;
    this.rangeX = [x, x];
    this.rangeY = [y, y];
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

  addSpeedToRange() {
    const [xmin, xmax] = this.rangeX;
    const [ymin, ymax] = this.rangeY;
    this.rangeX = [
      Math.max(xmin - FISH_SPEED, MIN_BORDER_MAP),
      Math.min(xmax + FISH_SPEED, MAX_BORDER_MAP),
    ];
    this.rangeY = [
      Math.max(ymin - FISH_SPEED, MIN_BORDER_MAP),
      Math.min(ymax + FISH_SPEED, MAX_BORDER_MAP),
    ];
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

  willCollide(dronePos: Point, droneSpeed: Point) {
    if (!this.pos || !this.speed) return false;

    if (inRange(this.pos, dronePos, RADIUS_COLLISION)) {
      return true;
    }

    // Change referencial
    const [x, y] = this.pos;
    const [vx, vy] = droneSpeed;
    const [ux, uy] = dronePos;

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

    return true;
  }

  getScore() {
    return this.isScannedByFoe
      ? SCORE_BY_TYPE[this.type]
      : SCORE_BY_TYPE[this.type] * 2;
  }
}

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

  getLight(): number {
    const hasCreatureClosed = Game.fishes.some(
      ({ pos }) => !!pos && calculateDistance(pos, this.pos) <= 800
    );

    const shouldLight =
      this.battery >= 5 &&
      !hasCreatureClosed &&
      this.coolDownLight <= 0 &&
      this.pos[1] >= 2500;

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
    console.error(`============================================`);
    console.error(`Drone ${this.id} Pos:${this.pos} Target: ${this.target}`);
    console.error("creatureTarget", this.creatureTargets);
    console.error(`============================================\n`);
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

  getSpeed(p: Point): Point {
    const distanceToTarget = calculateDistance(this.pos, p);
    if (distanceToTarget > 600) {
      const [vx, vy] = createVectorFromPoints(this.pos, p);
      const [ux, uy] = [vx / distanceToTarget, vy / distanceToTarget];
      return [Math.round(ux * 600), Math.round(uy * 600)];
    }
    return [p[0] - this.pos[0], p[1] - this.pos[1]];
  }

  findNextTarget(): Point | null {
    if (this.creatureTargets.length > 0) {
      const positions = this.creatureTargets.map((id) =>
        Game.getFish(id)!.getEstimatedPosition()
      );
      return calculateBarycenter(positions);
    }

    return null;
  }

  computeCreatureTarget() {
    this.creatureTargets = [];
    let type = Game.type;

    while (type <= 2 && this.creatureTargets.length === 0) {
      const targetsForType = Game.targetsAvailable.filter(
        (t) => t.type === type
      );
      const maxCreatureForDrone = Math.round(
        Game.fishes.filter((f) => f.status === "available" && f.type === type)
          .length / 2
      );
      while (
        this.creatureTargets.length < maxCreatureForDrone &&
        targetsForType.length > 0
      ) {
        // TODO targetForDrone pas efficient parfois prend des cibles trop lointaine
        const targetForDrone = targetsForType.shift();
        if (targetForDrone) {
          this.creatureTargets.push(targetForDrone.id);
        }
      }
      type++;
    }
  }

  avoidMonster() {
    const monstersInRadius = Game.monsters.filter((monster) => !!monster.pos);
    const nextTarget = this.target ?? [
      this.pos[0],
      Math.min(this.pos[1] + 300, MAX_BORDER_MAP),
    ];
    if (monstersInRadius.length > 0) {
      const speed = this.getSpeed(nextTarget);
      const allPossiblePosition: Point[] = [];

      monstersInRadius.forEach((monster) => {
        if (monster.willCollide(this.pos, speed)) {
          console.error(`IF FOLLOW TARGET WILL COLLIDE WITH ${monster.id}`);
          const t = 0.1;
          for (let i = 0; i <= 2 * Math.PI; i += t) {
            const [vx, vy] = [
              Math.round(Math.cos(i) * 600),
              Math.round(Math.sin(i) * 600),
            ];
            const position: Point = [this.pos[0] + vx, this.pos[1] + vy];

            const willCollide = monstersInRadius.some((m) =>
              m.willCollide(this.pos, [vx, vy])
            );
            if (!willCollide && inMap(position)) {
              allPossiblePosition.push(position);
            }
          }
        }
      });

      const closestAvailablePositionFromTarget = allPossiblePosition.reduce<{
        position: Point | null;
        minDistance: number;
      }>(
        (acc, position) => {
          const distance = calculateDistance(position, nextTarget);
          if (distance < acc.minDistance) {
            return {
              position,
              minDistance: distance,
            };
          }
          return acc;
        },
        {
          position: null,
          minDistance: MAX_BORDER_MAP,
        }
      );

      this.target = closestAvailablePositionFromTarget.position ?? nextTarget;
    }
  }

  printMove() {
    const light = this.getLight();
    if (this.target) {
      const log = this.creatureTargets;
      const speed = this.getSpeed(this.target);
      const [x, y]: Point = [this.pos[0] + speed[0], this.pos[1] + speed[1]];
      console.error(`pos: ${this.pos} speed ${speed} ${[x, y]}`);
      console.log(`MOVE ${x} ${y} ${light} ${log}`);
    } else {
      console.log(`WAIT ${light}`);
    }
  }
}

class Game {
  public static type: number = 0;
  public static rangeY: Point[] = [
    [2500, 5000],
    [5000, 7500],
    [7500, MAX_BORDER_MAP],
  ];
  public static fishes: Creature[] = [];
  public static monsters: Creature[] = [];
  public static myDrones: Drone[] = [];
  public static targetsAvailable: CreatureInfo[] = [];
  public static round = 1;

  public static computeTargetsAvailable(): void {
    Game.targetsAvailable = Game.fishes
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
            droneClosest, // TODO use or remove
            pos,
          });
        }
        return acc;
      }, [])
      .sort((a, b) => a.pos[0] - b.pos[0])
      .sort((a, b) => a.type - b.type);
  }

  public static removeTargetsAvailable(targets: number[]) {
    Game.targetsAvailable = Game.targetsAvailable.filter(
      (t) => !targets.includes(t.id)
    );
  }

  public static getFish(creatureId: number): Creature | undefined {
    return Game.fishes.find(({ id }) => id === creatureId);
  }

  public static getScore(myScore: number) {
    const { scoreScanned, colorBonusCount, typeBonusCount } =
      Game.fishes.reduce<ScoreCount>(
        (acc, f) => {
          if (f.status === "scanned" || f.status === "registered") {
            if (f.status === "scanned") {
              acc.scoreScanned += f.getScore();
            }

            if (acc.typeBonusCount[f.type] === undefined) {
              acc.typeBonusCount[f.type] = {
                scannedOrRegister: 0,
                isScannedByFoe: false,
              };
            }
            acc.typeBonusCount[f.type].scannedOrRegister++;
            acc.typeBonusCount[f.type].isScannedByFoe =
              acc.typeBonusCount[f.type].isScannedByFoe || f.isScannedByFoe;

            if (acc.colorBonusCount[f.color] === undefined) {
              acc.colorBonusCount[f.color] = {
                scannedOrRegister: 0,
                isScannedByFoe: false,
              };
            }
            acc.colorBonusCount[f.color].scannedOrRegister++;
            acc.colorBonusCount[f.color].isScannedByFoe =
              acc.colorBonusCount[f.color].isScannedByFoe || f.isScannedByFoe;
          }
          return acc;
        },
        {
          scoreScanned: 0,
          typeBonusCount: {},
          colorBonusCount: {},
        }
      );

    let score = myScore + scoreScanned;
    for (let i = 0; i < NB_COLOR; i++) {
      if (colorBonusCount[i] && colorBonusCount[i].scannedOrRegister === 3) {
        score += colorBonusCount[i].isScannedByFoe ? 3 : 6;
      }
    }

    for (let i = 0; i < NB_TYPES; i++) {
      if (typeBonusCount[i] && typeBonusCount[i].scannedOrRegister === 3) {
        score += typeBonusCount[i].isScannedByFoe ? 3 : 6;
      }
    }

    return score;
  }

  public static endTurn() {
    const isTypeBeenScanned = !Game.fishes.some(
      (f) => f.status === "available" && f.type === Game.type
    );
    if (isTypeBeenScanned) {
      Game.type = Game.type + 1;
      console.error("isTypeBeenScanned change to type", Game.type);
    }
    Game.fishes.forEach((f) => f.addSpeedToRange());
    Game.round++;
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

  // Init round
  Game.fishes.forEach((c) => {
    c.status = "deleted";
  });

  for (let i = 0; i < myScanCount; i++) {
    // @ts-ignore
    const creatureId = parseInt(readline());
    const matchingCreature = Game.getFish(creatureId);
    if (matchingCreature) {
      matchingCreature.status = "registered";
    }
  }

  // @ts-ignore
  const foeScanCount = parseInt(readline());
  for (let i = 0; i < foeScanCount; i++) {
    // @ts-ignore
    const creatureId = parseInt(readline());
    const matchingCreature = Game.getFish(creatureId);
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
  Game.myDrones.sort((a, b) => a.pos[0] - b.pos[0]);

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

      const matchingCreature = Game.getFish(creatureId);
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

    const matchingCreature =
      Game.getFish(creatureId) ??
      Game.monsters.find((creature) => creature.id === creatureId);
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
    const matchingCreature = Game.getFish(creatureIdInt);
    const drone = Game.myDrones.find(({ id }) => id === droneIdInt);

    if (matchingCreature && drone) {
      if (matchingCreature.status === "deleted") {
        matchingCreature.status = "available";
      }
      matchingCreature.updateZone(drone.pos, radar);
    }
  }

  // END GET ALL DATA
  Game.computeTargetsAvailable();

  console.error(`==================== Monster =====================`);
  Game.monsters.forEach((m) =>
    console.error(`${m.id} pos: ${m.pos} speed: ${m.speed}`)
  );
  console.error(`============================================\n`);

  const score = Game.getScore(myScore);
  const hasFishAvailable = Game.fishes.some((f) => f.status === "available");

  //

  // =============== FOR DRONE =====================
  Game.myDrones.forEach((drone) => {
    drone.computeCreatureTarget();
    Game.removeTargetsAvailable(drone.creatureTargets);
  });

  Game.myDrones.sort((a, b) => a.id - b.id);

  // PRINT
  for (let i = 0; i < myDroneCount; i++) {
    const drone = Game.myDrones[i];

    const shouldGoUp =
      (score >= 64 || !hasFishAvailable) && drone.nbScanToRegister > 0; // TODO ESTIMATED SCORE 64 and some drone doesn't go up

    if (shouldGoUp || (drone.isGoingUp() && !drone.isUp())) {
      console.error("GO UP");
      drone.target = drone.getUpTarget();
    } else {
      console.error("FIND NEXT TARGET");
      drone.target = drone.findNextTarget();
    }
    drone.avoidMonster();

    DEBUG && drone.debugInfo();
    drone.printMove();
  }

  // END TURN
  Game.endTurn();
}
