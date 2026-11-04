// Compile-check stubs, NOT shipped to Unity. URP 17.3 only builds inside Unity 6, so this file declares
// just the members TamadunAutoSetupEditor uses, with the signatures of the URP 17 source
// (github.com/Unity-Technologies/Graphics, Packages/com.unity.render-pipelines.universal):
// UniversalRenderPipelineAsset.Create(ScriptableRendererData), useSRPBatcher, supportsHDR,
// shadowDistance, msaaSampleCount; UniversalAdditionalCameraData.renderPostProcessing / antialiasing.
namespace UnityEngine.Rendering.Universal
{
    public abstract class ScriptableRendererData : ScriptableObject { }

    public class UniversalRendererData : ScriptableRendererData { }

    public enum AntialiasingMode { None, FastApproximateAntialiasing, SubpixelMorphologicalAntiAliasing, TemporalAntiAliasing }

    public class UniversalRenderPipelineAsset : RenderPipelineAsset
    {
        public static UniversalRenderPipelineAsset Create(ScriptableRendererData rendererData = null) => CreateInstance<UniversalRenderPipelineAsset>();
        public bool useSRPBatcher { get; set; }
        public bool supportsHDR { get; set; }
        public float shadowDistance { get; set; }
        public int msaaSampleCount { get; set; }
        public override RenderPipeline CreatePipeline() => null;
    }

    [DisallowMultipleComponent, RequireComponent(typeof(Camera))]
    public class UniversalAdditionalCameraData : MonoBehaviour
    {
        public bool renderPostProcessing { get; set; }
        public AntialiasingMode antialiasing { get; set; }
    }
}
