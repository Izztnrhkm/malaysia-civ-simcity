using UnityEngine;

namespace TamadunKota.Core
{
    /// <summary>
    /// Target for the "Greybox / Full 3D Art" button's persistent OnClick listener, so the
    /// wiring is visible and editable in the Inspector. Also bound to the G key.
    /// </summary>
    public class ArtModeToggle : MonoBehaviour
    {
        public bool keyboardShortcut = true;

        public void Toggle() => ArtMode.Toggle();
        public void SetGreybox(bool greybox) => ArtMode.Set(greybox);

        void Update()
        {
            var kb = UnityEngine.InputSystem.Keyboard.current;
            if (keyboardShortcut && kb != null && kb.gKey.wasPressedThisFrame) Toggle();
        }
    }
}
