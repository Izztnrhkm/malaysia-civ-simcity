import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GameEngine } from '../core/engine';
import { saveToSlot } from '../core/save/save';
import { CommandResult, GameState, Lang, T } from '../core/types';
import { Overlay, Renderer } from '../render/renderer';
import { I18nContext, makeI18n, noticeText, translate } from '../i18n/i18n';
import { GameCanvas } from './GameCanvas';
import { useGameLoop, useInterval } from './hooks';
import { InfoPanel } from './InfoPanel';
import { MainMenu } from './MainMenu';
import { Minimap } from './Minimap';
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
import { ModalId, SPEED_TPS, Toast, Tool } from './types';

const LANG_KEY = 'tamadun-kota:lang';

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

export function App() {
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
  const [victorySeen, setVictorySeen] = useState(false);
  const [menuLoad, setMenuLoad] = useState(false);
  const toastId = useRef(1);
  const lastNotice = useRef(0);
  const langRef = useRef(lang);
  langRef.current = lang;

  const pushToast = useCallback((text: string, kind: Toast['kind'] = 'info', body?: string, entryId?: string) => {
    const id = toastId.current++;
    setToasts((ts) => [...ts.slice(-8), { id, text, kind, body, entry: entryId, at: Date.now() }]);
  }, []);

  const onResult = useCallback(
    (r: CommandResult) => {
      if (!r.ok && r.reason) pushToast(translate(langRef.current, r.reason), 'bad');
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

  const startNew = (name: string, seed: number) => {
    const e = GameEngine.newGame(seed, name);
    startEngine(e);
    setSpeed(1);
    pushToast(translate(lang, 'menu.howto'), 'info', [1, 2, 3, 4].map((i) => `${i}. ${translate(lang, `menu.howto.${i}`)}`).join(' '));
  };

  const loadState = (s: GameState) => {
    startEngine(new GameEngine(s));
    setSpeed(0);
  };

  useGameLoop(screen === 'game' && !modal ? engine : null, SPEED_TPS[speed], (err) => {
    setSpeed(0);
    pushToast(`Error: ${(err as Error).message}`, 'bad');
  });

  // turn engine notices into toasts
  useEffect(() => {
    if (!engine) return;
    return engine.subscribe(() => {
      const ns = engine.state.notices.filter((n) => n.id > lastNotice.current);
      if (!ns.length) return;
      lastNotice.current = ns[ns.length - 1].id;
      for (const n of ns) {
        const txt = noticeText(langRef.current, n);
        pushToast(txt.title, n.kind, txt.body, n.entry);
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

  // keyboard
  useEffect(() => {
    if (screen !== 'game' || !engine) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'SELECT') return;
      const step = 60 / renderer.camera.zoom;
      const cam = renderer.camera;
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
          renderer.camera = { ...cam, y: cam.y - step };
          break;
        case 'ArrowDown':
        case 's':
          renderer.camera = { ...cam, y: cam.y + step };
          break;
        case 'ArrowLeft':
        case 'a':
          renderer.camera = { ...cam, x: cam.x - step };
          break;
        case 'ArrowRight':
        case 'd':
          renderer.camera = { ...cam, x: cam.x + step };
          break;
        case '+':
        case '=':
          renderer.camera = { ...cam, zoom: Math.min(2.5, cam.zoom * 1.15) };
          break;
        case '-':
          renderer.camera = { ...cam, zoom: Math.max(0.35, cam.zoom / 1.15) };
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

  // debug / automation handle used by the E2E smoke test
  useEffect(() => {
    (window as unknown as { __tamadun?: unknown }).__tamadun = { engine, renderer, setSpeed, setTool };
  }, [engine, renderer]);

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
            <GameCanvas engine={engine} renderer={renderer} tool={tool} onSelect={setSelected} onResult={onResult} onCancelTool={() => setTool({ kind: 'inspect' })} />
            <div className="pointer-events-none absolute inset-0">
              <TopBar engine={engine} speed={speed} setSpeed={setSpeed} openModal={(m) => setModal(m)} />
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
              <Minimap engine={engine} renderer={renderer} overlay={overlay} setOverlay={setOverlay} />
              <Notifications toasts={toasts} dismiss={(id) => setToasts((ts) => ts.filter((x) => x.id !== id))} openEntry={openEntry} />
              {modal === 'tech' && <ResearchTree engine={engine} kind="tech" onClose={() => setModal(null)} openEntry={openEntry} onResult={onResult} />}
              {modal === 'civics' && <ResearchTree engine={engine} kind="civic" onClose={() => setModal(null)} openEntry={openEntry} onResult={onResult} />}
              {modal === 'era' && <EraPanel engine={engine} onClose={() => setModal(null)} openEntry={openEntry} />}
              {modal === 'diplomacy' && <Diplomacy engine={engine} onClose={() => setModal(null)} openEntry={openEntry} onResult={onResult} />}
              {modal === 'economy' && <Economy engine={engine} onClose={() => setModal(null)} onResult={onResult} />}
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
