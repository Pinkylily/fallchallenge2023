const DEBUG = true;
const MAX_DIST_BY_ROUND = 600;
const BIG_LIGHT_RADIUS = 2000;
const SMALL_LIGHT_RADIUS = 800;
const Y_TO_REGISTER = 500;
const Y_DOWNEST_TO_GET_CREATURE = 9200;
const vectorForRadar: Record<Radar, Point> = {
  BL: [-1, 1],
  BR: [1, 1],
  TL: [-1, -1],
  TR: [1, -1],
};

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

function createVectorFromPoints(point1: Point, point2: Point) {
  const x = point2[0] - point1[0];
  const y = point2[1] - point1[1];
  return [x, y];
}

type Radar = "TR" | "TL" | "BL" | "BR";
type CreatureInfo = { id: number; value: number; type: number };
type CreatureInfoByRadar = { [id in Radar]: CreatureInfo[] };

type Point = [number, number];

class Zone {
  public rangeX: Point;
  public rangeY: Point;
  public type: number;
  public haveCreatures: boolean;

  constructor(type: number, rangeX: Point, rangeY: Point) {
    this.type = type;
    this.rangeX = rangeX;
    this.rangeY = rangeY;
    this.haveCreatures = false;
  }

  isInZone(point: Point, delta: number = 0) {
    return (
      point[0] >= this.rangeX[0] - delta &&
      point[0] <= this.rangeX[1] + delta &&
      point[1] >= this.rangeY[0] &&
      point[1] <= this.rangeY[1]
    );
  }

