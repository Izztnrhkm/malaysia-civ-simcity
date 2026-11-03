import { DayMode, WeatherMode } from '../render3d/world';
import { useI18n } from '../i18n/i18n';

interface Props {
  dayMode: DayMode;
  setDayMode: (m: DayMode) => void;
  weather: WeatherMode;
  setWeather: (w: WeatherMode) => void;
  onReset: () => void;
  onRotate: (angle: number) => void;
}

const DAY_ICON: Record<DayMode, string> = { day: '☀️', night: '🌙', cycle: '🌗' };
const WEATHER_ICON: Record<WeatherMode, string> = { auto: '⛅', clear: '🌤️', rain: '🌧️' };
const nextOf = <T,>(list: T[], v: T) => list[(list.indexOf(v) + 1) % list.length];

/** Floating 3D camera, day/night and weather controls. */
export function ViewControls({ dayMode, setDayMode, weather, setWeather, onReset, onRotate }: Props) {
  const { t } = useI18n();
  return (
    <div className="panel pointer-events-auto absolute right-2 top-1/2 flex -translate-y-1/2 flex-col gap-1 p-1" data-testid="view-controls">
      <button className="btn px-2" onClick={onReset} title={t('view.reset')} aria-label={t('view.reset')} data-testid="camera-reset">
        🎯
      </button>
      <button className="btn px-2" onClick={() => onRotate(Math.PI / 4)} title={t('view.rotateLeft')} aria-label={t('view.rotateLeft')}>
        ⟲
      </button>
      <button className="btn px-2" onClick={() => onRotate(-Math.PI / 4)} title={t('view.rotateRight')} aria-label={t('view.rotateRight')}>
        ⟳
      </button>
      <button
        className="btn px-2"
        onClick={() => setDayMode(nextOf<DayMode>(['day', 'night', 'cycle'], dayMode))}
        title={`${t('view.daynight')}: ${t(`view.day.${dayMode}`)}`}
        aria-label={t('view.daynight')}
        data-testid="toggle-daynight"
      >
        {DAY_ICON[dayMode]}
      </button>
      <button
        className="btn px-2"
        onClick={() => setWeather(nextOf<WeatherMode>(['auto', 'rain', 'clear'], weather))}
        title={`${t('view.weather')}: ${t(`view.weather.${weather}`)}`}
        aria-label={t('view.weather')}
        data-testid="toggle-weather"
      >
        {WEATHER_ICON[weather]}
      </button>
    </div>
  );
}
