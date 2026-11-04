using System;
using System.Collections;
using System.Threading.Tasks;
using TamadunKota.Core;
using TamadunKota.Data;
using TamadunKota.Simulation;
using UnityEngine;

namespace TamadunKota.Systems
{
    /// <summary>
    /// Era soundtracks and ambience, all synthesised at runtime (no audio files to license):
    /// Era 1-2 gamelan in slendro / pelog, Era 3 keroncong-flavoured pentatonic, Era 4 synth.
    /// The loops are rendered on a worker thread by the pure-C# ProceduralMusic port, turned
    /// into AudioClips on the main thread and crossfaded between two AudioSources when the era
    /// changes. Two more looping sources carry the rainforest (cicadas, birds) and the sea; their
    /// mix follows what the camera is looking at. Custom clips can be assigned in the Inspector
    /// and then take precedence over the generated ones.
    /// </summary>
    public class AudioAtmosphereManager : MonoBehaviour
    {
        [Header("Optional authored clips (index 0..3 = era 1..4)")]
        public AudioClip[] eraMusic = new AudioClip[4];
        public AudioClip rainforestAmbience;
        public AudioClip seaAmbience;

        [Header("Mix")]
        [Range(0, 1)] public float musicVolume = 0.45f;
        [Range(0, 1)] public float ambienceVolume = 0.5f;
        public float crossfadeSeconds = 4f;
        [Tooltip("Bars rendered per generated loop")]
        public int barsPerLoop = 16;
        public int sampleRate = 32000;

        public Camera listenerCamera;

        AudioSource musicA, musicB, forest, sea;
        bool aIsActive = true;
        int playingEra;
        readonly AudioClip[] generated = new AudioClip[4];
        EraManager eraManager;
        Coroutine fade;
        bool loading;

        void Awake()
        {
            musicA = MakeSource("Music A", true);
            musicB = MakeSource("Music B", true);
            forest = MakeSource("Rainforest", true);
            sea = MakeSource("Sea", true);
            if (listenerCamera == null) listenerCamera = Camera.main;
            if (listenerCamera != null && FindAnyObjectByType<AudioListener>() == null)
                listenerCamera.gameObject.AddComponent<AudioListener>();
        }

        AudioSource MakeSource(string name, bool loop)
        {
            var go = new GameObject(name);
            go.transform.SetParent(transform, false);
            var s = go.AddComponent<AudioSource>();
            s.loop = loop;
            s.playOnAwake = false;
            s.spatialBlend = 0f;
            s.volume = 0f;
            return s;
        }

        void OnEnable()
        {
            eraManager = FindAnyObjectByType<EraManager>();
            if (eraManager != null) eraManager.OnEraAdvanced += PlayEra;
            if (GameRoot.Instance != null) GameRoot.Instance.SimulationChanged += OnSimulationChanged;
        }

        void OnDisable()
        {
            if (eraManager != null) eraManager.OnEraAdvanced -= PlayEra;
            if (GameRoot.Instance != null) GameRoot.Instance.SimulationChanged -= OnSimulationChanged;
        }

        IEnumerator Start()
        {
            // Ambience first (short), then the current era's music.
            var forestTask = Task.Run(() => ProceduralMusic.RenderAmbience(false, 12, sampleRate, 7));
            var seaTask = Task.Run(() => ProceduralMusic.RenderAmbience(true, 12, sampleRate, 11));
            while (!forestTask.IsCompleted || !seaTask.IsCompleted) yield return null;
            forest.clip = rainforestAmbience != null ? rainforestAmbience : ToClip("rainforest", forestTask.Result);
            sea.clip = seaAmbience != null ? seaAmbience : ToClip("sea", seaTask.Result);
            if (forest.clip != null) forest.Play();
            if (sea.clip != null) sea.Play();
            var sim = GameRoot.Instance != null ? GameRoot.Instance.Sim : null;
            PlayEra(sim != null ? sim.CurrentEra : 1);
        }

        void OnSimulationChanged(GameSimulation sim)
        {
            if (sim != null && sim.CurrentEra != playingEra) PlayEra(sim.CurrentEra);
        }

