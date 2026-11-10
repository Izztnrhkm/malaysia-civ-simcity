/**
 * Exports the web game's data tables to JSON for the Unity project
 * (unity-tamadun-kota/Assets/Resources/GameData, loaded with Resources.Load at runtime), so both games share one source
 * of truth. The output is shaped for UnityEngine.JsonUtility: every file is an
 * object with an `items` array, maps become arrays of {key, value} records,
 * bilingual text becomes flat `...Ms` / `...En` fields and missing numbers are 0.
 * The UI strings go to unity-tamadun-kota/Assets/Resources/Localization/{ms,en}.json.
 *
 *   npx vite-node scripts/export-unity-data.ts      (npm run unity:data)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ADVISORS } from '../src/core/data/advisors';
import { BUILDINGS, TRANSPORTS, ZONE_CAPACITY, ZONE_NAMES } from '../src/core/data/buildings';
import { CRISES } from '../src/core/data/crises';
import { Effects } from '../src/core/data/effects';
import { ERAS } from '../src/core/data/eras';
import { EVENTS, EventEffect } from '../src/core/data/events';
import { GOOD_DEFS } from '../src/core/data/goods';
import { PARTNERS } from '../src/core/data/partners';
import { ALL_RESEARCH, POLICIES, STARTING_BUILDINGS } from '../src/core/data/research';
import { CATEGORY_NAMES, ENTRIES, ENTRY_MAP } from '../src/content/sejarahpedia';
import { SCENARIOS } from '../src/core/scenarios';
import { MILESTONES } from '../src/core/sim/milestones';
import { GOODS, EraId } from '../src/core/types';
import { STRINGS } from '../src/i18n/strings';

const OUT = 'unity-tamadun-kota/Assets/Resources/GameData';
mkdirSync(OUT, { recursive: true });

/** Footprint in metres: the Unity grid uses 1 unit = 1 m and 4 m cells. */
export const FOOTPRINT_M: Record<number, number> = { 1: 4, 2: 8, 3: 16 };

const kv = (o: Record<string, number | undefined> | undefined) => Object.entries(o ?? {}).map(([key, value]) => ({ key, value: value ?? 0 }));

function effects(e: Effects | undefined) {
  return {
    production: kv(e?.production),
    productionAll: e?.productionAll ?? 0,
    exportCap: e?.exportCap ?? 0,
    exportPrice: e?.exportPrice ?? 0,
    tax: e?.tax ?? 0,
    research: e?.research ?? 0,
    culture: e?.culture ?? 0,
    happiness: e?.happiness ?? 0,
    pollution: e?.pollution ?? 0,
    growth: e?.growth ?? 0,
    upkeep: e?.upkeep ?? 0,
    construction: e?.construction ?? 0,
    relationGain: e?.relationGain ?? 0,
  };
}

function eventEffect(e: EventEffect) {
  return {
    duration: e.duration ?? 0,
    priceMult: kv(e.priceMult),
    productionMult: e.productionMult ?? 1,
    happiness: e.happiness ?? 0,
    research: e.research ?? 0,
    money: e.money ?? 0,
    researchOnce: e.research_once ?? 0,
    relations: kv(e.relations),
    grantCivic: e.grantCivic ?? '',
    flood: !!e.flood,
    exportCapMult: e.exportCapMult ?? 1,
  };
}

/**
 * Unity-only buildings that extend the eras described in the GDD (oil & gas,
 * vertical farming, AI hubs). Unlocked by existing technologies so the 41-tech
 * tree is unchanged. Their models are built procedurally in the Blender script.
 */
