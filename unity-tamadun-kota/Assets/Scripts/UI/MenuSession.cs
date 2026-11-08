using TamadunKota.Core;
using TamadunKota.Simulation;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem;
using UnityEngine.UI;

namespace TamadunKota.UI
{
    public enum MenuOrigin { Startup, Pause, Gameplay }

    /// <summary>One pause and input lease shared by the title, pause and utility menus.</summary>
    public sealed class MenuSession
    {
        readonly HudContext ctx;
        RTSCameraController camera;
        GameSimulation initialSimulation;
        bool cameraEnabled, placementEnabled;
        public bool Active { get; private set; }
        public bool HasEnteredCity { get; private set; }
        public MenuOrigin Origin { get; private set; }

        public MenuSession(HudContext context) { ctx = context; }
        public void EnterCity() => HasEnteredCity = true;

        public void Begin(MenuOrigin origin)
        {
            if (origin != MenuOrigin.Startup) HasEnteredCity = true;
            if (Active) return;
            Active = true;
            Origin = origin;
            initialSimulation = ctx.Sim;
            ctx.Time?.PushPause();
            camera = Object.FindAnyObjectByType<RTSCameraController>();
            if (camera != null) { cameraEnabled = camera.enabled; camera.enabled = false; }
            if (ctx.Placement != null)
            {
                placementEnabled = ctx.Placement.enabled;
                ctx.Placement.Cancel();
                ctx.Placement.enabled = false;
            }
            TextFocus.SetMenuBlocked(true, ctx.Time, ctx.SaveLoad);
        }

        public void End()
        {
            if (!Active) return;
            Active = false;
            if (EventSystem.current != null) EventSystem.current.SetSelectedGameObject(null);
            TextFocus.SetMenuBlocked(false, ctx.Time, ctx.SaveLoad);
            if (camera != null)
            {
                camera.enabled = cameraEnabled;
                // A disabled camera misses SimulationChanged while a city is created or loaded.
                if (cameraEnabled && !ReferenceEquals(initialSimulation, ctx.Sim) && ctx.Sim != null) camera.FrameSettlement(ctx.Sim);
            }
            if (ctx.Placement != null) ctx.Placement.enabled = placementEnabled;
            ctx.Time?.PopPause();
        }

        public void ReturnFromUtility()
        {
            if (ctx.MainMenu != null && ctx.MainMenu.IsOpen) ctx.MainMenu.FocusDefault();
            else End();
        }

        public static void Focus(Selectable selectable)
        {
            if (selectable != null && selectable.IsActive() && selectable.IsInteractable() && EventSystem.current != null)
                EventSystem.current.SetSelectedGameObject(selectable.gameObject);
        }

        public static void ConfigureNavigation(RectTransform root)
        {
            var all = root.GetComponentsInChildren<Selectable>();
            var controls = new System.Collections.Generic.List<Selectable>(all.Length);
            foreach (var control in all) if (control.IsInteractable()) controls.Add(control);
            for (int i = 0; i < controls.Count; i++)
            {
                var navigation = controls[i].navigation;
                navigation.mode = Navigation.Mode.Explicit;
                navigation.selectOnUp = controls[(i + controls.Count - 1) % controls.Count];
                navigation.selectOnDown = controls[(i + 1) % controls.Count];
                navigation.selectOnLeft = controls[i] is Slider ? null : navigation.selectOnUp;
                navigation.selectOnRight = controls[i] is Slider ? null : navigation.selectOnDown;
                controls[i].navigation = navigation;
            }
        }

        /// <summary>uGUI handles arrows and submit; Tab also supports fields, buttons and sliders.</summary>
        public void UpdateKeyboard()
        {
            var kb = Keyboard.current;
            if (!Active || kb == null || !kb.tabKey.wasPressedThisFrame) return;
            RectTransform root = null;
            if (ctx.ActiveModal is SettingsPanel settings) root = settings.MenuRoot;
            else if (ctx.ActiveModal is SaveLoadPanel saves) root = saves.MenuRoot;
            else if (ctx.MainMenu != null) root = ctx.MainMenu.MenuRoot;
            if (root == null) return;
            var controls = root.GetComponentsInChildren<Selectable>();
            var current = EventSystem.current != null ? EventSystem.current.currentSelectedGameObject : null;
            int index = -1;
            for (int i = 0; i < controls.Length; i++) if (controls[i].gameObject == current) index = i;
            int step = kb.shiftKey.isPressed ? -1 : 1;
            if (index < 0) index = step > 0 ? -1 : 0;
            for (int n = 0; n < controls.Length; n++)
            {
                index = (index + step + controls.Length) % controls.Length;
                if (controls[index].IsInteractable() && controls[index].IsActive()) { Focus(controls[index]); break; }
            }
        }
    }
}
