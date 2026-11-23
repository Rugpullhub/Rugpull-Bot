// Tekstur pixel-art prosedural 100% (tanpa aset eksternal) ala Growtopia.
import { T, TILE } from "./constants";
import { mulberry32 } from "./rng";

export interface CharFrames {
  idle: HTMLCanvasElement[]; // [mata terbuka, kedip]
  walk: HTMLCanvasElement[]; // 4 frame siklus jalan
  jump: HTMLCanvasElement;
  fall: HTMLCanvasElement;
  swim: HTMLCanvasElement[]; // 2 frame renang
  punch: HTMLCanvasElement[]; // 3 frame pukul (kanvas lebih lebar)
}

export interface Textures {
  tiles: Map<number, HTMLCanvasElement[]>; // id -> frame(s)
  cracks: HTMLCanvasElement[];
  fist: HTMLCanvasElement;
  fistPunch: HTMLCanvasElement;
  clouds: HTMLCanvasElement[];
  sun: HTMLCanvasElement;
  char: CharFrames;
  charHurt: CharFrames; // versi dis tint merah (kena lava)
}

type Ctx = CanvasRenderingContext2D;

function mk(w: number, h: number): { c: HTMLCanvasElement; x: Ctx } {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const x = c.getContext("2d")!;
  x.imageSmoothingEnabled = false;
  return { c, x };
}

function px(x: Ctx, X: number, Y: number, W: number, H: number, col: string) {
  x.fillStyle = col;
  x.fillRect(X, Y, W, H);
}

function hexRGB(col: string): [number, number, number] {
  const p = parseInt(col.slice(1), 16);
  return [(p >> 16) & 255, (p >> 8) & 255, p & 255];
}

// lingkaran pixel tanpa anti-alias
function pxCircle(x: Ctx, cx: number, cy: number, r: number, col: string) {
  x.fillStyle = col;
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy <= r * r) x.fillRect(cx + dx, cy + dy, 1, 1);
    }
  }
}

function speckle(
  x: Ctx,
  seed: number,
  n: number,
  col: string,
  s = 2,
  y0 = 0,
  y1 = TILE
) {
  const r = mulberry32(seed);
  for (let i = 0; i < n; i++) {
    const w = 1 + Math.floor(r() * s);
    const h = 1 + Math.floor(r() * s);
    px(x, Math.floor(r() * (TILE - w)), y0 + Math.floor(r() * (y1 - y0 - h + 1)), w, h, col);
  }
}

// ---------- outline ala sprite Growtopia (1px mengikuti siluet) ----------

function applyOutline(src: HTMLCanvasElement, col: string): HTMLCanvasElement {
  const w = src.width;
  const h = src.height;
  const sctx = src.getContext("2d")!;
  const d = sctx.getImageData(0, 0, w, h).data;
  const out = mk(w, h);
  const img = out.x.createImageData(w, h);
  const o = img.data;
  const [r, g, b] = hexRGB(col);
  const A = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < w && y < h ? d[(y * w + x) * 4 + 3] : 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (d[i + 3] > 0) {
        o[i] = d[i];
        o[i + 1] = d[i + 1];
        o[i + 2] = d[i + 2];
        o[i + 3] = d[i + 3];
      } else {
        let near = false;
        for (let dy = -1; dy <= 1 && !near; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (A(x + dx, y + dy) > 10) {
              near = true;
              break;
            }
          }
        }
        if (near) {
          o[i] = r;
          o[i + 1] = g;
          o[i + 2] = b;
          o[i + 3] = 255;
        }
      }
    }
  }
  out.x.putImageData(img, 0, 0);
  return out.c;
}

// ---------- tile painters (32x32) ----------

