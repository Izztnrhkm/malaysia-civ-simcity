"""Contract tests for geographic orientation and starting-region validation."""
import unittest
import bake_maps as maps
import numpy as np


class GeographicContracts(unittest.TestCase):
    def test_directed_northward_coast_keeps_land_west(self):
        source = {"features": [{"properties": {"natural": "coastline"},
                                "geometry": {"type": "LineString", "coordinates": [[.5, -.2], [.5, 1.2]]}}]}
        terrain = maps.layer_data({"latitude": .5, "stateId": "test"}, (0,0,1,1), source,
                                  np.ones((16,16), dtype=np.float32), 16)[0]
        self.assertTrue(np.all(terrain[:, :7] >= 3))
        self.assertTrue(np.all(terrain[:, 9:] <= 2))

    def test_north_up_rows_and_westward_coast(self):
        source = {"features": [{"properties": {"natural": "coastline"},
                                "geometry": {"type": "LineString", "coordinates": [[1.2, .5], [-.2, .5]]}}]}
        terrain = maps.layer_data({"latitude": .5, "stateId": "test"}, (0,0,1,1), source,
                                  np.ones((16,16), dtype=np.float32), 16)[0]
        self.assertTrue(np.all(terrain[:7] <= 2))
        self.assertTrue(np.all(terrain[9:] >= 3))

    def test_small_coastal_island_does_not_make_inland_landmass_playable(self):
        terrain = np.full((256,256), 6, dtype=np.uint8)
        terrain[:,:30] = 1
        terrain[:,40:45] = 5
        with self.assertRaisesRegex(ValueError, "Unplayable"):
            maps.validate(terrain)

    def test_coastal_start_has_connected_expansion_land(self):
        terrain = np.full((256,256), 6, dtype=np.uint8)
        terrain[:,:100] = 1
        report = maps.validate(terrain)
        self.assertGreater(report["harborFootprints"], 0)
        self.assertGreaterEqual(report["largestConnectedLandCells"], 8_000)
        self.assertEqual(terrain[report["harborY"], report["harborX"]], 6)


if __name__ == "__main__":
    unittest.main()
