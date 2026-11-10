using System.Collections;
using TamadunKota.Simulation;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace TamadunKota.UI
{
    /// <summary>Owns one isolated character, its lights, camera and render target.</summary>
    public sealed class LeaderPreview : MonoBehaviour, IBeginDragHandler, IDragHandler
    {
        const int PreviewLayer = 30;
        GameObject stage, character;
        Camera previewCamera;
        RenderTexture target;
        Animation legacyAnimation;
        Animator animator;
        RawImage image;
        string leaderId;
        bool reducedMotion, greeting;
        Coroutine renderOnce;

        public bool HasModel => character != null;

        public void Show(LeaderRecord leader)
        {
            if (leader == null) { Release(); return; }
            if (leaderId == leader.id && character != null) return;
            Release();
            image = GetComponent<RawImage>();
            var prefab = Resources.Load<GameObject>(leader.modelResource);
            if (prefab == null) return;
            leaderId = leader.id;
            stage = new GameObject("Leader Preview Stage");
            stage.transform.position = new Vector3(10000, 10000, 10000);
            character = Instantiate(prefab, stage.transform, false);
            character.name = leader.name;
            character.transform.localPosition = Vector3.zero;
            SetLayer(character.transform);
            foreach (var lod in character.GetComponentsInChildren<LODGroup>()) lod.ForceLOD(0);

            var renderers = character.GetComponentsInChildren<Renderer>();
            var bounds = new Bounds(stage.transform.position + Vector3.up, Vector3.one * 2);
            if (renderers.Length > 0)
            {
                bounds = renderers[0].bounds;
                for (int i = 1; i < renderers.Length; i++) bounds.Encapsulate(renderers[i].bounds);
            }
            float height = Mathf.Max(0.5f, bounds.size.y);
            var cameraObject = new GameObject("Leader Preview Camera", typeof(Camera));
            cameraObject.transform.SetParent(stage.transform, false);
            previewCamera = cameraObject.GetComponent<Camera>();
            previewCamera.cullingMask = 1 << PreviewLayer;
            previewCamera.clearFlags = CameraClearFlags.SolidColor;
            previewCamera.backgroundColor = new Color(0.055f, 0.075f, 0.08f, 1);
            previewCamera.fieldOfView = 27;
            previewCamera.nearClipPlane = 0.03f;
            previewCamera.farClipPlane = height * 12;
            previewCamera.transform.position = bounds.center + new Vector3(0, height * 0.015f, -height * 2.5f);
            previewCamera.transform.LookAt(bounds.center);
            target = new RenderTexture(512, 768, 24, RenderTextureFormat.ARGB32) { name = "Leader Preview", antiAliasing = 2 };
            target.Create();
            previewCamera.targetTexture = target;
            if (image != null) image.texture = target;
            AddLight("Key", new Vector3(25, -30, 0), new Color(1f, 0.91f, 0.8f), 1.5f);
            AddLight("Fill", new Vector3(15, 135, 0), new Color(0.7f, 0.82f, 1f), 0.75f);
            legacyAnimation = character.GetComponentInChildren<Animation>();
            animator = character.GetComponentInChildren<Animator>();
            ApplyMotion();
            Greet();
            Resources.UnloadUnusedAssets();
        }

        static void SetLayer(Transform root)
        {
            root.gameObject.layer = PreviewLayer;
            for (int i = 0; i < root.childCount; i++) SetLayer(root.GetChild(i));
        }

        void AddLight(string name, Vector3 angles, Color color, float intensity)
        {
            var go = new GameObject(name, typeof(Light));
            go.transform.SetParent(stage.transform, false);
            go.transform.localRotation = Quaternion.Euler(angles);
            var light = go.GetComponent<Light>();
            light.type = LightType.Directional;
            light.color = color;
            light.intensity = intensity;
            light.shadows = LightShadows.None;
            light.cullingMask = 1 << PreviewLayer;
        }

        void ApplyMotion()
        {
            reducedMotion = HudSettings.ReducedMotion;
            greeting = false;
            if (legacyAnimation != null)
            {
                legacyAnimation.Stop();
                if (legacyAnimation["Idle"] != null)
                {
                    legacyAnimation["Idle"].wrapMode = WrapMode.Loop;
                    legacyAnimation.Play("Idle");
                    if (reducedMotion)
                    {
                        legacyAnimation["Idle"].time = 0;
                        legacyAnimation.Sample();
                        legacyAnimation.Stop();
                    }
                }
            }
            if (animator != null) animator.speed = reducedMotion ? 0 : 1;
            if (previewCamera != null)
            {
                previewCamera.enabled = !reducedMotion;
                if (reducedMotion) RequestFrame();
            }
        }

        public void Greet()
        {
            if (HudSettings.ReducedMotion) return;
            if (legacyAnimation != null && legacyAnimation["Greeting"] != null)
            {
                legacyAnimation["Greeting"].wrapMode = WrapMode.Once;
                legacyAnimation.CrossFade("Greeting", 0.15f);
                greeting = true;
            }
        }

        void Update()
        {
            if (stage == null) return;
            if (reducedMotion != HudSettings.ReducedMotion) ApplyMotion();
            if (greeting && legacyAnimation != null && !legacyAnimation.IsPlaying("Greeting"))
            {
                greeting = false;
                if (legacyAnimation["Idle"] != null) legacyAnimation.CrossFade("Idle", 0.2f);
            }
        }

        public void Rotate(float degrees)
        {
            if (character == null) return;
            character.transform.Rotate(0, degrees, 0, Space.World);
            if (reducedMotion && previewCamera != null) RequestFrame();
        }

        void RequestFrame()
        {
            if (renderOnce != null) StopCoroutine(renderOnce);
            renderOnce = StartCoroutine(RenderFrame());
        }

        IEnumerator RenderFrame()
        {
            // Let URP render the camera normally, then freeze the resulting texture.
            previewCamera.enabled = true;
            yield return new WaitForEndOfFrame();
            if (previewCamera != null && reducedMotion) previewCamera.enabled = false;
            renderOnce = null;
        }

        public void OnBeginDrag(PointerEventData eventData) { }
        public void OnDrag(PointerEventData eventData) => Rotate(-eventData.delta.x * 0.45f);

        public void Release()
        {
            if (renderOnce != null) { StopCoroutine(renderOnce); renderOnce = null; }
            if (image != null) image.texture = null;
            if (previewCamera != null) { previewCamera.enabled = false; previewCamera.targetTexture = null; }
            if (stage != null) Destroy(stage);
            if (target != null) { target.Release(); Destroy(target); }
            stage = null;
            character = null;
            previewCamera = null;
            target = null;
            legacyAnimation = null;
            animator = null;
            leaderId = null;
        }

        void OnDisable() => Release();
        void OnDestroy() => Release();
    }
}