const UNITY_EXTRA = [
  {
    id: 'kilang_minyak', era: 3, category: 'production', size: 3, cost: 22000, upkeep: 24, jobs: 120, produces: { barang: 10 }, power: 300, pollution: 70, placement: 'coast',
    name: { ms: 'Loji Penapisan Minyak', en: 'Oil Refinery' }, desc: { ms: 'Menapis minyak mentah dari pelantar luar pesisir menjadi bahan api dan petrokimia.', en: 'Refines crude from offshore platforms into fuel and petrochemicals.' }, unlockedBy: 'elektrik_negara',
  },
  {
    id: 'pelantar_minyak', era: 3, category: 'production', size: 2, cost: 30000, upkeep: 30, jobs: 60, produces: { barang: 6 }, power: 200, pollution: 30, placement: 'coast',
    name: { ms: 'Pelantar Minyak & Gas', en: 'Oil & Gas Platform' }, desc: { ms: 'Pelantar luar pesisir di Laut China Selatan dan Selat Melaka.', en: 'An offshore platform pumping oil and gas.' }, unlockedBy: 'elektrik_negara',
  },
  {
    id: 'ladang_menegak', era: 4, category: 'production', size: 2, cost: 26000, upkeep: 20, jobs: 40, produces: { padi: 30 }, power: -120, water: -40,
    name: { ms: 'Ladang Menegak', en: 'Vertical Farm' }, desc: { ms: 'Pertanian hidroponik bertingkat dengan lampu LED dan air kitar semula.', en: 'Stacked hydroponic farming under LED light with recycled water.' }, unlockedBy: 'teknologi_hijau',
  },
  {
    id: 'hab_siber', era: 4, category: 'research', size: 2, cost: 45000, upkeep: 55, jobs: 200, research: 30, produces: { digital: 12 }, power: -300,
    name: { ms: 'Hab AI & Keselamatan Siber', en: 'AI & Cybersecurity Hub' }, desc: { ms: 'Pusat kecerdasan buatan dan pertahanan siber negara.', en: 'A national centre for artificial intelligence and cyber defence.' }, unlockedBy: 'kecerdasan_buatan',
  },
] as const;

/** Upgrade lines: which catalog model represents a building in each era. */
const ERA_MODELS: Record<string, [string, string, string, string]> = {
  pelabuhan: ['building_pelabuhan', 'building_pelabuhan_dagang', 'building_pelabuhan_kontena', 'building_pelabuhan_kontena'],
  pasar: ['building_pasar', 'zone_C_d3_e2', 'zone_C_d3_e3', 'zone_C_d3_e4'],
  gudang: ['building_gudang', 'zone_I_d1_e2', 'zone_I_d2_e4', 'zone_I_d2_e4'],
};

function buildingRecord(b: (typeof BUILDINGS)[number] | Record<string, unknown>, unityOnly = false) {
  const d = b as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const entry = d.entry ? ENTRY_MAP[d.entry] : undefined;
  const unlockedBy = unityOnly ? d.unlockedBy : ALL_RESEARCH.find((r) => r.unlocks.buildings?.includes(d.id))?.id ?? '';
  const modelId = unityOnly ? `unity_${d.id}` : `building_${d.id}`;
  return {
    id: d.id,
    era: d.era,
    category: d.category,
    sizeTiles: d.size,
    footprintMeters: FOOTPRINT_M[d.size],
    cost: d.cost,
    upkeep: d.upkeep,
    jobs: d.jobs ?? 0,
    produces: kv(d.produces),
    consumes: kv(d.consumes),
    placement: d.placement ?? 'land',
    exportHub: !!d.exportHub,
    transfer: !!d.transfer,
    market: !!d.market,
    exportCapacity: d.exportCapacity ?? 0,
    storage: d.storage ?? 0,
    serviceKind: d.service?.kind ?? '',
    serviceRadius: d.service?.radius ?? 0,
    serviceStrength: d.service?.strength ?? 0,
    research: d.research ?? 0,
    culture: d.culture ?? 0,
    happiness: d.happiness ?? 0,
    power: d.power ?? 0,
    water: d.water ?? 0,
    pollution: d.pollution ?? 0,
    floodGuard: d.floodGuard ?? 0,
    landmark: !!d.landmark,
    obsoleteAfterEra: d.obsolete ?? 0,
    startingBuilding: STARTING_BUILDINGS.includes(d.id),
    unlockedBy,
    unityOnly,
    nameMs: d.name.ms,
    nameEn: d.name.en,
    descMs: d.desc.ms,
    descEn: d.desc.en,
    entryId: entry?.id ?? '',
    entryTitleMs: entry?.title.ms ?? '',
    entryTitleEn: entry?.title.en ?? '',
    entrySummaryMs: entry?.summary.ms ?? '',
    entrySummaryEn: entry?.summary.en ?? '',
    modelId,
    eraModelIds: ERA_MODELS[d.id] ?? [modelId, modelId, modelId, modelId],
  };
}

