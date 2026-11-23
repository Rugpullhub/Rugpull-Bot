# GROWTOPIA WEB — Fan Demo (Pixel Sandbox Game)

Game sandbox 2D pixel-art bergaya **Growtopia**, 100% prosedural (tanpa aset eksternal), dibuat dengan Next.js + Canvas 2D.

> Cabang `growtopia-web-game` khusus berisi game web ini. Branch `main` tidak diubah.

## Fitur (Tahap 1 — Default World)
- World 100x54 tile: Dirt, Grass, Cave Background, Rock, Lava, Air, Bedrock, Door, Main Door
- Karakter chibi **1 blok** ala Growtopia: idle/berkedip, jalan 4-frame, lompat, jatuh, renang, animasi pukul
- Hancurkan & pasang blok, drop item bermagnet, inventori hotbar 9 slot
- Cairan mengalir (air + lava = rock), lava membakar, respawn ke Main Door
- Chat in-game dengan bubble, SFX 8-bit WebAudio, save otomatis (localStorage)
- Kontrol keyboard + tombol sentuh untuk HP

## Cara Deploy ke Vercel (Gratis)
1. Buka [vercel.com/new](https://vercel.com/new) dan import repo ini
2. Pilih **Production Branch: `growtopia-web-game`**
3. Framework auto-terdeteksi (Next.js) — langsung klik **Deploy**

Jalankan lokal:

```bash
npm install
npm run dev
```

## Kontrol
| Aksi | Tombol |
|---|---|
| Gerak | A / D atau ←/→ |
| Lompat | W / Spasi (di air: renang naik) |
| Pukul / Pasang | Klik kiri (klik kanan = paksa tinju) |
| Ganti slot | 1-9 / scroll / klik hotbar |
| Masuk pintu | E atau Naik saat di depan pintu |
| Chat | T atau Enter |
| Menu | Esc |

---
Fan-made tribute. Tidak berafiliasi dengan Ubisoft / Growtopia.
