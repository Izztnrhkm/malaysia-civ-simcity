using System;
using System.Collections.Generic;
using TamadunKota.Simulation;
using UnityEngine;

namespace TamadunKota.Data
{
    [Serializable]
    public class TechNode
    {
        public string id;
        public bool isCivic;
        [Range(1, 4)] public int era = 1;
        public string historicalDate;
        public float cost;
        public string[] prerequisites = Array.Empty<string>();
        public string[] unlocksBuildings = Array.Empty<string>();
        public string[] unlocksTransport = Array.Empty<string>();
        public string[] unlocksPolicies = Array.Empty<string>();
        public string nameMs, nameEn;
        [TextArea(2, 5)] public string descriptionMs;
        [TextArea(2, 5)] public string descriptionEn;
        public string sejarahpediaEntry;
    }

    [Serializable]
    public class CrisisChoiceNode
    {
        public string id, nameMs, nameEn;
        [TextArea(1, 4)] public string descriptionMs;
        [TextArea(1, 4)] public string descriptionEn;
        public float cost;
    }

    [Serializable]
    public class CrisisNode
    {
        public string id;
        public int[] eras = Array.Empty<int>();
        public int triggerYear;
        public string triggerEvent;
        public string nameMs, nameEn;
        [TextArea(2, 6)] public string descriptionMs;
        [TextArea(2, 6)] public string descriptionEn;
        public int defaultChoice;
        public List<CrisisChoiceNode> choices = new List<CrisisChoiceNode>();
    }

    /// <summary>
    /// The 41 technologies, 25 civics and the historical crises in a Unity-serializable,
    /// designer-friendly form. Generated from Assets/Resources/GameData by the setup menu.
    /// The simulation itself reads the same JSON, so editing this asset is for review and
    /// UI text; regenerate it after changing the JSON.
    /// </summary>
    [CreateAssetMenu(fileName = "TechCivicTree", menuName = "Tamadun & Kota/Tech & Civic Tree", order = 1)]
    public class TechCivicTreeSO : ScriptableObject
    {
        public List<TechNode> technologies = new List<TechNode>();
        public List<TechNode> civics = new List<TechNode>();
        public List<CrisisNode> crises = new List<CrisisNode>();

        public int TechCount => technologies.Count;
        public int CivicCount => civics.Count;

        public TechNode Find(string id)
        {
            foreach (var t in technologies) if (t.id == id) return t;
            foreach (var c in civics) if (c.id == id) return c;
            return null;
        }

        /// <summary>Fill from the simulation's research and crisis tables.</summary>
        public void Populate(ResearchRecord[] research, CrisisRecord[] crisisRecords)
        {
            technologies.Clear();
            civics.Clear();
            crises.Clear();
            foreach (var r in research)
            {
                var n = new TechNode
                {
                    id = r.id,
                    isCivic = !r.IsTech,
                    era = r.era,
                    historicalDate = r.date,
                    cost = (float)r.cost,
                    prerequisites = r.prereqs,
                    unlocksBuildings = r.unlockBuildings,
                    unlocksTransport = r.unlockTransport,
                    unlocksPolicies = r.unlockPolicies,
                    nameMs = r.nameMs,
                    nameEn = r.nameEn,
                    descriptionMs = r.descMs,
                    descriptionEn = r.descEn,
                    sejarahpediaEntry = r.entryId,
                };
                (r.IsTech ? technologies : civics).Add(n);
            }
            foreach (var c in crisisRecords)
            {
                var node = new CrisisNode
                {
                    id = c.id,
                    eras = c.eras,
                    triggerYear = c.triggerYear,
                    triggerEvent = c.triggerEvent,
                    nameMs = c.nameMs,
                    nameEn = c.nameEn,
                    descriptionMs = c.descMs,
                    descriptionEn = c.descEn,
                    defaultChoice = c.defaultChoice,
                };
                foreach (var ch in c.choices)
                    node.choices.Add(new CrisisChoiceNode { id = ch.id, nameMs = ch.nameMs, nameEn = ch.nameEn, descriptionMs = ch.descMs, descriptionEn = ch.descEn, cost = (float)ch.cost });
                crises.Add(node);
            }
        }
    }
}
