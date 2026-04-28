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
        {recentEvents.map((event) => (
          <article key={event.id} className={`event-item event-${event.type}`}>
            <time>{formatTime(event.timestamp)}</time>
            <div>
              <strong>{event.label}</strong>
              <span>{event.type}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function formatTime(timestamp: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(timestamp));
}
