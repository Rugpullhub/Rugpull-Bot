// Simpan/muat world ke localStorage (RLE agar hemat)
import { WORLD_H, WORLD_W } from "./constants";

export interface SaveData {
  v: number;
  seed: number;
  fgRLE: number[];
  bgRLE: number[];
  inv: [number, number][];
  order: number[];
  sel: number;
  px: number;
  py: number;
}

function encodeRLE(arr: Uint8Array): number[] {
  const out: number[] = [];
  let cur = arr[0];
  let run = 1;
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] === cur && run < 65535) run++;
    else {
      out.push(cur, run);
      cur = arr[i];
      run = 1;
    }
  }
  out.push(cur, run);
  return out;
}

function decodeRLE(rle: number[], len: number): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(len);
  let p = 0;
  for (let i = 0; i < rle.length; i += 2) {
    const v = rle[i];
    const run = rle[i + 1];
    for (let j = 0; j < run && p < len; j++) out[p++] = v;
  }
  return out;
}

const key = (name: string) => `gtweb:world:${name}`;

export function saveWorld(name: string, data: SaveData): boolean {
  try {
    localStorage.setItem(key(name), JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadWorld(name: string): SaveData | null {
  try {
    const raw = localStorage.getItem(key(name));
    if (!raw) return null;
    const d = JSON.parse(raw) as SaveData;
    if (d.v !== 1 || !Array.isArray(d.fgRLE)) return null;
    if (decodeRLE(d.fgRLE, 1).length !== 1) return null;
    return d;
  } catch {
    return null;
  }
}

export function hasSave(name: string): boolean {
  try {
    return localStorage.getItem(key(name)) !== null;
  } catch {
    return false;
  }
}

export function deleteWorld(name: string) {
  try {
    localStorage.removeItem(key(name));
  } catch {
    // abaikan
  }
}

export function arraysFromSave(d: SaveData): {
  fg: Uint8Array<ArrayBuffer>;
  bg: Uint8Array<ArrayBuffer>;
} {
  return {
    fg: decodeRLE(d.fgRLE, WORLD_W * WORLD_H),
    bg: decodeRLE(d.bgRLE, WORLD_W * WORLD_H),
  };
}

export function toSaveArrays(
  fg: Uint8Array,
  bg: Uint8Array
): { fgRLE: number[]; bgRLE: number[] } {
  return { fgRLE: encodeRLE(fg), bgRLE: encodeRLE(bg) };
}
