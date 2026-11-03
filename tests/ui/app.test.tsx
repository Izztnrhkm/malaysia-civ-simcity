import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { App } from '../../src/ui/App';
import { GameEngine } from '../../src/core/engine';
import { I18nContext, makeI18n } from '../../src/i18n/i18n';
import { ResearchTree } from '../../src/ui/modals/ResearchTree';
import { Diplomacy } from '../../src/ui/modals/Diplomacy';
import { Economy } from '../../src/ui/modals/Economy';
import { EraPanel } from '../../src/ui/modals/EraPanel';
import { Sejarahpedia } from '../../src/ui/modals/Sejarahpedia';
import { SaveLoad } from '../../src/ui/modals/SaveLoad';
import { Toolbar } from '../../src/ui/Toolbar';
import { ReactNode } from 'react';
import { saveToSlot } from '../../src/core/save/save';

afterEach(() => cleanup());
beforeEach(() => localStorage.clear());

const wrap = (ui: ReactNode, lang: 'ms' | 'en' = 'en') => render(<I18nContext.Provider value={makeI18n(lang)}>{ui}</I18nContext.Provider>);

describe('App shell', () => {
  it('shows the bilingual main menu and switches language', () => {
    render(<App />);
    expect(screen.getByTestId('main-menu')).toBeInTheDocument();
    expect(screen.getByText(/Mula Membina/)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('menu-lang-en'));
    expect(screen.getByText(/Start Building/)).toBeInTheDocument();
    expect(localStorage.getItem('tamadun-kota:lang')).toBe('en');
  });

  it('starts a new game with HUD, toolbar and minimap, and opens every panel', () => {
    render(<App />);
    fireEvent.change(screen.getByTestId('city-name'), { target: { value: 'Kuala Ujian' } });
    fireEvent.change(screen.getByTestId('seed'), { target: { value: '42' } });
    fireEvent.click(screen.getByTestId('start-game'));
    expect(screen.getByTestId('topbar')).toHaveTextContent('Kuala Ujian');
    expect(screen.getByTestId('date')).toHaveTextContent('1400');
    expect(screen.getByTestId('toolbar')).toBeInTheDocument();
    expect(screen.getByTestId('minimap')).toBeInTheDocument();
    for (const id of ['tech', 'civics', 'diplomacy', 'economy', 'encyclopedia', 'save', 'settings', 'era']) {
      fireEvent.click(id === 'era' ? screen.getByTestId('era-button') : screen.getByTestId(`open-${id}`));
      const modal = screen.getByRole('dialog');
      expect(modal).toBeInTheDocument();
      fireEvent.click(within(modal).getByTestId('modal-close'));
      expect(screen.queryByRole('dialog')).toBeNull();
    }
  });

  it('runs the simulation when unpaused', async () => {
    vi.useFakeTimers();
    render(<App />);
    fireEvent.change(screen.getByTestId('seed'), { target: { value: '42' } });
    fireEvent.click(screen.getByTestId('start-game'));
    const handle = (window as unknown as { __tamadun: { engine: GameEngine } }).__tamadun;
    const before = handle.engine.state.tick;
    fireEvent.click(screen.getByTestId('speed-3'));
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(handle.engine.state.tick).toBeGreaterThan(before + 5);
    fireEvent.click(screen.getByTestId('speed-0'));
    const paused = handle.engine.state.tick;
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(handle.engine.state.tick).toBe(paused);
    vi.useRealTimers();
  });

  it('loads a saved game from the main menu', () => {
    const e = GameEngine.newGame(5, 'Bandar Tersimpan', 48);
    saveToSlot(e.state, 'slot1');
    render(<App />);
    fireEvent.click(screen.getByTestId('menu-load'));
    fireEvent.click(screen.getByTestId('load-slot1'));
    expect(screen.getByTestId('topbar')).toHaveTextContent('Bandar Tersimpan');
  });
});

