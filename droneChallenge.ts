const DEBUG = true;
const MAX_DIST_BY_ROUND = 600;
const BIG_LIGHT_RADIUS = 2000;
const SMALL_LIGHT_RADIUS = 800;
const Y_TO_REGISTER = 500;
const Y_DOWNEST_TO_GET_CREATURE = 9200;

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
  const centerX = Math.floor(sumX / totalPoints);
  const centerY = Math.floor(sumY / totalPoints);

  return [centerX, centerY];
}

type Point = [number, number];

class Zone {
  public rangeX: Point;
  public rangeY: Point;
  public type: number;

  constructor(type: number, rangeX: Point, rangeY: Point) {
    this.type = type;
    this.rangeX = rangeX;
    this.rangeY = rangeY;
  }

  isInZone(point: Point, delta: number = 0) {
    return (
      point[0] >= this.rangeX[0] - delta &&
      point[0] <= this.rangeX[1] + delta &&
      point[1] >= this.rangeY[0] &&
      point[1] <= this.rangeY[1]
    );
  }

  toString() {
    return `Zone(type=${this.type}, rangeY=${this.rangeY})`;
  }
}

class Creature {
  public id: number;
  public color: number;
  public type: number;
  public speed: Point | null;
  public pos: Point | null;
  constructor(id: number, color: number, type: number) {
    this.id = id;
    this.color = color;
    this.type = type;
    this.speed = null;
    this.pos = null;
  }

  updateWithCoordinate(pos: Point, speed) {
    this.pos = pos;
    this.speed = speed;
  }
}

class Drone {
  public id: number;
  public pos: Point;
  public battery: number;
  public emergency: number;
  public target: Point | null;
  public creatureToRegister: number;

  constructor(id: number, pos: Point, battery: number, emergency: number) {
    this.id = id;
    this.pos = pos;
    this.battery = battery;
    this.emergency = emergency;
    this.target = null;
    this.creatureToRegister = 0;
  }

  update(pos: Point, battery: number, emergency: number) {
    this.pos = pos;
    this.battery = battery;
    this.emergency = emergency;
  }

  isDown(): boolean {
    return this.pos && this.pos[1] >= Y_DOWNEST_TO_GET_CREATURE;
  }

  isUp(): boolean {
    return this.pos?.[1] <= Y_TO_REGISTER;
  }

  debugInfo() {
    console.error(`==== Drone ${this.id} Target: ${this.target}`);
  }
}

type Radar = "TR" | "TL" | "BL" | "BR";

class MyDrone extends Drone {
  public zoneIter: number;
  public zone: Zone;
  public radarCreature: { [id in Radar]: number[] };

  constructor(
    id: number,
    pos: Point,
    battery: number,
    emergency: number,
    zone: Zone
  ) {
    super(id, pos, battery, emergency);
    this.target = [2000, 3750];
    this.zoneIter = 0;
    this.zone = zone;
    this.radarCreature = {
      BL: [],
      BR: [],
      TL: [],
      TR: [],
    };
  }

