import { MessageCircle } from "lucide-react";

interface AiCompanionAvatarProps {
  active?: boolean;
  onOpen: () => void;
}

export function AiCompanionAvatar({ active = false, onOpen }: AiCompanionAvatarProps): JSX.Element {
  return (
    <button
      className={`ai-stage-companion${active ? " active" : ""}`}
      type="button"
      onClick={onOpen}
      aria-label="打开 AI 伙伴"
      title="打开 AI 伙伴"
    >
      <span className="ai-avatar-orbit" aria-hidden="true" />
      <span className="ai-avatar-body" aria-hidden="true">
        <span className="ai-avatar-ear left" />
        <span className="ai-avatar-ear right" />
        <span className="ai-avatar-face">
          <span className="ai-avatar-eye left" />
          <span className="ai-avatar-eye right" />
          <span className="ai-avatar-mouth" />
        </span>
      </span>
      <span className="ai-avatar-label">
        <MessageCircle size={14} />
        AI 伙伴
      </span>
    </button>
  );
}
