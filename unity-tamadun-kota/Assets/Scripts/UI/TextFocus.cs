using TamadunKota.Core;
using TamadunKota.Systems;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace TamadunKota.UI
{
    /// <summary>
    /// Keeps the game's keyboard shortcuts out of the HUD's text fields (city name, seed,
    /// Sejarahpedia search): while a field has focus, the clock (Space, 1-3), quick save/load
    /// (F5/F9) and art mode (G) shortcuts are switched off, then restored. Other keyboard users,
    /// such as the RTS camera, can check <see cref="Active"/>.
    /// </summary>
    public static class TextFocus
    {
        /// <summary>True while a text field or menu owns the gameplay shortcuts.</summary>
        public static bool Active { get; private set; }

        static bool savedTime, savedSave, savedArt;
        static TimeManager time;
        static SaveLoadManager saveLoad;
        static ArtModeToggle art;
        static bool menuBlocked;

        /// <summary>Called by the UIManager every frame (no allocations).</summary>
        public static void Update(TimeManager t, SaveLoadManager s)
        {
            var es = EventSystem.current;
            var go = es != null ? es.currentSelectedGameObject : null;
            bool focused = go != null && go.TryGetComponent(out InputField field) && field.isFocused;
            Set(focused || menuBlocked, t, s);
        }

        public static void SetMenuBlocked(bool blocked, TimeManager t, SaveLoadManager s)
        {
            menuBlocked = blocked;
            Update(t, s);
        }

        /// <summary>Give the shortcuts back (the HUD is going away while a field has focus).</summary>
        public static void Release() { menuBlocked = false; Set(false, time, saveLoad); }

        static void Set(bool focused, TimeManager t, SaveLoadManager s)
        {
            if (focused == Active) return;
            Active = focused;
            if (focused)
            {
                time = t;
                saveLoad = s;
                if (art == null) art = Object.FindAnyObjectByType<ArtModeToggle>();
                if (time != null) { savedTime = time.keyboardShortcuts; time.keyboardShortcuts = false; }
                if (saveLoad != null) { savedSave = saveLoad.keyboardShortcuts; saveLoad.keyboardShortcuts = false; }
                if (art != null) { savedArt = art.keyboardShortcut; art.keyboardShortcut = false; }
            }
            else
            {
                if (time != null) time.keyboardShortcuts = savedTime;
                if (saveLoad != null) saveLoad.keyboardShortcuts = savedSave;
                if (art != null) art.keyboardShortcut = savedArt;
            }
        }
    }
}