describe('panels', () => {
  it('toolbar opens the build menu and selects a building', () => {
    const e = GameEngine.newGame(42, 'x', 48);
    const setTool = vi.fn();
    wrap(<Toolbar engine={e} tool={{ kind: 'inspect' }} setTool={setTool} />);
    fireEvent.click(screen.getByTestId('cat-trade'));
    expect(screen.getByTestId('build-menu')).toHaveTextContent('Entrepôt Harbour');
    fireEvent.click(screen.getByTestId('build-pelabuhan'));
    expect(setTool).toHaveBeenCalledWith({ kind: 'building', id: 'pelabuhan' });
    expect(screen.getByTestId('build-gudang')).toBeDisabled();
    fireEvent.click(screen.getByTestId('tool-zone-R'));
    expect(setTool).toHaveBeenCalledWith({ kind: 'zone', zone: 'R' });
  });

  it('tech tree selects research and civics adopt policies', () => {
    const e = GameEngine.newGame(42, 'x', 48);
    const onResult = vi.fn();
    const { unmount } = wrap(<ResearchTree engine={e} kind="tech" onClose={() => {}} openEntry={() => {}} onResult={onResult} />);
    fireEvent.click(screen.getByTestId('research-navigasi_monsun'));
    expect(e.state.research.current).toBe('navigasi_monsun');
    unmount();
    e.state.civics.done.push('gotong_royong');
    wrap(<ResearchTree engine={e} kind="civic" onClose={() => {}} openEntry={() => {}} onResult={onResult} />);
    fireEvent.click(screen.getByTestId('policy-gotong_royong'));
    expect(e.state.policies).toContain('gotong_royong');
  });

  it('diplomacy sends envoys and proposes deals', () => {
    const e = GameEngine.newGame(42, 'x', 48);
    wrap(<Diplomacy engine={e} onClose={() => {}} openEntry={() => {}} onResult={() => {}} />);
    fireEvent.click(screen.getByTestId('partner-gujerat'));
    const r0 = e.state.partners.gujerat.relation;
    fireEvent.click(screen.getByTestId('send-envoy'));
    expect(e.state.partners.gujerat.relation).toBeGreaterThan(r0);
    fireEvent.click(screen.getByTestId('propose-deal'));
    expect(e.state.deals).toHaveLength(1);
    expect(screen.getAllByTestId('deal-row')).toHaveLength(1);
  });

  it('economy panel changes taxes and lists goods', () => {
    const e = GameEngine.newGame(42, 'x', 48);
    wrap(<Economy engine={e} onClose={() => {}} onResult={() => {}} />);
    fireEvent.change(screen.getByTestId('tax-R'), { target: { value: '14' } });
    expect(e.state.tax.R).toBe(14);
    expect(screen.getByTestId('goods-table')).toHaveTextContent('Rice');
  });

  it('era panel lists requirements and blocks early advance', () => {
    const e = GameEngine.newGame(42, 'x', 48);
    wrap(<EraPanel engine={e} onClose={() => {}} openEntry={() => {}} />, 'ms');
    expect(screen.getByTestId('era-reqs')).toHaveTextContent('Istana Kesultanan');
    expect(screen.getByTestId('advance-era')).toBeDisabled();
  });

  it('Sejarahpedia searches and opens entries in either language', () => {
    wrap(<Sejarahpedia initial="kereta_api" onClose={() => {}} />, 'en');
    expect(screen.getByTestId('enc-article')).toHaveTextContent('Taiping');
    fireEvent.change(screen.getByTestId('enc-search'), { target: { value: 'Zheng' } });
    fireEvent.click(screen.getByTestId('enc-item-zheng_he'));
    expect(screen.getByTestId('enc-article')).toHaveTextContent('Ming');
  });

  it('save/load panel writes slots', () => {
    const e = GameEngine.newGame(42, 'Simpanan', 48);
    const notify = vi.fn();
    wrap(<SaveLoad engine={e} onClose={() => {}} onLoad={() => {}} notify={notify} />);
    fireEvent.click(screen.getByTestId('save-slot3'));
    expect(notify).toHaveBeenCalledWith('Game saved.', 'good');
    expect(screen.getByTestId('slot-slot3')).toHaveTextContent('Simpanan');
  });
});
