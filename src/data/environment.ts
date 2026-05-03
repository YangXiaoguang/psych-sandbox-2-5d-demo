import type { SandboxEnvironment, SandboxLightMode, SandboxWeather } from "../types";

export const DEFAULT_ENVIRONMENT: SandboxEnvironment = {
  weather: "sunny",
  light: "day",
};

export const WEATHER_LABELS: Record<SandboxWeather, string> = {
  sunny: "晴天",
  cloudy: "阴天",
  rainy: "雨天",
};

export const LIGHT_LABELS: Record<SandboxLightMode, string> = {
  day: "白天",
  night: "黑夜",
};

export const WEATHER_OPTIONS: SandboxWeather[] = ["sunny", "cloudy", "rainy"];
export const LIGHT_OPTIONS: SandboxLightMode[] = ["day", "night"];

export interface ObjectEnvironmentStyle {
  castOffsetX: number;
  castOffsetY: number;
  castOpacity: number;
  contactOpacity: number;
  shadowBlur: number;
  shadowColor: string;
  spriteOpacity: number;
}

export interface StageEnvironmentProfile {
  backgroundStops: [number, string, number, string];
  sandStops: [number, string, number, string, number, string];
  stageShadowOpacity: number;
  warmWashOpacity: number;
  coolWashOpacity: number;
  globalTint: string;
  globalTintOpacity: number;
  vignetteOpacity: number;
  rainOpacity: number;
  mistOpacity: number;
  object: ObjectEnvironmentStyle;
}

export function getEnvironmentLabel(environment: SandboxEnvironment): string {
  return `${WEATHER_LABELS[environment.weather]} · ${LIGHT_LABELS[environment.light]}`;
}

export function getEnvironmentProfile(environment: SandboxEnvironment): StageEnvironmentProfile {
  const night = environment.light === "night";
  const rainy = environment.weather === "rainy";
  const cloudy = environment.weather === "cloudy";

  const base: StageEnvironmentProfile = {
    backgroundStops: night ? [0, "#1f3340", 1, "#0f1d29"] : [0, "#dfe8df", 1, "#bfcbbf"],
    sandStops: night
      ? [0, "#cdb37c", 0.48, "#b79a67", 1, "#8d7048"]
      : [0, "#f1deac", 0.45, "#dec38b", 1, "#c8a66f"],
    stageShadowOpacity: night ? 0.26 : 0.16,
    warmWashOpacity: night ? 0.05 : 0.16,
    coolWashOpacity: night ? 0.16 : 0.08,
    globalTint: night ? "#10243b" : "#fff4cf",
    globalTintOpacity: night ? 0.28 : 0.05,
    vignetteOpacity: night ? 0.32 : 0.08,
    rainOpacity: 0,
    mistOpacity: 0,
    object: {
      castOffsetX: night ? 0.05 : 0.14,
      castOffsetY: night ? 0.08 : 0.07,
      castOpacity: night ? 0.22 : 0.13,
      contactOpacity: night ? 0.28 : 0.22,
      shadowBlur: night ? 16 : 9,
      shadowColor: night ? "#091827" : "#2c2117",
      spriteOpacity: night ? 0.94 : 1,
    },
  };

  if (cloudy) {
    return {
      ...base,
      backgroundStops: night ? [0, "#22303a", 1, "#15212c"] : [0, "#d2d8d0", 1, "#aeb9b2"],
      sandStops: night
        ? [0, "#bda779", 0.5, "#a48d62", 1, "#76624a"]
        : [0, "#ead9ab", 0.48, "#d1bb8a", 1, "#b89865"],
      warmWashOpacity: night ? 0.03 : 0.07,
      coolWashOpacity: night ? 0.18 : 0.15,
      globalTint: night ? "#102033" : "#82918b",
      globalTintOpacity: night ? 0.24 : 0.12,
      mistOpacity: night ? 0.16 : 0.12,
      object: {
        ...base.object,
        castOffsetX: night ? 0.03 : 0.07,
        castOffsetY: night ? 0.06 : 0.05,
        castOpacity: night ? 0.18 : 0.08,
        contactOpacity: night ? 0.25 : 0.18,
        shadowBlur: night ? 18 : 15,
        spriteOpacity: night ? 0.91 : 0.96,
      },
    };
  }

  if (rainy) {
    return {
      ...base,
      backgroundStops: night ? [0, "#1b2b39", 1, "#0c1723"] : [0, "#c3d1d0", 1, "#91aaa9"],
      sandStops: night
        ? [0, "#bca87d", 0.5, "#967f5b", 1, "#695744"]
        : [0, "#e3d2a8", 0.48, "#c4ad80", 1, "#a8865d"],
      warmWashOpacity: night ? 0.02 : 0.04,
      coolWashOpacity: night ? 0.24 : 0.2,
      globalTint: night ? "#0d2035" : "#5e7e88",
      globalTintOpacity: night ? 0.28 : 0.16,
      vignetteOpacity: night ? 0.38 : 0.16,
      rainOpacity: night ? 0.34 : 0.28,
      mistOpacity: night ? 0.22 : 0.18,
      object: {
        ...base.object,
        castOffsetX: night ? 0.04 : 0.08,
        castOffsetY: night ? 0.07 : 0.06,
        castOpacity: night ? 0.2 : 0.1,
        contactOpacity: night ? 0.28 : 0.22,
        shadowBlur: night ? 19 : 17,
        shadowColor: night ? "#061522" : "#24313a",
        spriteOpacity: night ? 0.89 : 0.93,
      },
    };
  }

  return base;
}
