import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ReactNode } from 'react';
import { App } from '../../src/ui/App';
import { GameEngine } from '../../src/core/engine';
import { CRISIS_MAP } from '../../src/core/data/crises';
import { startCrisis } from '../../src/core/sim/crises';
import { I18nContext, makeI18n } from '../../src/i18n/i18n';
import { Advisors } from '../../src/ui/modals/Advisors';
import { Crisis } from '../../src/ui/modals/Crisis';
import { Timeline } from '../../src/ui/modals/Timeline';
import { SoundControl } from '../../src/ui/SoundControl';
import { SoundEngine } from '../../src/audio/soundEngine';

afterEach(() => cleanup());
beforeEach(() => localStorage.clear());

const wrap = (ui: ReactNode, lang: 'ms' | 'en' = 'en') => render(<I18nContext.Provider value={makeI18n(lang)}>{ui}</I18nContext.Provider>);
type Handle = { __tamadun: { engine: GameEngine; viewMode: string } };

describe('v2 main menu and HUD', () => {
  it('offers three scenarios and starts the 1875 Tin Rush in era 2', () => {
    render(<App />);
    fireEvent.click(screen.getByTestId('menu-lang-en'));
    for (const id of ['melaka_1400', 'larut_1875', 'msc_1996']) expect(screen.getByTestId(`scenario-${id}`)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('scenario-larut_1875'));
    expect(screen.getByTestId('scenario-desc')).toHaveTextContent(/railway/i);
    fireEvent.change(screen.getByTestId('seed'), { target: { value: '42' } });
    fireEvent.click(screen.getByTestId('start-game'));
    expect(screen.getByTestId('date')).toHaveTextContent('1875');
    const { engine } = (window as unknown as Handle).__tamadun;
    expect(engine.state.era).toBe(2);
    expect(engine.state.scenario).toBe('larut_1875');
  });

  it('falls back to the 2D classic view without WebGL and still offers the 3D toggle', () => {
    render(<App />);
    fireEvent.click(screen.getByTestId('start-game'));
    expect((window as unknown as Handle).__tamadun.viewMode).toBe('2d');
    expect(screen.getByTestId('game-canvas')).toBeInTheDocument();
    expect(screen.getByTestId('toggle-view')).toHaveTextContent('2D');
    fireEvent.click(screen.getByTestId('toggle-view'));
    // no WebGL in jsdom: stays on the classic view
    expect(screen.getByTestId('game-canvas')).toBeInTheDocument();
  });

  it('opens the advisors and timeline panels, and the phone drawer lists every panel', () => {
    render(<App />);
    fireEvent.click(screen.getByTestId('start-game'));
    for (const id of ['advisors', 'timeline']) {
      fireEvent.click(screen.getByTestId(`open-${id}`));
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      fireEvent.click(within(screen.getByRole('dialog')).getByTestId('modal-close'));
    }
    fireEvent.click(screen.getByTestId('menu-drawer'));
    const drawer = screen.getByTestId('menu-drawer-panel');
    expect(within(drawer).getAllByRole('button').length).toBe(9);
    fireEvent.click(within(drawer).getByTestId('drawer-open-economy'));
    expect(screen.getByTestId('modal-economy')).toBeInTheDocument();
  });

  it('collapses and expands the toolbar drawer', () => {
    render(<App />);
    fireEvent.click(screen.getByTestId('start-game'));
    fireEvent.click(screen.getByTestId('toolbar-collapse'));
    expect(screen.queryByTestId('tool-inspect')).toBeNull();
    fireEvent.click(screen.getByTestId('toolbar-expand'));
    expect(screen.getByTestId('tool-inspect')).toBeInTheDocument();
  });

  it('pops up a pending crisis and resolves it from the dialog', async () => {
    vi.useFakeTimers();
    render(<App />);
    fireEvent.click(screen.getByTestId('start-game'));
    const { engine } = (window as unknown as Handle).__tamadun;
    await act(async () => {
      engine.state.era = 2;
      engine.state.year = 1926;
      engine.tick();
    });
    expect(screen.getByTestId('modal-crisis')).toBeInTheDocument();
    expect(screen.getByTestId('crisis-button')).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByTestId('crisis-choice-2'));
    });
    expect(engine.state.crisis).toBeNull();
    expect(screen.queryByTestId('modal-crisis')).toBeNull();
    vi.useRealTimers();
  });
});

describe('v2 panels', () => {
  it('recruits and dismisses an advisor', () => {
    const e = GameEngine.newGame(42);
    const onResult = vi.fn();
    wrap(<Advisors engine={e} onClose={() => {}} onResult={onResult} />);
    expect(screen.getByTestId('advisor-slots')).toHaveTextContent('0/1');
    expect(screen.getByTestId('advisor-ungku_aziz')).toHaveTextContent(/another era/);
    act(() => {
      fireEvent.click(screen.getByTestId('recruit-tun_perak'));
    });
    expect(e.state.advisors).toEqual(['tun_perak']);
    expect(screen.getByTestId('advisor-slots')).toHaveTextContent('1/1');
    expect((screen.getByTestId('recruit-tun_sri_lanang') as HTMLButtonElement).disabled).toBe(true);
    act(() => {
      fireEvent.click(screen.getByTestId('dismiss-tun_perak'));
    });
    expect(e.state.advisors).toEqual([]);
  });

  it('shows bilingual crisis choices with costs and disables unaffordable ones', () => {
    const e = GameEngine.newGame(42);
    e.state.era = 4;
    startCrisis(e.state, e.ctx, CRISIS_MAP.krisis_kewangan);
    e.state.money = 1000;
    wrap(<Crisis engine={e} onClose={() => {}} onResult={() => {}} openEntry={() => {}} />, 'ms');
    expect(screen.getByTestId('modal-crisis')).toHaveTextContent('Krisis Kewangan Asia 1997');
    expect((screen.getByTestId('crisis-choice-2') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('crisis-choice-0') as HTMLButtonElement).disabled).toBe(false);
  });

  it('charts treasury, population and output as small multiples with a table view and milestones', () => {
    const e = GameEngine.newGame(42);
    for (let i = 0; i < 30; i++) e.tick();
    wrap(<Timeline engine={e} onClose={() => {}} />);
    for (const k of ['money', 'population', 'output']) expect(screen.getByTestId(`chart-${k}`)).toBeInTheDocument();
    for (const m of ['economic_hegemon', 'smart_nation', 'heritage_metropolis']) expect(screen.getByTestId(`milestone-${m}`)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('timeline-table-toggle'));
    expect(screen.getByTestId('timeline-table').querySelectorAll('tbody tr').length).toBe(e.state.history.length);
  });

  it('sound control toggles mute and exposes volume sliders', () => {
    const se = new SoundEngine(() => null);
    wrap(<SoundControl engine={se} />);
    const btn = screen.getByTestId('sound-button');
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    act(() => {
      fireEvent.click(btn);
    });
    expect(se.settings.muted).toBe(true);
    expect(screen.getByTestId('sound-button')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByTestId('sound-menu'));
    act(() => {
      fireEvent.change(screen.getByTestId('volume-music'), { target: { value: '25' } });
    });
    expect(se.settings.music).toBe(0.25);
  });
});