function texDirt(): HTMLCanvasElement {
  const { c, x } = mk(TILE, TILE);
  px(x, 0, 0, 32, 32, "#a06a3c");
  // bercak besar lembut untuk kedalaman
  const r = mulberry32(101);
  for (let i = 0; i < 12; i++) {
    const w = 4 + Math.floor(r() * 7);
    const h = 3 + Math.floor(r() * 5);
    px(x, Math.floor(r() * (32 - w)), Math.floor(r() * (32 - h)), w, h, r() < 0.5 ? "#96613a" : "#aa7244");
  }
  speckle(x, 202, 14, "#b97f4c", 1);
  speckle(x, 303, 10, "#7a4a26", 2);
  // kerikil kecil (batu 2 warna)
  const r2 = mulberry32(404);
  for (let i = 0; i < 7; i++) {
    const bx = 2 + Math.floor(r2() * 28);
    const by = 2 + Math.floor(r2() * 28);
    px(x, bx, by, 2, 2, "#8a5830");
    px(x, bx, by, 1, 1, "#c99862");
  }
  // bevel dalam + outline gelap ala block Growtopia
  px(x, 0, 0, 32, 1, "#5d371c");
  px(x, 0, 31, 32, 1, "#5d371c");
  px(x, 0, 0, 1, 32, "#5d371c");
  px(x, 31, 0, 1, 32, "#5d371c");
  px(x, 1, 1, 30, 1, "#b97f4c");
  px(x, 1, 30, 30, 1, "#7a4a26");
  px(x, 1, 1, 1, 30, "#b07544");
  px(x, 30, 1, 1, 30, "#7a4a26");
  return c;
}

function texGrass(): HTMLCanvasElement {
  const { c, x } = mk(TILE, TILE);
  x.drawImage(texDirt(), 0, 0);
  const r = mulberry32(777);
  for (let col = 0; col < 32; col++) {
    const h = 7 + Math.floor(r() * 3); // 7..9
    // tiga nada hijau: terang -> utama -> gelap
    px(x, col, 0, 1, 2, "#58c835");
    px(x, col, 2, 1, h - 4, "#3aa22c");
    px(x, col, h - 2, 1, 2, "#2f8f22");
    // batas rumput-tanah
    px(x, col, h, 1, 1, "#6f421f");
    if (r() < 0.3) px(x, col, 0, 1, 1, "#8fe860"); // kilau
    if (r() < 0.25) px(x, col, 2 + Math.floor(r() * (h - 4)), 1, 1, "#2f8f22"); // serat
    if (r() < 0.15) px(x, col, h - 2, 1, 1, "#45bb33"); // transisi
  }
  // helai rumput menonjol di permukaan
  const r2 = mulberry32(888);
  for (let i = 0; i < 6; i++) {
    const bx = Math.floor(r2() * 30) + 1;
    const by = 1 + Math.floor(r2() * 2);
    px(x, bx, by, 1, 2, "#6fd94f");
  }
  return c;
}

function texCaveBg(): HTMLCanvasElement {
  const { c, x } = mk(TILE, TILE);
  // gradien band (makin dalam makin gelap) + batas dither
  const bands: [string, number][] = [
    ["#4d3826", 9],
    ["#46321f", 18],
    ["#3e2b1a", 26],
    ["#372515", 32],
  ];
  let y = 0;
  for (const [col, until] of bands) {
    for (; y < until; y++) px(x, 0, y, 32, 1, col);
  }
  // dither antar band
  const r = mulberry32(4242);
  for (const yy of [9, 18, 26]) {
    for (let xx = 0; xx < 32; xx += 2) px(x, xx + ((yy / 9) | 0) % 2, yy, 1, 1, "#3a2818");
  }
  // bongkahan halus
  for (let i = 0; i < 8; i++) {
    const w = 4 + Math.floor(r() * 8);
    const h = 3 + Math.floor(r() * 6);
    px(x, Math.floor(r() * (32 - w)), Math.floor(r() * (32 - h)), w, h, r() < 0.5 ? "#3c2b1c" : "#533c28");
  }
  // retakan
  for (let i = 0; i < 5; i++) {
    let cx = Math.floor(r() * 32);
    let cy = Math.floor(r() * 32);
    const len = 4 + Math.floor(r() * 7);
    for (let s = 0; s < len; s++) {
      px(x, cx, cy, 1, 1, "#2c1e12");
      cx += r() < 0.6 ? 1 : 0;
      cy += r() < 0.5 ? 1 : -1;
      cx = Math.max(0, Math.min(31, cx));
      cy = Math.max(0, Math.min(31, cy));
    }
  }
  px(x, 0, 0, 32, 1, "#2f2113");
  px(x, 0, 31, 32, 1, "#2a1c10");
  px(x, 0, 0, 1, 32, "#312310");
  px(x, 31, 0, 1, 32, "#2a1c10");
  return c;
}

