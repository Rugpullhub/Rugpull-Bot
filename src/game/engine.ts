// ============================================================
// GROWTOPIA WEB - Game Engine (canvas 2D, pixel art, 60fps)
// ============================================================
import {
  FIST_ID,
  MAX_SLOTS,
  PHYS,
  SKY_BOTTOM,
  SKY_TOP,
  T,
  TILE,
  TILES,
  WORLD_H,
  WORLD_W,
} from "./constants";
import { SFX } from "./audio";
import { hashStr } from "./rng";
import {
  arraysFromSave,
  loadWorld,
  saveWorld,
  toSaveArrays,
} from "./save";
import {
  buildTextures,
  drawCharacter,
  slotIcon,
  Textures,
} from "./textures";
import { World } from "./world";

export interface SlotInfo {
  id: number;
  count: number; // -1 = tak terbatas (fist)
  name: string;
}

export interface EngineState {
  slots: SlotInfo[];
  sel: number;
  dead: boolean;
  hint: string | null;
}

export interface EngineCallbacks {
  onState: (s: EngineState) => void;
  onToast: (text: string) => void;
  onChatLog: (name: string, text: string) => void;
}

interface Player {
  x: number;
  y: number; // titik tengah
  vx: number;
  vy: number;
  facing: 1 | -1;
  onGround: boolean;
  inWater: boolean;
  moving: boolean;
  walkPhase: number;
  punchT: number;
  hurtT: number;
  burnT: number;
  dead: boolean;
  deadT: number;
}

interface Drop {
  x: number;
  y: number;
  vx: number;
  vy: number;
  id: number;
  t: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
  grav: number;
}

const BREAK_COLORS: Record<number, string[]> = {
  [T.DIRT]: ["#a06a3c", "#8a5830", "#b97f4c"],
  [T.GRASS]: ["#3aa22c", "#a06a3c", "#6fd94f"],
  [T.CAVE_BG]: ["#43301f", "#37261a", "#4f3a26"],
  [T.ROCK]: ["#8b949c", "#565e66", "#a5aeb6"],
  [T.LAVA]: ["#d94a12", "#ff9624", "#ffd23f"],
  [T.WATER]: ["#2f7fd0", "#66b4ec", "#1f5fa8"],
  [T.BEDROCK]: ["#3d4147", "#2b2e33", "#575d66"],
  [T.DOOR]: ["#6d4a2f", "#e8e3d5", "#59391f"],
  [T.MAIN_DOOR]: ["#46586a", "#f4f6f8", "#caa42a"],
};

export class Game {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  tex: Textures;
  sfx = new SFX();
  world = new World();
  playerName: string;
  cb: EngineCallbacks;
  worldName: string;

  p: Player;
  cam = { x: 0, y: 0 };
  zoom = 2;
  inv = new Map<number, number>();
  order: number[] = [FIST_ID];
  sel = 0;
  dmg = new Map<number, { n: number; t: number; layer: "fg" | "bg" }>();
  drops: Drop[] = [];
  parts: Particle[] = [];
  bubble: { text: string; t: number } | null = null;
  flashT = 0;

  keys = new Set<string>();
  moveL = false;
  moveR = false;
  jumpHeld = false;
  jumpEdge = false;
  doorEdge = false;
  chatFocus = false;

  mouse = { x: 0, y: 0, down: false, inside: false, forceFist: false };
  target = { x: 0, y: 0, valid: false, layer: "fg" as "fg" | "bg" };
  punchCd = 0;
  placeCd = 0;
  liqAcc = 0;
  saveAcc = 0;
  wasInWater = false;
  hint: string | null = null;
  fontsReady = false;

  private raf = 0;
  private last = 0;
  private dpr = 1;
  private destroyed = false;
  private onResizeBound = this.onResize.bind(this);

