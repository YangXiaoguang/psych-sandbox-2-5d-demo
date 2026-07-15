import { Bot, Boxes, LogOut, Settings, ShieldCheck, UserRound, type LucideIcon } from "lucide-react";
import type { LocalAuthSession } from "../auth/types";

export type AppView = "auth" | "sandbox" | "agentChat" | "personal" | "admin";

interface AppNavigationProps {
  activeView: AppView;
  onViewChange: (view: AppView) => void;
  activeUserName?: string;
  authSession: LocalAuthSession | null;
  onLogout: () => void;
}

const NAV_ITEMS: Array<{ id: AppView; label: string; eyebrow: string; icon: LucideIcon }> = [
  { id: "sandbox", label: "沙盘编辑", eyebrow: "Sand Tray", icon: Boxes },
  { id: "agentChat", label: "对话 Agent", eyebrow: "AI Dialogue", icon: Bot },
  { id: "personal", label: "个人中心", eyebrow: "Memory OS", icon: UserRound },
  { id: "admin", label: "管理后台", eyebrow: "Admin", icon: Settings },
];

export function AppNavigation({
  activeView,
  onViewChange,
  activeUserName,
  authSession,
  onLogout,
}: AppNavigationProps): JSX.Element {
  return (
    <header className="app-navigation" aria-label="应用导航">
      <div className="app-brand">
        <p className="eyebrow">Psych Sandbox Studio</p>
        <h1>2.5D 心理沙盘协作系统</h1>
        <div className="app-brand-meta" aria-label="系统状态">
          <span>本地原型</span>
          {activeUserName ? <span>当前：{activeUserName}</span> : null}
          <span className="app-save-status">已保存</span>
        </div>
      </div>
      <div className="app-navigation-actions">
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
        <div className="app-auth-chip" aria-label="当前登录身份">
          <span>
            {authSession?.authMode === "password" ? <ShieldCheck size={16} /> : <UserRound size={16} />}
          </span>
          <div>
            <strong>{authSession?.displayName ?? activeUserName ?? "本地来访者"}</strong>
            <em>{authSession?.authMode === "password" ? authSession.email : "本地访客模式"}</em>
          </div>
          <button type="button" onClick={onLogout} aria-label="退出登录">
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </header>
  );
}