function texRock(): HTMLCanvasElement {
  const { c, x } = mk(TILE, TILE);
  // bayangan dasar
  pxCircle(x, 15, 22, 11, "#474f57");
  // bongkahan besar
  pxCircle(x, 14, 16, 12, "#5a636b");
  pxCircle(x, 12, 13, 9, "#79838c");
  pxCircle(x, 10, 11, 5, "#97a1aa");
  // bongkahan kecil kanan-atas
  pxCircle(x, 25, 9, 6, "#646d75");
  pxCircle(x, 24, 7, 3, "#87919a");
  // retakan
  const r = mulberry32(909);
  for (let i = 0; i < 5; i++) {
    let cx = 6 + Math.floor(r() * 18);
    let cy = 8 + Math.floor(r() * 16);
    const len = 3 + Math.floor(r() * 5);
    for (let s = 0; s < len; s++) {
      px(x, cx, cy, 1, 1, "#3f474f");
      cx += r() < 0.6 ? 1 : 0;
      cy += r() < 0.5 ? 1 : -1;
    }
  }
  speckle(x, 111, 7, "#b9c2ca", 1, 4, 20);
  return c;
}

function texLava(frame: number): HTMLCanvasElement {
  const { c, x } = mk(TILE, TILE);
  px(x, 0, 0, 32, 32, "#d94a12");
  const r = mulberry32(600 + frame);
  // kerak gelap
  for (let i = 0; i < 5; i++) {
    px(x, Math.floor(r() * 28), Math.floor(r() * 28), 3 + Math.floor(r() * 4), 2, "#a53208");
  }
  // gumpalan oranye
  for (let i = 0; i < 7; i++) {
    px(x, Math.floor(r() * 27), Math.floor(r() * 27), 3 + Math.floor(r() * 4), 2 + Math.floor(r() * 3), "#ff9624");
  }
  // inti panas
  for (let i = 0; i < 6; i++) {
    px(x, Math.floor(r() * 30), Math.floor(r() * 30), 2, 2, "#ffd23f");
  }
  // gelembung naik per frame
  const rb = mulberry32(950);
  for (let i = 0; i < 4; i++) {
    const bx = Math.floor(rb() * 30);
    const by = 28 - ((frame * 7 + i * 9) % 30);
    px(x, bx, by, 1, 1, "#ffe98a");
  }
  // permukaan bergaris terang yang bergeser tiap frame
  const off = frame * 8;
  for (let col = 0; col < 32; col++) {
    if ((col + off) % 10 < 5) px(x, col, 0, 1, 2, "#ffd23f");
    if ((col + off) % 7 < 2) px(x, col, 2, 1, 1, "#ff9624");
  }
  px(x, 0, 31, 32, 1, "#8a2a06");
  px(x, 31, 0, 1, 32, "#b03a0c");
  px(x, 0, 0, 1, 32, "#ff9624");
  return c;
}

function texWater(frame: number): HTMLCanvasElement {
  const { c, x } = mk(TILE, TILE);
  px(x, 0, 0, 32, 32, "#2f7fd0");
  px(x, 0, 22, 32, 10, "#2669b4");
  px(x, 0, 28, 32, 4, "#1f5fa8");
  const off = frame * 7;
  for (let col = 0; col < 32; col++) {
    const wave = Math.sin((col + off) * 0.5) > 0.2;
    if (wave) px(x, col, 0, 1, 2, "#66b4ec");
    if (wave) px(x, col, 2, 1, 1, "#4f9ade");
    if ((col + off) % 13 < 3) px(x, col, 4 + ((col / 5) | 0) % 3, 1, 1, "#8fd0f5");
    if ((col + off * 2) % 17 < 2) px(x, col, 10 + ((col / 7) | 0) % 8, 2, 1, "#5aa4e0");
  }
  const r = mulberry32(800 + frame);
  for (let i = 0; i < 3; i++) {
    px(x, Math.floor(r() * 30), 6 + Math.floor(r() * 18), 1, 1, "#d8f0ff");
  }
  px(x, 0, 31, 32, 1, "#1a4f8a");
  return c;
}

