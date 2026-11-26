import { DomainModifier } from './types';

export interface ObstacleRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface RoomNode {
  index: number;
  name: string;
  isBossRoom: boolean;
  width: number;
  height: number;
  spawnX: number;
  spawnY: number;
  portalX: number;
  portalY: number;
  obstacles: ObstacleRect[];
  enemySpawns: Array<{
    archetype: 'thrall' | 'cultist' | 'charger' | 'stalker' | 'boss';
    x: number;
    y: number;
    isElite: boolean;
  }>;
  cleared: boolean;
}

export interface DomainLayout {
  tier: number;
  corrupted: boolean;
  modifiers: DomainModifier[];
  rooms: RoomNode[];
  connections: [number, number][];
}

const BOSS_NAMES = [
  'Vaelor, The Ashen Sovereign',
  'Malkor, Storm Warden',
  'Sera, Frostbound Oracle',
  'Nyx, Architect of the Void',
  'Kaelen, Iron Colossus',
];

const ROOM_TITLES = [
  'Shattered Threshold',
  'Cinder Nave',
  'Obsidian Cloister',
  'Eclipse Sanctum',
];

export function generateDomainLayout(
  tier: number,
  corrupted: boolean,
  modifiers: DomainModifier[]
): DomainLayout {
  const roomCount = 4;
  const rooms: RoomNode[] = [];
  const connections: [number, number][] = [
    [0, 1],
    [1, 2],
    [2, 3],
  ];

  const baseCount = Math.min(18, 6 + Math.floor(tier * 1.4) + (corrupted ? 3 : 0));

  for (let i = 0; i < roomCount; i++) {
    const isBossRoom = i === roomCount - 1;
    const width = isBossRoom ? 1500 : 1380;
    const height = isBossRoom ? 1020 : 940;
    const spawnX = 240;
    const spawnY = height / 2;
    const portalX = width - 170;
    const portalY = height / 2;

    // Symmetric obsidian pillars leaving >= 220px clear center & lanes
    const obstacles: ObstacleRect[] = isBossRoom
      ? [
          { x: 460, y: 230, w: 72, h: 72 },
          { x: 980, y: 230, w: 72, h: 72 },
          { x: 460, y: 710, w: 72, h: 72 },
          { x: 980, y: 710, w: 72, h: 72 },
        ]
      : [
          { x: 520, y: 240, w: 80, h: 80 },
          { x: 840, y: 610, w: 80, h: 80 },
        ];

    const enemySpawns: RoomNode['enemySpawns'] = [];

    if (isBossRoom) {
      enemySpawns.push({
        archetype: 'boss',
        x: width - 360,
        y: height / 2,
        isElite: true,
      });
      // Two flanking honour guards
      enemySpawns.push({ archetype: 'thrall', x: width - 480, y: height / 2 - 190, isElite: false });
      enemySpawns.push({ archetype: 'cultist', x: width - 480, y: height / 2 + 190, isElite: false });
    } else {
      const count = baseCount + i * 2;
      const archetypes: Array<'thrall' | 'cultist' | 'charger' | 'stalker'> = [
        'thrall',
        'cultist',
        'charger',
        'stalker',
      ];
      for (let e = 0; e < count; e++) {
        // Spawn well away from player entry (>= 360px away) so opening seconds are safe
        const ex = 560 + ((e * 173 + i * 97) % (width - 680));
        const ey = 140 + ((e * 229 + i * 131) % (height - 280));
        const arch = archetypes[(e + i) % archetypes.length];
        const isElite = e === 0 && (tier >= 2 || i >= 1 || corrupted);
        enemySpawns.push({ archetype: arch, x: ex, y: ey, isElite });
      }
    }

    rooms.push({
      index: i,
      name: isBossRoom ? BOSS_NAMES[(tier - 1) % BOSS_NAMES.length] : ROOM_TITLES[i],
      isBossRoom,
      width,
      height,
      spawnX,
      spawnY,
      portalX,
      portalY,
      obstacles,
      enemySpawns,
      cleared: false,
    });
  }

  return {
    tier,
    corrupted,
    modifiers,
    rooms,
    connections,
  };
}