  constructor(
    canvas: HTMLCanvasElement,
    worldName: string,
    playerName: string,
    cb: EngineCallbacks
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.worldName = worldName;
    this.playerName = playerName;
    this.cb = cb;
    this.tex = buildTextures();

    this.p = {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      facing: 1,
      onGround: false,
      inWater: false,
      moving: false,
      walkPhase: 0,
      punchT: 0,
      hurtT: 0,
      burnT: 0,
      dead: false,
      deadT: 0,
    };

    // muat save atau generate world baru (nama sama = world sama)
    const save = loadWorld(worldName);
    if (save) {
      const { fg, bg } = arraysFromSave(save);
      this.world.fg = fg;
      this.world.bg = bg;
      this.world.seed = save.seed;
      this.world.doorX = 3;
      for (let i = 0; i < this.world.fg.length; i++) {
        const t = this.world.fg[i];
        if (t === T.WATER || t === T.LAVA) this.world.liquids.add(i);
        if (t === T.MAIN_DOOR) this.world.doorY = (i / WORLD_W) | 0;
      }
      // hitung ulang titik spawn dari posisi main door
      this.world.spawnX = (this.world.doorX + 1.7) * TILE;
      this.world.spawnY = (this.world.doorY + 1) * TILE - PHYS.PLAYER_H / 2;
      this.p.x = save.px;
      this.p.y = save.py;
      this.inv = new Map(save.inv);
      this.order = save.order.length ? save.order : [FIST_ID];
      this.sel = Math.min(save.sel, this.order.length - 1);
    } else {
      const seed = (hashStr(worldName) ^ (Date.now() & 0xffff)) >>> 0;
      this.world.generate(seed);
      this.p.x = this.world.spawnX;
      this.p.y = this.world.spawnY;
      this.cb.onToast(`Selamat datang di ${worldName}!`);
    }

    this.onResize();
    window.addEventListener("resize", this.onResizeBound);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    this.bindPointer();
    void document.fonts.load('8px "Press Start 2P"').then(() => {
      this.fontsReady = true;
    });
    this.emit();
    this.raf = requestAnimationFrame(this.loop);
    // handle debug untuk pengujian otomatis
    (window as unknown as { __gt?: Game }).__gt = this;
  }

  // ---------------- input ----------------