function texBedrock(): HTMLCanvasElement {
  const { c, x } = mk(TILE, TILE);
  px(x, 0, 0, 32, 32, "#3d4147");
  // lempengan besar
  const r = mulberry32(31337);
  for (let i = 0; i < 8; i++) {
    const w = 6 + Math.floor(r() * 9);
    const h = 4 + Math.floor(r() * 7);
    px(x, Math.floor(r() * (32 - w)), Math.floor(r() * (32 - h)), w, h, r() < 0.55 ? "#2b2e33" : "#494f57");
  }
  // retakan tebal
  for (let i = 0; i < 4; i++) {
    let cx = Math.floor(r() * 32);
    let cy = Math.floor(r() * 32);
    const len = 5 + Math.floor(r() * 6);
    for (let s = 0; s < len; s++) {
      px(x, cx, cy, 1, 2, "#23262b");
      cx += r() < 0.6 ? 1 : 0;
      cy += r() < 0.5 ? 1 : -1;
      cx = Math.max(0, Math.min(31, cx));
      cy = Math.max(0, Math.min(30, cy));
    }
  }
  speckle(x, 424, 9, "#575d66", 1);
  speckle(x, 425, 4, "#6a7178", 1);
  px(x, 0, 0, 32, 1, "#23262b");
  px(x, 0, 31, 32, 1, "#23262b");
  px(x, 0, 0, 1, 32, "#23262b");
  px(x, 31, 0, 1, 32, "#23262b");
  px(x, 1, 1, 30, 1, "#575d66");
  return c;
}

function texDoor(main: boolean): HTMLCanvasElement {
  const { c, x } = mk(TILE, TILE);
  const frame = main ? "#4d6072" : "#7a5233";
  const frameD = main ? "#3a4a5a" : "#5d3d24";
  const panel = main ? "#f4f6f8" : "#f2ead8";
  const panelD = main ? "#d7dde3" : "#d8cdb4";
  const panelDD = main ? "#c2cad2" : "#cfc3a8";
  // bingkai
  px(x, 0, 0, 32, 32, frame);
  // serat kayu pada bingkai (pintu kayu saja)
  if (!main) {
    const r = mulberry32(620);
    for (let i = 0; i < 6; i++) {
      const gx = r() < 0.5 ? Math.floor(r() * 4) : 28 + Math.floor(r() * 4);
      px(x, gx, Math.floor(r() * 26), 1, 3 + Math.floor(r() * 4), frameD);
    }
  }
  px(x, 0, 0, 32, 1, frameD);
  px(x, 0, 31, 32, 1, frameD);
  px(x, 0, 0, 1, 32, frameD);
  px(x, 31, 0, 1, 32, frameD);
  // panel pintu
  px(x, 4, 3, 24, 27, panel);
  px(x, 4, 3, 24, 1, frameD);
  px(x, 17, 3, 11, 27, panelD); // sisi kanan gelap
  px(x, 4, 27, 24, 3, panelDD); // kaki panel
  // jendela dengan kilau kaca
  px(x, 8, 6, 14, 11, frameD);
  px(x, 9, 7, 12, 9, main ? "#a8dcf2" : "#9fd4ef");
  px(x, 10, 8, 2, 4, "#d8f2fc");
  px(x, 13, 8, 1, 2, "#d8f2fc");
  px(x, 9, 11, 12, 1, frameD); // palang jendela
  px(x, 14, 12, 6, 3, "#8cc4e0");
  // pegangan emas + bayangan
  px(x, 23, 19, 3, 4, "#9a7a1a");
  px(x, 22, 18, 3, 4, "#d8b23a");
  px(x, 22, 18, 3, 1, "#ffe98a");
  px(x, 22, 21, 1, 1, "#9a7a1a");
  // paku keling untuk main door (bingkai baja)
  if (main) {
    for (const [rx, ry] of [
      [1, 1],
      [29, 1],
      [1, 29],
      [29, 29],
    ]) {
      px(x, rx, ry, 2, 2, "#caa42a");
      px(x, rx, ry, 1, 1, "#ffe98a");
    }
  }
  // ambang bawah
  px(x, 0, 29, 32, 3, frameD);
  px(x, 4, 29, 24, 1, main ? "#556878" : "#6d4a2f");
  return c;
}

