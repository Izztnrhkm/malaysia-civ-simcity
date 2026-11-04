using System;
using TamadunKota.Simulation;
using UnityEngine;

namespace TamadunKota.Core
{
    /// <summary>The numbers the HUD shows, refreshed after every tick. A struct: no allocations.</summary>
    [Serializable]
    public struct EconomySnapshot
    {
        public double treasury, netIncome;
        public double food, timber, tin, rubber, energy, tech, culture;
        public double population, happiness, unemployment, foodSatisfaction;
        public double demandR, demandC, demandI;
        public double researchPerTick, exportCapacity;
        public int year, month, era;
    }

    /// <summary>
    /// Runs one GameSimulation turn on every TimeManager tick and publishes the results:
    /// Timber, Tin, Rubber, Food, Energy, Tech and the Treasury (Kupang / Straits dollar /
    /// Ringgit by era). The heavy lifting is the allocation-free EconomyModel in the
    /// TamadunKota.Simulation assembly.
    /// </summary>
    [DefaultExecutionOrder(-400)]
    public class EconomyManager : MonoBehaviour
    {
        public TimeManager time;

        public EconomySnapshot Current;
        public event Action<EconomySnapshot> Updated;

        GameSimulation Sim => GameRoot.Instance != null ? GameRoot.Instance.Sim : null;

        void OnEnable()
        {
            if (time == null) time = FindAnyObjectByType<TimeManager>();
            if (time != null) time.Tick += OnTick;
            if (GameRoot.Instance != null) GameRoot.Instance.SimulationChanged += OnSimulationChanged;
        }

        void OnDisable()
        {
            if (time != null) time.Tick -= OnTick;
            if (GameRoot.Instance != null) GameRoot.Instance.SimulationChanged -= OnSimulationChanged;
        }

        void Start() => Publish();

        void OnSimulationChanged(GameSimulation sim) => Publish();

        void OnTick(int tick)
        {
            var sim = Sim;
            if (sim == null) return;
            sim.Step();
            Publish();
        }

        public void Publish()
        {
            var sim = Sim;
            if (sim == null) return;
            var e = sim.Economy;
            var s = sim.Stock;
            Current.treasury = s[ResourceType.Treasury];
            Current.netIncome = e.Budget.Net;
            Current.food = s[ResourceType.Food];
            Current.timber = s[ResourceType.Timber];
            Current.tin = s[ResourceType.Tin];
            Current.rubber = s[ResourceType.Rubber];
            Current.energy = s[ResourceType.Energy];
            Current.tech = s[ResourceType.Tech];
            Current.culture = s[ResourceType.Culture];
            Current.population = e.Population;
            Current.happiness = e.Happiness;
            Current.unemployment = e.Unemployment;
            Current.foodSatisfaction = e.FoodSatisfaction;
            Current.demandR = e.DemandR;
            Current.demandC = e.DemandC;
            Current.demandI = e.DemandI;
            Current.researchPerTick = e.ResearchPerTick;
            Current.exportCapacity = e.ExportCapacity;
            Current.year = sim.Year;
            Current.month = sim.Month;
            Current.era = sim.CurrentEra;
            Updated?.Invoke(Current);
        }

        /// <summary>Set a zone tax rate (0-20 %).</summary>
        public void SetTax(ZoneType zone, double rate)
        {
            var sim = Sim;
            if (sim == null) return;
            rate = Math.Max(0, Math.Min(20, Math.Round(rate)));
            if (zone == ZoneType.Residential) sim.TaxR = rate;
            else if (zone == ZoneType.Commercial) sim.TaxC = rate;
            else if (zone == ZoneType.Industrial) sim.TaxI = rate;
        }

        public string Currency
        {
            get
            {
                var sim = Sim;
                return sim == null ? "" : sim.EraDef.currencySymbol;
            }
        }
    }
}
