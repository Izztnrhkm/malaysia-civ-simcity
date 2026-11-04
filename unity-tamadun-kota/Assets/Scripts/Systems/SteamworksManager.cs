using System;
using System.Collections.Generic;
using TamadunKota.Core;
using TamadunKota.Data;
using TamadunKota.Simulation;
using UnityEngine;
#if !DISABLESTEAMWORKS && STEAMWORKS_NET
using Steamworks;
#endif

namespace TamadunKota.Systems
{
    /// <summary>Achievement API names. They must match the ones created in the Steamworks partner site.</summary>
    public static class Achievements
    {
        public const string Era2TinRush = "ACH_ERA_2_TIN_RUSH";
        public const string Era3Merdeka = "ACH_ERA_3_MERDEKA";
        public const string Era4SmartMetropolis = "ACH_ERA_4_SMART_METROPOLIS";
        public const string SurviveBahBesar = "ACH_SURVIVE_BAH_BESAR";

        public static readonly string[] All = { Era2TinRush, Era3Merdeka, Era4SmartMetropolis, SurviveBahBesar };

        public static string ForEra(int era) =>
            era == 2 ? Era2TinRush : era == 3 ? Era3Merdeka : era == 4 ? Era4SmartMetropolis : null;
    }

    /// <summary>
    /// Steam integration: init/shutdown, achievements and Steam Cloud (Remote Storage) save sync.
    ///
    /// All Steam calls are compiled only when DISABLESTEAMWORKS is NOT defined and the
    /// Steamworks.NET package (com.rlabrecque.steamworks.net) is installed, which defines
    /// STEAMWORKS_NET through the runtime asmdef's versionDefines. Without the package the
    /// project still compiles; achievements are then recorded locally in PlayerPrefs and the
    /// cloud functions report false, so the game behaves the same off Steam.
    /// </summary>
    [DefaultExecutionOrder(-900)]
    public class SteamworksManager : MonoBehaviour
    {
        public static SteamworksManager Instance { get; private set; }

        [Tooltip("Your Steam App ID. 480 is Valve's public test app (Spacewar).")]
        public uint appId = 480;
        [Tooltip("Relaunch through Steam when the game was started outside the client (release builds only)")]
        public bool restartThroughSteam = false;

        public bool Initialized { get; private set; }
        /// <summary>Raised whenever an achievement is unlocked for the first time (Steam or local).</summary>
        public static event Action<string> AchievementUnlocked;

        GameSimulation sim;
        EraManager eraManager;
        readonly HashSet<string> unlockedLocal = new HashSet<string>();

        void Awake()
        {
            if (Instance != null && Instance != this) { Destroy(gameObject); return; }
            Instance = this;
            foreach (var a in Achievements.All)
                if (PlayerPrefs.GetInt("ach_" + a, 0) == 1) unlockedLocal.Add(a);
            Init();
        }

        void Init()
        {
#if !DISABLESTEAMWORKS && STEAMWORKS_NET
            try
            {
                if (restartThroughSteam && !Application.isEditor && SteamAPI.RestartAppIfNecessary(new AppId_t(appId)))
                {
                    Application.Quit();
                    return;
                }
                Initialized = SteamAPI.Init();
                if (!Initialized) Debug.LogWarning("[Steam] SteamAPI.Init() failed. Is the Steam client running and steam_appid.txt present?");
            }
            catch (DllNotFoundException e)
            {
                Debug.LogWarning("[Steam] steam_api native library not found: " + e.Message);
                Initialized = false;
            }
#else
            Initialized = false;
#endif
        }

        void OnEnable()
        {
            if (GameRoot.Instance != null)
            {
                GameRoot.Instance.SimulationChanged += Bind;
                Bind(GameRoot.Instance.Sim);
            }
            eraManager = FindAnyObjectByType<EraManager>();
            if (eraManager != null) eraManager.OnEraAdvanced += OnEra;
        }

