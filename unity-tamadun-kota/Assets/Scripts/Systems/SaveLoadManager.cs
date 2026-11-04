using System;
using System.IO;
using System.Text;
using TamadunKota.Core;
using TamadunKota.Simulation;
using UnityEngine;
using UnityEngine.InputSystem;

namespace TamadunKota.Systems
{
    /// <summary>Summary of one save slot for the load menu.</summary>
    public struct SaveSlotInfo
    {
        public int slot;
        public bool exists;
        public string cityName;
        public int era, year;
        public string savedAt;
    }

    /// <summary>
    /// Saves and loads the whole game state (era, resources, research progress, every
    /// building's coordinates, transport, zones, events) as JSON in
    /// Application.persistentDataPath/saves/slotN.json. When Steam Cloud is available the same
    /// bytes are mirrored to Remote Storage, and loading picks whichever copy is newer.
    /// F5 = quick save (slot 0), F9 = quick load. Autosave every few in-game years.
    /// </summary>
    public class SaveLoadManager : MonoBehaviour
    {
        public const int SlotCount = 4;

        [Tooltip("Ticks between autosaves into slot 0 (0 = off)")]
        public int autosaveEveryTicks = 120;
        public bool keyboardShortcuts = true;

        public event Action<int> Saved;
        public event Action<int> Loaded;
        public event Action<string> Failed;

        TimeManager time;
        string Folder => Path.Combine(Application.persistentDataPath, "saves");

        public static string FileName(int slot) => "slot" + slot + ".json";
        public string PathFor(int slot) => Path.Combine(Folder, FileName(slot));

        void OnEnable()
        {
            time = FindAnyObjectByType<TimeManager>();
            if (time != null) time.Tick += OnTick;
        }

        void OnDisable()
        {
            if (time != null) time.Tick -= OnTick;
        }

        void OnTick(int tick)
        {
            if (autosaveEveryTicks > 0 && tick % autosaveEveryTicks == 0) Save(0);
        }

        void Update()
        {
            if (!keyboardShortcuts) return;
            var kb = Keyboard.current;
            if (kb == null) return;
            if (kb.f5Key.wasPressedThisFrame) Save(0);
            if (kb.f9Key.wasPressedThisFrame) Load(0);
        }

        public bool Save(int slot)
        {
            var root = GameRoot.Instance;
            if (root == null || root.Sim == null) return false;
            try
            {
                var save = SaveCodec.Capture(root.Sim, root.cityName, root.seed);
                string json = JsonUtility.ToJson(save);
                Directory.CreateDirectory(Folder);
                string path = PathFor(slot);
                string tmp = path + ".tmp";
                File.WriteAllText(tmp, json, Encoding.UTF8);
                if (File.Exists(path)) File.Delete(path);
                File.Move(tmp, path);
                var steam = SteamworksManager.Instance;
                if (steam != null) steam.CloudWrite(FileName(slot), Encoding.UTF8.GetBytes(json));
                Saved?.Invoke(slot);
                return true;
            }
            catch (Exception e)
            {
                Debug.LogError("[Save] " + e);
                Failed?.Invoke(e.Message);
                return false;
            }
        }

        public bool Load(int slot)
        {
            var root = GameRoot.Instance;
            if (root == null) return false;
            try
            {
                var save = ReadNewest(slot);
                if (save == null) { Failed?.Invoke("Empty slot"); return false; }
                var sim = SaveCodec.Restore(root.Db, save);
                root.seed = save.seed;
                root.cityName = save.cityName;
                root.scenario = save.scenario;
                root.Replace(sim);
                Loaded?.Invoke(slot);
                return true;
            }
            catch (Exception e)
            {
                Debug.LogError("[Load] " + e);
                Failed?.Invoke(e.Message);
                return false;
            }
        }

        public bool Delete(int slot)
        {
            string path = PathFor(slot);
            if (!File.Exists(path)) return false;
            File.Delete(path);
            return true;
        }

        public SaveSlotInfo Info(int slot)
        {
            var info = new SaveSlotInfo { slot = slot };
            try
            {
                var s = ReadNewest(slot);
                if (s == null) return info;
                info.exists = true;
                info.cityName = s.cityName;
                info.era = s.era;
                info.year = s.year;
                info.savedAt = s.savedAt;
            }
            catch (Exception) { }
            return info;
        }

        /// <summary>The newer of the local file and the Steam Cloud copy (by savedAt).</summary>
        SaveGame ReadNewest(int slot)
        {
            SaveGame local = null, cloud = null;
            string path = PathFor(slot);
            if (File.Exists(path)) local = Parse(File.ReadAllText(path, Encoding.UTF8));
            var steam = SteamworksManager.Instance;
            if (steam != null)
            {
                var bytes = steam.CloudRead(FileName(slot));
                if (bytes != null) cloud = Parse(Encoding.UTF8.GetString(bytes));
            }
            if (local == null) return cloud;
            if (cloud == null) return local;
            return string.CompareOrdinal(cloud.savedAt ?? "", local.savedAt ?? "") > 0 ? cloud : local;
        }

        static SaveGame Parse(string json)
        {
            if (string.IsNullOrEmpty(json)) return null;
            var s = JsonUtility.FromJson<SaveGame>(json);
            return s != null && s.format == SaveGame.Format ? s : null;
        }
    }
}
