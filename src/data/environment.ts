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
      : [0, "#f5e0aa", 0.45, "#dfbf7c", 1, "#bd925b"],
    stageShadowOpacity: night ? 0.26 : 0.16,
    warmWashOpacity: night ? 0.05 : 0.072,
    coolWashOpacity: night ? 0.16 : 0.036,
    globalTint: night ? "#10243b" : "#fff4cf",
    globalTintOpacity: night ? 0.12 : 0.035,
    vignetteOpacity: night ? 0.18 : 0.08,
    rainOpacity: 0,
    mistOpacity: 0,
    object: {
      castOffsetX: night ? 0.05 : 0.14,
      castOffsetY: night ? 0.08 : 0.07,
      castOpacity: night ? 0.165 : 0.145,
      contactOpacity: night ? 0.23 : 0.28,
      shadowBlur: night ? 21 : 14,
      shadowColor: night ? "#0e202b" : "#3a2b1d",
      spriteOpacity: 1,
    },
  };

  if (cloudy) {
    return {
      ...base,
      backgroundStops: night ? [0, "#22303a", 1, "#15212c"] : [0, "#d2d8d0", 1, "#aeb9b2"],
      sandStops: night
        ? [0, "#cdb88a", 0.5, "#b0986c", 1, "#846d50"]
        : [0, "#ead9ab", 0.48, "#d1bb8a", 1, "#b89865"],
      warmWashOpacity: night ? 0.03 : 0.052,
      coolWashOpacity: night ? 0.15 : 0.115,
      globalTint: night ? "#102033" : "#82918b",
      globalTintOpacity: night ? 0.08 : 0.06,
      mistOpacity: night ? 0.055 : 0.075,
      object: {
        ...base.object,
        castOffsetX: night ? 0.03 : 0.07,
        castOffsetY: night ? 0.06 : 0.05,
        castOpacity: night ? 0.15 : 0.12,
        contactOpacity: night ? 0.23 : 0.255,
        shadowBlur: night ? 21 : 16,
        spriteOpacity: 1,
      },
    };
  }

  if (rainy) {
    return {
      ...base,
      backgroundStops: night ? [0, "#1b2b39", 1, "#0c1723"] : [0, "#c3d1d0", 1, "#91aaa9"],
      sandStops: night
        ? [0, "#cdb98a", 0.5, "#ad9469", 1, "#826b50"]
        : [0, "#e3d2a8", 0.48, "#c4ad80", 1, "#a8865d"],
      warmWashOpacity: night ? 0.02 : 0.032,
      coolWashOpacity: night ? 0.18 : 0.155,
      globalTint: night ? "#0d2035" : "#5e7e88",
      globalTintOpacity: night ? 0.075 : 0.082,
      vignetteOpacity: night ? 0.15 : 0.12,
      rainOpacity: night ? 0.13 : 0.19,
      mistOpacity: night ? 0.06 : 0.1,
      object: {
        ...base.object,
        castOffsetX: night ? 0.04 : 0.08,
        castOffsetY: night ? 0.07 : 0.06,
        castOpacity: night ? 0.15 : 0.125,
        contactOpacity: night ? 0.24 : 0.27,
        shadowBlur: night ? 22 : 17,
        shadowColor: night ? "#102331" : "#24313a",
        spriteOpacity: 1,
      },
    };
  }

  return base;
}