function texCrack(stage: number): HTMLCanvasElement {
  const { c, x } = mk(TILE, TILE);
  const r = mulberry32(5000 + stage * 17);
  const lines = 2 + stage * 3;
  for (let i = 0; i < lines; i++) {
    let cx = 6 + Math.floor(r() * 20);
    let cy = 6 + Math.floor(r() * 20);
    const len = 4 + stage * 3 + Math.floor(r() * 5);
    for (let s = 0; s < len; s++) {
      px(x, cx, cy, 1, 1, "rgba(0,0,0,0.6)");
      const d = r();
      if (d < 0.4) cx++;
      else if (d < 0.6) cx--;
      else if (d < 0.8) cy++;
      else cy--;
      cx = Math.max(0, Math.min(31, cx));
      cy = Math.max(0, Math.min(31, cy));
    }
  }
  if (stage === 2) {
    for (let i = 0; i < 10; i++) {
      px(x, Math.floor(r() * 30), Math.floor(r() * 30), 2, 2, "rgba(0,0,0,0.35)");
    }
  }
  return c;
}

function texFist(punch: boolean): HTMLCanvasElement {
  const { c, x } = mk(TILE, TILE);
  const skin = "#f6c893";
  const dark = "#d9a06b";
  const line = "#b57e4b";
  px(x, 9, 11, 15, 13, skin);
  px(x, 9, 11, 15, 2, "#ffdfae"); // highlight
  px(x, 6, 15, 5, 8, skin); // ibu jari
  px(x, 6, 21, 5, 2, dark);
  // garis jari
  for (let i = 0; i < 3; i++) px(x, 12 + i * 4, 13, 1, 7, dark);
  px(x, 9, 23, 15, 1, line);
  px(x, 23, 12, 1, 12, line);
  px(x, 9, 11, 15, 1, line);
  px(x, 9, 11, 1, 12, line);
  if (punch) {
    for (let i = 0; i < 3; i++) px(x, 2 + i, 14 + i * 4, 4, 1, "rgba(255,255,255,0.8)");
  }
  return applyOutline(c, "#1e1610");
}

function texCloud(w: number, h: number, seed: number): HTMLCanvasElement {
  const { c, x } = mk(w, h);
  const r = mulberry32(seed);
  const base = h - 4;
  const blobs = 3 + Math.floor(r() * 3);
  for (let i = 0; i < blobs; i++) {
    const bx = 8 + Math.floor(r() * (w - 16));
    const by = base - 4 - Math.floor(r() * 6);
    const br = 5 + Math.floor(r() * 7);
    pxCircle(x, bx, by, br, "#ffffff");
  }
  px(x, 0, base, w, 4, "#ffffff");
  px(x, 6, base + 2, w - 12, 2, "#ddeefc");
  return c;
}

function texSun(): HTMLCanvasElement {
  const { c, x } = mk(40, 40);
  pxCircle(x, 20, 20, 11, "#ffd94a");
  pxCircle(x, 20, 20, 8, "#ffe98a");
  const rays: [number, number][] = [
    [20, 2],
    [20, 36],
    [2, 20],
    [36, 20],
    [7, 7],
    [31, 7],
    [7, 31],
    [31, 31],
  ];
  for (const [rx, ry] of rays) px(x, rx, ry, 2, 2, "#ffd94a");
  return c;
}

// ============================================================
// KARAKTER GROWTOPIA — chibi 1 block (32x32), outline gelap,
// kepala besar ala Growtopia, dianimasikan via frame prarender.
// ============================================================

const P = {
  out: "#1e1610",
  skin: "#f6c893",
  skinHi: "#ffdfae",
  skinSh: "#d9a06b",
  skinDk: "#b57e4b",
  eye: "#26221e",
  shine: "#ffffff",
  shirt: "#f4f4f0",
  shirtHi: "#ffffff",
  shirtSh: "#cfcfc8",
  pants: "#46639e",
  pantsSh: "#35508a",
  shoe: "#8a5a30",
  shoeHi: "#a5713d",
  sole: "#3c2712",
  mouth: "#b5763c",
};

