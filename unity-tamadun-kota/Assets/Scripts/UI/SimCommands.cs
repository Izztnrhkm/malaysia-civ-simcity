using TamadunKota.Simulation;

namespace TamadunKota.UI
{
    /// <summary>Compatibility forwards for panels that use the simulation command facade.</summary>
    public static class SimCommands
    {
        public static int AdvisorSlots(GameSimulation sim) => sim.AdvisorSlots;
        public static bool DismissAdvisor(GameSimulation sim, string id) => sim.DismissAdvisor(id);
        public static int PolicySlots(GameSimulation sim) => sim.PolicySlots;
        public static bool IsPolicyUnlocked(GameSimulation sim, string id) => sim.IsPolicyUnlocked(id);
        public static string AdoptPolicy(GameSimulation sim, string id) => sim.AdoptPolicy(id).Reason;
        public static bool RevokePolicy(GameSimulation sim, string id) => sim.RevokePolicy(id).Ok;
    }
}
