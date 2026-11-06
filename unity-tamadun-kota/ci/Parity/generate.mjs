// Executes the frozen web engine to produce constants consumed by NUnit, without editing src/.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const require = createRequire(import.meta.url);
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: filename,
  }).outputText, filename);
};
const load = (name) => require(path.join(root, 'src/core', name + '.ts'));
const { createGame, createContext, ensurePartners, refreshModifiers } = load('sim/context');
const { BUILDING_MAP } = load('data/buildings');
const { ERAS } = load('data/eras');
const { GOODS } = load('types');
const transport = load('sim/transport');
const env = load('sim/environment');
const zoning = load('sim/zoning');
const dip = load('sim/diplomacy');
const { runEconomy } = load('sim/economy');
const { MILESTONES, checkMilestones } = load('sim/milestones');
const { checkVictory } = load('sim/research');
const { ADVISORS } = load('data/advisors');
const advisors = load('sim/advisors');
const { ALL_RESEARCH, POLICIES } = load('data/research');
const { GameEngine } = load('engine');

function flat(size = 16) {
  const s = createGame(42, 'Parity', size);
  s.map.terrain.fill(6); s.map.elevation.fill(120); s.map.fertility.fill(160); s.map.tin.fill(100);
  return s;
}
function building(s, id, x, y, efficiency = 1) {
  const size = BUILDING_MAP[id].size;
  const b = { id: s.nextId++, def: id, x, y, w: size, h: size, efficiency, built: 0 };
  s.buildings.push(b);
  for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) s.map.building[(y + dy) * s.map.width + x + dx] = b.id;
}

const fields = [];
const scalar = (name, value) => fields.push(`        public const double ${name} = ${number(value)};`);
const number = (v) => v === Infinity ? 'double.PositiveInfinity' : v === -Infinity ? 'double.NegativeInfinity' : String(v);
const array = (name, values) => {
  const list = Array.from(values, number);
  const lines = [];
  for (let i = 0; i < list.length; i += 12) lines.push('            ' + list.slice(i, i + 12).join(', ') + ',');
  fields.push(`        public static readonly double[] ${name} = {\n${lines.join('\n')}\n        };`);
};
const strings = (name, values) => fields.push(`        public static readonly string[] ${name} = { ${values.map((v) => JSON.stringify(v ?? null)).join(', ')} };`);
const effectValues = (e) => [e.productionAll, e.exportCap, e.exportPrice, e.tax, e.research, e.culture,
  e.happiness, e.pollution, e.growth, e.upkeep, e.construction, e.relationGain, ...GOODS.map((g) => e.production[g] ?? 0)];

// Advisor validation order, fees, seat limits, dismissal, retirement and effect refresh in every era.
for (let era = 1; era <= 4; era++) {
  const s = flat(); s.era = era; s.money = 0; const ctx = createContext(s);
  const reasons = [], values = [];
  const first = ADVISORS.find((a) => a.eras.includes(era)).id;
  const record = (id) => {
    const check = advisors.canRecruit(s, id);
    const result = advisors.recruitAdvisor(s, ctx, id);
    reasons.push(result.reason ?? null);
    values.push(Number(result.ok), check.cost ?? 0, s.money, s.advisors?.length ?? 0, ...effectValues(ctx.effects));
  };
  record('unknown'); record(first); s.money = 100000;
  for (const def of ADVISORS) record(def.id);
  record(first);
  for (let i = 0; i < 2; i++) {
    const result = advisors.dismissAdvisor(s, ctx, first);
    reasons.push(result.reason ?? null);
    values.push(Number(result.ok), 0, s.money, s.advisors.length, ...effectValues(ctx.effects));
  }
  if (era < 4) { s.era++; advisors.retireAdvisors(s, ctx); }
  scalar(`AdvisorSlots${era}`, advisors.advisorSlots({ ...s, era }));
  array(`AdvisorCommands${era}`, values); strings(`AdvisorReasons${era}`, reasons);
  strings(`AdvisorsAfterRetirement${era}`, s.advisors);
  strings(`AdvisorNoticeIds${era}`, s.notices.map((n) => n.params.id));
  strings(`AdvisorNoticeKeys${era}`, s.notices.map((n) => n.key));
}

