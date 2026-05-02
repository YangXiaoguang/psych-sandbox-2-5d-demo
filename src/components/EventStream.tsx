import type { SandboxEvent } from "../types";

interface EventStreamProps {
  events: SandboxEvent[];
}

export function EventStream({ events }: EventStreamProps): JSX.Element {
  const recentEvents = [...events].reverse().slice(0, 14);

  return (
    <section className="side-section event-stream" aria-label="过程事件流">
      <h2>事件流</h2>
      <div className="event-list">
        {recentEvents.length === 0 ? <p className="empty-state compact">还没有创作事件。</p> : null}
        {recentEvents.map((event) => (
          <article key={event.id} className={`event-item event-${event.type}`}>
            <time>{formatTime(event.timestamp)}</time>
            <div>
              <strong>{event.label}</strong>
              <span>{getEventLabel(event.type)}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function getEventLabel(type: SandboxEvent["type"]): string {
  const labels: Record<SandboxEvent["type"], string> = {
    add: "添加",
    move: "移动",
    transform: "变换",
    delete: "删除",
    property_change: "属性",
    export: "导出",
    clear: "清空",
    select: "选择",
    seed: "初始",
  };
  return labels[type];
}

function formatTime(timestamp: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(timestamp));
}
