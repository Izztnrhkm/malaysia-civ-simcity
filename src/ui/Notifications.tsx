import { useI18n } from '../i18n/i18n';
import { Toast } from './types';

const KIND_STYLE: Record<Toast['kind'], string> = {
  info: 'border-sky-400/50',
  good: 'border-emerald-400/60',
  bad: 'border-red-400/70',
  event: 'border-songket-300/80',
  era: 'border-songket-300 bg-songket-900/90',
};

export function Notifications({ toasts, dismiss, openEntry }: { toasts: Toast[]; dismiss: (id: number) => void; openEntry: (id: string) => void }) {
  const { t } = useI18n();
  return (
    <div className="pointer-events-none absolute bottom-2 left-[5rem] flex w-[22rem] max-w-[calc(100%-6rem)] flex-col-reverse gap-1.5" data-testid="notifications">
      {toasts.slice(-5).map((n) => (
        <div key={n.id} className={`panel pointer-events-auto border-l-4 p-2 text-xs ${KIND_STYLE[n.kind]}`} role="status">
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <div className="font-semibold text-songket-100">{n.text}</div>
              {n.body && <div className="mt-0.5 opacity-85">{n.body}</div>}
              {n.entry && (
                <button className="mt-1 text-songket-300 underline" onClick={() => openEntry(n.entry!)}>
                  📖 {t('info.readMore')}
                </button>
              )}
            </div>
            <button className="opacity-60 hover:opacity-100" onClick={() => dismiss(n.id)} aria-label={t('panel.close')}>
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
