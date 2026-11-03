/**
 * PBR (metallic-roughness) material library shared by the inline Three.js
 * builders, the Node glTF packer and the Blender script. Colours are sRGB hex.
 * `glow` marks materials that light up at night (window glass, lamps).
 */
export interface MaterialDef {
  color: string;
  metalness: number;
  roughness: number;
  /** emissive colour used at night (sRGB hex) */
  emissive?: string;
  /** relative emissive strength at full night */
  glow?: number;
  /** constant emissive strength (signals, lamps) */
  emissiveBase?: number;
  opacity?: number;
}

export const MATERIALS = {
  // tropical hardwoods (chengal / meranti) and thatch
  timber: { color: '#8a5a33', metalness: 0, roughness: 0.82 },
  timber_dark: { color: '#5b381d', metalness: 0, roughness: 0.85 },
  timber_light: { color: '#b48552', metalness: 0, roughness: 0.8 },
  attap: { color: '#a98d52', metalness: 0, roughness: 0.96 },
  bamboo: { color: '#c2a764', metalness: 0, roughness: 0.75 },
  // roofs
  terracotta: { color: '#b4532c', metalness: 0, roughness: 0.72 },
  terracotta_dark: { color: '#8e3c20', metalness: 0, roughness: 0.75 },
  zinc: { color: '#a5adb3', metalness: 0.75, roughness: 0.42 },
  tin_rust: { color: '#8f5a39', metalness: 0.45, roughness: 0.7 },
  roof_green: { color: '#3f6f5a', metalness: 0.2, roughness: 0.6 },
  roof_blue: { color: '#3d5f8a', metalness: 0.25, roughness: 0.55 },
  // pastel heritage plaster
  plaster_white: { color: '#eee8da', metalness: 0, roughness: 0.88 },
  plaster_cream: { color: '#efdcae', metalness: 0, roughness: 0.88 },
  plaster_mint: { color: '#a9d6bf', metalness: 0, roughness: 0.88 },
  plaster_pink: { color: '#e9b4b0', metalness: 0, roughness: 0.88 },
  plaster_blue: { color: '#a8c6e0', metalness: 0, roughness: 0.88 },
  plaster_yellow: { color: '#ecd27a', metalness: 0, roughness: 0.88 },
  // masonry
  brick: { color: '#9c4a2e', metalness: 0, roughness: 0.9 },
  laterite: { color: '#a8603c', metalness: 0, roughness: 0.95 },
  stone: { color: '#a8a294', metalness: 0, roughness: 0.92 },
  concrete: { color: '#bdbab1', metalness: 0, roughness: 0.9 },
  concrete_dark: { color: '#7f7c75', metalness: 0, roughness: 0.92 },
  asphalt: { color: '#38393c', metalness: 0, roughness: 0.95 },
  dirt: { color: '#8a6a45', metalness: 0, roughness: 1 },
  gravel: { color: '#7d756b', metalness: 0, roughness: 1 },
  // metals and glass
  steel: { color: '#9aa3ab', metalness: 0.9, roughness: 0.3 },
  steel_dark: { color: '#3b434b', metalness: 0.8, roughness: 0.38 },
  chrome: { color: '#d8dde2', metalness: 1, roughness: 0.15 },
  iron_black: { color: '#26282b', metalness: 0.7, roughness: 0.55 },
  gold: { color: '#d4a63a', metalness: 1, roughness: 0.28 },
  copper_green: { color: '#4f8f7a', metalness: 0.6, roughness: 0.45 },
  glass: { color: '#6b97b8', metalness: 0.9, roughness: 0.08, emissive: '#ffd08a', glow: 0.9 },
  glass_dark: { color: '#2b4964', metalness: 0.9, roughness: 0.1, emissive: '#ffd9a0', glow: 0.7 },
  glass_green: { color: '#4f8a7c', metalness: 0.85, roughness: 0.1, emissive: '#ffe0a8', glow: 0.7 },
  window: { color: '#2b2622', metalness: 0.1, roughness: 0.5, emissive: '#ffb860', glow: 1.3 },
  solar: { color: '#1b2c58', metalness: 0.7, roughness: 0.18 },
  // paint
  paint_red: { color: '#b0302c', metalness: 0.1, roughness: 0.55 },
  paint_white: { color: '#f2f2ee', metalness: 0.05, roughness: 0.5 },
  paint_yellow: { color: '#e2b42a', metalness: 0.1, roughness: 0.5 },
  paint_blue: { color: '#2f5c9c', metalness: 0.1, roughness: 0.5 },
  paint_green: { color: '#2e5a35', metalness: 0.15, roughness: 0.5 },
  paint_black: { color: '#1e1f22', metalness: 0.2, roughness: 0.5 },
  paint_orange: { color: '#e07a22', metalness: 0.1, roughness: 0.5 },
  // vegetation and ground
  foliage: { color: '#2f7a3a', metalness: 0, roughness: 0.9 },
  foliage_dark: { color: '#1f5a2b', metalness: 0, roughness: 0.92 },
  foliage_light: { color: '#5fa046', metalness: 0, roughness: 0.9 },
  palm: { color: '#3f8a35', metalness: 0, roughness: 0.85 },
  trunk: { color: '#6b4a2f', metalness: 0, roughness: 0.95 },
  trunk_pale: { color: '#a19077', metalness: 0, roughness: 0.9 },
  paddy: { color: '#86b84a', metalness: 0, roughness: 0.9 },
  soil: { color: '#6f4f33', metalness: 0, roughness: 1 },
  grass: { color: '#5d9a45', metalness: 0, roughness: 0.95 },
  sand: { color: '#d9c48f', metalness: 0, roughness: 1 },
  pond: { color: '#4d8d8a', metalness: 0.3, roughness: 0.15 },
  mud: { color: '#9a7c55', metalness: 0, roughness: 0.6 },
  // textiles
  sail: { color: '#eadfc4', metalness: 0, roughness: 0.9 },
  sail_red: { color: '#a5462a', metalness: 0, roughness: 0.9 },
  fabric_red: { color: '#b8342e', metalness: 0, roughness: 0.9 },
  fabric_blue: { color: '#2d5aa0', metalness: 0, roughness: 0.9 },
  // lights
  lamp: { color: '#fff1c4', metalness: 0, roughness: 0.5, emissive: '#ffd27a', glow: 2.5, emissiveBase: 0.15 },
  signal_red: { color: '#ff3b30', metalness: 0, roughness: 0.5, emissive: '#ff2a1f', glow: 2, emissiveBase: 0.6 },
} satisfies Record<string, MaterialDef>;

export type MatId = keyof typeof MATERIALS;
export const MATERIAL_IDS = Object.keys(MATERIALS) as MatId[];

/** sRGB hex -> linear RGB floats (glTF stores linear factors). */
export function hexToLinear(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return [c[0], c[1], c[2]];
}
