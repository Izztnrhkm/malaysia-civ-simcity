import { TransportKey, ZoneKey } from '../core/types';

export type Tool =
  | { kind: 'inspect' }
  | { kind: 'bulldoze' }
  | { kind: 'zone'; zone: ZoneKey | 'none' }
  | { kind: 'transport'; key: TransportKey }
  | { kind: 'building'; id: string };

export type ModalId = 'tech' | 'civics' | 'diplomacy' | 'economy' | 'encyclopedia' | 'save' | 'settings' | 'era' | null;

export interface Toast {
  id: number;
  text: string;
  body?: string;
  kind: 'info' | 'good' | 'bad' | 'event' | 'era';
  entry?: string;
  at: number;
}

export const SPEED_TPS = [0, 1, 2.5, 6];

export type ViewMode = '3d' | '2d';

/** Camera operations shared by the 2D canvas and the 3D view. */
export interface ViewController {
  mode: ViewMode;
  centerOn: (tx: number, ty: number) => void;
  /** pan by screen-aligned amounts (tiles in 3D, world px in 2D) */
  pan: (dx: number, dy: number) => void;
  zoom: (factor: number) => void;
  rotate?: (angle: number) => void;
  resetCamera: () => void;
  /** page coordinates of a tile centre */
  tileToScreen: (x: number, y: number) => { x: number; y: number };
  pick?: (clientX: number, clientY: number) => { x: number; y: number } | null;
  view?: unknown;
}
