// ============================================================
// GROWTOPIA WEB - Core constants (Stage 1: Default World blocks)
// ============================================================

export const TILE = 32; // ukuran tile dalam px dunia
export const WORLD_W = 100; // lebar world (Growtopia: 100 tile)
export const WORLD_H = 54; // tinggi world (Growtopia: 54 tile)

// ID tile
export const T = {
  EMPTY: 0,
  DIRT: 1,
  GRASS: 2,
  CAVE_BG: 3,
  ROCK: 4,
  LAVA: 5,
  WATER: 6,
  BEDROCK: 7,
  DOOR: 8,
  MAIN_DOOR: 9,
} as const;

export const FIST_ID = 255; // slot tinju (bukan tile)
export const MAX_SLOTS = 9; // 1 fist + 8 item (ala hotbar Growtopia)

export interface TileDef {
  name: string;
  layer: "fg" | "bg";
  solid: boolean;
  liquid: boolean;
  hits: number; // 0 = tidak bisa dihancurkan
  deadly: boolean; // lava
  swim: boolean; // air
  door: boolean;
  mainDoor: boolean;
  drop: number; // tile yang dijatuhkan saat hancur (0 = tidak ada)
}

const def = (o: Partial<TileDef> & { name: string }): TileDef => ({
  layer: "fg",
  solid: true,
  liquid: false,
  hits: 4,
  deadly: false,
  swim: false,
  door: false,
  mainDoor: false,
  drop: 0,
  ...o,
});

export const TILES: Record<number, TileDef> = {
  [T.EMPTY]: def({ name: "", solid: false, hits: 0 }),
  [T.DIRT]: def({ name: "Dirt", hits: 4, drop: T.DIRT }),
  [T.GRASS]: def({ name: "Grass", hits: 4, drop: T.GRASS }),
  [T.CAVE_BG]: def({
    name: "Cave Background",
    layer: "bg",
    solid: false,
    hits: 4,
    drop: T.CAVE_BG,
  }),
  [T.ROCK]: def({ name: "Rock", hits: 14, drop: T.ROCK }),
  [T.LAVA]: def({
    name: "Lava",
    solid: false,
    liquid: true,
    hits: 3,
    deadly: true,
    drop: T.LAVA,
  }),
  [T.WATER]: def({
    name: "Water",
    solid: false,
    liquid: true,
    hits: 3,
    swim: true,
    drop: T.WATER,
  }),
  [T.BEDROCK]: def({ name: "Bedrock", hits: 0, drop: 0 }),
  [T.DOOR]: def({ name: "Door", hits: 6, door: true, drop: T.DOOR }),
  [T.MAIN_DOOR]: def({
    name: "Main Door",
    hits: 0,
    door: true,
    mainDoor: true,
    drop: 0,
  }),
};

// Fisika (px/satuan detik, karakter ala Growtopia: cukup 1 block!)
export const PHYS = {
  GRAVITY: 2000,
  MOVE: 175,
  ACCEL: 1600,
  FRICTION: 1800,
  JUMP: 565, // tinggi lompat ~2.4 tile
  MAX_FALL: 720,
  SWIM_GRAV: 420,
  SWIM_MAXFALL: 130,
  SWIM_UP: 170,
  SWIM_MOVE: 110,
  PUNCH_RANGE: 96,
  PUNCH_CD: 0.24,
  PLACE_CD: 0.16,
  PLAYER_W: 18, // hitbox ramping, sprite 32x32 (1 tile)
  PLAYER_H: 30, // muat lewat celah 1 tile
  LIQUID_INTERVAL: 0.28,
  LIQUID_CAP: 260,
  PLAYER_START_COUNT: 0,
};

// Warna langit Growtopia-ish
export const SKY_TOP = "#6ec2f2";
export const SKY_BOTTOM = "#c9ecff";
