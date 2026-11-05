using System;
using TamadunKota.Simulation;

namespace TamadunKota.UI
{
    /// <summary>
    /// Player commands the web engine has (src/core/engine.ts, sim/advisors.ts) but the C# engine
    /// does not expose yet, written against GameSimulation's public state with the web game's
    /// rules. They belong in GameSimulation; see "Requests" in docs/TEAM_PLAN.md. Once lane C adds
    /// them, these become one-line forwards.
    /// </summary>
    public static class SimCommands
    {
        /// <summary>Council seats per era (web ADVISOR_SLOTS; the same table is local to GameSimulation.RecruitAdvisor).</summary>
        static readonly int[] AdvisorSlotsByEra = { 0, 1, 2, 2, 3 };

        public static int AdvisorSlots(GameSimulation sim) => AdvisorSlotsByEra[Math.Max(0, Math.Min(4, sim.CurrentEra))];

        public static bool DismissAdvisor(GameSimulation sim, string id)
        {
            if (!sim.Advisors.Remove(id)) return false;
            sim.RefreshEffects();
            return true;
        }

        public static int PolicySlots(GameSimulation sim) => sim.EraDef.policySlots;

        /// <summary>Web isPolicyUnlocked: a finished civic unlocks it.</summary>
        public static bool IsPolicyUnlocked(GameSimulation sim, string id)
        {
            var research = sim.Db.Research;
            for (int i = 0; i < research.Length; i++)
            {
                if (!sim.Tech.Done[i] || research[i].IsTech) continue;
                if (Array.IndexOf(research[i].unlockPolicies, id) >= 0) return true;
            }
            return false;
        }

        /// <summary>Web adoptPolicy. Returns a Loc key for the reason when it fails, or null on success.</summary>
        public static string AdoptPolicy(GameSimulation sim, string id)
        {
            bool known = false;
            foreach (var p in sim.Db.Policies) if (p.id == id) known = true;
            if (!known || !IsPolicyUnlocked(sim, id)) return "err.locked";
            if (sim.Policies.Contains(id)) return "err.invalid";
            if (sim.Policies.Count >= PolicySlots(sim)) return "err.noSlot";
            sim.Policies.Add(id);
            sim.RefreshEffects();
            return null;
        }

        public static bool RevokePolicy(GameSimulation sim, string id)
        {
            if (!sim.Policies.Remove(id)) return false;
            sim.RefreshEffects();
            return true;
        }
    }
}
