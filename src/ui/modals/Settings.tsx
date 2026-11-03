import { Lang } from '../../core/types';
import { useI18n } from '../../i18n/i18n';
import { Modal } from './Modal';

interface Props {
  onClose: () => void;
  setLang: (l: Lang) => void;
  autosave: boolean;
  setAutosave: (v: boolean) => void;
  onMainMenu: () => void;
}

export function Settings({ onClose, setLang, autosave, setAutosave, onMainMenu }: Props) {
  const { t, lang } = useI18n();
  return (
    <Modal title={`⚙ ${t('panel.settings')}`} onClose={onClose} testId="modal-settings">
      <div className="space-y-4 text-sm">
        <div>
          <div className="mb-1 font-semibold text-songket-300">{t('settings.language')}</div>
          <div className="flex gap-2">
            {(['ms', 'en'] as Lang[]).map((l) => (
              <button key={l} className={`btn ${lang === l ? 'btn-active' : ''}`} onClick={() => setLang(l)} data-testid={`lang-${l}`}>
                {l === 'ms' ? 'Bahasa Melayu' : 'English'}
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={autosave} onChange={(e) => setAutosave(e.target.checked)} />
          {t('settings.autosave')}
        </label>
        <div>
          <div className="mb-1 font-semibold text-songket-300">{t('settings.controls')}</div>
          <p className="opacity-85">{t('settings.controls.body')}</p>
        </div>
        <button className="btn" onClick={onMainMenu}>
          ⏏ {t('settings.mainMenu')}
        </button>
      </div>
    </Modal>
  );
}
