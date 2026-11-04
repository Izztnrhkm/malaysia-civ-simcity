// Compile-check stub, NOT shipped to Unity. The real InputSystemUIInputModule (com.unity.inputsystem
// Plugins/UI) needs uGUI 2.0 APIs, but the only uGUI reference assembly on nuget.org is 2018.3, so the
// check compiles the rest of the Input System from source and stands in this one type.
using UnityEngine.EventSystems;

namespace UnityEngine.InputSystem.UI
{
    public class InputSystemUIInputModule : BaseInputModule
    {
        public override void Process() { }
    }
}

// Plugins/UI/UISupport.cs declares this in the global namespace.
internal static class UISupport
{
    public static void Initialize() { }
}
