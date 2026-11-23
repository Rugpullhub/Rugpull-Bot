"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FIST_ID, T } from "@/game/constants";
import { Game, EngineState } from "@/game/engine";
import { hasSave } from "@/game/save";
import { buildTextures, slotIcon } from "@/game/textures";

type Screen = "title" | "game";

interface Toast {
  id: number;
  text: string;
}
interface ChatLine {
  id: number;
  name: string;
  text: string;
}

const WORLD_RE = /^[A-Z0-9]{1,16}$/;

export default function Home() {
  const [screen, setScreen] = useState<Screen>("title");
  const [worldName, setWorldName] = useState("START");
  const [playerName, setPlayerName] = useState("Growtopian");
  const [icons, setIcons] = useState<Record<number, string>>({});
  const [savedExists, setSavedExists] = useState(false);

  // ===== game state =====
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [eng, setEng] = useState<EngineState | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [chatLog, setChatLog] = useState<ChatLine[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatText, setChatText] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [resetAsk, setResetAsk] = useState(false);
  const [sfxOn, setSfxOn] = useState(true);
  const [itemNameLabel, setItemNameLabel] = useState<string | null>(null);
  const [iconMap, setIconMap] = useState<Record<number, string>>({});
  const [isTouch, setIsTouch] = useState(false);
  const toastId = useRef(0);
  const chatId = useRef(0);
  const chatInputRef = useRef<HTMLInputElement>(null);

  // ikon blok untuk title screen
  useEffect(() => {
    if (screen !== "title") return;
    const t = setTimeout(() => {
      const tex = buildTextures();
      setIcons({
        [T.DIRT]: slotIcon(tex, T.DIRT),
        [T.GRASS]: slotIcon(tex, T.GRASS),
        [T.ROCK]: slotIcon(tex, T.ROCK),
        [T.LAVA]: slotIcon(tex, T.LAVA),
        [T.WATER]: slotIcon(tex, T.WATER),
        [T.DOOR]: slotIcon(tex, T.DOOR),
        [T.BEDROCK]: slotIcon(tex, T.BEDROCK),
      });
    }, 0);
    return () => clearTimeout(t);
  }, [screen]);

  useEffect(() => {
    const t = setTimeout(
      () =>
        setIsTouch(
          typeof window !== "undefined" &&
            window.matchMedia("(pointer: coarse)").matches
        ),
      0
    );
    return () => clearTimeout(t);
  }, []);

  // cek save yang tersedia saat kembali ke title / ganti nama
  useEffect(() => {
    if (screen !== "title") return;
    const t = setTimeout(
      () => setSavedExists(WORLD_RE.test(worldName) && hasSave(worldName)),
      0
    );
    return () => clearTimeout(t);
  }, [screen, worldName]);

  const pushToast = useCallback((text: string) => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-3), { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3400);
  }, []);

  // ===== lifecycle engine =====
  useEffect(() => {
    if (screen !== "game" || !canvasRef.current) return;
    const game = new Game(canvasRef.current, worldName, playerName, {
      onState: (s) => setEng(s),
      onToast: pushToast,
      onChatLog: (name, text) => {
        const id = ++chatId.current;
        setChatLog((c) => [...c.slice(-6), { id, name, text }]);
        setTimeout(
          () => setChatLog((c) => c.filter((x) => x.id !== id)),
          9200
        );
      },
    });
    gameRef.current = game;
    game.emit();
    setSfxOn(!game.sfx.muted);
    setChatLog([]);
    setChatOpen(false);
    setMenuOpen(false);
    setHelpOpen(false);

    const onVis = () => {
      if (document.visibilityState === "hidden") game.saveNow();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      game.destroy();
      gameRef.current = null;
    };
  }, [screen]);

  // ===== hotkeys UI level =====
  useEffect(() => {
    if (screen !== "game") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (chatOpen) {
          setChatOpen(false);
          gameRef.current?.setChatFocus(false);
        } else if (helpOpen) {
          setHelpOpen(false);
        } else {
          setMenuOpen((m) => !m);
        }
        return;
      }
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (!chatOpen && (e.key === "t" || e.key === "T" || e.key === "Enter")) {
        e.preventDefault();
        setMenuOpen(false);
        setChatOpen(true);
        gameRef.current?.setChatFocus(true);
        setTimeout(() => chatInputRef.current?.focus(), 30);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen, chatOpen, helpOpen]);

  // label nama item saat ganti slot
  useEffect(() => {
    if (!eng) return;
    const slot = eng.slots[eng.sel];
    const t = setTimeout(() => {
      if (slot) setItemNameLabel(slot.name);
    }, 0);
    const hide = setTimeout(() => setItemNameLabel(null), 1500);
    return () => {
      clearTimeout(t);
      clearTimeout(hide);
    };
  }, [eng?.sel, eng]);

  // cache ikon hotbar (dibuat di effect, bukan saat render)
  useEffect(() => {
    if (!eng || !gameRef.current) return;
    const game = gameRef.current;
    const t = setTimeout(() => {
      setIconMap((prev) => {
        const next = { ...prev };
        let changed = false;
        for (const s of eng.slots) {
          if (!next[s.id]) {
            next[s.id] = game.getIcon(s.id);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 0);
    return () => clearTimeout(t);
  }, [eng]);

  // ===== chat submit =====
  const submitChat = () => {
    const text = chatText.trim();
    if (text && gameRef.current) gameRef.current.say(text);
    setChatText("");
    setChatOpen(false);
    gameRef.current?.setChatFocus(false);
  };

  const play = () => {
    const w = worldName.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16) || "START";
    setWorldName(w);
    setSavedExists(hasSave(w));
    setScreen("game");
  };

  const toggleSfx = () => {
    const g = gameRef.current;
    if (!g) return;
    const m = !g.sfx.muted;
    g.sfx.setMuted(m);
    setSfxOn(!m);
  };

  const exitToTitle = () => {
    gameRef.current?.saveNow();
    setScreen("title");
    setMenuOpen(false);
  };

  // ================= RENDER =================

  if (screen === "title") {
    return (
      <main className="gt-sky fixed inset-0 overflow-hidden select-none">
        {/* blok pixel melayang */}
        {Object.entries(icons).map(([id, url], i) => (
          <img
            key={id}
            src={url}
            alt=""
            className="gt-float absolute opacity-90"
            style={{
              width: 52,
              height: 52,
              imageRendering: "pixelated",
              left: `${6 + ((i * 13) % 88)}%`,
              top: `${8 + ((i * 29) % 70)}%`,
              animationDelay: `${i * 0.7}s`,
              animationDuration: `${3.5 + (i % 3)}s`,
            }}
          />
        ))}

        <div className="relative z-10 flex h-full w-full flex-col items-center justify-center gap-6 px-4">
          <div className="text-center">
            <h1 className="gt-logo-letter text-4xl sm:text-5xl" aria-label="GROWTOPIA WEB">
              {"GROWTOPIA".split("").map((ch, i) => (
                <span
                  key={i}
                  style={{
                    color: ["#7ed957", "#ffd23f", "#f0796a", "#7ed957", "#ffd23f", "#f0796a", "#7ed957", "#ffd23f", "#f0796a"][i],
                  }}
                >
                  {ch}
                </span>
              ))}
            </h1>
            <p className="gt-pixel mt-3 text-[10px] text-white/95" style={{ textShadow: "2px 2px 0 rgba(0,0,0,.4)" }}>
              WEB EDITION — FAN DEMO
            </p>
          </div>

          <div className="gt-panel w-full max-w-md rounded-lg p-6">
            <label className="gt-pixel mb-2 block text-[9px] text-sky-200">
              NAMA WORLD
            </label>
            <input
              className="gt-input uppercase"
              value={worldName}
              maxLength={16}
              onChange={(e) => {
                const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
                setWorldName(v);
                setSavedExists(WORLD_RE.test(v) && hasSave(v));
              }}
              placeholder="START"
              aria-label="Nama world"
            />
            {savedExists && (
              <p className="gt-vt mt-2 text-[17px] text-emerald-300">
                World tersimpan ditemukan — progres kamu akan dilanjutkan.
              </p>
            )}

            <label className="gt-pixel mb-2 mt-4 block text-[9px] text-sky-200">
              NAMA KAMU
            </label>
            <input
              className="gt-input"
              value={playerName}
              maxLength={12}
              onChange={(e) => setPlayerName(e.target.value.replace(/[^\w ]/g, "").slice(0, 12))}
              placeholder="Growtopian"
              aria-label="Nama pemain"
            />

            <button className="gt-btn gt-btn-green mt-6 w-full rounded-md text-[12px]" onClick={play}>
              BERMAIN !
            </button>
          </div>

          <div className="gt-panel max-w-md rounded-lg px-5 py-4">
            <p className="gt-vt text-[18px] leading-snug text-sky-100">
              <b>Gerak</b> A/D &nbsp; <b>Lompat</b> W/Spasi &nbsp; <b>Pukul/Pasang</b> Klik &nbsp; <b>Pintu</b> E &nbsp; <b>Chat</b> T
            </p>
            <p className="gt-vt mt-1 text-[16px] text-sky-200/80">
              Tahap 1: blok world default — Dirt, Grass, Cave, Rock, Lava, Air, Bedrock, Pintu.
            </p>
          </div>

          <p className="gt-vt text-[15px] text-slate-700">
            Fan-made tribute, tidak berafiliasi dengan Ubisoft / Growtopia.
          </p>
        </div>
      </main>
    );
  }

  // ===== GAME SCREEN =====
  return (
    <main className="fixed inset-0 select-none overflow-hidden bg-black">
      <canvas ref={canvasRef} className="gt-canvas absolute inset-0 h-full w-full" />

      {/* nama world */}
      <div className="pointer-events-none absolute left-3 top-2 z-10 sm:left-1/2 sm:-translate-x-1/2">
        <span className="gt-worldname text-[12px] sm:text-[15px]">{worldName}</span>
      </div>

      {/* toasts */}
      <div className="pointer-events-none absolute left-1/2 top-9 z-20 flex -translate-x-1/2 flex-col items-center gap-1.5">
        {toasts.map((t) => (
          <div key={t.id} className="gt-toast">
            {t.text}
          </div>
        ))}
      </div>

      {/* tombol kanan atas */}
      <div className="absolute right-2 top-2 z-20 flex gap-1.5 sm:gap-2">
        <button className="gt-btn rounded-md px-2 py-1.5 text-[7px] sm:px-3 sm:py-2 sm:text-[8px]" onClick={toggleSfx} aria-label="Suara">
          SFX:{sfxOn ? "ON" : "OFF"}
        </button>
        <button className="gt-btn rounded-md px-2 py-1.5 text-[7px] sm:px-3 sm:py-2 sm:text-[8px]" onClick={() => setHelpOpen(true)}>
          BANTUAN
        </button>
        <button className="gt-btn rounded-md px-2 py-1.5 text-[7px] sm:px-3 sm:py-2 sm:text-[8px]" onClick={() => setMenuOpen(true)}>
          MENU
        </button>
      </div>

      {/* hint pintu */}
      {eng?.hint && (
        <div className="pointer-events-none absolute bottom-28 left-1/2 z-10 -translate-x-1/2">
          <div className="gt-toast">{eng.hint}</div>
        </div>
      )}

      {/* label item terpilih */}
      {itemNameLabel && (
        <div className="pointer-events-none absolute bottom-[86px] left-1/2 z-10 -translate-x-1/2">
          <span className="gt-worldname gt-pixel text-[9px]">{itemNameLabel}</span>
        </div>
      )}

      {/* chat log */}
      <div className="pointer-events-none absolute bottom-24 left-3 z-10 flex max-w-[46%] flex-col gap-0.5">
        {chatLog.map((c) => (
          <div key={c.id} className="gt-chatline">
            <span className="text-emerald-300">{c.name}: </span>
            {c.text}
          </div>
        ))}
      </div>

      {/* hotbar */}
      {eng && (
        <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 gap-1.5">
          {eng.slots.map((slot, i) => (
            <button
              key={slot.id}
              className={`gt-slot h-[38px] w-[38px] sm:h-[54px] sm:w-[54px] ${i === eng.sel ? "sel" : ""}`}
              onClick={() => gameRef.current?.setSel(i)}
              aria-label={slot.name}
            >
              <span className="num">{i + 1}</span>
              <img className="h-[26px] w-[26px] sm:h-10 sm:w-10" src={iconMap[slot.id]} alt={slot.name} draggable={false} />
              <span className="cnt">{slot.count === -1 ? "" : `x${slot.count}`}</span>
            </button>
          ))}
        </div>
      )}

      {/* chat input */}
      {chatOpen && (
        <div className="absolute bottom-3 left-3 z-30 w-72">
          <input
            ref={chatInputRef}
            className="gt-input text-[12px]"
            value={chatText}
            maxLength={90}
            placeholder="Ketik pesan... (Enter kirim, Esc batal)"
            onChange={(e) => setChatText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitChat();
              e.stopPropagation();
            }}
            onBlur={() => {
              setChatOpen(false);
              gameRef.current?.setChatFocus(false);
            }}
          />
        </div>
      )}

      {/* kontrol sentuh */}
      {isTouch && (
        <>
          <div className="absolute bottom-20 left-4 z-20 flex gap-3">
            <button
              className="gt-touch h-14 w-14"
              onPointerDown={(e) => { e.preventDefault(); gameRef.current?.setMove("L", true); }}
              onPointerUp={() => gameRef.current?.setMove("L", false)}
              onPointerLeave={() => gameRef.current?.setMove("L", false)}
              aria-label="Kiri"
            >
              <span className="tri tri-l" />
            </button>
            <button
              className="gt-touch h-14 w-14"
              onPointerDown={(e) => { e.preventDefault(); gameRef.current?.setMove("R", true); }}
              onPointerUp={() => gameRef.current?.setMove("R", false)}
              onPointerLeave={() => gameRef.current?.setMove("R", false)}
              aria-label="Kanan"
            >
              <span className="tri tri-r" />
            </button>
          </div>
          <div className="absolute bottom-20 right-4 z-20">
            <button
              className="gt-touch h-14 w-14"
              onPointerDown={(e) => { e.preventDefault(); gameRef.current?.setJump(true); }}
              onPointerUp={() => gameRef.current?.setJump(false)}
              aria-label="Lompat"
            >
              <span className="tri tri-u" />
            </button>
          </div>
        </>
      )}

      {/* overlay mati */}
      {eng?.dead && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
          <span className="gt-worldname text-[16px]">Kamu terbakar... kembali ke pintu utama!</span>
        </div>
      )}

      {/* menu ESC */}
      {menuOpen && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60">
          <div className="gt-panel w-full max-w-xs rounded-lg p-6">
            <h2 className="gt-pixel mb-5 text-center text-[12px] text-white">{worldName}</h2>
            <div className="flex flex-col gap-3">
              <button className="gt-btn gt-btn-green rounded-md text-[10px]" onClick={() => setMenuOpen(false)}>
                LANJUT MAIN
              </button>
              <button
                className="gt-btn rounded-md text-[10px]"
                onClick={() => {
                  gameRef.current?.saveNow();
                  pushToast("World tersimpan!");
                  setMenuOpen(false);
                }}
              >
                SIMPAN WORLD
              </button>
              <button
                className="gt-btn rounded-md text-[10px]"
                onClick={() => {
                  setMenuOpen(false);
                  setHelpOpen(true);
                }}
              >
                BANTUAN
              </button>
              {!resetAsk ? (
                <button className="gt-btn rounded-md text-[10px]" onClick={() => setResetAsk(true)}>
                  RESET WORLD
                </button>
              ) : (
                <div className="gt-panel rounded-md p-3">
                  <p className="gt-vt text-[17px] text-amber-200">Yakin reset? World baru acak dibuat, progres blok hilang.</p>
                  <div className="mt-2 flex gap-2">
                    <button
                      className="gt-btn gt-btn-red flex-1 rounded-md px-1 py-2 text-[8px]"
                      onClick={() => {
                        gameRef.current?.resetWorld();
                        setResetAsk(false);
                        setMenuOpen(false);
                      }}
                    >
                      YA, RESET
                    </button>
                    <button
                      className="gt-btn flex-1 rounded-md px-1 py-2 text-[8px]"
                      onClick={() => setResetAsk(false)}
                    >
                      BATAL
                    </button>
                  </div>
                </div>
              )}
              <button className="gt-btn gt-btn-red rounded-md text-[10px]" onClick={exitToTitle}>
                KELUAR KE MENU
              </button>
            </div>
          </div>
        </div>
      )}

      {/* bantuan */}
      {helpOpen && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
          <div className="gt-panel w-full max-w-md rounded-lg p-6">
            <h2 className="gt-pixel mb-4 text-center text-[12px] text-white">CARA BERMAIN</h2>
            <ul className="gt-vt space-y-1.5 text-[19px] text-sky-100">
              <li><b className="text-amber-300">Gerak:</b> A/D atau tombol kiri/kanan di layar</li>
              <li><b className="text-amber-300">Lompat:</b> W / Spasi / tombol panah atas (di air: tahan untuk berenang naik)</li>
              <li><b className="text-amber-300">Pukul blok:</b> arahkan mouse lalu tahan klik kiri (slot Tinju)</li>
              <li><b className="text-amber-300">Pasang blok:</b> pilih slot blok lalu klik petak kosong</li>
              <li><b className="text-amber-300">Ganti slot:</b> klik slot / tombol 1-9 / scroll mouse</li>
              <li><b className="text-amber-300">Masuk pintu:</b> berdiri di depan pintu, tekan E atau Naik</li>
              <li><b className="text-amber-300">Chat:</b> tekan T / Enter</li>
              <li><b className="text-amber-300">Menu:</b> Esc</li>
              <li className="text-emerald-300">Air + Lava bertemu menjadi Rock. Lava membakar — hati-hati!</li>
              <li className="text-emerald-300">Nama world sama = world yang sama. Progres tersimpan otomatis di browser ini.</li>
            </ul>
            <button className="gt-btn mt-5 w-full rounded-md text-[10px]" onClick={() => setHelpOpen(false)}>
              MENGERTI
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
