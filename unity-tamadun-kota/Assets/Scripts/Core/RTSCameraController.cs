using UnityEngine;
using UnityEngine.InputSystem;

namespace TamadunKota.Core
{
    /// <summary>
    /// Strategy camera rig. This transform is the ground-level pivot; the camera (or a
    /// Cinemachine camera following <see cref="cameraTarget"/>) sits behind it at
    /// <see cref="distance"/> and <see cref="pitch"/>.
    ///   WASD / arrows  pan        Q / E  rotate      mouse wheel  zoom
    ///   screen edges   pan        middle-drag  pan    right-drag   orbit and tilt
    ///   Home           reset
    /// Movement is smoothed and frame-rate independent; the camera never dips under the terrain.
    /// </summary>
    public class RTSCameraController : MonoBehaviour
    {
        [Header("Rig")]
        [Tooltip("Camera to drive directly. Leave empty if a Cinemachine camera follows cameraTarget.")]
        public Camera cam;
        [Tooltip("Point the camera sits at (created automatically)")]
        public Transform cameraTarget;

        [Header("Pan")]
        public float panSpeed = 60f;
        public bool edgeScrolling = true;
        [Range(2, 60)] public float edgeSize = 12f;
        public float dragPanSpeed = 0.35f;

        [Header("Rotate & tilt")]
        public float rotateSpeed = 90f;
        public float mouseOrbitSpeed = 0.25f;
        [Range(15, 89)] public float minPitch = 25f;
        [Range(15, 89)] public float maxPitch = 85f;
        [Range(15, 89)] public float pitch = 52f;
        public float yaw = 45f;

        [Header("Zoom")]
        public float distance = 90f;
        public float minDistance = 12f;
        public float maxDistance = 420f;
        public float zoomStep = 0.12f;
        [Tooltip("Minimum clearance above terrain and buildings, in metres")]
        public float minClearance = 4f;

        [Header("Smoothing")]
        [Range(0.01f, 0.5f)] public float smoothTime = 0.12f;

        [Header("Bounds (metres)")]
        public Vector2 boundsMin = Vector2.zero;
        public Vector2 boundsMax = new Vector2(512, 512);

        Vector3 targetPos;
        float targetYaw, targetPitch, targetDistance;
        Vector3 posVel;
        float yawVel, pitchVel, distVel;
        Vector3 homePos;
        float homeYaw, homePitch, homeDistance;

        void Awake()
        {
            if (cam == null) cam = GetComponentInChildren<Camera>();
            if (cameraTarget == null)
            {
                cameraTarget = new GameObject("CameraTarget").transform;
                cameraTarget.SetParent(transform, false);
            }
            targetPos = transform.position;
            targetYaw = yaw;
            targetPitch = pitch;
            targetDistance = distance;
            SaveHome();
        }

        public void SaveHome()
        {
            homePos = targetPos;
            homeYaw = targetYaw;
            homePitch = targetPitch;
            homeDistance = targetDistance;
        }

        public void ResetView()
        {
            targetPos = homePos;
            targetYaw = homeYaw;
            targetPitch = homePitch;
            targetDistance = homeDistance;
        }

        public void SetBounds(float worldWidth, float worldDepth)
        {
            boundsMin = Vector2.zero;
            boundsMax = new Vector2(worldWidth, worldDepth);
        }

        /// <summary>Jump the pivot to a world position (minimap, focus on event).</summary>
        public void FocusOn(Vector3 worldPos, bool instant = false)
        {
            targetPos = new Vector3(worldPos.x, 0, worldPos.z);
            if (instant)
            {
                transform.position = targetPos;
                posVel = Vector3.zero;
            }
        }

        void OnEnable()
        {
            if (GameRoot.Instance != null) GameRoot.Instance.SimulationChanged += FrameSettlement;
        }

        void OnDisable()
        {
            if (GameRoot.Instance != null) GameRoot.Instance.SimulationChanged -= FrameSettlement;
        }

        void Start()
        {
            if (GameRoot.Instance != null && GameRoot.Instance.Sim != null) FrameSettlement(GameRoot.Instance.Sim);
        }

        /// <summary>
        /// Start over the river mouth, where the first settlement belongs: the pivot sits a few cells
        /// inland of the mouth so the coast, the river and open land are all in view.
        /// </summary>
        public void FrameSettlement(TamadunKota.Simulation.GameSimulation sim)
        {
            if (sim == null) return;
            var map = sim.Map;
            var grid = sim.City.Grid;
            int dx = map.MouthX < map.Width / 2 ? 8 : -8;
            int cx = Mathf.Clamp(map.MouthX + dx, 0, map.Width - 1);
            grid.CellCenter(cx, map.MouthY, out float wx, out float wz);
            FocusOn(new Vector3(wx, 0, wz), true);
            targetDistance = distance = Mathf.Clamp(170f, minDistance, maxDistance);
            targetPitch = pitch = Mathf.Clamp(55f, minPitch, maxPitch);
            SaveHome();
        }