  computePointInZone(point: Point): Point {
    const x = Math.min(Math.max(point[0], this.rangeX[0]), this.rangeX[1]);
    const y = Math.min(Math.max(point[1], this.rangeY[0]), this.rangeY[1]);
    return [x, y];
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

const creatures: Creature[] = [];
const myDrones: MyDrone[] = [];
const creatureScannedByFoe: number[] = [];
const zones = [
  new Zone(0, [790, 9250], [2500, 5000]),
  new Zone(1, [790, 9250], [5000, 7500]),
  new Zone(2, [790, 9250], [7500, 9200]),
];

class MyDrone {
  public zoneIter: number;
  public zone: Zone;
  public radarCreature: CreatureInfoByRadar;
  public creatureTarget: number[];
  public id: number;
  public pos: Point;
  public battery: number;
  public emergency: number;
  public target: Point | null;
  public creatureToRegister: number;

  constructor(
    id: number,
    pos: Point,
    battery: number,
    emergency: number,
    zone: Zone
  ) {
    this.id = id;
    this.pos = pos;
    this.battery = battery;
    this.emergency = emergency;
    this.target = null;
    this.target = null;
    this.creatureTarget = [];
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

    if (emergency === 1) {
      this.creatureTarget = [];
    }
  }

  isDown(): boolean {
    return this.pos && this.pos[1] >= Y_DOWNEST_TO_GET_CREATURE;
  }

  isUp(): boolean {
    return this.pos?.[1] <= Y_TO_REGISTER;
  }

  debugInfo() {
    console.error(
      `==== Drone ${this.id} Target: ${this.target} Creature target ${this.creatureTarget}`
    );
  }

  getUpTarget(): Point | null {
    if (!this.pos) {
      return null;
    }
    this.creatureTarget = [];
    return [this.pos[0], Y_TO_REGISTER];
  }

  isAtTarget(): boolean {
    this.creatureTarget = [];
    console.error(`is At target target ${this.target}`);
    return (
      !!this.target &&
      !!this.pos &&
      this.pos[1] === this.target[1] &&
      this.pos[0] === this.target[0]
    );
  }

  findNextTarget(): Point | null {
    let radarToGo: Radar | null = null;
    let zoneType = this.zone.type - 1;

    if (this.creatureTarget.length > 0) {
      radarToGo = (Object.keys(this.radarCreature) as Radar[]).reduce<{
        id: Radar | null;
        nbTarget: number;
      }>(
        (acc, radar: Radar) => {
          const nbTarget: number = this.radarCreature[radar].filter(({ id }) =>
            this.creatureTarget.includes(id)
          ).length;
          if (nbTarget > acc.nbTarget) {
            return { id: radar, nbTarget };
          }
          return acc;
        },
        {
          id: null,
          nbTarget: 0,
        }
      ).id;

      if (radarToGo !== null) {
        zoneType = this.radarCreature[radarToGo].reduce<number>(
          (acc, { type }) => (type < acc ? type : acc),
          2
        );
      }
    }

    while (zoneType < 2 && radarToGo === null) {
      //find radar with most creature and lenght > 0
      zoneType++;
      const radars = (Object.keys(this.radarCreature) as Radar[]).reduce<{
        id: Radar | null;
        valueMax: number;
      }>(
        (acc, radar) => {
          const value: number = this.radarCreature[radar].reduce<number>(
            (acc, { type, value }) => (type === zoneType ? acc + value : acc),
            0
          );
          if (value > acc.valueMax) {
            return { id: radar, valueMax: value };
          }
          return acc;
        },
        {
          id: null,
          valueMax: 0,
        }
      );

      radarToGo = radars.id;
    }

    console.error(`drone ${this.id}, radar: ${JSON.stringify(radarToGo)}}`);

    if (radarToGo !== null) {
      const [ux, uy] = vectorForRadar[radarToGo];
      this.creatureTarget = this.radarCreature[radarToGo].map(({ id }) => id);

      console.error(`zoneType ${zoneType} ${this.zone.type}`);

      return zones[zoneType].computePointInZone([
        this.pos[0] + ux * 600,
        this.pos[1] + uy * 600,
      ]);
    }

    return null;
  }
}

// @ts-ignore
const creatureCount = parseInt(readline());
for (let i = 0; i < creatureCount; i++) {
  // @ts-ignore
  const [creatureId, color, type] = readline().split(" ").map(Number);
  creatures.push(new Creature(creatureId, color, type));
}

while (true) {
  const creatureScanned: number[] = [];
  // @ts-ignore
  const myScore = parseInt(readline());
  // @ts-ignore
  const foeScore = parseInt(readline());
  // @ts-ignore
  const myScanCount = parseInt(readline());
  zones.forEach((zone) => (zone.haveCreatures = false));

  for (let i = 0; i < myScanCount; i++) {
    // @ts-ignore
    const creatureId = parseInt(readline());
    if (!creatureScanned.includes(creatureId)) {
      creatureScanned.push(creatureId);
    }
  }

  // @ts-ignore
  const foeScanCount = parseInt(readline());
  for (let i = 0; i < foeScanCount; i++) {
    // @ts-ignore
    const creatureId = parseInt(readline());
    if (!creatureScannedByFoe.includes(creatureId)) {
      creatureScannedByFoe.push(creatureId);
    }
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

  // clean already scanned target
  myDrones.forEach((drone) => {
    drone.creatureTarget = drone.creatureTarget.filter(
      (id) => !creatureScanned.includes(id)
    );
  });

  // @ts-ignore
  const radarBlipCount = parseInt(readline());
  for (let i = 0; i < radarBlipCount; i++) {
    // @ts-ignore
    const [droneId, creatureId, radar] = readline().split(" ");
    const creatureIdInt = parseInt(creatureId);
    const droneIdInt = parseInt(droneId);
    const { drone, otherDrone } = myDrones.reduce<{
      drone: MyDrone | null;
      otherDrone: MyDrone | null;
    }>(
      (acc, drone) => {
        drone.id === droneIdInt
          ? (acc.drone = drone)
          : (acc.otherDrone = drone);
        return acc;
      },
      { drone: null, otherDrone: null }
    );
    const typeCreature = creatures.find(({ id }) => creatureIdInt === id)!.type;

    if (
      !!drone &&
      !!otherDrone &&
      !creatureScanned.includes(creatureIdInt) &&
      typeCreature >= 0
    ) {
      if (typeCreature === drone.zone.type && !drone.zone.haveCreatures) {
        drone.zone.haveCreatures = true;
      }
      let value = 3;
      if (creatureScannedByFoe.includes(creatureIdInt)) {
        value = 2;
      } else if (otherDrone.creatureTarget.includes(creatureIdInt)) {
        value = 1;
      }
      const creatureInfo: CreatureInfo = {
        id: creatureIdInt,
        value,
        type: typeCreature,
      };
      drone?.radarCreature[radar].push(creatureInfo);
    }
  }

  for (let i = 0; i < myDroneCount; i++) {
    const drone = myDrones[i];
    const isTypeBeenScanned = !drone.zone.haveCreatures;
    console.error(`${drone.zone.type} isTypeBeenScanned ${isTypeBeenScanned}`);
    const monstersInRadius = creatures.filter(
      (monster) =>
        monster.type === -1 &&
        monster.pos &&
        calculateDistance(monster.pos, drone.pos) <= 1100
    ); // attention si light = 2000 au tours d'avant alors on peut voir les montres à 2300

    const shouldGoUp =
      (isTypeBeenScanned && drone.creatureToRegister > 0) ||
      creatureScanned.length === 12;
    const hasCreatureClosed =
      creatures.filter(
        ({ pos }) => !!pos && calculateDistance(pos, drone.pos) <= 800
      ).length > 0;

    if (isTypeBeenScanned) {
      const newZone = Math.min(drone.zoneIter + 1, 2);
      drone.zoneIter = newZone;
      drone.zone = zones[newZone];
    }

    if (i === 1) {
      const otherDroneTarget = myDrones[0].creatureTarget;
      if (otherDroneTarget.length > 0) {
        (Object.keys(drone.radarCreature) as Radar[]).forEach((radar) => {
          drone.radarCreature[radar] = drone.radarCreature[radar].map((c) =>
            otherDroneTarget.includes(c.id) ? { ...c, value: 1 } : c
          );
        });
      }
    }

    if (drone.isUp()) {
      console.error("isUp");
      drone.target = drone.findNextTarget();
    } else if (shouldGoUp) {
      console.error("shouldGoUp");
      console.error(
        `first ${isTypeBeenScanned && drone.creatureToRegister > 0}`
      );
      console.error(` second ${creatureScanned.length === 12}`);
      console.error(` creatureScanned ${creatureScanned.length}`);
      drone.target = drone.getUpTarget();
    } else if (drone.isAtTarget() || isTypeBeenScanned) {
      console.error("isAtTarget");
      drone.target = drone.findNextTarget();
    }

    drone.debugInfo();
    const shouldLight =
      drone.battery >= 10 &&
      !hasCreatureClosed &&
      drone.zone.isInZone(drone.pos, 300);
    const light = shouldLight ? 1 : 0;

    if (drone.target && monstersInRadius.length > 0) {
      //console.error("Monster visible", monstersInRadius);
      // if (
      //   monstersInRadius.some(
      //     (monster) =>
      //       monster.pos && calculateDistance(monster.pos, drone.pos) <= 500
      //   )
      // ) {
      //   drone.target = drone.getUpTarget();
      // }
      //TODO
      // for now just one monster
      //const [nextMonsterX, nextMonsterY] =
      // if (drone.target[1] === Y_TO_REGISTER) {
      //   // is going up
      // } else {
      // is searching next target
      // }
    }

    if (drone.target) {
      console.log(`MOVE ${drone.target[0]} ${drone.target[1]} ${light}`);
    } else {
      console.log(`WAIT ${light}`);
    }
  }
}
