# Geographic source notices

The `osm.geojson` files are extracts and adaptations of the OpenStreetMap database.
They retain the Open Database License 1.0 (ODbL), independently of the game code.
The geometry is supplied here so recipients can access the database used for the
produced map images and terrain layers. OpenStreetMap attribution applies to the
map images and gameplay map displays as well.

- Copyright: OpenStreetMap contributors.
- License: https://opendatacommons.org/licenses/odbl/1-0/
- Attribution and contributor information: https://www.openstreetmap.org/copyright
- Each snapshot records its actual OSM API URL, retrieval time, original response
  SHA-256, object identifiers, object versions and object timestamps. User names and
  unrelated buildings/roads are omitted.

The `dsm_samples.npz` files contain the bilinearly sampled, geographic crop of the
Copernicus DEM 2021 GLO-30 Public digital surface model. The original one-degree
GeoTIFF URL, byte count and SHA-256 are recorded in each `dem_sources.json`.
These geographic samples are supplied with the following source notice:

Produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and
Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all
rights reserved.

- Public data registry: https://registry.opendata.aws/copernicus-dem/
- Dataset and license conditions: https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM
- Dataset citation: https://doi.org/10.5270/ESA-c5d3d65

The geographic inputs are contemporary reference landforms, not reconstructed
historic coastlines. The game does not ship modern OSM buildings or roads. The
Copernicus input is a surface model rather than a surveyed bare-earth model, so
building and vegetation height can influence measured relief. The authored
fertility and mineral layers do not represent mineral surveys or land-use advice.