        void Update()
        {
            float dt = Time.unscaledDeltaTime;
            var kb = Keyboard.current;
            var mouse = Mouse.current;
            Vector2 move = Vector2.zero;
            float rotate = 0;
            if (kb != null)
            {
                if (kb.wKey.isPressed || kb.upArrowKey.isPressed) move.y += 1;
                if (kb.sKey.isPressed || kb.downArrowKey.isPressed) move.y -= 1;
                if (kb.dKey.isPressed || kb.rightArrowKey.isPressed) move.x += 1;
                if (kb.aKey.isPressed || kb.leftArrowKey.isPressed) move.x -= 1;
                if (kb.qKey.isPressed) rotate -= 1;
                if (kb.eKey.isPressed) rotate += 1;
                if (kb.homeKey.wasPressedThisFrame) ResetView();
            }
            if (mouse != null)
            {
                Vector2 p = mouse.position.ReadValue();
                bool inWindow = p.x >= 0 && p.y >= 0 && p.x <= Screen.width && p.y <= Screen.height;
                if (edgeScrolling && inWindow && Application.isFocused)
                {
                    if (p.x < edgeSize) move.x -= 1;
                    else if (p.x > Screen.width - edgeSize) move.x += 1;
                    if (p.y < edgeSize) move.y -= 1;
                    else if (p.y > Screen.height - edgeSize) move.y += 1;
                }
                float scroll = mouse.scroll.ReadValue().y;
                if (Mathf.Abs(scroll) > 0.01f && !PointerOverUI())
                {
                    // ~120 per notch on Windows, ~1 on some platforms: normalise to notches
                    float notches = Mathf.Abs(scroll) > 10 ? scroll / 120f : scroll;
                    targetDistance *= Mathf.Pow(1 - zoomStep, notches);
                }
                Vector2 delta = mouse.delta.ReadValue();
                if (mouse.rightButton.isPressed)
                {
                    targetYaw += delta.x * mouseOrbitSpeed;
                    targetPitch -= delta.y * mouseOrbitSpeed;
                }
                if (mouse.middleButton.isPressed)
                {
                    float k = dragPanSpeed * targetDistance / 100f;
                    Vector3 right = Quaternion.Euler(0, targetYaw, 0) * Vector3.right;
                    Vector3 fwd = Quaternion.Euler(0, targetYaw, 0) * Vector3.forward;
                    targetPos -= (right * delta.x + fwd * delta.y) * k;
                }
            }

            if (move.sqrMagnitude > 1) move.Normalize();
            float speed = panSpeed * Mathf.Lerp(0.4f, 3f, Mathf.InverseLerp(minDistance, maxDistance, targetDistance));
            Vector3 r = Quaternion.Euler(0, targetYaw, 0) * Vector3.right;
            Vector3 f = Quaternion.Euler(0, targetYaw, 0) * Vector3.forward;
            targetPos += (r * move.x + f * move.y) * speed * dt;
            targetPos.x = Mathf.Clamp(targetPos.x, boundsMin.x, boundsMax.x);
            targetPos.z = Mathf.Clamp(targetPos.z, boundsMin.y, boundsMax.y);
            targetYaw += rotate * rotateSpeed * dt;
            targetPitch = Mathf.Clamp(targetPitch, minPitch, maxPitch);
            targetDistance = Mathf.Clamp(targetDistance, minDistance, maxDistance);

            // follow the ground under the pivot
            targetPos.y = GroundAt(targetPos);

            transform.position = Vector3.SmoothDamp(transform.position, targetPos, ref posVel, smoothTime, Mathf.Infinity, dt);
            yaw = Mathf.SmoothDampAngle(yaw, targetYaw, ref yawVel, smoothTime, Mathf.Infinity, dt);
            pitch = Mathf.SmoothDamp(pitch, targetPitch, ref pitchVel, smoothTime, Mathf.Infinity, dt);
            distance = Mathf.SmoothDamp(distance, targetDistance, ref distVel, smoothTime, Mathf.Infinity, dt);
            ApplyRig();
        }

        void ApplyRig()
        {
            Quaternion rot = Quaternion.Euler(pitch, yaw, 0);
            Vector3 camPos = transform.position - rot * Vector3.forward * distance;
            // terrain height clamping: keep the camera above the ground beneath it
            float floor = GroundAt(camPos) + minClearance;
            if (camPos.y < floor) camPos.y = floor;
            cameraTarget.SetPositionAndRotation(camPos, Quaternion.LookRotation(transform.position - camPos, Vector3.up));
            if (cam != null) cam.transform.SetPositionAndRotation(cameraTarget.position, cameraTarget.rotation);
        }

        static float GroundAt(Vector3 p)
        {
            var t = Terrain.activeTerrain;
            if (t == null) return 0;
            return Mathf.Max(0, t.SampleHeight(p) + t.transform.position.y);
        }

        static bool PointerOverUI()
        {
            var es = UnityEngine.EventSystems.EventSystem.current;
            return es != null && es.IsPointerOverGameObject();
        }
    }
}
