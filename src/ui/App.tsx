import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GameEngine } from '../core/engine';
import { deserialize, saveToSlot, toJSON } from '../core/save/save';
import { CommandResult, GameState, Lang, T } from '../core/types';
import { Overlay, Renderer } from '../render/renderer';
import { I18nContext, makeI18n, noticeText, translate } from '../i18n/i18n';
import { GameCanvas } from './GameCanvas';
import { useGameLoop, useInterval } from './hooks';
import { InfoPanel } from './InfoPanel';
import { MainMenu } from './MainMenu';
import { Minimap } from './Minimap';
import { ViewControls } from './ViewControls';
import { Notifications } from './Notifications';
import { TopBar } from './TopBar';
import { Toolbar } from './Toolbar';
import { Diplomacy } from './modals/Diplomacy';
import { Economy } from './modals/Economy';
import { EraPanel } from './modals/EraPanel';
import { Modal } from './modals/Modal';
import { ResearchTree } from './modals/ResearchTree';
import { SaveLoad } from './modals/SaveLoad';
import { Sejarahpedia } from './modals/Sejarahpedia';
import { Settings } from './modals/Settings';
import { GameView3D } from './GameView3D';
import { SfxId, sound } from '../audio/soundEngine';
import { createScenario } from '../core/scenarios';
import { Advisors } from './modals/Advisors';
import { Crisis } from './modals/Crisis';
import { Timeline } from './modals/Timeline';
import { isWebGLAvailable } from '../render3d/view3d';
import { DayMode, WeatherMode } from '../render3d/world';
import { ModalId, SPEED_TPS, Toast, Tool, ViewController, ViewMode } from './types';

const LANG_KEY = 'tamadun-kota:lang';
const VIEW_KEY = 'tamadun-kota:view';

function readView(): ViewMode {
  const gl = isWebGLAvailable();
  try {
    const v = localStorage.getItem(VIEW_KEY);
    if (v === '2d') return '2d';
  } catch {
    /* storage unavailable */
  }
  return gl ? '3d' : '2d';
}

function readLang(): Lang {
  try {
    const v = localStorage.getItem(LANG_KEY);
    return v === 'en' ? 'en' : 'ms';
  } catch {
    return 'ms';
  }
}

/** Centre the camera on the river mouth, where most cities begin. */
function focusStart(renderer: Renderer, state: GameState) {
  const m = state.map;
  if (state.buildings.length) {
    const b = state.buildings[0];
    renderer.centerOn(b.x + 6, b.y);
    return;
  }
  let best = Infinity;
  let pos = { x: m.width / 3, y: m.height / 2 };
  for (let i = 0; i < m.terrain.length; i++)
    if (m.terrain[i] === T.RIVER) {
      const x = i % m.width;
      if (x < best) {
        best = x;
        pos = { x: x + 8, y: (i / m.width) | 0 };
      }
    }
  renderer.centerOn(pos.x, pos.y);
}