        void OnDisable()
        {
            if (GameRoot.Instance != null) GameRoot.Instance.SimulationChanged -= Bind;
            if (eraManager != null) eraManager.OnEraAdvanced -= OnEra;
            Bind(null);
        }

        void Bind(GameSimulation s)
        {
            if (sim != null) sim.Events.CrisisResolved -= OnCrisisResolved;
            sim = s;
            if (sim != null) sim.Events.CrisisResolved += OnCrisisResolved;
        }

        void OnEra(int era)
        {
            var id = Achievements.ForEra(era);
            if (id != null) Unlock(id);
        }

        void OnCrisisResolved(CrisisRecord crisis, CrisisChoiceRecord choice, bool auto)
        {
            // Surviving = the treasury is still solvent after the 1926 flood has been dealt with.
            if (crisis.id == "bah_besar" && sim != null && sim.Stock[ResourceType.Treasury] >= 0)
                Unlock(Achievements.SurviveBahBesar);
        }

        void Update()
        {
#if !DISABLESTEAMWORKS && STEAMWORKS_NET
            if (Initialized) SteamAPI.RunCallbacks();
#endif
        }

        void OnDestroy()
        {
            if (Instance != this) return;
            Instance = null;
#if !DISABLESTEAMWORKS && STEAMWORKS_NET
            if (Initialized) SteamAPI.Shutdown();
#endif
            Initialized = false;
        }

        public bool IsUnlocked(string id)
        {
#if !DISABLESTEAMWORKS && STEAMWORKS_NET
            if (Initialized && SteamUserStats.GetAchievement(id, out bool done)) return done;
#endif
            return unlockedLocal.Contains(id);
        }

        /// <summary>Unlock an achievement on Steam (when available) and locally.</summary>
        public void Unlock(string id)
        {
            if (string.IsNullOrEmpty(id) || IsUnlocked(id)) return;
#if !DISABLESTEAMWORKS && STEAMWORKS_NET
            if (Initialized)
            {
                SteamUserStats.SetAchievement(id);
                SteamUserStats.StoreStats();
            }
#endif
            unlockedLocal.Add(id);
            PlayerPrefs.SetInt("ach_" + id, 1);
            PlayerPrefs.Save();
            Debug.Log("[Achievement] " + id);
            AchievementUnlocked?.Invoke(id);
        }

        // ------------------------------------------------------------ Steam Cloud

        public bool CloudAvailable
        {
            get
            {
#if !DISABLESTEAMWORKS && STEAMWORKS_NET
                return Initialized && SteamRemoteStorage.IsCloudEnabledForAccount() && SteamRemoteStorage.IsCloudEnabledForApp();
#else
                return false;
#endif
            }
        }

        /// <summary>Write a save file to Steam Cloud. Returns false when the cloud is unavailable.</summary>
        public bool CloudWrite(string fileName, byte[] data)
        {
#if !DISABLESTEAMWORKS && STEAMWORKS_NET
            if (!CloudAvailable || data == null) return false;
            return SteamRemoteStorage.FileWrite(fileName, data, data.Length);
#else
            return false;
#endif
        }

        /// <summary>Read a save file from Steam Cloud, or null when missing or unavailable.</summary>
        public byte[] CloudRead(string fileName)
        {
#if !DISABLESTEAMWORKS && STEAMWORKS_NET
            if (!CloudAvailable || !SteamRemoteStorage.FileExists(fileName)) return null;
            int size = SteamRemoteStorage.GetFileSize(fileName);
            if (size <= 0) return null;
            var buffer = new byte[size];
            int read = SteamRemoteStorage.FileRead(fileName, buffer, size);
            if (read <= 0) return null;
            if (read == size) return buffer;
            var trimmed = new byte[read];
            Array.Copy(buffer, trimmed, read);
            return trimmed;
#else
            return null;
#endif
        }
    }
}
