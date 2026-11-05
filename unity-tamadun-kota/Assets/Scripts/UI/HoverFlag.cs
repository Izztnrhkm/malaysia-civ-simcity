using UnityEngine;
using UnityEngine.EventSystems;

namespace TamadunKota.UI
{
    /// <summary>Records whether the pointer is over this UI element (for hover read-outs and pausing fades).</summary>
    public sealed class HoverFlag : MonoBehaviour, IPointerEnterHandler, IPointerExitHandler
    {
        public bool Hovered { get; private set; }

        public void OnPointerEnter(PointerEventData eventData) => Hovered = true;
        public void OnPointerExit(PointerEventData eventData) => Hovered = false;
        void OnDisable() => Hovered = false;
    }
}
