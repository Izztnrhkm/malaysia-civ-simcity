import { ReactNode, useEffect } from 'react';
import { useI18n } from '../../i18n/i18n';

export function Modal({ title, onClose, children, wide = false, testId }: { title: ReactNode; onClose: () => void; children: ReactNode; wide?: boolean; testId?: string }) {
  const { t } = useI18n();
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center bg-black/55 p-3" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-label={typeof title === 'string' ? title : undefined} data-testid={testId} className={`panel flex max-h-full w-full flex-col overflow-hidden ${wide ? 'max-w-6xl' : 'max-w-2xl'}`}>
        <div className="songket-border h-1.5 w-full" />
        <div className="flex items-center justify-between border-b border-songket-500/30 px-4 py-2">
          <h2 className="font-display text-lg font-bold text-songket-300">{title}</h2>
          <button className="btn px-2" onClick={onClose} aria-label={t('panel.close')} data-testid="modal-close">
            ✕
          </button>
        </div>
        <div className="scroll-thin overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}
