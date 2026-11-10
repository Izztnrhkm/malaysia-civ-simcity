using System;
using System.Collections.Generic;
using TamadunKota.Core;
using UnityEngine;

namespace TamadunKota.UI
{
    /// <summary>
    /// UI strings from the authoritative Assets/Resources/Localization/{ms,en}.json catalogs.
    /// A missing key returns the key itself (and logs once), so a gap is visible, not fatal.
    /// </summary>
    public static class Loc
    {
        [Serializable] class Item { public string key, value; }
        [Serializable] class Table { public Item[] items = Array.Empty<Item>(); }

        static Dictionary<string, string> ms, en;
        static readonly HashSet<string> warned = new HashSet<string>();

        static bool Malay => GameRoot.Instance == null || GameRoot.Instance.malay;

        static Dictionary<string, string> Load(string lang)
        {
            var map = new Dictionary<string, string>(1024);
            var asset = Resources.Load<TextAsset>("Localization/" + lang);
            if (asset == null)
            {
                Debug.LogError("Missing Resources/Localization/" + lang + ".json");
                return map;
            }
            var table = JsonUtility.FromJson<Table>(asset.text);
            if (table?.items != null) foreach (var it in table.items) if (it.key != null) map[it.key] = it.value ?? "";
            return map;
        }

        /// <summary>The string for <paramref name="key"/> in the current language.</summary>
        public static string Get(string key) => Get(key, Malay);

        public static string Get(string key, bool malay)
        {
            var map = malay ? (ms ??= Load("ms")) : (en ??= Load("en"));
            if (map.TryGetValue(key, out var s)) return s;
            if (warned.Add(key)) Debug.LogWarning("[Loc] missing key " + key + (malay ? " (ms)" : " (en)"));
            return key;
        }

        public static bool Has(string key) => (Malay ? (ms ??= Load("ms")) : (en ??= Load("en"))).ContainsKey(key);

        /// <summary>Get with named placeholders: Format("advisors.slots", "used", 1, "max", 2).</summary>
        public static string Format(string key, string name1, object value1, string name2 = null, object value2 = null)
        {
            string s = Get(key).Replace("{" + name1 + "}", value1?.ToString() ?? "");
            if (name2 != null) s = s.Replace("{" + name2 + "}", value2?.ToString() ?? "");
            return s;
        }
    }
}
