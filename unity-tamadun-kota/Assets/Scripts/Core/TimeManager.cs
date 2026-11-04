using System;
using UnityEngine;
using UnityEngine.InputSystem;

namespace TamadunKota.Core
{
    /// <summary>
    /// Frame-rate independent tick engine. Accumulates real time and raises <see cref="Tick"/>
    /// every <see cref="TickSeconds"/> (1.5 s at normal speed, 0.75 s fast, 0.35 s fastest).
    /// A long frame never runs more than <see cref="maxTicksPerFrame"/> ticks, so hitches do
    /// not snowball. Space pauses, 1-3 set the speed.
    /// </summary>
    [DefaultExecutionOrder(-500)]
    public class TimeManager : MonoBehaviour
    {
        public static readonly float[] SecondsPerTick = { 0f, 1.5f, 0.75f, 0.35f };

        [Range(0, 3)] public int speed = 1;
        [Range(1, 8)] public int maxTicksPerFrame = 3;
        public bool keyboardShortcuts = true;

        /// <summary>Raised once per simulation turn with the running tick count.</summary>
        public event Action<int> Tick;
        public event Action<int> SpeedChanged;

        public int TickCount { get; private set; }
        /// <summary>0..1 progress towards the next tick (for interpolating animations).</summary>
        public float Progress { get; private set; }
        public float TickSeconds => SecondsPerTick[Mathf.Clamp(speed, 0, 3)];
        public bool Paused => speed == 0 || externallyPaused > 0;

        float accumulator;
        int externallyPaused;
        int resumeSpeed = 1;

        public void SetSpeed(int s)
        {
            s = Mathf.Clamp(s, 0, 3);
            if (s > 0) resumeSpeed = s;
            if (s == speed) return;
            speed = s;
            SpeedChanged?.Invoke(speed);
        }

        public void TogglePause() => SetSpeed(speed == 0 ? resumeSpeed : 0);

        /// <summary>Modal dialogs (crises, menus) pause the clock without changing the chosen speed.</summary>
        public void PushPause() => externallyPaused++;
        public void PopPause() => externallyPaused = Mathf.Max(0, externallyPaused - 1);

        void Update()
        {
            var kb = Keyboard.current;
            if (keyboardShortcuts && kb != null)
            {
                if (kb.spaceKey.wasPressedThisFrame) TogglePause();
                if (kb.digit1Key.wasPressedThisFrame) SetSpeed(1);
                if (kb.digit2Key.wasPressedThisFrame) SetSpeed(2);
                if (kb.digit3Key.wasPressedThisFrame) SetSpeed(3);
            }
            if (Paused)
            {
                Progress = 0;
                return;
            }
            float step = TickSeconds;
            accumulator += Time.unscaledDeltaTime;
            int ran = 0;
            while (accumulator >= step && ran < maxTicksPerFrame)
            {
                accumulator -= step;
                TickCount++;
                ran++;
                Tick?.Invoke(TickCount);
            }
            if (ran == maxTicksPerFrame && accumulator > step) accumulator = 0;
            Progress = Mathf.Clamp01(accumulator / step);
        }
    }
}
