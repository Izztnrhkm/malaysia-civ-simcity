import { GameEngine } from '../../src/core/engine';
import { BUILDING_MAP } from '../../src/core/data/buildings';
import { ERAS } from '../../src/core/data/eras';
import { RESEARCH_MAP } from '../../src/core/data/research';
import { canAdvanceEra, availableResearch } from '../../src/core/sim/research';
import { isBuildingUnlocked, isTransportUnlocked } from '../../src/core/sim/context';
import { T } from '../../src/core/types';

/** Simple scripted player used by soak tests to exercise every system. */
export class Bot {
  e: GameEngine;
  hub: [number, number] = [0, 0];
  roadsY: number[] = [];
  x0 = 0;
  x1 = 0;
  log: string[] = [];
  constructor(e: GameEngine) {
    this.e = e;
  }

  findSpot(defId: string, cx: number, cy: number, maxR = 40): [number, number] | null {
    for (let r = 0; r <= maxR; r++)
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = cx + dx;
          const y = cy + dy;
          if (this.e.checkBuilding(defId, x, y).ok) return [x, y];
        }
    return null;
  }

  build(defId: string, cx: number, cy: number, maxR = 40): boolean {
    if (!isBuildingUnlocked(this.e.state, defId)) return false;
    const s = this.findSpot(defId, cx, cy, maxR);
    if (!s) return false;
    const r = this.e.placeBuilding(defId, s[0], s[1]);
    if (r.ok) this.log.push(`t${this.e.state.tick} build ${defId} @${s}`);
    return r.ok;
  }

  setup(): void {
    const m = this.e.state.map;
    // river mouth = river tile with the smallest x
    let mouth: [number, number] = [20, m.height / 2];
    let bestX = Infinity;
    for (let i = 0; i < m.terrain.length; i++)
      if (m.terrain[i] === T.RIVER) {
        const x = i % m.width;
        if (x < bestX) {
          bestX = x;
          mouth = [x, (i / m.width) | 0];
        }
      }
    const port = this.findSpot('pelabuhan', mouth[0], mouth[1] - 3, 30)!;
    this.e.placeBuilding('pelabuhan', port[0], port[1]);
    this.hub = port;
    const [px, py] = port;
    this.x0 = px + 2;
    this.x1 = Math.min(m.width - 2, px + 52);
    const roadY = [py - 6, py + 1, py + 8];
    for (const y of roadY) {
      if (y < 1 || y >= m.height - 1) continue;
      this.e.buildTransport('road', this.x0, y, this.x1, y);
      this.roadsY.push(y);
    }
    for (let x = this.x0; x <= this.x1; x += 8) this.e.buildTransport('road', x, roadY[0], x, roadY[2]);
    const ps = this.findSpot('pasar', px + 6, py + 3);
    if (ps) this.e.placeBuilding('pasar', ps[0], ps[1]);
    this.zoneRows(18);
    for (let k = 0; k < 4; k++) this.build('sawah', px + 10 + k * 4, py + 12, 30);
    this.build('nelayan', mouth[0], mouth[1], 20);
    this.build('nelayan', mouth[0], mouth[1] + 4, 20);
    this.build('surau', px + 8, py - 3);
  }

  /** zone R above each road and a C / R / I mix below it, up to `len` tiles from the port */
  zoneRows(len: number): void {
    const span = Math.min(this.x1 - this.x0, len);
    for (const y of this.roadsY) {
      const xs = this.x0;
      this.e.zone('R', xs, y - 2, xs + span, y - 1, true);
      const c1 = xs + Math.round(span * 0.3);
      const c2 = xs + Math.round(span * 0.7);
      this.e.zone('C', xs, y + 1, c1, y + 2, true);
      this.e.zone('R', c1 + 1, y + 1, c2, y + 2, true);
      this.e.zone('I', c2 + 1, y + 1, xs + span, y + 2, true);
    }
  }

  zoneStrip(zone: 'R' | 'C' | 'I', offsetX: number, len: number, near = false): void {
    for (const y of this.roadsY) {
      const xs = this.x0 + offsetX;
      const xe = Math.min(this.x1, xs + len);
      if (near) this.e.zone(zone, xs, y + 1, xe, y + 1, true);
      else {
        this.e.zone(zone, xs, y - 2, xe, y - 1, true);
        this.e.zone(zone, xs, y + 1, xe, y + 2, true);
      }
    }
  }

  pickResearch(): void {
    const s = this.e.state;
    for (const kind of ['tech', 'civic'] as const) {
      const track = kind === 'tech' ? s.research : s.civics;
      if (track.current) continue;
      const req = ERAS[s.era].advance;
      const avail = availableResearch(s, kind);
      const prio = (id: string) => (req.techs.includes(id) || req.civics.includes(id) ? -1000 : 0) + RESEARCH_MAP[id].cost;
      avail.sort((a, b) => prio(a) - prio(b));
      if (avail[0]) this.e.setResearch(avail[0]);
    }
  }

  step(): void {
    const s = this.e.state;
    const [px, py] = this.hub;
    this.pickResearch();
    if (canAdvanceEra(s)) {
      this.e.advanceEra();
      this.log.push(`t${s.tick} ERA -> ${s.era} year ${s.year}`);
    }
    if (s.tick % 10 !== 0) return;
    const d = s.derived;
    const lm = ERAS[s.era].advance.landmark;
    if (!s.buildings.some((b) => b.def === lm) && s.money > BUILDING_MAP[lm].cost * 1.1) this.build(lm, px + 12, py - 12, 50);
    if (d.foodSatisfaction < 0.98 && s.money > 400) this.build('sawah', px + 14, py + 16, 50);
    if ((d.demand.R > 20 || d.demand.C > 30 || d.demand.I > 30) && s.money > 2000) {
      const m = s.map;
      const ny = this.roadsY[this.roadsY.length - 1] + 7;
      if (ny < m.height - 3 && this.roadsY.length < 22) {
        this.e.buildTransport('road', this.x0, ny, this.x1, ny);
        this.e.buildTransport('road', this.x0, ny - 7, this.x0, ny);
        this.e.buildTransport('road', this.x1, ny - 7, this.x1, ny);
        this.roadsY.push(ny);
      }
      this.zoneRows(18 + s.tick / 6);
    }
    const want: Record<number, string[]> = {
      1: ['gudang', 'madrasah', 'masjid', 'syahbandar', 'pendulang', 'kebun_lada', 'balai', 'taman', 'relau_besi', 'pembalakan', 'limbungan', 'candi'],
      2: ['pelabuhan_dagang', 'lombong', 'estet_getah', 'sekolah', 'hospital', 'balai_polis', 'pejabat_pos', 'kapal_korek'],
      3: ['janakuasa', 'loji_air', 'universiti', 'ftz', 'pelabuhan_kontena', 'klinik_desa', 'ladang_sawit', 'kilang_kereta', 'empangan'],
      4: ['pusat_data', 'ladang_solar', 'hab_inovasi', 'menara_telekom', 'lapangan_terbang', 'kitar_semula'],
    };
    for (let e = 1; e <= s.era; e++)
      for (const id of want[e]) {
        const count = s.buildings.filter((b) => b.def === id).length;
        const limit = id === 'janakuasa' || id === 'loji_air' ? Math.ceil(d.power.demand / 500) + 1 : e === s.era ? 2 : 1;
        if (count < limit && s.money > BUILDING_MAP[id].cost * 1.5) this.build(id, px + 10, py, 60);
      }
    if (s.era >= 2 && isTransportUnlocked(s, 'rail') && !s.buildings.some((b) => b.def === 'stesen')) {
      const y = this.roadsY[0] - 2;
      this.e.buildTransport('rail', this.x0, y, Math.min(s.map.width - 2, this.x1 + 20), y);
      this.build('stesen', this.x0 + 3, y + 1, 10);
    }
    if (s.money < 0 && s.debt < 5000) this.e.takeLoan(2000);
  }
}
