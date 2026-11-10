# Tamadun & Kota: Game Design Document (Unity 6 LTS edition)

*Unity-only states and leaders milestone. Unity 6000.3 with URP. The authoritative data is
`Assets/Resources/GameData/*.json`; no web source or catalog exporter is required.*

## 1. Vision

A city builder that is also a history lesson. The player chooses one of thirteen Malaysian states and its historical leader, then grows a
settlement on an offline geographic city region from a 15th-century entrepôt into a 21st-century
smart metropolis. Every building, technology, crisis and advisor links to a bilingual (Bahasa Melayu
and English) **Sejarahpedia** entry with its sources, so the game can be played for fun or used in a
classroom.

| | |
|---|---|
| Genre | City builder with a Civilization-style tech and civics tree |
| Platform | PC (Windows, macOS, Linux) through Steam; Unity 6.3 LTS, Universal Render Pipeline |
| Camera | Free RTS camera (pan, rotate, zoom, tilt) over a 1,024 x 1,024 m geographic map |
| Session | 2 to 6 hours for a full four-era game; 3 scenarios start later |
| Languages | Bahasa Melayu (default), English; switchable at any time |

## 2. The four eras

The calendar advances a fixed number of months per tick, faster in early eras so centuries pass in
minutes. An era advances when its technologies, civics, population target and landmark are complete
(`EraStateMachine.Requirements`).

| Era | In-game name | Years | Months per tick | To advance | Treasury |
|---|---|---|---|---|---|
| 1 | Ancient & Early Kingdoms: Maritime Entrepôt Age | 1400 to 1823 | 6 | 3 techs, 2 civics, 1,200 people, Sultanate Palace | Gold kupang & tin pitis (Kp) |
| 2 | Maritime Trade & Industrial Transition: Tin, Rubber & Rail | 1824 to 1956 | 4 | 3 techs, 2 civics, 5,000 people, Grand Moorish Station | Straits dollar ($) |
| 3 | Modern Nation: Post-Merdeka Industrialisation | 1957 to 1995 | 2 | 3 techs, 2 civics, 15,000 people, Independence Stadium | Ringgit (RM) |
| 4 | Future Smart Metropolis | 1996 onward | 1 | (final era; victory milestones) | Ringgit (RM) |

### Era 1: Ancient & Early Kingdoms (Bujang Valley heritage and Melaka)