  update(pos: Point, battery: number, emergency: number) {
    this.pos = pos;
    this.battery = battery;
    this.emergency = emergency;
    this.creatureToRegister = 0;
    this.radarCreature = {
      BL: [],
      BR: [],
      TL: [],
      TR: [],
    };
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

  findNextTarget(): Point | null {
    if (this.zone.isInZone(this.pos)) {
      // TODO radar compute
      const radarWithMostCreatureOfType = Object.keys(
        this.radarCreature
      ).reduce(
        (acc: { id: Radar; nbOfType: number }, radar) => {
          const nbTypeOfZone: number = this.radarCreature[radar].length;
          if (nbTypeOfZone > acc.nbOfType) {
            return {
              id: radar as Radar,
              nbOfType: nbTypeOfZone,
            };
          }
          return acc;
        },
        { id: "BL", nbOfType: -1 } as { id: Radar; nbOfType: number }
      ).id;

      const right: Point = [this.zone.rangeX[1], this.pos[1]];
      const left: Point = [this.zone.rangeX[0], this.pos[1]];
      const top: Point = [this.pos[0], this.zone.rangeY[0]];
      const bottom: Point = [this.pos[0], this.zone.rangeY[1]];
      const lookUp: Record<Radar, Point[]> = {
        BL: [bottom, left],
        BR: [bottom, right],
        TL: [top, left],
        TR: [top, right],
      };
      return calculateBarycenter(lookUp[radarWithMostCreatureOfType]);
    }

    const isInLeft = this.pos[0] < 5000;
    const x = isInLeft ? this.zone.rangeX[0] : this.zone.rangeX[1];

    return [x, this.zone.rangeY[0]];
  }
}

const creatures: Creature[] = [];
const myDrones: MyDrone[] = [];
const creatureScanned: number[] = [];
const zones = [
  new Zone(0, [790, 9250], [2500, 5000]),
  new Zone(1, [790, 9250], [5000, 7500]),
  new Zone(2, [790, 9250], [7500, 9200]),
];

// @ts-ignore
const creatureCount = parseInt(readline());
for (let i = 0; i < creatureCount; i++) {
  // @ts-ignore
  const [creatureId, color, type] = readline().split(" ").map(Number);
  creatures.push(new Creature(creatureId, color, type));
}

while (true) {
  // @ts-ignore
  const myScore = parseInt(readline());
  // @ts-ignore
  const foeScore = parseInt(readline());
  // @ts-ignore
  const myScanCount = parseInt(readline());

  for (let i = 0; i < myScanCount; i++) {
    // @ts-ignore
    const creatureId = parseInt(readline());
    if (!creatureScanned.includes(creatureId)) {
      creatureScanned.push(creatureId);
      console.error("myScan" + creatureId);
    }
  }

  // @ts-ignore
  const foeScanCount = parseInt(readline());
  for (let i = 0; i < foeScanCount; i++) {
    // @ts-ignore
    const creatureId = parseInt(readline());
  }

  // @ts-ignore
  const myDroneCount = parseInt(readline());
  for (let i = 0; i < myDroneCount; i++) {
    // @ts-ignore
    const [droneId, droneX, droneY, emergency, battery] = readline()
      .split(" ")
      .map(Number);
    if (myDrones.length >= myDroneCount) {
      myDrones[i].update([droneX, droneY], battery, emergency);
    } else {
      myDrones.push(
        new MyDrone(droneId, [droneX, droneY], battery, emergency, zones[0])
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
    const drone = myDrones.find(({ id }) => id === droneId);
    if (drone) {
      drone.creatureToRegister++;
      if (!creatureScanned.includes(creatureId)) {
        creatureScanned.push(creatureId);
        console.error("droneScanCount" + creatureId);
      }
    }
  }

  // @ts-ignore
  const visibleCreatureCount = parseInt(readline());
  for (let i = 0; i < visibleCreatureCount; i++) {
    const [creatureId, creatureX, creatureY, creatureVX, creatureVY] = // @ts-ignore
      readline().split(" ").map(Number);

    const matchingCreature = creatures.find(
      (creature) => creature.id === creatureId
    );
    if (matchingCreature) {
      matchingCreature.updateWithCoordinate(
        [creatureX, creatureY],
        [creatureVX, creatureVY]
      );
    }
  }

  // @ts-ignore
  const radarBlipCount = parseInt(readline());
  for (let i = 0; i < radarBlipCount; i++) {
    // @ts-ignore
    const [droneId, creatureId, radar] = readline().split(" ");
    const creatureIdInt = parseInt(creatureId);
    const droneIdInt = parseInt(droneId);
    const drone = myDrones.find(({ id }) => id === droneIdInt);
    const typeCreature = creatures.find(({ id }) => creatureIdInt === id)!.type;
    if (
      !!drone &&
      !creatureScanned.includes(creatureIdInt) &&
      drone.zone.type === typeCreature
    ) {
      drone?.radarCreature[radar].push(creatureIdInt);
    }
  }

  if (DEBUG) {
    console.error(
      `Creatures Scanned: ${JSON.stringify(creatureScanned, null, 2)}`
    );
  }

  for (let i = 0; i < myDroneCount; i++) {
    const drone = myDrones[i];
    const nbOfTypeToScan = Object.values(drone.radarCreature).reduce(
      (acc, creatures) => acc + creatures.length,
      0
    );
    console.error("type", drone.zone.type, "nbOfTypeToScan", nbOfTypeToScan);
    const isTypeBeenScanned = nbOfTypeToScan <= 0;
    const monstersInRadius = creatures.filter(
      (monster) =>
        monster.type === -1 &&
        monster.pos &&
        calculateDistance(monster.pos, drone.pos) <= 1100
    ); // attention si light = 2000 au tours d'avant alors on peut voir les montres à 2300

    const shouldGoUp =
      (isTypeBeenScanned && drone.creatureToRegister > 0) ||
      myScanCount + droneScanCount === 12;
    const hasCreatureClosed =
      creatures.filter(
        ({ pos }) => !!pos && calculateDistance(pos, drone.pos) <= 800
      ).length > 0;

    drone.debugInfo();

    if (isTypeBeenScanned) {
      const newZone = Math.min(drone.zoneIter + 1, 2);
      drone.zoneIter = newZone;
      drone.zone = zones[newZone];
    }

    if (drone.isUp()) {
      console.error("isUp");
      drone.target = drone.findNextTarget();
    } else if (shouldGoUp) {
      console.error("shouldGoUp");
      drone.target = drone.getUpTarget();
    } else if (drone.isAtTarget() || isTypeBeenScanned) {
      console.error("isAtTarget");
      drone.target = drone.findNextTarget();
    }

    drone.debugInfo();
    console.error("hasCreatureClosed", hasCreatureClosed);
    const shouldLight =
      drone.battery >= 10 &&
      !hasCreatureClosed &&
      drone.zone.isInZone(drone.pos, 300);
    const light = shouldLight ? 1 : 0;

    if (drone.target && monstersInRadius.length > 0) {
      console.error("Monster visible"); //TODO
      // for now just one monster
      //const [nextMonsterX, nextMonsterY] =
      // if (drone.target[1] === Y_TO_REGISTER) {
      //   // is going up
      // } else {
      // is searching next target
      drone.target = drone.getUpTarget();
      // }
    }

    if (drone.target) {
      console.log(`MOVE ${drone.target[0]} ${drone.target[1]} ${light}`);
    } else {
      console.log(`WAIT ${light}`);
    }
  }
}
