import { useRef, useState } from 'react';
import { GameEngine } from '../../core/engine';
import { ERAS } from '../../core/data/eras';
import { GameState, EraId } from '../../core/types';
import { SLOT_IDS, SlotId, deleteSlot, deserialize, listSlots, loadFromSlot, saveToSlot, toJSON } from '../../core/save/save';
import { formatNumber, useI18n } from '../../i18n/i18n';
import { Modal } from './Modal';

interface Props {
  engine: GameEngine | null;
  onClose: () => void;
  onLoad: (s: GameState) => void;
  notify: (text: string, kind?: 'good' | 'bad') => void;
}

export function SaveLoad({ engine, onClose, onLoad, notify }: Props) {
  const { t, L } = useI18n();
  const [slots, setSlots] = useState(listSlots);
  const [confirming, setConfirming] = useState<SlotId | null>(null);
  const [paste, setPaste] = useState('');
  const [showPaste, setShowPaste] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const refresh = () => setSlots(listSlots());

  const doSave = (id: SlotId) => {
    if (!engine) return;
    const slot = slots.find((s) => s.id === id);
    // in-page confirmation (native confirm dialogs are unavailable in some embeds)
    if (slot && !slot.empty && confirming !== id) {
      setConfirming(id);
      return;
    }
    setConfirming(null);
    try {
      saveToSlot(engine.state, id);
      notify(t('save.saved'), 'good');
      refresh();
    } catch (e) {
      notify(`${t('save.error')}: ${(e as Error).message}`, 'bad');
    }
  };
  const doLoad = (id: SlotId) => {
    try {
      onLoad(loadFromSlot(id));
      notify(t('save.loaded'), 'good');
      onClose();
    } catch (e) {
      notify(`${t('save.error')}: ${(e as Error).message}`, 'bad');
    }
  };
  const loadText = (text: string) => {
    try {
      onLoad(deserialize(text));
      notify(t('save.loaded'), 'good');
      onClose();
    } catch (e) {
      notify(`${t('save.error')}: ${(e as Error).message}`, 'bad');
    }
  };
  const doExport = () => {
    if (!engine) return;
    const blob = new Blob([toJSON(engine.state)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `tamadun-kota-${engine.state.name.replace(/\W+/g, '_')}-${engine.state.year}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const doCopy = () => {
    if (!engine) return;
    const json = toJSON(engine.state);
    navigator.clipboard
      ?.writeText(json)
      .then(() => notify(t('save.copied'), 'good'))
      .catch(() => {
        setPaste(json);
        setShowPaste(true);
        notify(t('save.copyFallback'));
      });
  };

  return (
    <Modal title={`💾 ${t('panel.save')}`} onClose={onClose} testId="modal-save">
      <div className="mb-2 font-semibold text-songket-300">{t('save.slots')}</div>
      <div className="space-y-2">
        {SLOT_IDS.map((id) => {
          const s = slots.find((x) => x.id === id)!;
          return (
            <div key={id} className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-black/20 p-2 text-sm" data-testid={`slot-${id}`}>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{id === 'autosave' ? t('save.autosave') : `Slot ${id.slice(-1)}`}</div>
                {s.empty ? (
                  <div className="text-xs opacity-60">{t('save.empty')}</div>
                ) : (
                  <div className="text-xs opacity-80">
                    {s.name} · Era {s.era} {s.era ? L(ERAS[s.era as EraId].short) : ''} · {s.year} · 👥 {formatNumber(s.population ?? 0)} · {s.savedAt ? new Date(s.savedAt).toLocaleString() : ''}
                  </div>
                )}
              </div>
              {id !== 'autosave' && engine && (
                <button className={confirming === id ? 'btn-gold' : 'btn'} onClick={() => doSave(id)} data-testid={`save-${id}`}>
                  {confirming === id ? t('save.confirmOverwrite') : t('save.save')}
                </button>
              )}
              <button className="btn" disabled={s.empty} onClick={() => doLoad(id)} data-testid={`load-${id}`}>
                {t('save.load')}
              </button>
              <button
                className="btn"
                disabled={s.empty}
                onClick={() => {
                  deleteSlot(id);
                  refresh();
                }}
              >
                {t('save.delete')}
              </button>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {/* file downloads are unavailable in the embedded (artifact) build; copy/paste JSON covers it */}
        {import.meta.env.MODE !== 'artifact' && (
          <button className="btn-gold" disabled={!engine} onClick={doExport} data-testid="export-json">
            ⬇️ {t('save.export')}
          </button>
        )}
        <button className="btn" disabled={!engine} onClick={doCopy} data-testid="copy-json">
          📋 {t('save.copy')}
        </button>
        <button className="btn" onClick={() => fileRef.current?.click()} data-testid="import-json">
          ⬆️ {t('save.import')}
        </button>
        <button className="btn" onClick={() => setShowPaste((v) => !v)} data-testid="paste-toggle">
          📥 {t('save.paste')}
        </button>
        <input
          ref={fileRef}
          id="import-file"
          type="file"
          accept="application/json,.json"
          className="hidden"
          data-testid="import-file"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void f.text().then(loadText);
            e.target.value = '';
          }}
        />
      </div>
      {showPaste && (
        <div className="mt-3">
          <label htmlFor="paste-json" className="text-xs opacity-80">
            {t('save.pasteHelp')}
          </label>
          <textarea
            id="paste-json"
            className="mt-1 h-28 w-full rounded bg-black/40 p-2 font-mono text-[11px]"
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            onFocus={(e) => e.target.select()}
            data-testid="paste-json"
          />
          <button className="btn-gold mt-1" disabled={!paste.trim()} onClick={() => loadText(paste)} data-testid="paste-load">
            {t('save.load')}
          </button>
        </div>
      )}
    </Modal>
  );
}