// kepala besar (20px) dengan shading bulat; b = bob vertikal
function chHead(g: Ctx, cx: number, b: number, face: "open" | "blink") {
  const x0 = cx - 10;
  px(g, x0 + 2, 2 + b, 16, 1, P.skin);
  px(g, x0 + 1, 3 + b, 18, 1, P.skin);
  px(g, x0, 4 + b, 20, 11, P.skin);
  px(g, x0 + 1, 15 + b, 18, 1, P.skin);
  px(g, x0 + 2, 16 + b, 16, 1, P.skin);
  // highlight atas
  px(g, x0 + 2, 2 + b, 16, 1, P.skinHi);
  px(g, x0 + 1, 3 + b, 4, 1, P.skinHi);
  // shading kanan (bulat)
  px(g, cx + 6, 4 + b, 4, 11, P.skinSh);
  px(g, cx + 9, 5 + b, 1, 9, P.skinDk);
  // shading dagu
  px(g, x0 + 2, 16 + b, 16, 1, P.skinSh);
  px(g, x0 + 1, 15 + b, 3, 1, P.skinSh);
  px(g, x0 + 16, 15 + b, 3, 1, P.skinSh);
  // mata besar ala Growtopia (menghadap kanan)
  if (face === "open") {
    for (const ex of [cx - 3, cx + 2]) {
      px(g, ex, 7 + b, 3, 4, P.eye);
      px(g, ex, 7 + b, 1, 1, P.shine);
    }
  } else {
    px(g, cx - 3, 9 + b, 3, 1, P.skinDk);
    px(g, cx + 2, 9 + b, 3, 1, P.skinDk);
  }
  // mulut kecil
  px(g, cx + 1, 13 + b, 2, 1, P.mouth);
  // leher
  px(g, cx - 3, 17 + b, 6, 1, P.skinSh);
}

function chTorso(g: Ctx, cx: number, b: number) {
  px(g, cx - 7, 18 + b, 14, 7, P.shirt);
  px(g, cx - 6, 19 + b, 6, 1, P.shirtHi);
  px(g, cx + 4, 18 + b, 3, 7, P.shirtSh);
  px(g, cx - 7, 24 + b, 14, 1, P.shirtSh);
  px(g, cx - 7, 18 + b, 1, 7, P.shirtSh);
}

// lengan belakang (di belakang badan, warna gelap)
function chArmBack(g: Ctx, cx: number, b: number, dx: number, raise = 0) {
  const ax = cx - 10 + dx;
  const ay = 19 - raise + b;
  px(g, ax, ay, 3, 6, P.shirtSh);
  px(g, ax, ay + 6, 3, 2, P.skinSh);
}

// lengan depan
function chArmFront(g: Ctx, cx: number, b: number, dx: number, raise = 0) {
  const ax = cx + 7 + dx;
  const ay = 19 - raise + b;
  px(g, ax, ay, 3, 6, P.shirt);
  px(g, ax, ay + 6, 3, 2, P.skin);
}

// sepatu 7px (toe mengarah kanan), sole gelap; L = angkat (tuck)
function chShoe(g: Ctx, sx: number, L: number, hi: string, main: string) {
  px(g, sx, 28 - L, 7, 3, main);
  px(g, sx, 28 - L, 7, 1, hi);
  px(g, sx, 31 - L, 7, 1, P.sole);
}

// sepasang kaki; bDx/fDx = rentangan depan-belakang, bL/fL = angkat kaki
function chLegs(g: Ctx, cx: number, bDx: number, fDx: number, bL = 0, fL = 0) {
  const bx = cx - 8 + bDx;
  px(g, bx, 25 - bL, 5, 3, P.pantsSh);
  chShoe(g, bx, bL, P.shoeHi, P.shoe);
  const fx = cx - 1 + fDx;
  px(g, fx, 25 - fL, 5, 3, P.pants);
  chShoe(g, fx, fL, "#c99862", P.shoeHi);
}

// pose dasar + variasi; kembalikan painter (g, cx)
type Painter = (g: Ctx, cx: number) => void;

const poseIdle = (face: "open" | "blink"): Painter => (g, cx) => {
  chArmBack(g, cx, 0, 0);
  chLegs(g, cx, 0, 0);
  chTorso(g, cx, 0);
  chHead(g, cx, 0, face);
  chArmFront(g, cx, 0, 0);
};