export function App({ initialSave }: { initialSave?: string } = {}) {
  const [lang, setLangState] = useState<Lang>(readLang);
  const i18n = useMemo(() => makeI18n(lang), [lang]);
  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(LANG_KEY, l);
    } catch {
      /* storage unavailable */
    }
  };
  const [engine, setEngine] = useState<GameEngine | null>(null);
  const [screen, setScreen] = useState<'menu' | 'game'>('menu');
  const renderer = useMemo(() => new Renderer(), []);
  const [speed, setSpeed] = useState(0);
  const [tool, setTool] = useState<Tool>({ kind: 'inspect' });
  const [overlay, setOverlayState] = useState<Overlay>('none');
  const [modal, setModal] = useState<ModalId>(null);
  const [entry, setEntry] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ x: number; y: number } | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [autosave, setAutosave] = useState(true);
  const [gfx, setGfxState] = useState<'auto' | 'high' | 'low'>(() => {
    try {
      const v = localStorage.getItem('tamadun-kota:gfx');
      return v === 'high' || v === 'low' ? v : 'auto';
    } catch {
      return 'auto';
    }
  });
  const setGfx = (v: 'auto' | 'high' | 'low') => {
    setGfxState(v);
    try {
      localStorage.setItem('tamadun-kota:gfx', v);
    } catch {
      /* storage unavailable */
    }
  };
  const [victorySeen, setVictorySeen] = useState(false);
  const [menuLoad, setMenuLoad] = useState(false);
  const [viewMode, setViewModeState] = useState<ViewMode>(readView);
  const [dayMode, setDayMode] = useState<DayMode>('day');
  const [weather, setWeather] = useState<WeatherMode>('auto');
  const controllerRef = useRef<ViewController | null>(null);
  const setViewMode = useCallback((v: ViewMode) => {
    const next = v === '3d' && !isWebGLAvailable() ? '2d' : v;
    setViewModeState(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      /* storage unavailable */
    }
  }, []);
  const toastId = useRef(1);
  const lastNotice = useRef(0);
  const langRef = useRef(lang);
  langRef.current = lang;

  const pushToast = useCallback((text: string, kind: Toast['kind'] = 'info', body?: string, entryId?: string) => {
    const id = toastId.current++;
    setToasts((ts) => [...ts.slice(-8), { id, text, kind, body, entry: entryId, at: Date.now() }]);
  }, []);

  const onResult = useCallback(
    (r: CommandResult, kind?: 'build' | 'transport' | 'zone' | 'bulldoze') => {
      if (!r.ok) {
        if (r.reason) pushToast(translate(langRef.current, r.reason), 'bad');
        sound.play('error');
        return;
      }
      const sfx: Record<string, SfxId> = { build: 'place', transport: 'road', zone: 'zone', bulldoze: 'bulldoze' };
      if (kind) sound.play(sfx[kind]);
    },
    [pushToast],
  );

  const setOverlay = (o: Overlay) => {
    renderer.overlay = o;
    setOverlayState(o);
    engine?.emit();
  };

  const startEngine = useCallback(
    (e: GameEngine) => {
      lastNotice.current = e.state.notices.length ? e.state.notices[e.state.notices.length - 1].id : 0;
      renderer.selected = null;
      renderer.preview = null;
      focusStart(renderer, e.state);
      setEngine(e);
      setScreen('game');
      setTool({ kind: 'inspect' });
      setSelected(null);
      setVictorySeen(e.state.victory);
      setToasts([]);
    },
    [renderer],
  );

  const startAudio = (era: number, seed: number) => {
    if (sound.unlock()) {
      sound.setEra(era);
      sound.startMusic(seed);
    }
  };

  const startNew = (name: string, seed: number, scenario = 'melaka_1400') => {
    const e = scenario === 'melaka_1400' ? GameEngine.newGame(seed, name) : createScenario(scenario, seed, name);
    startEngine(e);
    startAudio(e.state.era, seed);
    setSpeed(1);
    pushToast(translate(lang, 'menu.howto'), 'info', [1, 2, 3, 4].map((i) => `${i}. ${translate(lang, `menu.howto.${i}`)}`).join(' '));
  };

  const loadState = (s: GameState) => {
    startEngine(new GameEngine(s));
    setSpeed(0);
    startAudio(s.era, s.seed);
  };

  useGameLoop(screen === 'game' && !modal ? engine : null, SPEED_TPS[speed], (err) => {
    setSpeed(0);
    pushToast(`Error: ${(err as Error).message}`, 'bad');
  });

  // turn engine notices into toasts and sounds; open pending crises; keep the music in era
  useEffect(() => {
    if (!engine) return;
    let lastYear = engine.state.year;
    let lastCrisis = engine.state.crisis?.id ?? null;
    return engine.subscribe(() => {
      const st = engine.state;
      sound.setEra(st.era);
      if (st.year !== lastYear) {
        if (st.derived.netIncome > 0 && st.year % 5 === 0) sound.play('coin');
        lastYear = st.year;
      }
      const cid = st.crisis?.id ?? null;
      if (cid && cid !== lastCrisis) {
        sound.play('crisis');
        setModal((m) => m ?? 'crisis');
      }
      lastCrisis = cid;
      const ns = st.notices.filter((n) => n.id > lastNotice.current);
      if (!ns.length) return;
      lastNotice.current = ns[ns.length - 1].id;
      for (const n of ns) {
        const txt = noticeText(langRef.current, n);
        pushToast(txt.title, n.kind, txt.body, n.entry);
        if (n.key === 'notice.techDone' || n.key === 'notice.civicDone') sound.play('fanfare');
        else if (n.key === 'notice.newEra') sound.play('era');
        else if (n.key === 'notice.milestone' || n.key === 'notice.victory') sound.play('victory');
        else if (n.key === 'event.banjir_monsun') sound.play('thunder');
        else if (n.key === 'notice.advisorJoined') sound.play('coin');
      }
    });
  }, [engine, pushToast]);

  // expire toasts
  useInterval(() => {
    const now = Date.now();
    setToasts((ts) => {
      const keep = ts.filter((x) => now - x.at < (x.kind === 'era' || x.kind === 'event' ? 16000 : 7000));
      return keep.length === ts.length ? ts : keep;
    });
  }, 1000);

  useInterval(
    () => {
      if (engine && screen === 'game') {
        try {
          saveToSlot(engine.state, 'autosave');
        } catch {
          /* ignore quota errors for autosave */
        }
      }
    },
    autosave ? 120000 : null,
  );

  // camera controller for the 2D canvas
  useEffect(() => {
    if (viewMode !== '2d' || !engine) return;
    controllerRef.current = {
      mode: '2d',
      centerOn: (x, y) => {
        renderer.centerOn(x, y);
        engine.emit();
      },
      pan: (dx, dy) => {
        renderer.camera = { ...renderer.camera, x: renderer.camera.x + dx * 32, y: renderer.camera.y + dy * 32 };
        engine.emit();
      },
      zoom: (f) => {
        renderer.camera = { ...renderer.camera, zoom: Math.max(0.35, Math.min(2.5, renderer.camera.zoom * f)) };
        engine.emit();
      },
      resetCamera: () => {
        focusStart(renderer, engine.state);
        renderer.camera = { ...renderer.camera, zoom: 1 };
        engine.emit();
      },
      tileToScreen: (x, y) => {
        const c = document.querySelector('[data-testid=game-canvas]') as HTMLCanvasElement | null;
        const r = c?.getBoundingClientRect() ?? { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
        const cam = renderer.camera;
        const wx = (x - y) * 32;
        const wy = (x + y) * 16 + 16;
        return { x: r.left + (wx - cam.x) * cam.zoom + r.width / 2, y: r.top + (wy - cam.y) * cam.zoom + r.height / 2 };
      },
    };
    return () => {
      if (controllerRef.current?.mode === '2d') controllerRef.current = null;
    };
  }, [viewMode, engine, renderer]);

  // keyboard
  useEffect(() => {
    if (screen !== 'game' || !engine) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'SELECT') return;
      const ctl = controllerRef.current;
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
          ctl?.pan(0, ctl.mode === '3d' ? 3 : -2 / renderer.camera.zoom);
          break;
        case 'ArrowDown':
        case 's':
          ctl?.pan(0, ctl.mode === '3d' ? -3 : 2 / renderer.camera.zoom);
          break;
        case 'ArrowLeft':
        case 'a':
          ctl?.pan(ctl.mode === '3d' ? -3 : -2 / renderer.camera.zoom, 0);
          break;
        case 'ArrowRight':
        case 'd':
          ctl?.pan(ctl.mode === '3d' ? 3 : 2 / renderer.camera.zoom, 0);
          break;
        case '+':
        case '=':
          ctl?.zoom(1.15);
          break;
        case '-':
          ctl?.zoom(1 / 1.15);
          break;
        case 'q':
          ctl?.rotate?.(0.2);
          break;
        case 'e':
          ctl?.rotate?.(-0.2);
          break;
        case 'Home':
          ctl?.resetCamera();
          break;
        case 'Escape':
          if (!modal) setTool({ kind: 'inspect' });
          return;
        case ' ':
          e.preventDefault();
          setSpeed((sp) => (sp === 0 ? 1 : 0));
          return;
        case '1':
        case '2':
        case '3':
          setSpeed(Number(e.key));
          return;
        case 'b':
          setTool({ kind: 'bulldoze' });
          return;
        case 'r':
          setTool({ kind: 'transport', key: 'road' });
          return;
        default:
          return;
      }
      engine.emit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screen, engine, renderer, modal]);

  const openEntry = (id: string) => {
    setEntry(id);
    setModal('encyclopedia');
  };

  // restore a game handed back by an embedding viewer after an update
  useEffect(() => {
    if (!initialSave) return;
    try {
      loadState(deserialize(initialSave));
    } catch {
      /* ignore an incompatible snapshot */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSave]);

  // let an embedding viewer snapshot the running game so it survives updates
  useEffect(() => {
    const hot = (window as unknown as { claude?: { hot?: { snapshot?: (fn: () => unknown) => void } } }).claude?.hot;
    try {
      hot?.snapshot?.(() => (engine ? { save: toJSON(engine.state) } : {}));
    } catch {
      /* viewer without snapshot support */
    }
  }, [engine]);

  // debug / automation handle used by the E2E smoke test
  useEffect(() => {
    (window as unknown as { __tamadun?: unknown }).__tamadun = { engine, renderer, setSpeed, setTool, controller: controllerRef, viewMode, setViewMode };
  }, [engine, renderer, viewMode, setViewMode]);

  const showVictory = engine?.state.victory && !victorySeen;

  return (
    <I18nContext.Provider value={i18n}>
      <div className="relative h-full w-full select-none text-songket-50">
        {screen === 'menu' && (
          <>
            <MainMenu onStart={startNew} onOpenLoad={() => setMenuLoad(true)} onContinue={engine ? () => setScreen('game') : null} setLang={setLang} />
            {menuLoad && <SaveLoad engine={null} onClose={() => setMenuLoad(false)} onLoad={loadState} notify={(t, k) => pushToast(t, k)} />}
          </>
        )}
        {screen === 'game' && engine && (
          <>
            {viewMode === '3d' ? (
              <GameView3D
                engine={engine}
                tool={tool}
                overlay={overlay}
                dayMode={dayMode}
                weather={weather}
                selected={selected}
                onSelect={(t) => {
                  renderer.selected = t;
                  setSelected(t);
                }}
                onResult={onResult}
                onLightning={() => sound.play('thunder')}
                onCancelTool={() => setTool({ kind: 'inspect' })}
                onFail={() => setViewMode('2d')}
                controllerRef={controllerRef}
                quality={gfx}
              />
            ) : (
              <GameCanvas engine={engine} renderer={renderer} tool={tool} onSelect={setSelected} onResult={onResult} onCancelTool={() => setTool({ kind: 'inspect' })} />
            )}
            <div className="pointer-events-none absolute inset-0">
              <TopBar
                engine={engine}
                speed={speed}
                setSpeed={setSpeed}
                openModal={(m) => setModal(m)}
                viewMode={viewMode}
                setViewMode={setViewMode}
                sound={sound}
              />
              <Toolbar engine={engine} tool={tool} setTool={setTool} />
              <InfoPanel
                engine={engine}
                tile={tool.kind === 'inspect' ? selected : null}
                onClose={() => {
                  setSelected(null);
                  renderer.selected = null;
                  engine.emit();
                }}
                openEntry={openEntry}
              />
              <Minimap engine={engine} controllerRef={controllerRef} overlay={overlay} setOverlay={setOverlay} />
              {viewMode === '3d' && (
                <ViewControls
                  dayMode={dayMode}
                  setDayMode={setDayMode}
                  weather={weather}
                  setWeather={setWeather}
                  onReset={() => controllerRef.current?.resetCamera()}
                  onRotate={(a) => controllerRef.current?.rotate?.(a)}
                />
              )}
              <Notifications toasts={toasts} dismiss={(id) => setToasts((ts) => ts.filter((x) => x.id !== id))} openEntry={openEntry} />
              {modal === 'tech' && <ResearchTree engine={engine} kind="tech" onClose={() => setModal(null)} openEntry={openEntry} onResult={onResult} />}
              {modal === 'civics' && <ResearchTree engine={engine} kind="civic" onClose={() => setModal(null)} openEntry={openEntry} onResult={onResult} />}
              {modal === 'era' && <EraPanel engine={engine} onClose={() => setModal(null)} openEntry={openEntry} />}
              {modal === 'diplomacy' && <Diplomacy engine={engine} onClose={() => setModal(null)} openEntry={openEntry} onResult={onResult} />}
              {modal === 'economy' && <Economy engine={engine} onClose={() => setModal(null)} onResult={onResult} />}
              {modal === 'advisors' && <Advisors engine={engine} onClose={() => setModal(null)} onResult={onResult} />}
              {modal === 'timeline' && <Timeline engine={engine} onClose={() => setModal(null)} />}
              {modal === 'crisis' && engine.state.crisis && (
                <Crisis
                  engine={engine}
                  onClose={() => setModal(null)}
                  onResult={(r) => {
                    onResult(r);
                    if (r.ok) {
                      sound.play('click');
                      setModal(null);
                    }
                  }}
                  openEntry={openEntry}
                />
              )}
              {modal === 'encyclopedia' && (
                <Sejarahpedia
                  initial={entry}
                  onClose={() => {
                    setModal(null);
                    setEntry(null);
                  }}
                />
              )}
              {modal === 'save' && <SaveLoad engine={engine} onClose={() => setModal(null)} onLoad={loadState} notify={(t, k) => pushToast(t, k)} />}
              {modal === 'settings' && (
                <Settings
                  onClose={() => setModal(null)}
                  setLang={setLang}
                  autosave={autosave}
                  gfx={gfx}
                  setGfx={setGfx}
                  setAutosave={setAutosave}
                  onMainMenu={() => {
                    setModal(null);
                    setSpeed(0);
                    setScreen('menu');
                  }}
                />
              )}
              {showVictory && (
                <Modal title={`🏆 ${i18n.t('era.victory')}`} onClose={() => setVictorySeen(true)} testId="modal-victory">
                  <p className="text-sm">{i18n.t('era.victoryBody')}</p>
                  <button className="btn-gold mt-3" onClick={() => setVictorySeen(true)}>
                    {i18n.t('era.keepPlaying')}
                  </button>
                </Modal>
              )}
            </div>
          </>
        )}
      </div>
    </I18nContext.Provider>
  );
}