/** Zoned lot types: one record per zone and density, with an era model line (Kampung -> Rumah Kedai -> Apartment -> Eco-tower). */
const STYLE_MAX = [0, 2, 3, 4, 4];
const zoneModel = (z: string, d: number, era: number) => `zone_${z}_d${Math.min(d, STYLE_MAX[era])}_e${era}`;
const ZONE_NAMES_EN: Record<string, string> = { R: 'Residential', C: 'Commercial', I: 'Industrial' };
const ZONE_NAMES_MS: Record<string, string> = { R: 'Kediaman', C: 'Komersial', I: 'Perindustrian' };
const zones = (['R', 'C', 'I'] as const).flatMap((z) =>
  [1, 2, 3, 4].map((density) => {
    const eraModelIds = [1, 2, 3, 4].map((era) => zoneModel(z, density, era));
    if (z === 'R' && density >= 3) eraModelIds[3] = 'unity_eco_tower';
    return {
      id: `zone_${z}_${density}`,
      zone: z,
      density,
      capacity: ZONE_CAPACITY[z][density],
      footprintMeters: 4,
      nameMs: `${ZONE_NAMES_MS[z]} (tahap ${density})`,
      nameEn: `${ZONE_NAMES_EN[z]} (level ${density})`,
      eraNamesMs: ZONE_NAMES[z].era.map((n) => n.ms),
      eraNamesEn: ZONE_NAMES[z].era.map((n) => n.en),
      eraModelIds,
    };
  }),
);

const research = ALL_RESEARCH.map((r) => ({
  id: r.id,
  kind: r.kind,
  era: r.era,
  date: r.date,
  cost: r.cost,
  prereqs: r.prereqs,
  unlockBuildings: [...(r.unlocks.buildings ?? []), ...UNITY_EXTRA.filter((x) => x.unlockedBy === r.id).map((x) => x.id)],
  unlockTransport: r.unlocks.transport ?? [],
  unlockPolicies: r.unlocks.policies ?? [],
  effects: effects(r.effects),
  nameMs: r.name.ms,
  nameEn: r.name.en,
  descMs: r.desc.ms,
  descEn: r.desc.en,
  entryId: r.entry ?? '',
}));

