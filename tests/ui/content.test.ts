import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { STRINGS } from '../../src/i18n/strings';
import { ENTRIES, ENTRY_MAP } from '../../src/content/sejarahpedia';
import { BUILDINGS } from '../../src/core/data/buildings';
import { ALL_RESEARCH } from '../../src/core/data/research';
import { EVENTS } from '../../src/core/data/events';
import { PARTNERS } from '../../src/core/data/partners';
import { ERAS } from '../../src/core/data/eras';
import { ERA_IDS } from '../../src/core/types';
import { noticeText, translate } from '../../src/i18n/i18n';

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(p) ? [p] : [];
  });
}

describe('i18n', () => {
  it('Malay and English dictionaries have exactly the same keys and no empty strings', () => {
    const ms = Object.keys(STRINGS.ms).sort();
    const en = Object.keys(STRINGS.en).sort();
    expect(ms).toEqual(en);
    for (const k of ms) {
      expect((STRINGS.ms as Record<string, string>)[k].length, k).toBeGreaterThan(0);
      expect((STRINGS.en as Record<string, string>)[k].length, k).toBeGreaterThan(0);
    }
  });

  it('every literal translation key and error reason used in the source exists', () => {
    const src = walk(join(__dirname, '../../src'));
    const keys = new Set<string>();
    for (const f of src) {
      const text = readFileSync(f, 'utf8');
      for (const m of text.matchAll(/\bt\('([a-zA-Z0-9_.]+)'/g)) keys.add(m[1]);
      for (const m of text.matchAll(/reason: '([a-zA-Z0-9_.]+)'/g)) keys.add(m[1]);
      for (const m of text.matchAll(/notify\(state, '[a-z]+', '([a-zA-Z0-9_.]+)'/g)) keys.add(m[1]);
    }
    expect(keys.size).toBeGreaterThan(60);
    const missing = [...keys].filter((k) => !(k in STRINGS.ms));
    expect(missing).toEqual([]);
  });

  it('interpolates parameters and falls back to the key', () => {
    expect(translate('en', 'notice.offer', { name: 'Ming China' })).toBe('New offer from Ming China');
    expect(translate('ms', 'no.such.key')).toBe('no.such.key');
  });

  it('formats engine notices in both languages', () => {
    const n = { id: 1, tick: 0, kind: 'event' as const, key: 'event.zheng_he' };
    expect(noticeText('ms', n).title).toContain('Cheng Ho');
    expect(noticeText('en', n).title).toContain('Zheng He');
    expect(noticeText('en', { id: 2, tick: 0, kind: 'good', key: 'notice.techDone', params: { id: 'kereta_api' } }).title).toBe('Technology complete: Railways');
  });
});

describe('Sejarahpedia', () => {
  it('has bilingual entries with sources', () => {
    expect(ENTRIES.length).toBeGreaterThanOrEqual(35);
    for (const e of ENTRIES) {
      expect(e.title.ms && e.title.en, e.id).toBeTruthy();
      expect(e.body.ms.length, e.id).toBeGreaterThan(0);
      expect(e.body.en.length, e.id).toBe(e.body.ms.length);
      expect(e.inGame.ms && e.inGame.en).toBeTruthy();
      expect(e.sources.length, e.id).toBeGreaterThan(0);
      for (const s of e.sources) expect(s.url).toMatch(/^https:\/\//);
      for (const r of e.related) expect(ENTRY_MAP[r], `${e.id} -> ${r}`).toBeDefined();
    }
  });

  it('every entry referenced by game content exists', () => {
    const refs = [
      ...BUILDINGS.map((b) => b.entry),
      ...ALL_RESEARCH.map((r) => r.entry),
      ...EVENTS.map((e) => e.entry),
      ...PARTNERS.map((p) => p.entry),
      ...ERA_IDS.map((e) => ERAS[e].entry),
    ].filter(Boolean) as string[];
    expect(refs.length).toBeGreaterThan(40);
    for (const r of refs) expect(ENTRY_MAP[r], r).toBeDefined();
  });

  it('records disputed dates rather than asserting a single value', () => {
    expect(ENTRY_MAP.sungai_batu.body.en.join(' ')).toMatch(/2nd to 10th/);
    expect(ENTRY_MAP.getah.body.en.join(' ')).toMatch(/Hugh Low/);
    expect(ENTRY_MAP.zheng_he.body.en.join(' ')).toMatch(/Sources differ/);
  });
});