        AudioClip ToClip(string name, float[] samples)
        {
            if (samples == null || samples.Length == 0) return null;
            var clip = AudioClip.Create(name, samples.Length, 1, sampleRate, false);
            clip.SetData(samples, 0);
            return clip;
        }

        /// <summary>Crossfade to an era's soundtrack (generating it first if needed).</summary>
        public void PlayEra(int era)
        {
            era = Mathf.Clamp(era, 1, 4);
            if (era == playingEra && (loading || musicA.isPlaying || musicB.isPlaying)) return;
            playingEra = era;
            if (!isActiveAndEnabled) return;
            StartCoroutine(LoadAndFade(era));
        }

        IEnumerator LoadAndFade(int era)
        {
            AudioClip clip = eraMusic != null && eraMusic.Length >= era ? eraMusic[era - 1] : null;
            if (clip == null) clip = generated[era - 1];
            if (clip == null)
            {
                loading = true;
                int bars = Mathf.Max(4, barsPerLoop), sr = sampleRate;
                var task = Task.Run(() => ProceduralMusic.RenderLoop(era, bars, sr, era * 17 + 1));
                while (!task.IsCompleted) yield return null;
                loading = false;
                if (task.IsFaulted) { Debug.LogWarning("[Audio] music render failed: " + task.Exception); yield break; }
                clip = generated[era - 1] = ToClip("era" + era + "_music", task.Result);
            }
            if (era != playingEra || clip == null) yield break;
            var from = aIsActive ? musicA : musicB;
            var to = aIsActive ? musicB : musicA;
            aIsActive = !aIsActive;
            to.clip = clip;
            to.volume = 0f;
            to.Play();
            if (fade != null) StopCoroutine(fade);
            fade = StartCoroutine(Crossfade(from, to));
        }

        IEnumerator Crossfade(AudioSource from, AudioSource to)
        {
            float t = 0f, start = from.volume;
            while (t < crossfadeSeconds)
            {
                t += Time.unscaledDeltaTime;
                float k = Mathf.Clamp01(t / Mathf.Max(0.01f, crossfadeSeconds));
                from.volume = Mathf.Lerp(start, 0f, k);
                to.volume = Mathf.Lerp(0f, musicVolume, k);
                yield return null;
            }
            from.Stop();
            to.volume = musicVolume;
            fade = null;
        }

        void Update()
        {
            if (fade == null)
            {
                var active = aIsActive ? musicA : musicB;
                if (active.isPlaying) active.volume = musicVolume;
            }
            // Ambience mix: more sea when the camera looks at water, more forest over land
            // in the early eras (the jungle recedes as the city industrialises).
            float seaMix = 0.3f, forestMix = 0.7f;
            if (listenerCamera != null)
            {
                var ray = new Ray(listenerCamera.transform.position, listenerCamera.transform.forward);
                var plane = new Plane(Vector3.up, Vector3.zero);
                if (plane.Raycast(ray, out float d))
                {
                    var p = ray.GetPoint(d);
                    var terrain = Terrain.activeTerrain;
                    bool water = terrain == null || terrain.SampleHeight(p) + terrain.transform.position.y < 0.3f;
                    seaMix = water ? 0.85f : 0.2f;
                    forestMix = water ? 0.25f : 0.8f;
                }
                float h = listenerCamera.transform.position.y;
                float altitude = Mathf.InverseLerp(400f, 60f, h);
                seaMix *= 0.4f + 0.6f * altitude;
                forestMix *= 0.4f + 0.6f * altitude;
            }
            int era = Mathf.Max(1, playingEra);
            forestMix *= era <= 2 ? 1f : era == 3 ? 0.55f : 0.4f;
            float k = 1f - Mathf.Exp(-Time.unscaledDeltaTime * 2f);
            forest.volume = Mathf.Lerp(forest.volume, forestMix * ambienceVolume, k);
            sea.volume = Mathf.Lerp(sea.volume, seaMix * ambienceVolume, k);
        }
    }
}