const tables: Record<string, unknown[]> = {
  buildings: [...BUILDINGS.map((b) => buildingRecord(b)), ...UNITY_EXTRA.map((b) => buildingRecord(b as unknown as Record<string, unknown>, true))],
  zones,
  research,
  policies: POLICIES.map((p) => ({ id: p.id, nameMs: p.name.ms, nameEn: p.name.en, descMs: p.desc.ms, descEn: p.desc.en, effects: effects(p.effects) })),
  eras: ([1, 2, 3, 4] as EraId[]).map((id) => {
    const e = ERAS[id];
    return {
      id,
      nameMs: e.name.ms,
      nameEn: e.name.en,
      shortMs: e.short.ms,
      shortEn: e.short.en,
      spanMs: e.span.ms,
      spanEn: e.span.en,
      startYear: e.startYear,
      endYear: e.endYear,
      monthsPerTick: e.monthsPerTick,
      // The Unity design names the Era 1 treasury after the kupang, the gold coin of the Malay
      // sultanates (Kelantan from c. 1400, the Johor-type mas & kupang after 1511); Melaka itself
      // minted tin pitis, so both are named. Later eras keep the web game's currencies.
      currencyMs: id === 1 ? 'Kupang emas & pitis timah' : e.currency.ms,
      currencyEn: id === 1 ? 'Gold kupang & tin pitis' : e.currency.en,
      currencySymbol: id === 1 ? 'Kp' : e.currencySymbol,
      maxDensity: e.maxDensity,
      wealth: e.wealth,
      commercialRatio: e.commercialRatio,
      industrialRatio: e.industrialRatio,
      policySlots: e.policySlots,
      advanceTechs: e.advance.techs,
      advanceCivics: e.advance.civics,
      advancePopulation: e.advance.population,
      advanceLandmark: e.advance.landmark,
      introMs: e.intro.ms,
      introEn: e.intro.en,
      entryId: e.entry,
    };
  }),
  goods: GOODS.map((g) => ({ id: g, nameMs: GOOD_DEFS[g].name.ms, nameEn: GOOD_DEFS[g].name.en, color: GOOD_DEFS[g].color, food: !!GOOD_DEFS[g].food, prices: GOOD_DEFS[g].price.map((p) => (p == null ? -1 : p)) })),
  transports: TRANSPORTS.map((t) => ({ key: t.key, id: t.id, nameMs: t.name.ms, nameEn: t.name.en, cost: t.cost, upkeep: t.upkeep, step: t.step, era: t.era, bridge: t.bridge })),
  events: EVENTS.map((e) => ({ id: e.id, kind: e.kind, eras: e.eras, year: e.year ?? 0, onEraStart: !!e.onEraStart, months: e.months ?? [], chance: e.chance ?? 0, requiresBuilding: e.requires?.building ?? '', requiresResearch: e.requires?.research ?? '', nameMs: e.name.ms, nameEn: e.name.en, descMs: e.desc.ms, descEn: e.desc.en, effect: eventEffect(e.effect), entryId: e.entry ?? '' })),
  crises: CRISES.map((c) => ({
    id: c.id,
    eras: c.eras,
    triggerEvent: c.trigger.event ?? '',
    triggerYear: c.trigger.year ?? 0,
    triggerMonths: c.trigger.months ?? [],
    triggerChance: c.trigger.chance ?? 0,
    cooldown: c.trigger.cooldown ?? 0,
    minTick: c.trigger.minTick ?? 0,
    hasBase: !!c.base,
    baseEffect: eventEffect(c.base ?? {}),
    nameMs: c.name.ms,
    nameEn: c.name.en,
    descMs: c.desc.ms,
    descEn: c.desc.en,
    defaultChoice: c.defaultChoice,
    entryId: c.entry ?? '',
    choices: c.choices.map((ch) => ({ id: ch.id, nameMs: ch.name.ms, nameEn: ch.name.en, descMs: ch.desc.ms, descEn: ch.desc.en, cost: ch.cost ?? 0, effect: eventEffect(ch.effect) })),
  })),
  advisors: ADVISORS.map((a) => ({ id: a.id, name: a.name, titleMs: a.title.ms, titleEn: a.title.en, life: a.life, eras: a.eras, cost: a.cost, upkeep: a.upkeep, effects: effects(a.effects), bonusMs: a.bonus.ms, bonusEn: a.bonus.en, bioMs: a.bio.ms, bioEn: a.bio.en, sources: a.sources })),
  partners: PARTNERS.map((p) => ({ id: p.id, nameMs: p.name.ms, nameEn: p.name.en, descMs: p.desc.ms, descEn: p.desc.en, eras: p.eras, color: p.color, buys: kv(p.buys), baseRelation: p.baseRelation, requiresEvent: p.requiresEvent ?? '', knowledge: p.knowledge })),
  scenarios: SCENARIOS.map((s) => ({ id: s.id, era: s.era, year: s.year, nameMs: s.name.ms, nameEn: s.name.en, descMs: s.desc.ms, descEn: s.desc.en, objectivesMs: s.objectives.map((o) => o.ms), objectivesEn: s.objectives.map((o) => o.en) })),
  milestones: MILESTONES.map((m) => ({ id: m.id, nameMs: m.name.ms, nameEn: m.name.en, descMs: m.desc.ms, descEn: m.desc.en })),
  sejarahpedia: ENTRIES.map((e) => ({
    id: e.id,
    category: e.category,
    period: e.period,
    titleMs: e.title.ms,
    titleEn: e.title.en,
    summaryMs: e.summary.ms,
    summaryEn: e.summary.en,
    bodyMs: e.body.ms.join('\n\n'),
    bodyEn: e.body.en.join('\n\n'),
    inGameMs: e.inGame.ms,
    inGameEn: e.inGame.en,
    sources: e.sources,
    related: e.related,
  })),
};

let total = 0;
for (const [name, items] of Object.entries(tables)) {
  writeFileSync(join(OUT, `${name}.json`), JSON.stringify({ items }, null, 1) + '\n');
  total += items.length;
  console.log(`${name}.json: ${items.length}`);
}
console.log(`${total} records -> ${OUT}`);