const poseWalk = (backDx: number, frontDx: number): Painter => (g, cx) => {
  chArmBack(g, cx, 0, -Math.sign(backDx));
  chLegs(g, cx, backDx, frontDx);
  chTorso(g, cx, 0);
  chHead(g, cx, 0, "open");
  chArmFront(g, cx, 0, -Math.sign(frontDx));
};

const poseJump = (g: Ctx, cx: number) => {
  chArmBack(g, cx, 0, -1, 3);
  chLegs(g, cx, -2, 0, 0, 2);
  chTorso(g, cx, 0);
  chHead(g, cx, 0, "open");
  chArmFront(g, cx, 0, 1, 3);
};

const poseFall = (g: Ctx, cx: number) => {
  chArmBack(g, cx, 0, -2, 4);
  chLegs(g, cx, -2, 1);
  chTorso(g, cx, 0);
  chHead(g, cx, 0, "open");
  chArmFront(g, cx, 0, 2, 4);
};

const poseSwim0 = (g: Ctx, cx: number) => {
  chArmBack(g, cx, 0, -1);
  chLegs(g, cx, -1, 1);
  chTorso(g, cx, 0);
  chHead(g, cx, 0, "open");
  // lengan depan dayung ke depan
  px(g, cx + 7, 20, 6, 3, P.shirt);
  px(g, cx + 13, 19, 3, 3, P.skin);
};

const poseSwim1 = (g: Ctx, cx: number) => {
  chArmBack(g, cx, 0, 0, 1);
  chLegs(g, cx, 1, -1);
  chTorso(g, cx, 0);
  chHead(g, cx, 0, "open");
  px(g, cx + 7, 21, 4, 3, P.shirt);
  px(g, cx + 11, 22, 3, 3, P.skin);
};

// frame pukul (tanpa lengan depan normal)
const posePunch0 = (g: Ctx, cx: number) => {
  chArmBack(g, cx, 0, 0);
  chLegs(g, cx, 0, 0);
  chTorso(g, cx, 0);
  chHead(g, cx, 0, "open");
  // tangan diayun ke belakang (windup)
  px(g, cx + 3, 19, 4, 5, P.skin);
  px(g, cx + 3, 21, 4, 1, P.skinDk);
  px(g, cx + 5, 23, 3, 3, P.shirt);
};

const posePunch1 = (g: Ctx, cx: number) => {
  chArmBack(g, cx, 0, -1);
  chLegs(g, cx, 0, 0);
  chTorso(g, cx, 0);
  chHead(g, cx, 0, "open");
  // lengan extends penuh + kepalan
  px(g, cx + 7, 20, 7, 4, P.shirt);
  px(g, cx + 7, 23, 7, 1, P.shirtSh);
  px(g, cx + 14, 19, 5, 5, P.skin);
  px(g, cx + 14, 19, 5, 1, P.skinHi);
  px(g, cx + 15, 21, 3, 1, P.skinDk);
};

const posePunch2 = (g: Ctx, cx: number) => {
  chArmBack(g, cx, 0, 0);
  chLegs(g, cx, 0, 0);
  chTorso(g, cx, 0);
  chHead(g, cx, 0, "open");
  px(g, cx + 7, 20, 4, 4, P.shirt);
  px(g, cx + 11, 19, 5, 5, P.skin);
  px(g, cx + 12, 21, 3, 1, P.skinDk);
};

function paintFrame(paint: Painter, w = 36): HTMLCanvasElement {
  const { c, x } = mk(w, 32);
  paint(x, Math.floor(w / 2));
  return applyOutline(c, P.out);
}

function buildCharFrames(): CharFrames {
  return {
    idle: [paintFrame(poseIdle("open")), paintFrame(poseIdle("blink"))],
    walk: [
      paintFrame(poseWalk(-2, 2)),
      paintFrame(poseWalk(0, 0)),
      paintFrame(poseWalk(2, -2)),
      paintFrame(poseWalk(0, 0)),
    ],
    jump: paintFrame(poseJump),
    fall: paintFrame(poseFall),
    swim: [paintFrame(poseSwim0), paintFrame(poseSwim1)],
    punch: [
      paintFrame(posePunch0, 56),
      paintFrame(posePunch1, 56),
      paintFrame(posePunch2, 56),
    ],
  };
}