  private onResize() {
    const c = this.canvas;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = c.clientWidth || window.innerWidth;
    const h = c.clientHeight || window.innerHeight;
    c.width = Math.floor(w * this.dpr);
    c.height = Math.floor(h * this.dpr);
    const z = Math.max(1.2, Math.min(3.2, h / (13.5 * TILE)));
    // langkah 0.5 supaya pixel tetap tajam dan seragam
    this.zoom = Math.round(z * 2) / 2;
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (this.chatFocus || this.destroyed) return;
    const code = e.code;
    if (
      [
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "Space",
        "KeyA",
        "KeyD",
        "KeyW",
        "KeyE",
      ].includes(code)
    ) {
      e.preventDefault();
    }
    if (code === "ArrowLeft" || code === "KeyA") this.keys.add("L");
    if (code === "ArrowRight" || code === "KeyD") this.keys.add("R");
    if (code === "ArrowUp" || code === "KeyW" || code === "Space") {
      if (!this.jumpHeld) this.jumpEdge = true;
      this.jumpHeld = true;
      if (!e.repeat) this.doorEdge = true;
    }
    if (code === "KeyE" && !e.repeat) this.doorEdge = true;
    if (code.startsWith("Digit")) {
      const n = parseInt(code.slice(5), 10);
      if (n >= 1 && n <= MAX_SLOTS) this.setSel(n - 1);
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    const code = e.code;
    if (code === "ArrowLeft" || code === "KeyA") this.keys.delete("L");
    if (code === "ArrowRight" || code === "KeyD") this.keys.delete("R");
    if (code === "ArrowUp" || code === "KeyW" || code === "Space") {
      this.jumpHeld = false;
    }
  };

  private bindPointer() {
    const c = this.canvas;
    c.style.touchAction = "none";
    c.addEventListener("pointerdown", (e) => {
      c.setPointerCapture(e.pointerId);
      this.updateMouse(e);
      this.mouse.down = true;
      this.mouse.inside = true;
      this.mouse.forceFist = e.button === 2;
      if (this.punchCd <= 0 && this.placeCd <= 0) this.actNow();
      e.preventDefault();
    });
    c.addEventListener("pointermove", (e) => {
      this.updateMouse(e);
    });
    c.addEventListener("pointerup", () => {
      this.mouse.down = false;
      this.mouse.forceFist = false;
    });
    c.addEventListener("pointercancel", () => {
      this.mouse.down = false;
      this.mouse.forceFist = false;
    });
    c.addEventListener("pointerleave", () => {
      this.mouse.inside = false;
    });
    c.addEventListener("pointerenter", () => {
      this.mouse.inside = true;
    });
    c.addEventListener("contextmenu", (e) => e.preventDefault());
    c.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const dir = e.deltaY > 0 ? 1 : -1;
        this.setSel((this.sel + dir + this.order.length) % this.order.length);
      },
      { passive: false }
    );
  }

  private updateMouse(e: PointerEvent) {
    const r = this.canvas.getBoundingClientRect();
    this.mouse.x = e.clientX - r.left;
    this.mouse.y = e.clientY - r.top;
    this.mouse.inside = true;
  }

  // API untuk React (tombol sentuh)
  setMove(dir: "L" | "R", on: boolean) {
    if (dir === "L") this.moveL = on;
    else this.moveR = on;
  }
  setJump(on: boolean) {
    if (on && !this.jumpHeld) this.jumpEdge = true;
    this.jumpHeld = on;
    if (on) this.doorEdge = true;
  }
  setChatFocus(f: boolean) {
    this.chatFocus = f;
    if (f) {
      this.keys.clear();
      this.mouse.down = false;
      this.moveL = this.moveR = false;
      this.jumpHeld = false;
    }
  }
  setSel(i: number) {
    if (i < 0 || i >= this.order.length) return;
    this.sel = i;
    this.sfx.click();
    this.emit();
  }
  say(text: string) {
    const t = text.trim().slice(0, 90);
    if (!t) return;
    this.bubble = { text: t, t: 6 };
    this.cb.onChatLog(this.playerName, t);
  }
  getIcon(id: number): string {
    return slotIcon(this.tex, id);
  }
  worldStats(): { blocks: number } {
    let blocks = 0;
    for (let i = 0; i < this.world.fg.length; i++) {
      if (this.world.fg[i] !== T.EMPTY) blocks++;
    }
    return { blocks };
  }

  // ---------------- aksi ----------------

  private actNow() {
    if (!this.target.valid) return;
    if (this.sel === 0 || this.mouse.forceFist) this.doPunch();
    else this.doPlace();
  }

  private doPunch() {
    const { x, y, layer } = this.target;
    this.p.punchT = 0.0001;
    this.p.facing = x * TILE + 16 > this.p.x ? 1 : -1;
    this.punchCd = PHYS.PUNCH_CD;
    const id = layer === "fg" ? this.world.getFg(x, y) : this.world.getBg(x, y);
    if (id === T.EMPTY) return;
    const def = TILES[id];
    const i = this.world.idx(x, y);
    if (def.hits <= 0) {
      this.sfx.clank();
      this.spawnParts(x * TILE + 16, y * TILE + 16, ["#9aa0a6"], 3, 60);
      return;
    }
    const rec = this.dmg.get(i) ?? { n: 0, t: performance.now() / 1000, layer };
    rec.n += 1;
    rec.t = performance.now() / 1000;
    rec.layer = layer;
    this.dmg.set(i, rec);
    this.sfx.punch();
    this.spawnParts(
      x * TILE + 16 + (Math.random() * 10 - 5),
      y * TILE + 16,
      BREAK_COLORS[id] ?? ["#ffffff"],
      2,
      70
    );
    if (rec.n >= def.hits) {
      // hancur
      if (layer === "fg") this.world.setFg(x, y, T.EMPTY);
      else this.world.setBg(x, y, T.EMPTY);
      this.dmg.delete(i);
      this.sfx.break_();
      this.spawnParts(
        x * TILE + 16,
        y * TILE + 16,
        BREAK_COLORS[id] ?? ["#ffffff"],
        10,
        150
      );
      if (def.drop) this.spawnDrop(x * TILE + 16, y * TILE + 8, def.drop);
    }
  }

  private doPlace() {
    const id = this.order[this.sel];
    if (id === FIST_ID) return;
    const def = TILES[id];
    const count = this.inv.get(id) ?? 0;
    if (count <= 0) return;
    const { x, y } = this.target;
    if (!this.world.inside(x, y)) return;
    this.placeCd = PHYS.PLACE_CD;
    this.p.punchT = 0.0001;
    this.p.facing = x * TILE + 16 > this.p.x ? 1 : -1;

    if (def.layer === "fg") {
      if (this.world.getFg(x, y) !== T.EMPTY) return;
      if (def.solid && this.overlapsPlayer(x, y)) {
        this.sfx.deny();
        return;
      }
      this.world.setFg(x, y, id);
    } else {
      if (this.world.getBg(x, y) !== T.EMPTY) return;
      this.world.setBg(x, y, id);
    }
    this.inv.set(id, count - 1);
    if (count - 1 <= 0) {
      this.inv.delete(id);
      this.order = this.order.filter((o) => o !== id);
      this.sel = Math.min(this.sel, this.order.length - 1);
    }
    this.sfx.place();
    this.spawnParts(x * TILE + 16, y * TILE + 16, ["#ffffff", "#e8f4ff"], 4, 60);
    this.emit();
  }

  private overlapsPlayer(x: number, y: number): boolean {
    const px0 = this.p.x - PHYS.PLAYER_W / 2;
    const px1 = this.p.x + PHYS.PLAYER_W / 2;
    const py0 = this.p.y - PHYS.PLAYER_H / 2;
    const py1 = this.p.y + PHYS.PLAYER_H / 2;
    const tx0 = x * TILE;
    const tx1 = tx0 + TILE;
    const ty0 = y * TILE;
    const ty1 = ty0 + TILE;
    return px1 > tx0 && px0 < tx1 && py1 > ty0 && py0 < ty1;
  }

  private spawnDrop(x: number, y: number, id: number) {
    this.drops.push({
      x,
      y,
      vx: Math.random() * 80 - 40,
      vy: -140 - Math.random() * 60,
      id,
      t: 0,
    });
  }

  private spawnParts(x: number, y: number, colors: string[], n: number, spd: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = spd * (0.4 + Math.random() * 0.8);
      this.parts.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 60,
        life: 0.4 + Math.random() * 0.3,
        max: 0.7,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 2 + Math.floor(Math.random() * 3),
        grav: 500,
      });
    }
  }

  private pickup(id: number) {
    if (this.order.length >= MAX_SLOTS && !this.inv.has(id)) {
      this.cb.onToast("Inventori penuh! Jual/hancurkan item dulu.");
      return;
    }
    this.inv.set(id, (this.inv.get(id) ?? 0) + 1);
    if (!this.order.includes(id)) this.order.push(id);
    this.sfx.pickup();
    this.emit();
  }

  enterDoor() {
    this.p.x = this.world.spawnX;
    this.p.y = this.world.spawnY;
    this.p.vx = 0;
    this.p.vy = 0;
    this.flashT = 0.5;
    this.sfx.door();
  }

  saveNow() {
    const { fgRLE, bgRLE } = toSaveArrays(this.world.fg, this.world.bg);
    const ok = saveWorld(this.worldName, {
      v: 1,
      seed: this.world.seed,
      fgRLE,
      bgRLE,
      inv: Array.from(this.inv.entries()),
      order: this.order,
      sel: this.sel,
      px: this.p.x,
      py: this.p.y,
    });
    return ok;
  }

  resetWorld() {
    const seed = (hashStr(this.worldName) ^ (Date.now() & 0xffffffff)) >>> 0;
    this.dmg.clear();
    this.drops = [];
    this.parts = [];
    this.world.generate(seed);
    this.p.x = this.world.spawnX;
    this.p.y = this.world.spawnY;
    this.p.vx = this.p.vy = 0;
    this.saveNow();
    this.cb.onToast("World di-reset! Dunia baru telah dibuat.");
  }

  // ---------------- loop ----------------

  private loop = (t: number) => {
    if (this.destroyed) return;
    const dt = Math.min(0.05, (t - this.last) / 1000 || 0.016);
    this.last = t;
    this.update(dt);
    this.render(t / 1000);
    this.raf = requestAnimationFrame(this.loop);
  };

  private update(dt: number) {
    const p = this.p;
    this.punchCd -= dt;
    this.placeCd -= dt;
    this.flashT = Math.max(0, this.flashT - dt);
    if (p.hurtT > 0) p.hurtT = Math.max(0, p.hurtT - dt * 2);
    if (p.punchT > 0) {
      p.punchT += dt / 0.26;
      if (p.punchT >= 1) p.punchT = 0;
    }
    if (this.bubble) {
      this.bubble.t -= dt;
      if (this.bubble.t <= 0) this.bubble = null;
    }

    if (p.dead) {
      p.deadT -= dt;
      if (p.deadT <= 0) this.respawn();
    } else if (p.burnT > 0) {
      p.burnT -= dt;
      if (p.burnT <= 0) {
        p.dead = true;
        p.deadT = 1.6;
        this.sfx.die();
        this.cb.onToast("Kamu terpanggang menjadi garing!");
        this.spawnParts(p.x, p.y, ["#ff9624", "#d94a12", "#3d4147"], 16, 200);
      }
    } else {
      this.updateMovement(dt);
    }

    this.updateTarget();
    if (this.mouse.down && !this.chatFocus && !p.dead) {
      if (this.punchCd <= 0 && this.placeCd <= 0) this.actNow();
    }

    this.updateDrops(dt);
    this.updateParts(dt);

    // cairan
    this.liqAcc += dt;
    while (this.liqAcc >= PHYS.LIQUID_INTERVAL) {
      this.liqAcc -= PHYS.LIQUID_INTERVAL;
      const steam = this.world.stepLiquids();
      for (const [sx, sy] of steam) {
        this.sfx.fizz();
        this.spawnParts(sx * TILE + 16, sy * TILE + 8, ["#e8f4ff", "#9aa0a6"], 8, 90);
      }
    }

    // peluruhan kerusakan blok (ala Growtopia: pulih setelah beberapa detik)
    const now = performance.now() / 1000;
    for (const [k, v] of this.dmg) {
      if (now - v.t > 6) this.dmg.delete(k);
    }

    // kamera
    const viewW = this.canvas.width / this.dpr / this.zoom;
    const viewH = this.canvas.height / this.dpr / this.zoom;
    const tx = Math.max(0, Math.min(WORLD_W * TILE - viewW, p.x - viewW / 2));
    const ty = Math.max(0, Math.min(WORLD_H * TILE - viewH, p.y - viewH / 2));
    const k = Math.min(1, dt * 8);
    this.cam.x += (tx - this.cam.x) * k;
    this.cam.y += (ty - this.cam.y) * k;

    // autosave
    if (this.world.dirty) {
      this.saveAcc += dt;
      if (this.saveAcc > 3) {
        this.saveAcc = 0;
        this.world.dirty = false;
        this.saveNow();
      }
    }

    // hint pintu
    const near = this.nearDoor();
    const hint = near === 1 ? "Tekan E atau Naik untuk masuk pintu" : null;
    if (hint !== this.hint) {
      this.hint = hint;
      this.emit();
    }
    this.doorEdge = false; // selalu dikonsumsi per frame
  }

  private nearDoor(): 0 | 1 | 2 {
    const p = this.p;
    const x0 = Math.floor((p.x - PHYS.PLAYER_W / 2 - 4) / TILE);
    const x1 = Math.floor((p.x + PHYS.PLAYER_W / 2 + 4) / TILE);
    const y0 = Math.floor((p.y - PHYS.PLAYER_H / 2) / TILE);
    const y1 = Math.floor((p.y + PHYS.PLAYER_H / 2) / TILE);
    let main = false;
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        const id = this.world.getFg(x, y);
        if (id === T.DOOR) return 1;
        if (id === T.MAIN_DOOR) main = true;
      }
    }
    return main ? 2 : 0;
  }

  private updateMovement(dt: number) {
    const p = this.p;
    const wasWater = p.inWater;
    p.inWater = this.overlapsType(T.WATER);
    if (p.inWater && !wasWater) this.sfx.splash();

    // pintu: tekan E / Naik saat berdiri di depan pintu
    const near = this.nearDoor();
    if (this.doorEdge) {
      this.doorEdge = false;
      if (near && p.onGround) {
        this.jumpEdge = false;
        this.enterDoor();
        return;
      }
    }

    const left = this.keys.has("L") || this.moveL;
    const right = this.keys.has("R") || this.moveR;
    const speed = p.inWater ? PHYS.SWIM_MOVE : PHYS.MOVE;
    const targetVx = (right ? speed : 0) - (left ? speed : 0);
    p.moving = targetVx !== 0;
    const accel = targetVx !== 0 ? PHYS.ACCEL : PHYS.FRICTION;
    if (targetVx > p.vx) p.vx = Math.min(targetVx, p.vx + accel * dt);
    else if (targetVx < p.vx) p.vx = Math.max(targetVx, p.vx - accel * dt);
    if (targetVx !== 0) {
      p.facing = targetVx > 0 ? 1 : -1;
      p.walkPhase = (p.walkPhase + dt * 2.2) % 1;
    } else {
      p.walkPhase = 0;
    }

    if (p.inWater) {
      p.vy += PHYS.SWIM_GRAV * dt;
      if (p.vy > PHYS.SWIM_MAXFALL) p.vy = PHYS.SWIM_MAXFALL;
      if (this.jumpHeld) p.vy = -PHYS.SWIM_UP;
    } else {
      p.vy += PHYS.GRAVITY * dt;
      if (p.vy > PHYS.MAX_FALL) p.vy = PHYS.MAX_FALL;
      if (this.jumpEdge && p.onGround && !near) {
        p.vy = -PHYS.JUMP;
        p.onGround = false;
        this.sfx.jump();
      }
    }
    this.jumpEdge = false;

    // lava membakar
    if (this.overlapsType(T.LAVA)) this.burn();

    // integrasi + tabrakan per-sumbu
    p.onGround = false;
    this.moveAxis(dt * p.vx, 0);
    this.moveAxis(dt * p.vy, 1);
  }

  private moveAxis(d: number, axis: 0 | 1) {
    const p = this.p;
    const w = PHYS.PLAYER_W / 2;
    const h = PHYS.PLAYER_H / 2;
    if (axis === 0) p.x += d;
    else p.y += d;
    // batas world
    p.x = Math.max(w + 1, Math.min(WORLD_W * TILE - w - 1, p.x));
    p.y = Math.max(-200, Math.min(WORLD_H * TILE - h - 1, p.y));

    const x0 = Math.floor((p.x - w) / TILE);
    const x1 = Math.floor((p.x + w) / TILE);
    const y0 = Math.floor((p.y - h) / TILE);
    const y1 = Math.floor((p.y + h) / TILE);
    // cari tile solid yang tumpang tindih; resolve sekali ke tepi terjauh
    // (mencegah "memanjat" saat tertanam di beberapa tile sekaligus)
    let best: number | null = null;
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (!this.world.isSolid(tx, ty)) continue;
        const btx0 = tx * TILE;
        const btx1 = btx0 + TILE;
        const bty0 = ty * TILE;
        const bty1 = bty0 + TILE;
        if (p.x + w <= btx0 || p.x - w >= btx1 || p.y + h <= bty0 || p.y - h >= bty1) continue;
        if (axis === 0) {
          const edge = d > 0 ? btx0 - w - 0.01 : btx1 + w + 0.01;
          if (best === null || (d > 0 ? edge < best : edge > best)) best = edge;
        } else {
          const edge = d > 0 ? bty0 - h - 0.01 : bty1 + h + 0.01;
          if (best === null || (d > 0 ? edge < best : edge > best)) best = edge;
        }
      }
    }
    if (best !== null) {
      if (axis === 0) {
        p.x = best;
        p.vx = 0;
      } else {
        p.y = best;
        if (d > 0) p.onGround = true;
        p.vy = 0;
      }
    }
  }

  private overlapsType(id: number): boolean {
    const p = this.p;
    const w = PHYS.PLAYER_W / 2;
    const h = PHYS.PLAYER_H / 2;
    const x0 = Math.floor((p.x - w) / TILE);
    const x1 = Math.floor((p.x + w) / TILE);
    const y0 = Math.floor((p.y - h) / TILE);
    const y1 = Math.floor((p.y + h) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (this.world.getFg(tx, ty) === id) return true;
      }
    }
    return false;
  }

  private updateTarget() {
    const wx = this.cam.x + this.mouse.x / this.zoom;
    const wy = this.cam.y + this.mouse.y / this.zoom;
    const tx = Math.floor(wx / TILE);
    const ty = Math.floor(wy / TILE);
    const dx = wx - this.p.x;
    const dy = wy - (this.p.y - 8);
    const inRange = Math.sqrt(dx * dx + dy * dy) <= PHYS.PUNCH_RANGE;
    const inside = this.world.inside(tx, ty);
    let layer: "fg" | "bg" = "fg";
    if (inside) {
      const fg = this.world.getFg(tx, ty);
      if (fg === T.EMPTY) layer = "bg";
    }
    this.target = { x: tx, y: ty, valid: inside && inRange, layer };
  }

  private updateDrops(dt: number) {
    const p = this.p;
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.t += dt;
      const dx = p.x - d.x;
      const dy = p.y - d.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 64 && !p.dead) {
        // magnet ke player
        d.vx += (dx / dist) * 900 * dt;
        d.vy += (dy / dist) * 900 * dt;
      } else {
        d.vy += PHYS.GRAVITY * 0.6 * dt;
      }
      d.vy = Math.min(d.vy, 500);
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      // tabrak solid sederhana
      const bx = Math.floor(d.x / TILE);
      const by = Math.floor((d.y + 6) / TILE);
      if (this.world.isSolid(bx, by) && d.vy > 0) {
        d.y = by * TILE - 6;
        d.vy = 0;
        d.vx *= 0.8;
      }
      if (dist < 18 && !p.dead) {
        this.pickup(d.id);
        this.drops.splice(i, 1);
      }
    }
  }

  private updateParts(dt: number) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const q = this.parts[i];
      q.life -= dt;
      if (q.life <= 0) {
        this.parts.splice(i, 1);
        continue;
      }
      q.vy += q.grav * dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
    }
  }

  private burn() {
    if (this.p.burnT > 0 || this.p.dead) return;
    this.p.burnT = 0.9;
    this.p.hurtT = 1;
    this.sfx.burn();
    this.cb.onToast("Aduh! Kamu terkena lava!");
    this.spawnParts(this.p.x, this.p.y, ["#ff9624", "#ffd23f"], 10, 160);
  }

  private respawn() {
    const p = this.p;
    p.dead = false;
    p.deadT = 0;
    p.burnT = 0;
    p.vx = 0;
    p.vy = 0;
    p.x = this.world.spawnX;
    p.punchT = 0;
    p.y = this.world.spawnY;
    this.flashT = 0.6;
  }

  emit() {
    if (this.destroyed) return;
    const slots: SlotInfo[] = this.order.map((id) => ({
      id,
      count: id === FIST_ID ? -1 : this.inv.get(id) ?? 0,
      name: id === FIST_ID ? "Tinju" : TILES[id]?.name ?? "?",
    }));
    this.cb.onState({
      slots,
      sel: this.sel,
      dead: this.p.dead,
      hint: this.hint,
    });
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.onResizeBound);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.saveNow();
  }

  // ---------------- render ----------------

  private render(time: number) {
    const ctx = this.ctx;
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;

    // langit
    const grad = ctx.createLinearGradient(0, 0, 0, ch);
    grad.addColorStop(0, SKY_TOP);
    grad.addColorStop(1, SKY_BOTTOM);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, cw, ch);

    // matahari & awan (screen-space, parallax halus)
    const vw = cw / this.dpr;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const sunX = vw - 150 - this.cam.x * 0.04;
    const sunY = 55 - this.cam.y * 0.06;
    ctx.drawImage(this.tex.sun, sunX, sunY);
    for (let ci = 0; ci < 3; ci++) {
      const cloud = this.tex.clouds[ci];
      const cy = 40 + ci * 78 - this.cam.y * 0.07;
      const speed = 6 + ci * 4;
      const range = vw + 260;
      const cx =
        ((((ci * 530 - this.cam.x * (0.15 + ci * 0.05) - time * speed) % range) +
          range) %
          range) -
        130;
      ctx.drawImage(cloud, cx, cy);
      ctx.drawImage(cloud, cx + range / 2, cy + 14);
    }

    const z = this.zoom * this.dpr;
    ctx.setTransform(z, 0, 0, z, -this.cam.x * z, -this.cam.y * z);

    // range tile terlihat
    const x0 = Math.max(0, Math.floor(this.cam.x / TILE) - 1);
    const x1 = Math.min(WORLD_W - 1, Math.ceil((this.cam.x + cw / z / 1) / TILE) + 1);
    const y0 = Math.max(0, Math.floor(this.cam.y / TILE) - 1);
    const y1 = Math.min(WORLD_H - 1, Math.ceil((this.cam.y + ch / z / 1) / TILE) + 1);

    // layer background (cave background)
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * WORLD_W + x;
        const bid = this.world.bg[i];
        if (bid !== T.EMPTY) {
          ctx.drawImage(this.tex.tiles.get(bid)![0], x * TILE, y * TILE);
        }
      }
    }

    // layer depan
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * WORLD_W + x;
        const id = this.world.fg[i];
        if (id === T.EMPTY) continue;
        const frames = this.tex.tiles.get(id)!;
        let frame = 0;
        if (frames.length > 1) {
          frame = Math.floor(time * 5.5 + x * 0.7 + y * 0.37) % frames.length;
        }
        if (id === T.WATER) ctx.globalAlpha = 0.88;
        ctx.drawImage(frames[frame], x * TILE, y * TILE);
        ctx.globalAlpha = 1;
      }
    }

    // retakan kerusakan
    for (const [i, rec] of this.dmg) {
      const id =
        rec.layer === "fg" ? this.world.fg[i] : this.world.bg[i];
      if (id === T.EMPTY) continue;
      const def = TILES[id];
      const stage = Math.min(2, Math.floor((rec.n / def.hits) * 3));
      const x = i % WORLD_W;
      const y = (i / WORLD_W) | 0;
      ctx.drawImage(this.tex.cracks[stage], x * TILE, y * TILE);
    }

    // drop
    for (const d of this.drops) {
      const frames = this.tex.tiles.get(d.id);
      if (!frames) continue;
      const bob = Math.sin(time * 3 + d.x) * 2;
      ctx.drawImage(frames[0], d.x - 8, d.y - 8 + bob, 16, 16);
    }

    // player
    if (!this.p.dead) {
      drawCharacter(ctx, this.tex, this.p.x, this.p.y + PHYS.PLAYER_H / 2, {
        facing: this.p.facing,
        walkPhase: this.p.walkPhase,
        onGround: this.p.onGround,
        inWater: this.p.inWater,
        punchT: this.p.punchT,
        hurtT: this.p.hurtT,
        vy: this.p.vy,
        moving: this.p.moving,
        blink: time % 3.5 < 0.13,
      });
    }

    // partikel
    for (const q of this.parts) {
      ctx.globalAlpha = Math.min(1, q.life / q.max);
      ctx.fillStyle = q.color;
      ctx.fillRect(q.x, q.y, q.size, q.size);
    }
    ctx.globalAlpha = 1;

    // kursor target (outline putih berdenyut ala Growtopia)
    if (this.target.valid && this.mouse.inside && !this.chatFocus) {
      const pulse = 0.55 + Math.sin(time * 7) * 0.25;
      ctx.strokeStyle = `rgba(255,255,255,${pulse})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(
        this.target.x * TILE + 1,
        this.target.y * TILE + 1,
        TILE - 2,
        TILE - 2
      );
    }

    // ---- pass layar (teks & overlay) ----
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const sx = (wx: number) => (wx - this.cam.x) * this.zoom;
    const sy = (wy: number) => (wy - this.cam.y) * this.zoom;

    if (!this.p.dead && this.fontsReady) {
      const nx = sx(this.p.x);
      const ny = sy(this.p.y - PHYS.PLAYER_H / 2 - 10);
      ctx.font = '8px "Press Start 2P", monospace';
      ctx.textAlign = "center";
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(0,0,0,0.85)";
      ctx.fillStyle = "#ffffff";
      ctx.strokeText(this.playerName, nx, ny);
      ctx.fillText(this.playerName, nx, ny);

      // bubble chat
      if (this.bubble) {
        const text = this.bubble.text;
        ctx.font = '9px "Press Start 2P", monospace';
        const maxW = 260;
        const lines = wrapText(ctx, text, maxW);
        const lw = Math.min(
          maxW + 16,
          Math.max(...lines.map((l) => ctx.measureText(l).width)) + 16
        );
        const lh = lines.length * 14 + 10;
        const bx = nx - lw / 2;
        const by = ny - lh - 16;
        ctx.fillStyle = "rgba(255,255,255,0.96)";
        ctx.strokeStyle = "#1d1d1d";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(bx, by, lw, lh, 6);
        ctx.fill();
        ctx.stroke();
        // ekor bubble
        ctx.beginPath();
        ctx.moveTo(nx - 5, by + lh);
        ctx.lineTo(nx + 5, by + lh);
        ctx.lineTo(nx, by + lh + 8);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "#1d1d1d";
        ctx.stroke();
        ctx.fillStyle = "#1d1d1d";
        ctx.textAlign = "center";
        lines.forEach((l, li) => {
          ctx.fillText(l, nx, by + 16 + li * 14);
        });
      }
    }

    // flash telepor
    if (this.flashT > 0) {
      ctx.fillStyle = `rgba(255,255,255,${this.flashT * 1.2})`;
      ctx.fillRect(0, 0, cw / this.dpr, ch / this.dpr);
    }
    // overlay terbakar / mati
    if (this.p.burnT > 0 || this.p.dead) {
      const a = this.p.dead ? 0.4 : 0.3 + Math.sin(time * 12) * 0.12;
      ctx.fillStyle = `rgba(200,30,10,${a})`;
      ctx.fillRect(0, 0, cw / this.dpr, ch / this.dpr);
    }
  }
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? cur + " " + w : w;
    if (ctx.measureText(test).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else cur = test;
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 4);
}
