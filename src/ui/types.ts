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