// Policy commands retain their error order and stack effects with completed civics and technologies.
for (let era = 1; era <= 4; era++) {
  const s = flat(); s.era = era;
  for (const r of ALL_RESEARCH) if (r.era <= era) (r.kind === 'tech' ? s.research : s.civics).done.push(r.id);
  const engine = new GameEngine(s); refreshModifiers(s, engine.ctx);
  const values = [], reasons = [], unlocked = [];
  const record = (result) => {
    reasons.push(result.reason ?? null);
    values.push(Number(result.ok), s.policies.length, s.money, ...effectValues(engine.ctx.effects));
  };
  record(engine.adoptPolicy('unknown'));
  for (const p of POLICIES) {
    unlocked.push(Number(load('sim/context').isPolicyUnlocked(s, p.id)));
    record(engine.adoptPolicy(p.id));
  }
  record(engine.adoptPolicy(POLICIES[0].id));
  record(engine.revokePolicy(POLICIES[0].id)); record(engine.revokePolicy(POLICIES[0].id));
  record(engine.adoptPolicy(POLICIES[0].id));
  scalar(`PolicySlots${era}`, ERAS[era].policySlots);
  array(`PolicyUnlocked${era}`, unlocked); array(`PolicyCommands${era}`, values); strings(`PolicyReasons${era}`, reasons);
  strings(`PoliciesAfterCommands${era}`, s.policies);
}

