# Offline state geography

Each of the thirteen state maps is a fixed, north-up 256 × 256 grid of four-metre
cells, covering approximately 1.024 km on each side. `Assets/Resources/Maps` holds
the portable JSON layers and preview images used by Unity. Starting or loading a
city does not contact a map server.

## Source data and authoring

Shorelines use actual directed OpenStreetMap coastline geometry: land is on the
left side and marine water on the right side of each way. Closed water polygons
and available multipolygon rings identify inland rivers and water bodies. River
centre lines without mapped polygons use the stated OSM width, or a twelve-metre
cartographic width when no width is recorded. Woods, mangroves and beaches use
their mapped area tags where available. Modern buildings and roads are not loaded.

Elevation uses bilinear samples from the public Copernicus DEM 2021 GLO-30 digital
surface model. Its original resolution is approximately thirty metres, so the
four-metre game cells do not imply four-metre survey accuracy. The common rendering
range preserves relative relief up to sixty metres; higher ground remains mountain
terrain. Offshore display depth is an authored visual gradient, not bathymetry.
Fertility and mineral richness are authored gameplay layers and vary slightly with
the city seed. The seed does not move the coastline, rivers, or elevation.

`scripts/geography/regions.json` fixes every crop centre. Actual south/west/north/east
bounds are included in each shipped JSON file and in `validation.json`. The Perak
crop is the marine coastal estuary approximately five kilometres south of Kuala
Sepetang village: the village itself has tidal river channels but no marine shore
within the selected one-kilometre footprint. This keeps coastal harbor placement
valid without inventing an ocean coastline at the village.

## Rebuild and check

Python 3.11 or later is supported. From the repository root, install the pinned
geography dependencies in an isolated environment or the tool-local directory:

```powershell
python -m pip install --target unity-tamadun-kota/scripts/geography/.deps -r unity-tamadun-kota/scripts/geography/requirements.txt
python unity-tamadun-kota/scripts/geography/bake_maps.py
python unity-tamadun-kota/scripts/geography/bake_maps.py --check
python -m unittest discover -s unity-tamadun-kota/scripts/geography -p test_geography.py -v
```

Once dependencies are installed, the bake and check use committed source snapshots
without internet access. `--check` verifies the source snapshot SHA-256 values against the pinned
validation manifest and compares all four baked JSON layers byte for byte. The
large original DSM tiles stay in the ignored `.cache` directory.

To obtain missing sources for a newly authored crop, use `--fetch`. This contacts
the public OSM map API and public Copernicus S3 bucket; it requires no API key or
AWS account. `--only perak` limits the work to one state. A changed crop requires
new source sampling and a reviewed validation manifest. OSM snapshots retain object
identifiers, versions, timestamps, source URL and response SHA-256. DSM metadata
retains the full original tile SHA-256 and the exact sample bounds.

## Validation

The bake requires at least 8,000 connected buildable land cells, at least 1,000
marine cells, and legal two-by-two coastal harbor footprints connected to a land
component of at least 8,000 cells. It reports land/water counts, component size,
harbor count and a sample valid harbor anchor. C# tests additionally exercise the
real placement and growth rules; the Python check does not replace Unity play-testing.

The source geometry and DSM samples are committed under
`scripts/geography/sources` to support offline reproducibility. Their data licenses
remain distinct from the game code. The full notices are in
`scripts/geography/sources/LICENSING.md`; each map also carries the display attribution.

Sources: [OpenStreetMap coastline convention](https://wiki.openstreetmap.org/wiki/Tag:natural%3Dcoastline),
[OpenStreetMap copyright](https://www.openstreetmap.org/copyright),
[Copernicus public dataset](https://registry.opendata.aws/copernicus-dem/),
[Copernicus dataset and source notices](https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM).
