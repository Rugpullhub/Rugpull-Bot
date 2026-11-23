// World 100x54 ala Growtopia: dirt & grass di permukaan, cave background di
// bawah tanah, gua dari noise + random walk, lava, air, rock, bedrock, main door.
import { PHYS, T, TILE, WORLD_H, WORLD_W, TILES } from "./constants";
import { mulberry32, valueNoise } from "./rng";

export class World {
  fg = new Uint8Array(WORLD_W * WORLD_H);
  bg = new Uint8Array(WORLD_W * WORLD_H);
  seed = 0;
  dirty = false;
  // kumpulan tile cair + antrean tile cair yang aktif menyebar
  liquids = new Set<number>();
  active = new Set<number>();
  doorX = 3;
  doorY = 0; // posisi main door (diisi saat generate)
  spawnX = 0;
  spawnY = 0;

  idx(x: number, y: number): number {
    return y * WORLD_W + x;
  }

  inside(x: number, y: number): boolean {
    return x >= 0 && x < WORLD_W && y >= 0 && y < WORLD_H;
  }

  getFg(x: number, y: number): number {
    if (y < 0) return T.EMPTY; // langit terbuka di atas world
    if (x < 0 || x >= WORLD_W || y >= WORLD_H) return T.BEDROCK; // dinding & dasar
    return this.fg[y * WORLD_W + x];
  }

  getBg(x: number, y: number): number {
    if (!this.inside(x, y)) return T.EMPTY;
    return this.bg[this.idx(x, y)];
  }

  isSolid(x: number, y: number): boolean {
    const t = this.getFg(x, y);
    return t !== T.EMPTY && TILES[t].solid;
  }

  setFg(x: number, y: number, id: number) {
    if (!this.inside(x, y)) return;
    const i = this.idx(x, y);
    this.fg[i] = id;
    this.dirty = true;
    if (id === T.WATER || id === T.LAVA) {
      this.liquids.add(i);
      this.active.add(i);
    } else {
      this.liquids.delete(i);
    }
    // bangunkan tetangga cair
    for (const [nx, ny] of [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ]) {
      if (!this.inside(nx, ny)) continue;
      const ni = this.idx(nx, ny);
      const nt = this.fg[ni];
      if (nt === T.WATER || nt === T.LAVA) this.active.add(ni);
    }
  }

  setBg(x: number, y: number, id: number) {
    if (!this.inside(x, y)) return;
    this.bg[this.idx(x, y)] = id;
    this.dirty = true;
  }

  generate(seed: number) {
    this.seed = seed;
    const rnd = mulberry32(seed);
    this.fg.fill(T.EMPTY);
    this.bg.fill(T.EMPTY);
    this.liquids.clear();
    this.active.clear();

    // --- permukaan berbukit lembut ---
    const ph1 = rnd() * 100;
    const ph2 = rnd() * 100;
    const surf: number[] = [];
    for (let x = 0; x < WORLD_W; x++) {
      const s =
        23 +
        Math.sin(x * 0.07 + ph1) * 1.8 +
        Math.sin(x * 0.19 + ph2) * 1.1;
      surf[x] = Math.max(19, Math.min(27, Math.round(s)));
    }

    // --- isi dirt + grass + cave background ---
    for (let x = 0; x < WORLD_W; x++) {
      for (let y = surf[x]; y < WORLD_H; y++) {
        const i = this.idx(x, y);
        this.fg[i] = y === surf[x] ? T.GRASS : T.DIRT;
        this.bg[i] = T.CAVE_BG; // apa pun yang digali di bawah tanah -> latar gua
      }
    }

    // --- gua dari value noise ---
    for (let x = 1; x < WORLD_W - 1; x++) {
      for (let y = surf[x] + 3; y < WORLD_H - 3; y++) {
        const n =
          valueNoise(x * 0.09, y * 0.13, seed) * 0.7 +
          valueNoise(x * 0.22, y * 0.3, seed ^ 0x9e37) * 0.3;
        if (n > 0.63) {
          this.carve(x, y);
        }
      }
    }

    // --- terowongan random walk supaya gua saling terhubung ---
    const walkers = 14;
    for (let w = 0; w < walkers; w++) {
      let wx = 4 + Math.floor(rnd() * (WORLD_W - 8));
      let wy = surf[wx] + 5 + Math.floor(rnd() * (WORLD_H - surf[wx] - 9));
      const steps = 30 + Math.floor(rnd() * 55);
      let dir = rnd() < 0.5 ? -1 : 1;
      for (let s = 0; s < steps; s++) {
        this.carve(wx, wy);
        this.carve(wx, wy - 1);
        if (rnd() < 0.55) dir = rnd() < 0.82 ? dir : -dir;
        wx += dir;
        wy += rnd() < 0.45 ? (rnd() < 0.5 ? -1 : 1) : 0;
        wx = Math.max(2, Math.min(WORLD_W - 3, wx));
        wy = Math.max(surf[Math.max(0, Math.min(WORLD_W - 1, wx))] + 2, Math.min(WORLD_H - 4, wy));
      }
    }

    // --- genangan lava (dalam) & air (tengah) ---
    for (let x = 1; x < WORLD_W - 1; x++) {
      for (let y = surf[x] + 4; y < WORLD_H - 2; y++) {
        const i = this.idx(x, y);
        if (this.fg[i] !== T.EMPTY) continue;
        const below = this.fg[this.idx(x, y + 1)];
        const solidBelow = below !== T.EMPTY && TILES[below].solid;
        if (!solidBelow) continue;
        if (y > WORLD_H - 17 && rnd() < 0.16) {
          this.fg[i] = T.LAVA;
          this.liquids.add(i);
        } else if (y < WORLD_H - 18 && y > surf[x] + 5 && rnd() < 0.09) {
          this.fg[i] = T.WATER;
          this.liquids.add(i);
        }
      }
    }

    // --- rock tersebar (makin dalam makin sering) + cluster ---
    for (let x = 1; x < WORLD_W - 1; x++) {
      for (let y = surf[x] + 2; y < WORLD_H - 2; y++) {
        if (this.fg[this.idx(x, y)] !== T.DIRT) continue;
        const depth = (y - surf[x]) / (WORLD_H - surf[x]);
        if (rnd() < 0.008 + depth * 0.02) this.fg[this.idx(x, y)] = T.ROCK;
      }
    }
    for (let c = 0; c < 6; c++) {
      const cx = 4 + Math.floor(rnd() * (WORLD_W - 8));
      const cy = surf[cx] + 4 + Math.floor(rnd() * (WORLD_H - surf[cx] - 7));
      this.blob(cx, cy, 1 + (rnd() < 0.4 ? 1 : 0), T.ROCK);
    }

    // --- bedrock: 2 baris bawah + gumpalan acak ---
    for (let x = 0; x < WORLD_W; x++) {
      this.fg[this.idx(x, WORLD_H - 1)] = T.BEDROCK;
      this.fg[this.idx(x, WORLD_H - 2)] = T.BEDROCK;
    }
    for (let c = 0; c < 10; c++) {
      const cx = Math.floor(rnd() * WORLD_W);
      const cy = WORLD_H - 6 - Math.floor(rnd() * 12);
      this.blob(cx, cy, rnd() < 0.5 ? 2 : 1, T.BEDROCK);
    }

    // --- main door di kiri (ala Growtopia) ---
    const dx = 3;
    const dy = surf[dx] - 1;
    this.fg[this.idx(dx, dy)] = T.MAIN_DOOR;
    // pastikan area spawn bersih
    for (let x = 1; x <= 7; x++) {
      for (let y = surf[x] - 4; y < surf[x]; y++) {
        if (y >= 0 && this.fg[this.idx(x, y)] !== T.MAIN_DOOR) {
          this.fg[this.idx(x, y)] = T.EMPTY;
        }
      }
    }
    this.doorX = dx;
    this.doorY = dy;
    this.spawnX = (dx + 1.7) * TILE; // tepat di kanan pintu, tidak menabrak
    this.spawnY = (dy + 1) * TILE - PHYS.PLAYER_H / 2; // kaki menyentuh permukaan
    this.dirty = true;
  }

