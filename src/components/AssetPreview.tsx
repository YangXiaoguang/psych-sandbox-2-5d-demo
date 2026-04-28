import type { SandboxAsset } from "../types";

interface AssetPreviewProps {
  asset: SandboxAsset;
}

export function AssetPreview({ asset }: AssetPreviewProps): JSX.Element {
  return (
    <svg className="asset-preview" viewBox="0 0 96 96" aria-hidden="true" focusable="false">
      <AssetPreviewGraphic assetId={asset.assetId} />
    </svg>
  );
}

function AssetPreviewGraphic({ assetId }: { assetId: string }): JSX.Element {
  switch (assetId) {
    case "person_child":
      return (
        <>
          <circle cx="48" cy="25" r="12" fill="#f2bc7c" />
          <rect x="36" y="38" width="24" height="30" rx="9" fill="#5ba8d8" />
          <path d="M37 70 29 86M59 70l8 16M36 47 24 58M60 47l12 11" stroke="#745843" strokeWidth="6" strokeLinecap="round" />
        </>
      );
    case "person_adult":
      return (
        <>
          <circle cx="48" cy="21" r="12" fill="#d99a65" />
          <rect x="34" y="35" width="28" height="42" rx="8" fill="#376a8a" />
          <path d="M36 79 30 91M60 79l6 12M34 43 20 55M62 43l14 12" stroke="#654431" strokeWidth="7" strokeLinecap="round" />
        </>
      );
    case "person_elder":
      return (
        <>
          <circle cx="47" cy="21" r="12" fill="#d6aa7b" />
          <path d="M35 35h26l5 40H30z" fill="#82756a" />
          <path d="M66 44v42" stroke="#6a4a33" strokeWidth="5" strokeLinecap="round" />
          <path d="M35 80 30 92M59 80l6 12" stroke="#5d4636" strokeWidth="6" strokeLinecap="round" />
        </>
      );
    case "animal_dog":
      return (
        <>
          <ellipse cx="47" cy="56" rx="27" ry="17" fill="#b77a45" />
          <circle cx="72" cy="45" r="14" fill="#c98a50" />
          <circle cx="77" cy="43" r="2.8" fill="#1f2933" />
          <path d="M67 35 60 22M74 34l6-12M22 51 10 40" stroke="#8b5a34" strokeWidth="6" strokeLinecap="round" />
          <path d="M34 69v16M56 69v16" stroke="#8b5a34" strokeWidth="6" strokeLinecap="round" />
        </>
      );
    case "animal_bird":
      return (
        <>
          <ellipse cx="48" cy="52" rx="24" ry="17" fill="#4f8bbd" />
          <path d="M39 50c-16-2-23-10-27-22 17 3 29 9 38 21z" fill="#78b8db" />
          <path d="M68 50 84 43 68 36z" fill="#d99b36" />
          <circle cx="58" cy="43" r="3" fill="#16202a" />
          <path d="M38 66 30 82M53 67l6 15" stroke="#6f482f" strokeWidth="5" strokeLinecap="round" />
        </>
      );
    case "animal_fish":
      return (
        <>
          <ellipse cx="48" cy="49" rx="28" ry="16" fill="#3d9fa8" />
          <path d="M20 49 5 34v30z" fill="#2a7f86" />
          <path d="M48 34c7 2 11 6 13 15-9-1-16-4-21-10z" fill="#75c5c8" />
          <circle cx="66" cy="45" r="3" fill="#172027" />
        </>
      );
    case "animal_lion":
      return (
        <>
          <ellipse cx="43" cy="61" rx="28" ry="16" fill="#bd8640" />
          <circle cx="70" cy="44" r="20" fill="#8e5a2d" />
          <circle cx="70" cy="44" r="13" fill="#d0a04f" />
          <circle cx="66" cy="42" r="2.2" fill="#171717" />
          <circle cx="75" cy="42" r="2.2" fill="#171717" />
          <path d="M29 72v14M51 72v14M16 57 6 47" stroke="#80512b" strokeWidth="6" strokeLinecap="round" />
        </>
      );
    case "env_house":
      return (
        <>
          <rect x="24" y="43" width="48" height="39" rx="4" fill="#e2b06d" />
          <path d="M18 47 48 18l30 29z" fill="#b9493e" />
          <rect x="43" y="59" width="12" height="23" rx="2" fill="#6d4a35" />
          <rect x="29" y="55" width="10" height="10" rx="2" fill="#7db1c6" />
          <rect x="59" y="55" width="10" height="10" rx="2" fill="#7db1c6" />
        </>
      );
    case "env_bridge":
      return (
        <>
          <path d="M15 66c16-29 50-29 66 0" fill="none" stroke="#8b6a4e" strokeWidth="10" strokeLinecap="round" />
          <path d="M18 67h60" stroke="#c19867" strokeWidth="10" strokeLinecap="round" />
          <path d="M29 45v28M48 38v35M67 45v28" stroke="#6d4e39" strokeWidth="5" strokeLinecap="round" />
        </>
      );
    case "env_fence":
      return (
        <>
          <path d="M14 50h68M14 68h68" stroke="#9b734c" strokeWidth="8" strokeLinecap="round" />
          {[20, 34, 48, 62, 76].map((x) => (
            <path key={x} d={`M${x} 31v50`} stroke="#c6925d" strokeWidth="9" strokeLinecap="round" />
          ))}
        </>
      );
    case "env_tower":
      return (
        <>
          <path d="M34 28h28l7 58H27z" fill="#8a98a4" />
          <path d="M30 28 48 11l18 17z" fill="#4f6475" />
          <rect x="43" y="61" width="10" height="25" rx="2" fill="#4b3b34" />
          <rect x="42" y="39" width="12" height="12" rx="2" fill="#e8c66e" />
        </>
      );
    case "nature_tree":
      return (
        <>
          <rect x="42" y="54" width="12" height="30" rx="4" fill="#8c6139" />
          <circle cx="39" cy="44" r="19" fill="#478f5b" />
          <circle cx="56" cy="38" r="22" fill="#3f7f52" />
          <circle cx="56" cy="56" r="18" fill="#5da66c" />
        </>
      );
    case "nature_water":
      return (
        <>
          <ellipse cx="48" cy="55" rx="38" ry="22" fill="#77bed0" />
          <path d="M18 52c8-6 16 6 24 0s16-6 25 0 13 5 18 0" fill="none" stroke="#e4fbff" strokeWidth="5" strokeLinecap="round" />
          <path d="M28 64c9-5 16 5 25 0s17-4 27 0" fill="none" stroke="#2b8da1" strokeWidth="4" strokeLinecap="round" />
        </>
      );
    case "nature_rock":
      return <path d="M16 65 28 38l20-9 24 11 10 26-18 14H31z" fill="#8e9494" stroke="#687173" strokeWidth="3" />;
    case "nature_sun":
      return (
        <>
          <path d="M48 7v17M48 72v17M7 48h17M72 48h17M19 19l12 12M65 65l12 12M77 19 65 31M31 65 19 77" stroke="#e59f2e" strokeWidth="6" strokeLinecap="round" />
          <circle cx="48" cy="48" r="22" fill="#f3c94e" />
        </>
      );
    case "symbol_monster":
      return (
        <>
          <path d="M29 28 22 10l18 13M65 28l10-17-20 12" fill="#6e559e" />
          <ellipse cx="48" cy="54" rx="31" ry="30" fill="#7b66b1" />
          <circle cx="38" cy="45" r="6" fill="#e9f5fb" />
          <circle cx="58" cy="45" r="6" fill="#e9f5fb" />
          <circle cx="39" cy="46" r="2" fill="#171717" />
          <circle cx="59" cy="46" r="2" fill="#171717" />
          <path d="M35 64h26l-6 8-5-5-5 5z" fill="#ffffff" />
        </>
      );
    case "symbol_robot":
      return (
        <>
          <path d="M48 12v10" stroke="#56606d" strokeWidth="5" strokeLinecap="round" />
          <circle cx="48" cy="10" r="4" fill="#e06f4f" />
          <rect x="31" y="24" width="34" height="26" rx="5" fill="#9aa6b2" />
          <rect x="26" y="55" width="44" height="29" rx="6" fill="#6f7f8d" />
          <circle cx="41" cy="38" r="4" fill="#22313d" />
          <circle cx="55" cy="38" r="4" fill="#22313d" />
          <path d="M21 62h-9M75 62h9M38 84v9M58 84v9" stroke="#56606d" strokeWidth="7" strokeLinecap="round" />
        </>
      );
    case "symbol_skull":
      return (
        <>
          <circle cx="48" cy="39" r="25" fill="#e8e4da" />
          <rect x="34" y="56" width="28" height="22" rx="5" fill="#d8d2c6" />
          <circle cx="38" cy="38" r="7" fill="#30343a" />
          <circle cx="58" cy="38" r="7" fill="#30343a" />
          <path d="M48 45 42 55h12z" fill="#34383d" />
          <path d="M39 64v13M48 63v15M57 64v13" stroke="#817a70" strokeWidth="3" />
        </>
      );
    case "symbol_light":
      return (
        <>
          <path d="M48 13v13M24 25l10 10M72 25 62 35M18 50h13M65 50h13" stroke="#f3c85c" strokeWidth="5" strokeLinecap="round" />
          <circle cx="48" cy="48" r="20" fill="#f7d978" />
          <rect x="40" y="67" width="16" height="11" rx="3" fill="#77715e" />
          <path d="M39 81h18" stroke="#4e4a40" strokeWidth="5" strokeLinecap="round" />
        </>
      );
    default:
      return <circle cx="48" cy="48" r="28" fill="#8ab7c9" />;
  }
}