* **Theme:** river-mouth and sea ports, monsoon trade, timber, paddy, pepper, tin panning and iron
  smelting. The Heritage Candi and the Iron Smelter recall the Bujang Valley of Kedah, where 17 iron
  smelting sites have been documented at Sungai Batu ([GSM Warta Geologi](https://gsm.org.my/articles/warta-geologi-462-geological-notes-10/)).
  *Dating note:* the early figure of c. 535 BCE comes from USM's 2018 work, but USM's own re-analysis
  in 2023 treats the 7th to 5th century BCE dates as outliers and places the main occupation between
  the 2nd and 10th centuries CE ([USM Arkeologi](https://arkeologi.usm.my/index.php/news/bujang-valley-revised-dating-narrative-towards-unesco-listing-of-ancient-maritime-site)).
  The game's calendar therefore starts at c. 1400 with Melaka and presents the Bujang Valley as heritage,
  not as a playable date.
* **Melaka:** founded c. 1400 by Parameswara, an entrepôt until the Portuguese conquest of 1511. Crisis: the monsoon winds shift (a season of failed trade)
  ([Malacca Sultanate](https://en.wikipedia.org/wiki/Malacca_Sultanate)).
* **Buildings (20):** Pasar, Jetty, Entrepôt Harbour, Gudang, Sawah, Fishing Village, Logging Camp,
  Tin Panning (dulang), Pepper Garden, Iron Smelter, Jong Shipyard, Surau, Tiered-Roof Mosque, Madrasah,
  Headman's Hall, Watchtower, Green, Heritage Candi, Harbour Master (Syahbandar), Sultanate Palace (16 m landmark).
* **Currency note:** the kupang was a small gold coin of the Malay sultanates (Kelantan from c. 1400;
  the "Johor type" mas and kupang after 1511), while Melaka itself minted tin cash called *pitis* from
  the reign of Sultan Muzaffar Shah (1445 to 1459) ([ICOMON, Gold and tin coins of the Malay States](https://icomon.mini.icom.museum/wp-content/uploads/sites/20/2019/11/Gold_and_tin_coins_of_the_Malay_States.pdf)).
  The Era 1 treasury is therefore labelled "gold kupang & tin pitis".

### Era 2: Maritime Trade & Industrial Transition

* **Theme:** the tin rush, rubber estates and the railway, under the Straits Settlements and the
  Federated Malay States.
* **Tin mining:** open-cast mines with *palong* sluices, then bucket dredges (*kapal korek*). The first
  successful dredge in Malaya was installed by Malayan Tin Dredging at Batu Gajah, Perak in 1912 and
  worked from January 1913 ([NUS Libraries, MMC history](https://lib.nus.edu.sg/nus_hl/mmccorp2010-1.pdf);
  [TT5 dredge museum](https://museumvolunteersjmm.com/2023/09/25/tanjung-tualang-tin-dredge-no-5-tt5-a-refurbished-dredge-in-all-its-glory/)).
* **Railways (KTMB heritage):** the Taiping to Port Weld line, opened 1 June 1885 to carry Larut tin to
  the coast, was the first of the lines that later formed the FMS Railways ([Perak State Railway](https://searail.malayanrailways.com/Penang-Perak/PSR.htm)).
* **Buildings (10):** Open-cast Tin Mine, Tin Dredge (16 m), Rubber Estate (16 m), Railway Station,
  Steamship Port (16 m), School, Hospital, Police Station, Post & Telegraph Office, Grand Moorish
  Station (16 m landmark). Transport: rail.
* **Crises:** the Great Flood of December 1926 (*Bah Besar*) that hit Selangor, Perak, Pahang and
  Kelantan and washed away railway lines ([FMT](https://www.freemalaysiatoday.com/category/leisure/2022/03/11/a-look-back-at-malayas-great-flood-of-1926);
  [UPSI Perspektif](https://ejournal.upsi.edu.my/index.php/PERS/article/view/1674)); the 1930s Depression.
  Surviving the flood solvent unlocks `ACH_SURVIVE_BAH_BESAR`.

### Era 3: Modern Nation (post-Merdeka)

* **Theme:** Merdeka (31 August 1957), Malaysia (1963), FELDA land schemes, the New Economic Policy,
  manufacturing and free trade zones, oil and gas, expressways.
* **Industry:** the Free Trade Zones Act 1971 led to Malaysia's first free trade zone at Bayan Lepas,
  Penang, in 1972, which drew the electronics multinationals ([Bayan Lepas FIZ](https://en.wikipedia.org/wiki/Bayan_Lepas_Free_Industrial_Zone);
  [Penang Monthly](https://penangmonthly.com/article/20873/frepenca-a-history-of-innovative-industrial-support-measures)).
* **Buildings (14):** Power Station, Hydroelectric Dam, Water Treatment Plant, Oil Palm Estate (16 m),
  Free Trade Zone (16 m), National Car Plant (16 m), Container Port (16 m), University (16 m), Rural
  Clinic, Flood Mitigation Barrage, Parliament House (16 m), Independence Stadium (16 m landmark), and
  two Unity-only buildings: **Oil Refinery** (16 m) and **Oil & Gas Platform** (8 m, coast). Transport:
  expressway. Skyscraper lots appear at density 4.
* **Crisis:** the 1985 tin market collapse.

### Era 4: Future Smart Metropolis

* **Theme:** the Multimedia Super Corridor (1996), MRT, green technology, AI and cyber security, flood
  resilience.
* **Transit:** the Sungai Buloh to Kajang MRT line opened in full on 17 July 2017 ([Kajang line](https://en.wikipedia.org/wiki/Kajang_line)).
* **Flood barrages:** modelled on the SMART tunnel, a 9.7 km stormwater and road tunnel in Kuala Lumpur
  used for flood control since 2007 ([Gamuda](https://gamuda.com/?p=11581)).
* **Buildings (11):** Data Centre, Innovation Hub, Solar Farm, MRT Station, International Airport,
  Telecom Tower, Recycling Centre, Megatower 118 and Twin Towers (16 m landmarks), and two Unity-only
  buildings: **Vertical Farm** and **AI & Cybersecurity Hub** (8 m each). Residential lots of density
  3 and 4 become planted **Eco Towers**. Transport: MRT.
* **Crisis:** the 1997 Asian financial crisis.

### Research

66 nodes: **41 technologies and 25 civics**, in `TechCivicTree.asset` (generated) and `research.json`.
Technology points come from population and research buildings; civics from culture. Each node can
unlock buildings, transport or policies and apply percentage effects.

## 3. Grid and scale

| Rule | Value |
|---|---|
| World units | **1 Unity unit = 1 metre**, +Y up |
| Grid cell | 4 x 4 m (`GridSpec.CellSize = 4`) |
| Map | 128 x 128 cells = 512 x 512 m, sea level at y = 0 |
| Small footprint | **4 x 4 m** (1 cell): houses, shops, surau, clinic |
| Medium footprint | **8 x 8 m** (2 x 2 cells): market, station, power plant, data centre |
| Landmark footprint | **16 x 16 m** (4 x 4 cells): palace, dredge, port, stadium, towers |
| Terrain | Unity Terrain, 513 heightmap, base at y = -12 m, 60 m height range; lots are flattened |
| Placement rules | coast, river, water, tin ground (tin >= 40), fertile soil (>= 105), forest, rail-side |
| Road access | a building or lot works at full rate only within 3 cells of a road (25 % otherwise) |

All Blender exports follow the same scale (`scripts/blender_unity_pipeline.py`): footprints map to 4,
8 and 16 m, heights use a storey factor so a kampung house is about 4 m tall and Merdeka 118 about 128 m.

## 4. Economy

All formulas live in `Assets/Scripts/Simulation/EconomyModel.cs` (pure C#, no Unity dependency, zero
allocations per tick, covered by NUnit tests). One tick is 1.5 s at normal speed (0.75 s and 0.35 s
at the faster speeds).

### Resources

| Resource | Source | Used by |
|---|---|---|
| **Treasury** (Kp, $, RM) | taxes, exports | building, upkeep, imports, advisors |
| **Food** | sawah, fishing, oil palm, vertical farm; imported through a port if short | 0.012 per citizen per tick |
| **Timber** | logging camps | shipyards and early industry |
| **Tin** | dulang, open-cast mines, dredges (only on tin ground) | export, smelting, industry |
| **Rubber** | rubber estates | export, car plant |
| **Energy** | power station, dam, solar farm (matters from era 3) | supply minus demand, shown on the HUD |
| **Tech** | research points per tick | technologies |
| Also traded | spices, iron, palm oil, goods, electronics, digital services | exports and inputs |

### Core formulas (per tick)

* **Population** = sum of residential lot capacity (6, 18, 50, 120 people by density 1 to 4).
* **Workers** = population x 0.55. **Jobs** = commercial + industrial lot jobs + building jobs.
  **Staffing** = min(workers, jobs) / jobs. **Unemployment** = (workers - employed) / workers.
* **Production** of a building = base yield x staffing x utilities (era 3+) x road access (1 or 0.25)
  x flood (0.5 if flooded and unguarded) x site factor x input availability x (1 + tech and policy bonuses).
* **Energy** (era 3+): demand = 0.03 x population + 0.05 x commercial jobs + 0.08 x industrial jobs;
  power ratio = min(1, supply / demand) scales every building that needs power.
* **Exports**: surplus above a reserve (4 ticks of inputs, 6 ticks of food) is sold, highest price
  first, up to the port capacity, at era world prices.
* **Taxes** (0 to 20 % per zone, default 9 %): wealth = era wealth x (0.6 + 0.4 x food satisfaction);
  R = population x rate x wealth; C = commercial jobs x staffing x rate x wealth x 3;
  I = industrial jobs x staffing x rate x wealth x 2.5.
* **Costs**: building and transport upkeep; administration = population x era wealth x
  {0.004, 0.02, 0.07, 0.12}; from era 3 an infrastructure bill (capital depreciation 0.06 % and
  0.15 % of build cost, network and urban maintenance that grows with log2 of population).
* **Research** = (1 + population / 250 + research buildings) x (1 + bonuses).
* **Happiness** moves 15 % per tick towards 55 + food and jobs terms - tax terms + buildings (max +20)
  - utility shortfall.
* **RCI demand** (-100 to 100): residential follows a pioneer bonus, the job gap, happiness, food and
  tax; commercial and industrial follow era ratios of jobs per resident (0.16 to 0.24) and exports.

### Era economy multipliers (`EraManager.Multipliers`)

| Era | Wealth | Commercial jobs / resident | Industrial jobs / resident | Max density |
|---|---|---|---|---|
| 1 | 0.30 | 0.16 | 0.12 | 2 |
| 2 | 0.45 | 0.18 | 0.16 | 3 |
| 3 | 0.70 | 0.20 | 0.20 | 4 |
| 4 | 1.10 | 0.24 | 0.16 | 4 |

## 5. Systems map (Unity)

| System | Script | Notes |
|---|---|---|
| Rules engine | `Simulation/GameSimulation.cs` | map generator, city grid, economy, research, eras, events, crises, advisors, saves |
| Clock | `Core/TimeManager.cs` | frame-rate independent ticks, max 3 per frame, Space and 1 to 3 keys |
| Economy bridge | `Core/EconomyManager.cs` | steps the simulation each tick, publishes an allocation-free snapshot |
| Camera | `Core/RTSCameraController.cs` | WASD, Q/E, edge scroll, wheel zoom, right-drag orbit, terrain clamp |
| Building | `Core/GridPlacementSystem.cs` | raycast picking, green/red ghost, drag roads and zones, bulldoze |
| Eras | `Data/EraManager.cs` | `OnEraAdvanced`, swaps LOD meshes of upgradable buildings |
| Data | `Data/BuildingData.cs`, `TechCivicTreeSO.cs`, `BuildingCatalog.cs` | ScriptableObjects generated by the setup menu |
| Agents | `Core/CitizenTrafficNavMesh.cs` | NavMesh villagers, cars and carts on the road graph (drive on the left), trains, ships |
| Saves | `Systems/SaveLoadManager.cs` | JSON in `persistentDataPath/saves`, Steam Cloud mirror, F5 / F9 |
| HUD | `Systems/UIManager.cs` | uGUI built in code; Greybox / Full 3D Art toggle (also G key) |
| Audio | `Systems/AudioAtmosphereManager.cs` | procedural gamelan, keroncong and synth loops per era; rainforest and sea beds |
| Steam | `Systems/SteamworksManager.cs` | achievements and cloud saves, compiled only with Steamworks.NET |

## 6. Art direction and performance budget

* Low-poly, flat-shaded, colour from one 512 x 512 **MasterPaletteAtlas** (64 PBR materials as 32 px
  cells, plus metallic-smoothness and emission atlases). Every model shares one URP Lit material, so
  the SRP Batcher and GPU instancing apply to all buildings, vehicles and trees.
* Three LODs per model: LOD0 full detail, LOD1 with small parts removed and half the curve segments,
  LOD2 as up to three stacked boxes plus a ground slab (12 to 48 triangles).
* Target: 5,000+ buildings at 60 FPS on a mid-range GPU at 1080p. This is a design target; confirm it
  with the Unity Profiler on target hardware.

## 7. Achievements (Steam)

| API name | Unlocked when |
|---|---|
| `ACH_ERA_2_TIN_RUSH` | the city enters Era 2 |
| `ACH_ERA_3_MERDEKA` | the city enters Era 3 |
| `ACH_ERA_4_SMART_METROPOLIS` | the city enters Era 4 |
| `ACH_SURVIVE_BAH_BESAR` | the 1926 Great Flood crisis is resolved with a non-negative treasury |

## 8. Historical sources and review

Content was written from secondary sources listed in each Sejarahpedia entry (`sejarahpedia.json`).
For classroom or commercial release it should be reviewed against the national collections:

* **Arkib Negara Malaysia** (National Archives of Malaysia), founded 1 December 1957 as the Public
  Records Office, renamed in 1963, governed by the National Archives Act 2003 ([arkib.gov.my](https://www.arkib.gov.my);
  [overview](https://en.wikipedia.org/wiki/National_Archives_of_Malaysia)). Use it for treaties,
  colonial records, photographs of tin mines, railways and Merdeka.
* **Jabatan Muzium Malaysia** (Department of Museums Malaysia), which runs Muzium Negara and 18 other
  museums, including the Lembah Bujang archaeological museum ([jmm.gov.my](https://www.jmm.gov.my)).
  Use it for artefacts, architecture references and the Bujang Valley material.

Where sources disagree (the Bujang Valley dates, 1912 or 1913 for the first dredge, 1 February or
1 June 1885 for the Port Weld line) the game text states the uncertainty instead of picking silently.

## States and leaders

Each state has one fixed historical leader, a permanent state passive and a leader passive.
Profiles, bilingual biographies, historical references and exact balance values live in
`Assets/Resources/GameData/states.json` and `leaders.json`. Melaka/Tun Perak is the default.
Leaders represent their state throughout the four eras; they do not consume advisor seats and
cannot also be recruited as advisors. Abilities stack additively within existing effect categories.

The state selector shows an animated full-body character, map region, biography and both bonuses.
A leader panel can be reopened during play. Reduced motion disables preview animations. Maps
preserve source coastlines, rivers and elevation, while resources are gameplay abstractions.
No modern road network or city buildings are imported into historical starts. All map assets ship
with the game; there is no runtime download.

Version-three saves contain exact map layers and the selected pairing. Older saves retain the
procedural generator and remain neutral legacy cities. Changing geographic assets must not move
terrain in an existing save. The lead verifies import, gameplay, character visuals and performance
in Unity 6000.3 before merging the milestone.
