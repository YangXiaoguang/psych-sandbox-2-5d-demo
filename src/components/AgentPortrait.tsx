import type { PsychAgentProfile } from "../types";

type AgentPortraitSize = "hero" | "mini" | "message";
type AgentPortraitVariant = "jung" | "freud" | "warm";

interface AgentPortraitProps {
  agent: Pick<PsychAgentProfile, "id" | "name" | "school" | "avatarStyle">;
  size?: AgentPortraitSize;
  isSpeaking?: boolean;
  className?: string;
}

export function AgentPortrait({
  agent,
  size = "hero",
  isSpeaking = false,
  className = "",
}: AgentPortraitProps): JSX.Element {
  const variant = getAgentPortraitVariant(agent);

  return (
    <span
      className={[
        "agent-portrait",
        `agent-portrait-${size}`,
        `agent-portrait-${variant}`,
        isSpeaking ? "speaking" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-hidden="true"
    >
      {variant === "jung" ? <JungPortrait /> : null}
      {variant === "freud" ? <FreudPortrait /> : null}
      {variant === "warm" ? <WarmPortrait /> : null}
    </span>
  );
}

function getAgentPortraitVariant(
  agent: Pick<PsychAgentProfile, "id" | "name" | "school" | "avatarStyle">,
): AgentPortraitVariant {
  const text = `${agent.id} ${agent.name} ${agent.school}`.toLowerCase();
  if (text.includes("jung") || text.includes("荣格")) {
    return "jung";
  }
  if (text.includes("freud") || text.includes("弗洛伊德")) {
    return "freud";
  }
  return "warm";
}

function JungPortrait(): JSX.Element {
  return (
    <svg className="agent-portrait-art" viewBox="0 0 180 220" focusable="false">
      <defs>
        <linearGradient id="jung-skin" x1="52" y1="18" x2="132" y2="142" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffe0b8" />
          <stop offset="0.62" stopColor="#f2ad78" />
          <stop offset="1" stopColor="#c8754d" />
        </linearGradient>
        <linearGradient id="jung-suit" x1="44" y1="138" x2="137" y2="218" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5f524a" />
          <stop offset="1" stopColor="#28231f" />
        </linearGradient>
        <radialGradient id="jung-cheek" cx="50%" cy="50%" r="50%">
          <stop stopColor="#f0a07d" stopOpacity="0.62" />
          <stop offset="1" stopColor="#f0a07d" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="jung-face-sheen" cx="37%" cy="20%" r="58%">
          <stop stopColor="#fff8dc" stopOpacity="0.58" />
          <stop offset="0.42" stopColor="#fff0c7" stopOpacity="0.2" />
          <stop offset="1" stopColor="#fff0c7" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="jung-glasses-shine" x1="58" y1="74" x2="128" y2="109" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fff8dc" stopOpacity="0.72" />
          <stop offset="0.48" stopColor="#fff8dc" stopOpacity="0" />
          <stop offset="1" stopColor="#fff8dc" stopOpacity="0.26" />
        </linearGradient>
        <filter id="portrait-soft-shadow" x="-30%" y="-30%" width="160%" height="170%">
          <feDropShadow dx="0" dy="9" stdDeviation="5" floodColor="#3d2b20" floodOpacity="0.22" />
        </filter>
      </defs>
      <g className="agent-portrait-body" filter="url(#portrait-soft-shadow)">
        <path d="M43 215c5-46 28-71 50-71s45 25 50 71H43z" fill="url(#jung-suit)" />
        <path d="M74 145h36l-7 31H81l-7-31z" fill="#f1c097" />
        <path d="M69 154l17 20-8 31-20-47 11-4zM112 154l-17 20 8 31 20-47-11-4z" fill="#f7f0df" />
        <path d="M84 174h17l8 41H76l8-41z" fill="#191716" />
        <path d="M61 169c10 11 20 18 31 20 12-2 22-9 31-20l7 46H54l7-46z" fill="none" stroke="#211d1a" strokeOpacity="0.45" strokeWidth="2" />
        <path d="M31 84c-7-3-15 4-13 17 2 14 11 21 20 18M145 84c7-3 15 4 13 17-2 14-11 21-20 18" fill="#e99d6a" />
        <path d="M32 67c1-35 24-56 58-56s57 22 59 56c2 47-18 82-58 82S30 114 32 67z" fill="url(#jung-skin)" />
        <path d="M44 66c5-26 25-40 52-40 20 0 34 8 42 23-14-9-34-12-58-8-18 3-29 11-36 25z" fill="url(#jung-face-sheen)" />
        <path d="M53 107c9 20 24 31 43 31 16 0 29-8 39-25-8 25-23 38-44 38-19 0-32-12-38-44z" fill="#8a4f37" opacity="0.12" />
        <ellipse cx="56" cy="103" rx="16" ry="10" fill="url(#jung-cheek)" />
        <ellipse cx="124" cy="103" rx="16" ry="10" fill="url(#jung-cheek)" />
        <path d="M29 69c0-40 25-62 62-62 32 0 53 17 58 50-23-12-52-15-84-9-14 3-26 9-36 21z" fill="#2a211a" />
        <path d="M38 64c18-21 57-30 99-13" fill="none" stroke="#5d4d42" strokeWidth="7" strokeLinecap="round" opacity="0.82" />
        <path d="M48 55c19-17 49-23 82-11" fill="none" stroke="#7b6a5d" strokeWidth="3" strokeLinecap="round" opacity="0.56" />
        <path d="M57 80c10-8 21-8 31-2M101 78c10-6 20-5 28 3" fill="none" stroke="#38251b" strokeWidth="4" strokeLinecap="round" />
        <ellipse className="agent-eye left" cx="73" cy="92" rx="10.5" ry="13" fill="#2b1c15" />
        <ellipse className="agent-eye right" cx="111" cy="92" rx="10.5" ry="13" fill="#2b1c15" />
        <circle className="agent-eye-glint" cx="69" cy="87" r="3.6" fill="#fff7e7" />
        <circle className="agent-eye-glint" cx="107" cy="87" r="3.6" fill="#fff7e7" />
        <path d="M63 81c8-5 22-5 31 0M100 81c10-5 22-5 32 1" fill="none" stroke="url(#jung-glasses-shine)" strokeWidth="1.8" strokeLinecap="round" opacity="0.72" />
        <path d="M65 91c-4 13 15 16 20 5M103 96c5 11 23 8 20-5" fill="none" stroke="#5c3e2e" strokeWidth="2.2" opacity="0.36" />
        <circle cx="73" cy="92" r="17" fill="none" stroke="#7a5738" strokeWidth="2.4" />
        <circle cx="111" cy="92" r="17" fill="none" stroke="#7a5738" strokeWidth="2.4" />
        <path d="M90 91h4" stroke="#7a5738" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M56 90l-20-9M128 90l18-8" stroke="#7a5738" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M92 91c-4 12-8 22-4 27 2 2 7 2 11 0" fill="none" stroke="#a86443" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M68 125c11-8 34-8 45 0" fill="none" stroke="#4b2318" strokeWidth="4.8" strokeLinecap="round" />
        <path className="agent-mouth" d="M79 133c8 4 18 4 25 0" fill="none" stroke="#6e3325" strokeWidth="3" strokeLinecap="round" />
      </g>
    </svg>
  );
}

function FreudPortrait(): JSX.Element {
  return (
    <svg className="agent-portrait-art" viewBox="0 0 180 220" focusable="false">
      <defs>
        <linearGradient id="freud-skin" x1="54" y1="28" x2="136" y2="142" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffe2bf" />
          <stop offset="0.62" stopColor="#eda778" />
          <stop offset="1" stopColor="#c67652" />
        </linearGradient>
        <linearGradient id="freud-suit" x1="45" y1="139" x2="135" y2="218" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8b6b43" />
          <stop offset="1" stopColor="#3f2d20" />
        </linearGradient>
        <linearGradient id="freud-hair" x1="47" y1="31" x2="126" y2="136" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fff5df" />
          <stop offset="0.56" stopColor="#d6c7ad" />
          <stop offset="1" stopColor="#847767" />
        </linearGradient>
        <radialGradient id="freud-face-sheen" cx="38%" cy="20%" r="58%">
          <stop stopColor="#fff8dd" stopOpacity="0.56" />
          <stop offset="0.42" stopColor="#fff0c7" stopOpacity="0.18" />
          <stop offset="1" stopColor="#fff0c7" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="freud-cheek" cx="50%" cy="50%" r="50%">
          <stop stopColor="#eea17f" stopOpacity="0.5" />
          <stop offset="1" stopColor="#eea17f" stopOpacity="0" />
        </radialGradient>
        <filter id="freud-soft-shadow" x="-30%" y="-30%" width="160%" height="170%">
          <feDropShadow dx="0" dy="9" stdDeviation="5" floodColor="#3d2b20" floodOpacity="0.22" />
        </filter>
      </defs>
      <g className="agent-portrait-body" filter="url(#freud-soft-shadow)">
        <path d="M42 215c5-44 26-70 50-70s45 26 48 70H42z" fill="url(#freud-suit)" />
        <path d="M76 145h34l-8 31H84l-8-31z" fill="#efbb91" />
        <path d="M69 155l18 19-9 38-23-49 14-8zM113 155l-18 19 8 38 24-49-14-8z" fill="#f7f0df" />
        <path d="M83 174h18l9 41H75l8-41z" fill="#49301f" />
        <path d="M34 84c-8-2-15 7-11 21 3 12 12 18 20 14M146 82c8-2 14 6 11 20-3 13-12 20-21 17" fill="#e69a6d" />
        <path d="M34 69c2-35 26-57 61-57 36 0 56 22 58 58 2 46-20 82-60 82S32 115 34 69z" fill="url(#freud-skin)" />
        <path d="M47 67c7-25 27-40 53-40 21 0 36 9 44 25-15-9-35-11-58-6-19 4-31 11-39 21z" fill="url(#freud-face-sheen)" />
        <ellipse cx="57" cy="105" rx="15" ry="10" fill="url(#freud-cheek)" />
        <ellipse cx="130" cy="105" rx="15" ry="10" fill="url(#freud-cheek)" />
        <path d="M36 70c4-35 30-61 65-61 23 0 42 12 50 35-26-15-67-11-94 4-10 6-17 13-21 22z" fill="url(#freud-hair)" />
        <path d="M55 48c24-16 61-22 92 2M51 58c28-18 63-21 94-1M47 70c29-18 64-19 96 1" fill="none" stroke="#fff7e9" strokeWidth="2.1" strokeLinecap="round" opacity="0.75" />
        <path d="M72 34c19-8 44-10 65 1" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" opacity="0.48" />
        <path d="M60 82c10-8 21-8 31-1M104 82c9-7 19-6 28 1" fill="none" stroke="#8d8175" strokeWidth="4.5" strokeLinecap="round" />
        <ellipse className="agent-eye left" cx="77" cy="95" rx="11" ry="13.5" fill="#332018" />
        <ellipse className="agent-eye right" cx="116" cy="94" rx="11" ry="13.5" fill="#332018" />
        <circle className="agent-eye-glint" cx="73" cy="90" r="3.5" fill="#fff7e7" />
        <circle className="agent-eye-glint" cx="112" cy="90" r="3.5" fill="#fff7e7" />
        <path d="M96 95c-5 12-9 22-4 27 2 2 7 2 11 0" fill="none" stroke="#a86443" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M59 119c8 33 60 36 73-1-10 14-23 20-37 20-14 0-25-6-36-19z" fill="url(#freud-hair)" />
        <path d="M67 126c14 18 42 19 56 0M79 136c9 9 24 10 33 0M72 118c14 7 32 7 48 0" fill="none" stroke="#fff9e9" strokeWidth="1.8" strokeLinecap="round" opacity="0.78" />
        <path className="agent-mouth" d="M82 129c8 4 19 4 27 0" fill="none" stroke="#7d4a35" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M39 170c-18-6-30-3-35 8-6 14 8 28 23 23 10-4 12-16 7-24" fill="#efbb91" />
        <path d="M27 173c-3-24 16-42 32-30 12 9 8 29-8 35" fill="#efbb91" />
        <path d="M8 178c25-16 40-26 52-34" fill="none" stroke="#5e341e" strokeWidth="8" strokeLinecap="round" />
        <path d="M8 178c24-16 39-25 51-33" fill="none" stroke="#9a5b2f" strokeWidth="5" strokeLinecap="round" />
        <path d="M5 178c-7-3-6-9 1-12 7-3 15 2 14 9-1 5-8 6-15 3z" fill="#2c211a" />
      </g>
    </svg>
  );
}

function WarmPortrait(): JSX.Element {
  return (
    <svg className="agent-portrait-art" viewBox="0 0 180 220" focusable="false">
      <defs>
        <linearGradient id="warm-head" x1="48" y1="28" x2="132" y2="146" gradientUnits="userSpaceOnUse">
          <stop stopColor="#a7e2d0" />
          <stop offset="0.65" stopColor="#64b9aa" />
          <stop offset="1" stopColor="#31877d" />
        </linearGradient>
        <linearGradient id="warm-body" x1="51" y1="143" x2="130" y2="218" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f3c688" />
          <stop offset="1" stopColor="#d47d53" />
        </linearGradient>
        <radialGradient id="warm-sheen" cx="36%" cy="20%" r="58%">
          <stop stopColor="#f5fff3" stopOpacity="0.66" />
          <stop offset="0.45" stopColor="#e6fff5" stopOpacity="0.2" />
          <stop offset="1" stopColor="#e6fff5" stopOpacity="0" />
        </radialGradient>
        <filter id="warm-soft-shadow" x="-30%" y="-30%" width="160%" height="170%">
          <feDropShadow dx="0" dy="9" stdDeviation="5" floodColor="#3d2b20" floodOpacity="0.22" />
        </filter>
      </defs>
      <g className="agent-portrait-body" filter="url(#warm-soft-shadow)">
        <path d="M46 215c4-44 24-72 47-72s43 28 47 72H46z" fill="url(#warm-body)" />
        <path d="M36 73c0-38 22-62 57-62s56 24 56 62v18c0 39-22 63-56 63s-57-24-57-63V73z" fill="url(#warm-head)" />
        <path d="M48 70c8-28 27-43 54-43 18 0 31 8 39 22-14-8-31-10-51-6-20 4-34 13-42 27z" fill="url(#warm-sheen)" />
        <path d="M46 61c15-28 53-42 91-18" fill="none" stroke="#d9fff2" strokeWidth="10" strokeLinecap="round" opacity="0.42" />
        <ellipse className="agent-eye left" cx="75" cy="91" rx="8" ry="11" fill="#253936" />
        <ellipse className="agent-eye right" cx="111" cy="91" rx="8" ry="11" fill="#253936" />
        <circle className="agent-eye-glint" cx="72" cy="86" r="3" fill="#fffbe9" />
        <circle className="agent-eye-glint" cx="108" cy="86" r="3" fill="#fffbe9" />
        <path className="agent-mouth" d="M74 120c10 11 28 11 39 0" fill="none" stroke="#234a45" strokeWidth="5" strokeLinecap="round" />
        <path d="M56 158c15 18 57 18 72 0" fill="none" stroke="#fff2d6" strokeWidth="7" strokeLinecap="round" />
        <path d="M73 170l20 17 20-17" fill="none" stroke="#8e4c33" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}