/**
 * UI strings for the Unity HUD: every web string (src/i18n/strings.ts), the Sejarahpedia
 * category names as `enc.cat.<id>`, and the few labels only the Unity edition has as
 * `unity.*`. One file per language, shaped for JsonUtility as { items: [{ key, value }] }.
 */
const UNITY_STRINGS: Record<string, { ms: string; en: string }> = {
  'unity.menu.settings': { ms: 'Tetapan', en: 'Settings' },
  'unity.menu.quit': { ms: 'Keluar', en: 'Quit' },
  'unity.menu.resume': { ms: 'Sambung', en: 'Resume' },
  'unity.menu.button': { ms: 'Menu', en: 'Menu' },
  'unity.menu.noSaves': { ms: 'Tiada permainan disimpan', en: 'No saved games' },
  'unity.menu.tagline': { ms: 'Dari kuala sungai ke negara pintar.\nBina kisah kota anda.', en: 'From a river mouth to a smart nation.\nBuild your city’s story.' },
  'unity.menu.back': { ms: 'Kembali', en: 'Back' },
  'unity.menu.newChapter': { ms: 'Mulakan bab baharu', en: 'Begin a new chapter' },
  'unity.menu.chooseChapter': { ms: 'Pilih titik permulaan', en: 'Choose your starting point' },
  'unity.menu.paused': { ms: 'PERMAINAN DIJEDA', en: 'GAME PAUSED' },
  'unity.menu.pauseHint': { ms: 'Kota anda menanti. Sambung apabila bersedia.', en: 'Your city awaits. Resume when you are ready.' },
  'unity.menu.noSavesHint': { ms: 'Sebuah kota baharu menanti. Pilih Permainan Baharu untuk bermula.', en: 'A new city awaits. Choose New Game to begin.' },
  'unity.menu.eraStory': { ms: 'ENTREPÔT MELAKA\nBIJIH TIMAH, GETAH & REL\nPASCA-MERDEKA\nKOTA PINTAR DIGITAL', en: 'MELAKA ENTREPÔT\nTIN, RUBBER & RAIL\nPOST-MERDEKA\nDIGITAL SMART CITY' },
  'unity.menu.saveLoad': { ms: 'Simpan & Muat', en: 'Save & Load' },
  'unity.menu.yourCities': { ms: 'KOTA-KOTA ANDA', en: 'YOUR CITIES' },
  'unity.menu.saveMetadata': { ms: 'Era {era}  ·  Tahun {year}', en: 'Era {era}  ·  Year {year}' },
  'unity.menu.dateCulture': { ms: 'ms-MY', en: 'en-MY' },
  'unity.menu.autoSlot': { ms: 'Auto / Pantas', en: 'Auto / Quick' },
  'unity.menu.slot': { ms: 'Slot {slot}', en: 'Slot {slot}' },
  'unity.menu.loadHint': { ms: 'Pilih kota tersimpan untuk menyambung perjalanan.', en: 'Choose a saved city to continue its story.' },
  'unity.menu.saveHint': { ms: 'Simpan kemajuan semasa atau sambung kota tersimpan.', en: 'Save your progress or return to a saved city.' },
  'unity.menu.emptySlot': { ms: 'Tiada kota tersedia', en: 'No city available' },
  'unity.menu.emptySlotHint': { ms: 'Tiada simpanan yang boleh dibaca dalam slot ini.', en: 'There is no readable save in this slot.' },
  'unity.menu.storageUnavailable': { ms: 'Simpanan tidak tersedia. Kembali dan cuba lagi.', en: 'Save storage is unavailable. Go back and try again.' },
  'unity.menu.loadFailed': { ms: 'Kota tidak dapat dimuat. Cuba lagi atau pilih slot lain.', en: 'This city could not be loaded. Try again or choose another slot.' },
  'unity.menu.saveFailed': { ms: 'Kemajuan tidak dapat disimpan. Cuba lagi atau pilih slot lain.', en: 'Your progress could not be saved. Try again or choose another slot.' },
  'unity.menu.saved': { ms: 'Kemajuan kota telah disimpan.', en: 'Your city’s progress has been saved.' },
  'unity.menu.keyboardHint': { ms: 'Tab / Shift+Tab: tukar kawalan. Enter: pilih. Esc: kembali.', en: 'Tab / Shift+Tab: move between controls. Enter: select. Esc: go back.' },
  'unity.settings.kicker': { ms: 'SESUAIKAN PENGALAMAN ANDA', en: 'MAKE YOURSELF AT HOME' },
  'unity.settings.general': { ms: 'Umum', en: 'General' },
  'unity.settings.audio': { ms: 'Audio', en: 'Audio' },
  'unity.settings.graphics': { ms: 'Grafik', en: 'Graphics' },
  'unity.settings.artHint': { ms: 'Seni 3D penuh memaparkan bangunan terperinci. Greybox menggunakan bentuk ringkas untuk pandangan yang lebih jelas.', en: 'Full 3D art displays detailed buildings. Greybox uses simple shapes for a clearer planning view.' },
  'unity.top.research': { ms: 'Kajian', en: 'Research' },
  'unity.top.era': { ms: 'Era', en: 'Era' },
  'unity.panel.eraTimeline': { ms: 'Era & Garis Masa', en: 'Era & Timeline' },
  'unity.top.advisors': { ms: 'Penasihat', en: 'Advisors' },
  'unity.settings.volume': { ms: 'Kelantangan utama', en: 'Master volume' },
  'unity.settings.music': { ms: 'Muzik', en: 'Music' },
  'unity.settings.ambience': { ms: 'Bunyi persekitaran', en: 'Ambience' },
  'unity.settings.artMode': { ms: 'Mod seni', en: 'Art mode' },
  'unity.settings.fullArt': { ms: 'Seni 3D penuh', en: 'Full 3D art' },
  'unity.settings.greybox': { ms: 'Greybox', en: 'Greybox' },
  'unity.settings.edgeScroll': { ms: 'Skrol tepi skrin', en: 'Edge scrolling' },
  'unity.settings.on': { ms: 'Hidup', en: 'On' },
  'unity.settings.off': { ms: 'Mati', en: 'Off' },
  'unity.settings.controls.body': {
    ms: 'WASD / anak panah, tepi skrin atau seret tengah untuk gerak; Q / E atau seret kanan untuk putar; roda tetikus untuk zum; Space jeda, 1-3 kelajuan; G tukar mod seni; F5 / F9 simpan / muat pantas; Esc tutup panel.',
    en: 'WASD / arrows, screen edges or middle drag to pan; Q / E or right drag to rotate; mouse wheel to zoom; Space pauses, 1-3 set the speed; G switches art mode; F5 / F9 quick save / load; Esc closes panels.',
  },
  'unity.eco.policySlots': { ms: 'Slot dasar: {used}/{max}', en: 'Policy slots: {used}/{max}' },
  'unity.eco.power': { ms: 'Elektrik', en: 'Power' },
  'unity.eco.water': { ms: 'Air', en: 'Water' },
  'unity.eco.noLoans': { ms: 'Pinjaman belum ada dalam edisi Unity.', en: 'Loans are not in the Unity edition yet.' },
  'unity.timeline.table': { ms: 'Jadual', en: 'Table' },
  'unity.timeline.charts': { ms: 'Carta', en: 'Charts' },
  'unity.timeline.year': { ms: 'Tahun', en: 'Year' },
  'unity.era.cannot': { ms: 'Syarat belum dipenuhi', en: 'Requirements not met' },
  'unity.enc.open': { ms: 'Buka', en: 'Open' },
  'unity.notif.close': { ms: 'x', en: 'x' },
};

const LOC_OUT = 'unity-tamadun-kota/Assets/Resources/Localization';
mkdirSync(LOC_OUT, { recursive: true });
for (const lang of ['ms', 'en'] as const) {
  const items = [
    ...Object.entries(STRINGS[lang]).map(([key, value]) => ({ key, value })),
    ...Object.entries(CATEGORY_NAMES).map(([id, name]) => ({ key: `enc.cat.${id}`, value: name[lang] })),
    ...Object.entries(UNITY_STRINGS).map(([key, value]) => ({ key, value: value[lang] })),
  ];
  writeFileSync(join(LOC_OUT, `${lang}.json`), JSON.stringify({ items }, null, 1) + '\n');
  console.log(`Localization/${lang}.json: ${items.length}`);
}
