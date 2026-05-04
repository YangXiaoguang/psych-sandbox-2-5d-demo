import { Bot, Boxes, Settings, UserRound, type LucideIcon } from "lucide-react";

export type AppView = "sandbox" | "agentChat" | "personal" | "admin";

interface AppNavigationProps {
  activeView: AppView;
  onViewChange: (view: AppView) => void;
  activeUserName?: string;
}

const NAV_ITEMS: Array<{ id: AppView; label: string; eyebrow: string; icon: LucideIcon }> = [
  { id: "sandbox", label: "沙盘编辑", eyebrow: "Sand Tray", icon: Boxes },
  { id: "agentChat", label: "对话 Agent", eyebrow: "AI Dialogue", icon: Bot },
  { id: "personal", label: "个人中心", eyebrow: "Memory OS", icon: UserRound },
  { id: "admin", label: "管理后台", eyebrow: "Admin", icon: Settings },
];

export function AppNavigation({ activeView, onViewChange, activeUserName }: AppNavigationProps): JSX.Element {
  return (
    <header className="app-navigation" aria-label="应用导航">
      <div className="app-brand">
        <p className="eyebrow">Psych Sandbox Studio</p>
        <h1>2.5D 心理沙盘协作系统</h1>
        <span>本地原型 · 沙盘编辑 · AI 陪伴 · 个人记忆 OS{activeUserName ? ` · 当前：${activeUserName}` : ""}</span>
      </div>
      <nav className="app-nav-tabs" aria-label="主功能">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              className={activeView === item.id ? "active" : ""}
              onClick={() => onViewChange(item.id)}
            >
              <Icon size={17} />
              <span>
                <em>{item.eyebrow}</em>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </header>
  );
}