  private carve(x: number, y: number) {
    if (x < 1 || x >= WORLD_W - 1 || y < 1 || y >= WORLD_H - 2) return;
    const i = this.idx(x, y);
    if (this.fg[i] === T.BEDROCK || this.fg[i] === T.MAIN_DOOR) return;
    this.fg[i] = T.EMPTY;
    this.bg[i] = T.CAVE_BG;
  }

  private blob(cx: number, cy: number, r: number, id: number) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        if (dx * dx + dy * dy > r * r + 1) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || x >= WORLD_W || y < 0 || y >= WORLD_H - 2) continue;
        const i = this.idx(x, y);
        if (this.fg[i] === T.DIRT || this.fg[i] === T.GRASS || this.fg[i] === T.ROCK) {
          this.fg[i] = id;
        }
      }
    }
  }

  // langkah penyebaran cairan (air & lava), ala Growtopia: menyebar penuh
  stepLiquids(): [number, number][] {
    const steam: [number, number][] = [];
    if (this.active.size === 0) return steam;
    const batch = Array.from(this.active);
    this.active.clear();
    let processed = 0;
    for (const i of batch) {
      if (processed >= 260) {
        this.active.add(i);
        continue;
      }
      const id = this.fg[i];
      if (id !== T.WATER && id !== T.LAVA) continue;
      const x = i % WORLD_W;
      const y = (i / WORLD_W) | 0;
      processed++;
      const moved = this.flow(x, y, id);
      if (moved) this.active.add(i);
      // interaksi air + lava -> rock (seperti dua cairan bertemu)
      for (const [nx, ny] of [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ]) {
        if (!this.inside(nx, ny)) continue;
        const ni = this.idx(nx, ny);
        const nt = this.fg[ni];
        if ((id === T.WATER && nt === T.LAVA) || (id === T.LAVA && nt === T.WATER)) {
          this.fg[ni] = T.ROCK;
          this.liquids.delete(ni);
          this.fg[i] = T.EMPTY;
          this.liquids.delete(i);
          steam.push([x, y]);
          break;
        }
      }
    }
    return steam;
  }

  // coba menyebar ke bawah lalu samping; return true jika masih ada gerak
  private flow(x: number, y: number, id: number): boolean {
    let moved = false;
    const tryCell = (tx: number, ty: number): boolean => {
      if (!this.inside(tx, ty)) return false;
      const ti = this.idx(tx, ty);
      if (this.fg[ti] !== T.EMPTY) return false;
      this.fg[ti] = id;
      this.liquids.add(ti);
      this.active.add(ti);
      moved = true;
      return true;
    };
    // turun dulu
    if (tryCell(x, y + 1)) return true;
    // jika bawah tertutup, menyebar ke samping
    const below = this.getFg(x, y + 1);
    const blocked = below !== T.EMPTY && (TILES[below].solid || TILES[below].liquid);
    if (blocked) {
      tryCell(x - 1, y);
      tryCell(x + 1, y);
    }
    return moved;
  }
}
