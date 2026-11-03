import { useState, useSyncExternalStore } from 'react';
import { SoundEngine } from '../audio/soundEngine';
import { useI18n } from '../i18n/i18n';

/** Mute toggle with a small volume popover (master, music, effects). */
export function SoundControl({ engine }: { engine: SoundEngine }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const settings = useSyncExternalStore(
    (fn) => engine.subscribe(fn),
    () => JSON.stringify(engine.settings),
  );
  const s = JSON.parse(settings) as SoundEngine['settings'];
  const slider = (kind: 'volume' | 'music' | 'sfx', label: string) => (
    <label className="flex items-center gap-2 text-xs">
      <span className="w-16 opacity-80">{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(s[kind] * 100)}
        onChange={(e) => engine.setVolume(kind, Number(e.target.value) / 100)}
        className="w-28 accent-amber-400"
        data-testid={`volume-${kind}`}
        aria-label={label}
      />
    </label>
  );
  return (
    <div className="relative">
      <div className="flex">
        <button
          className="btn rounded-r-none px-2"
          onClick={() => {
            engine.unlock();
            engine.toggleMute();
          }}
          title={s.muted ? t('sound.unmute') : t('sound.mute')}
          aria-label={s.muted ? t('sound.unmute') : t('sound.mute')}
          aria-pressed={s.muted}
          data-testid="sound-button"
        >
          {s.muted ? '🔇' : '🔊'}
        </button>
        <button className="btn rounded-l-none border-l-0 px-1 text-xs" onClick={() => setOpen((o) => !o)} aria-label={t('sound.volume')} aria-expanded={open} data-testid="sound-menu">
          ▾
        </button>
      </div>
      {open && (
        <div className="panel absolute right-0 top-full z-30 mt-1 space-y-1.5 p-2" data-testid="sound-popover">
          {slider('volume', t('sound.master'))}
          {slider('music', t('sound.music'))}
          {slider('sfx', t('sound.sfx'))}
        </div>
      )}
    </div>
  );
}
