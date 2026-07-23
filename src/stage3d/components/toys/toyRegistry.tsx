import type { ToyModelRecipe } from "../../../types";
import { DogToy, BirdToy, FishToy, LionToy } from "./AnimalToys";
import { BridgeToy, FenceToy, HouseToy, TowerToy } from "./EnvironmentToys";
import { RockToy, SunToy, TreeToy, WaterToy } from "./NatureToys";
import { PersonToy } from "./PersonToy";
import { FallbackToy, LightToy, MonsterToy, RobotToy, SkullToy } from "./SymbolToys";

export function renderToyModel(recipe: ToyModelRecipe): JSX.Element {
  switch (recipe.kind) {
    case "person":
      return <PersonToy cloth={recipe.cloth} skin={recipe.skin} bodyScale={recipe.bodyScale} elder={recipe.elder} />;
    case "dog":
      return <DogToy />;
    case "bird":
      return <BirdToy />;
    case "fish":
      return <FishToy />;
    case "lion":
      return <LionToy />;
    case "house":
      return <HouseToy />;
    case "bridge":
      return <BridgeToy />;
    case "fence":
      return <FenceToy />;
    case "tower":
      return <TowerToy />;
    case "tree":
      return <TreeToy />;
    case "water":
      return <WaterToy />;
    case "rock":
      return <RockToy />;
    case "sun":
      return <SunToy />;
    case "monster":
      return <MonsterToy />;
    case "robot":
      return <RobotToy />;
    case "skull":
      return <SkullToy />;
    case "light":
      return <LightToy />;
    case "fallback":
    default:
      return <FallbackToy />;
  }
}

export function getToyShadowRadius(kind: ToyModelRecipe["kind"]): number {
  if (kind === "bridge" || kind === "fence" || kind === "water") {
    return 0.74;
  }
  if (kind === "tree" || kind === "house" || kind === "tower") {
    return 0.62;
  }
  return 0.46;
}