// versi merah (kena lava / hurt flash)
function tintRed(src: HTMLCanvasElement): HTMLCanvasElement {
  const out = mk(src.width, src.height);
  out.x.drawImage(src, 0, 0);
  const img = out.x.getImageData(0, 0, src.width, src.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    d[i] = Math.min(255, d[i] * 0.45 + 200);
    d[i + 1] = Math.round(d[i + 1] * 0.35);
    d[i + 2] = Math.round(d[i + 2] * 0.35);
  }
  out.x.putImageData(img, 0, 0);
  return out.c;
}

function tintFrames(f: CharFrames): CharFrames {
  return {
    idle: f.idle.map(tintRed),
    walk: f.walk.map(tintRed),
    jump: tintRed(f.jump),
    fall: tintRed(f.fall),
    swim: f.swim.map(tintRed),
    punch: f.punch.map(tintRed),
  };
}

// ---------- status & render karakter ----------

export interface CharState {
  facing: 1 | -1;
  walkPhase: number; // 0..1 siklus jalan
  onGround: boolean;
  inWater: boolean;
  punchT: number; // 0 = tidak memukul; 0..1 animasi
  hurtT: number; // >0.45 = flash merah
  vy: number;
  moving: boolean;
  blink: boolean;
}

export function drawCharacter(
  ctx: Ctx,
  tex: Textures,
  feetX: number,
  feetY: number,
  s: CharState
) {
  const F = s.hurtT > 0.45 ? tex.charHurt : tex.char;
  let f: HTMLCanvasElement;
  if (s.punchT > 0) {
    f = s.punchT < 0.3 ? F.punch[0] : s.punchT < 0.62 ? F.punch[1] : F.punch[2];
  } else if (s.inWater) {
    f = F.swim[Math.floor(s.walkPhase * 2) % 2];
  } else if (!s.onGround) {
    f = s.vy < 0 ? F.jump : F.fall;
  } else if (s.moving) {
    f = F.walk[Math.floor(s.walkPhase * 4) % 4];
  } else {
    f = s.blink ? F.idle[1] : F.idle[0];
  }
  const ix = Math.round(feetX);
  const iy = Math.round(feetY);
  ctx.save();
  ctx.translate(ix, iy);
  if (s.facing === -1) ctx.scale(-1, 1);
  ctx.drawImage(f, -f.width / 2, -32);
  ctx.restore();
}

// ---------- builder ----------

export function buildTextures(): Textures {
  const tiles = new Map<number, HTMLCanvasElement[]>();
  tiles.set(T.DIRT, [texDirt()]);
  tiles.set(T.GRASS, [texGrass()]);
  tiles.set(T.CAVE_BG, [texCaveBg()]);
  tiles.set(T.ROCK, [texRock()]);
  tiles.set(T.LAVA, [0, 1, 2, 3].map((f) => texLava(f)));
  tiles.set(T.WATER, [0, 1, 2, 3].map((f) => texWater(f)));
  tiles.set(T.BEDROCK, [texBedrock()]);
  tiles.set(T.DOOR, [texDoor(false)]);
  tiles.set(T.MAIN_DOOR, [texDoor(true)]);
  const char = buildCharFrames();
  return {
    tiles,
    cracks: [texCrack(0), texCrack(1), texCrack(2)],
    fist: texFist(false),
    fistPunch: texFist(true),
    clouds: [texCloud(96, 30, 11), texCloud(70, 24, 22), texCloud(120, 34, 33)],
    sun: texSun(),
    char,
    charHurt: tintFrames(char),
  };
}

// ikon hotbar (dataURL) dengan cache
const iconCache = new Map<number, string>();
export function slotIcon(tex: Textures, id: number): string {
  const cached = iconCache.get(id);
  if (cached) return cached;
  const { c, x } = mk(32, 32);
  if (id === 255) {
    x.drawImage(tex.fist, 0, 0);
  } else {
    const frames = tex.tiles.get(id);
    if (frames) x.drawImage(frames[0], 0, 0);
  }
  const url = c.toDataURL();
  iconCache.set(id, url);
  return url;
}