// Mixed roads, water, rail and MRT with a transfer hub, isolated rail and off-network carting.
{
  const s = flat();
  for (let y = 0; y < 16; y++) s.map.terrain[y * 16] = 5;
  for (let x = 1; x < 13; x++) s.map.transport[4 * 16 + x] = x < 7 ? 1 : 3;
  for (let x = 1; x < 15; x++) s.map.transport[8 * 16 + x] = 2;
  for (let x = 1; x < 15; x++) s.map.transport[11 * 16 + x] = 4;
  s.map.transport[15 * 16 + 15] = 2;
  building(s, 'pelabuhan', 0, 3);
  building(s, 'jeti', 6, 8);
  building(s, 'pasar', 9, 10);
  const net = transport.buildNetwork(s);
  array('Modes', net.modes); array('Access', transport.computeAccess(s, net));
  array('Delivery', transport.deliveryCost(s, net));
}
// Coverage truncation, two float32 blur passes, cleaners, coastline and fractional land values.
{
  const s = flat(); s.era = 3;
  for (let y = 0; y < 16; y++) s.map.terrain[y * 16] = 5;
  s.map.terrain[22] = 8; s.map.terrain[24] = 4;
  for (let i = 32; i < 64; i++) { s.map.zone[i] = i % 3 + 1; s.map.density[i] = i % 4 + 1; }
  for (let x = 0; x < 16; x++) s.map.transport[4 * 16 + x] = 3;
  building(s, 'masjid', 2, 6, 0); building(s, 'surau', 5, 7, 0.2);
  building(s, 'pasar', 8, 9, 0.6); building(s, 'relau_besi', 5, 3, 0.75);
  // Use the catalog's first cleaner so the fixture also follows the exported data.
  const cleaner = Object.values(BUILDING_MAP).find((b) => b.pollution < 0);
  building(s, cleaner.id, 10, 2);
  const ctx = createContext(s); ctx.effects.pollution = -0.2;
  const net = transport.buildNetwork(s); s.map.access.set(transport.computeAccess(s, net));
  env.computeCoverage(s); env.computePollution(s, ctx);
  scalar('AverageLandValue', env.computeLandValue(s, ctx));
  fields.push(`        public const string Cleaner = "${cleaner.id}";`);
  array('Coverage', s.map.coverage); array('Pollution', s.map.pollution); array('LandValue', s.map.landValue);
  scalar('HappinessTarget', env.computeHappinessTarget(s, ctx, { foodSatisfaction: 0.85, unemployment: 0.12, powerRatio: 0.8, waterRatio: 0.95, buildingHappiness: 8 }));
}
// Fixed RNG stream exercises density caps, pollution, utilities, floods, decay and style changes.
for (let era = 1; era <= 4; era++) {
  const s = flat(); s.era = era;
  const ctx = createContext(s); ctx.rng.state = 12345; ctx.effects.growth = 0.2; ctx.flood = true;
  s.derived.demand = { R: 90, C: 70, I: -65 };
  for (let i = 0; i < 256; i++) {
    s.map.zone[i] = i % 4; s.map.density[i] = i % 5; s.map.style[i] = 1;
    s.map.access[i] = i % 7 === 0 ? 0 : 1; s.map.landValue[i] = i % 256;
    s.map.pollution[i] = (i * 17) % 256; s.map.elevation[i] = i % 2 ? 80 : 120;
    ctx.waterDist[i] = i % 5;
  }
  for (let tick = 0; tick < 80; tick++) zoning.growZones(s, ctx, { powerRatio: era === 4 ? 0.8 : 1, waterRatio: 1 });
  array(`Growth${era}`, s.map.density); array(`Style${era}`, s.map.style); scalar(`GrowthRng${era}`, ctx.rng.state);
}
// Diplomacy commands, drift, research exchange and cooldowns with the original RNG sequence.
{
  const s = flat(); const ctx = createContext(s); s.partners.ming.relation = 40;
  dip.sendEnvoy(s, ctx, 'ming'); dip.proposeDeal(s, ctx, 'ming', 'rempah', 3, 4); dip.toggleExchange(s, 'ming');
  let knowledge = 0;
  for (let i = 0; i < 30; i++) { knowledge += dip.tickDiplomacy(s, ctx); s.tick++; }
  array('Diplomacy', [s.money, s.partners.ming.relation, s.partners.ming.envoyCooldown, knowledge, ctx.rng.state, dip.dealPrice(s, ctx, 'ming', 'rempah')]);
}
// Contracts settle before spot exports, use shared capacity and square-root event prices.
{
  const s = flat(); const ctx = createContext(s); building(s, 'pelabuhan', 1, 1);
  for (let i = 128; i < 138; i++) { s.map.zone[i] = 1; s.map.density[i] = 1; }
  s.stock.rempah = 50; s.stock.timah = 50;
  ctx.priceMult.rempah = 4;
  dip.proposeDeal(s, ctx, 'ming', 'rempah', 20, 3); dip.proposeDeal(s, ctx, 'gujerat', 'timah', 20, 3);
  const values = [];
  for (let tick = 0; tick < 3; tick++) {
    const e = runEconomy(s, ctx, zoning.zoneTotals(s));
    values.push(e.budget.deals, e.budget.exports, s.stock.rempah, s.stock.timah, s.partners.ming.relation, s.partners.gujerat.relation, s.deals.length,
      s.deals[0]?.delivered ?? 0, s.deals[1]?.missed ?? 0);
  }
  array('Settlement', values);
}
// Offer generation covers trade offers, investments, expiry and inactive partners in every era.
for (let era = 1; era <= 4; era++) {
  const s = flat(); s.era = era; ensurePartners(s); const ctx = createContext(s); ctx.rng.state = 8765;
  s.money = 1000000; s.civics.done.push('zon_perdagangan_bebas');
  for (const p of Object.values(s.partners)) p.relation = 50;
  for (const g of GOODS) s.derived.production[g] = 10;
  const trace = [];
  for (let tick = 0; tick < 250; tick++) {
    s.tick = tick; dip.tickDiplomacy(s, ctx);
    for (const o of s.offers) {
      trace.push(o.id, GOODS.indexOf(o.good), o.qty ?? 0, o.price ?? 0, o.money ?? 0, o.expires);
      dip.acceptOffer(s, ctx, o.id);
    }
  }
  array(`Offers${era}`, trace); scalar(`OffersRng${era}`, ctx.rng.state);
}
// All achievement requirements at the boundary; victory is independent of milestone awards.
{
  const s = flat(32); s.era = 4; ensurePartners(s); s.money = 500000;
  for (const p of Object.values(s.partners)) p.relation = 50;
  s.derived.population = 30000; s.derived.culturePerTick = 60; s.derived.happiness = 70;
  s.derived.budget.exports = 5900; s.derived.budget.deals = 100;
  s.research.done.push('bandar_pintar', 'kecerdasan_buatan'); s.civics.done.push('negara_maju');
  for (const [i, id] of ['hab_inovasi','pusat_data','stesen_mrt','ladang_solar','istana','masjid','candi','bangunan_moorish','menara_berkembar'].entries()) building(s, id, (i % 5) * 5, Math.floor(i / 5) * 5);
  for (let i = 500; i < 620; i++) { s.map.zone[i] = 1; s.map.density[i] = 1; s.map.style[i] = i % 2 + 1; }
  array('MilestoneRequirements', MILESTONES.flatMap((m) => m.requirements(s).map((r) => Number(r.met))));
  scalar('Victory', Number(checkVictory(s))); scalar('Awards', checkMilestones(s).length); scalar('RepeatAwards', checkMilestones(s).length);
}

const output = '// Generated by ci/Parity/generate.mjs from src/core. Do not edit by hand.\nnamespace TamadunKota.Tests\n{\n    internal static class WebParity\n    {\n' + fields.join('\n') + '\n    }\n}\n';
const destination = path.join(root, 'unity-tamadun-kota/Assets/Tests/EditMode/WebParity.cs');
if (process.argv.includes('--check')) {
  if (!fs.existsSync(destination) || fs.readFileSync(destination, 'utf8').replaceAll('\r\n', '\n') !== output) {
    throw new Error('Web parity constants are stale. Run npm run generate in unity-tamadun-kota/ci/Parity.');
  }
  console.log('TypeScript parity constants match.');
} else { fs.writeFileSync(destination, output); console.log('Generated ' + destination); }
