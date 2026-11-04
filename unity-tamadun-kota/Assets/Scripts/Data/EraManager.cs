using System;
using TamadunKota.Core;
using TamadunKota.Simulation;
using UnityEngine;
using UnityEngine.Events;

namespace TamadunKota.Data
{
    /// <summary>Economy multipliers that change with the era (read from eras.json).</summary>
    [Serializable]
    public struct EraMultipliers
    {
        [Tooltip("Spending power per citizen; scales tax income and commercial demand")]
        public double wealth;
        [Tooltip("Commercial jobs wanted per resident")]
        public double commercialRatio;
        [Tooltip("Industrial jobs wanted per resident")]
        public double industrialRatio;
        [Tooltip("Highest zone density a lot can reach")]
        public int maxDensity;
        public int policySlots;
        public int monthsPerTick;
    }

    [Serializable] public class EraAdvancedUnityEvent : UnityEvent<int> { }

    /// <summary>
    /// Era state machine for the scene. The authoritative state (CurrentEra 1..4 and the
    /// requirements to advance) lives in the pure-C# <see cref="EraStateMachine"/>; this
    /// component exposes it to Unity, raises <see cref="OnEraAdvanced"/>, swaps the
    /// MeshFilter / LODGroup meshes of every placed upgradable building and of every zoned lot
    /// to the new era's models, and publishes the new economy multipliers.
    ///
    /// Era 1: Ancient Kingdoms and the Melaka entrepôt. Era 2: Tin, rubber and rail.
    /// Era 3: Merdeka and industrialisation. Era 4: Smart, green metropolis.
    /// </summary>
    [DefaultExecutionOrder(-300)]
    public class EraManager : MonoBehaviour
    {
        public CityView cityView;

        [Tooltip("When on, zoned lots built in older eras are restyled to the new era's architecture")]
        public bool restyleOldLots = false;

        /// <summary>(newEra) - raised after the simulation has advanced and the meshes are swapped.</summary>
        public event Action<int> OnEraAdvanced;
        /// <summary>Inspector hook for designers (sound stingers, UI banners, etc.).</summary>
        public EraAdvancedUnityEvent onEraAdvanced = new EraAdvancedUnityEvent();

        public EraMultipliers Multipliers { get; private set; }

        GameSimulation sim;

        public int CurrentEra => sim != null ? sim.CurrentEra : 1;
        public EraRecord Definition => sim != null ? sim.EraDef : null;

        void OnEnable()
        {
            if (cityView == null) cityView = FindAnyObjectByType<CityView>();
            if (GameRoot.Instance != null)
            {
                GameRoot.Instance.SimulationChanged += Bind;
                Bind(GameRoot.Instance.Sim);
            }
        }

        void OnDisable()
        {
            if (GameRoot.Instance != null) GameRoot.Instance.SimulationChanged -= Bind;
            Bind(null);
        }

        void Bind(GameSimulation s)
        {
            if (sim != null) sim.Era.EraAdvanced -= HandleEraAdvanced;
            sim = s;
            if (sim == null) return;
            sim.Era.EraAdvanced += HandleEraAdvanced;
            UpdateMultipliers();
        }

        /// <summary>Try to advance (respecting the requirements unless forced). Returns true on success.</summary>
        public bool TryAdvance(bool force = false) => sim != null && sim.AdvanceEra(force);

        public bool CanAdvance => sim != null && sim.Era.CanAdvance(sim.Tech, sim.Economy.Population, sim.City);

        public System.Collections.Generic.IReadOnlyList<EraRequirement> Requirements =>
            sim != null ? sim.Era.Requirements(sim.Tech, sim.Economy.Population, sim.City) : Array.Empty<EraRequirement>();

        void HandleEraAdvanced(int oldEra, int newEra)
        {
            UpdateMultipliers();
            SwapAllMeshes(newEra);
            OnEraAdvanced?.Invoke(newEra);
            onEraAdvanced.Invoke(newEra);
            Debug.Log($"[EraManager] Era {oldEra} -> {newEra}: {sim.EraDef.nameEn}");
        }

        void UpdateMultipliers()
        {
            var e = sim.EraDef;
            if (e == null) return;
            Multipliers = new EraMultipliers
            {
                wealth = e.wealth,
                commercialRatio = e.commercialRatio,
                industrialRatio = e.industrialRatio,
                maxDensity = e.maxDensity,
                policySlots = e.policySlots,
                monthsPerTick = e.monthsPerTick,
            };
        }

        /// <summary>
        /// Swap every upgradable building (and optionally every lot) to the meshes of
        /// <paramref name="era"/>. Non-upgradable buildings keep their period look: a Melaka
        /// istana does not turn into a tower.
        /// </summary>
        public void SwapAllMeshes(int era)
        {
            if (cityView == null) return;
            foreach (var view in cityView.AllViews())
            {
                if (view == null || view.data == null) continue;
                bool isLot = view.cellIndex >= 0;
                if (isLot)
                {
                    if (!restyleOldLots) continue;
                    if (sim != null) sim.City.Style[view.cellIndex] = (byte)era;
                    view.SetEra(era);
                }
                else if (view.data.upgradable)
                {
                    view.SetEra(era);
                }
            }
        }
    }
}
