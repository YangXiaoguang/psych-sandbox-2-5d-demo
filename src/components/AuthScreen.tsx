import { ArrowRight, KeyRound, LockKeyhole, Mail, ShieldCheck, UserPlus, UserRound } from "lucide-react";
import { type FormEvent, useState } from "react";
import type { PersonalAgeGroup, PersonalRole } from "../personal/types";

export type AuthMode = "login" | "register" | "recover";

interface AuthScreenProps {
  defaultDisplayName: string;
  onLogin: (input: { email: string; password: string }) => Promise<void>;
  onRegister: (input: {
    displayName: string;
    email: string;
    password: string;
    ageGroup: PersonalAgeGroup;
    role: PersonalRole;
  }) => Promise<void>;
  onRecover: (email: string) => Promise<string>;
  onContinueAsGuest: () => void;
}

const AGE_GROUP_OPTIONS: Array<{ value: PersonalAgeGroup; label: string }> = [
  { value: "unknown", label: "暂不指定" },
  { value: "child", label: "儿童" },
  { value: "teen", label: "青少年" },
  { value: "adult", label: "成人" },
  { value: "elder", label: "长者" },
];

const ROLE_OPTIONS: Array<{ value: PersonalRole; label: string }> = [
  { value: "client", label: "来访者" },
  { value: "student", label: "学生" },
  { value: "parent", label: "家长" },
  { value: "clinician", label: "咨询师" },
  { value: "researcher", label: "研究者" },
  { value: "demo", label: "本地原型" },
];

export function AuthScreen({
  defaultDisplayName,
  onLogin,
  onRegister,
  onRecover,
  onContinueAsGuest,
}: AuthScreenProps): JSX.Element {
  const [mode, setMode] = useState<AuthMode>("login");
  const [displayName, setDisplayName] = useState(defaultDisplayName || "新的来访者");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [ageGroup, setAgeGroup] = useState<PersonalAgeGroup>("unknown");
  const [role, setRole] = useState<PersonalRole>("client");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (mode === "login") {
        await onLogin({ email, password });
      } else if (mode === "register") {
        await onRegister({ displayName, email, password, ageGroup, role });
      } else {
        setMessage(await onRecover(email));
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "操作失败，请稍后重试。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-shell" aria-label="登录与注册">
      <section className="auth-stage" aria-label="产品说明">
        <div className="auth-orbit">
          <span />
          <span />
          <span />
        </div>
        <div className="auth-avatar" aria-hidden="true">
          <UserRound size={46} />
        </div>
        <p className="eyebrow">Personal Memory OS</p>
        <h2>进入你的心理沙盘工作区</h2>
        <p>
          每个账号拥有独立的沙盘档案、AI 对话、长期记忆候选、授权边界和审计记录。当前为本地原型，认证接口已按后续服务端接入预留。
        </p>
        <div className="auth-stage-points">
          <span>
            <ShieldCheck size={15} />
            个人资料与沙盘档案隔离
          </span>
          <span>
            <KeyRound size={15} />
            为后台账号权限预留接口
          </span>
          <span>
            <LockKeyhole size={15} />
            后续可接入 MFA 与设备管理
          </span>
        </div>
      </section>

      <section className="auth-card" aria-label="认证表单">
        <div className="auth-card-header">
          <div>
            <p className="eyebrow">{mode === "login" ? "Sign In" : mode === "register" ? "Create Account" : "Recover"}</p>
            <h1>{mode === "login" ? "登录" : mode === "register" ? "注册个人账号" : "找回密码"}</h1>
          </div>
          <span>{mode === "register" ? <UserPlus size={18} /> : <ShieldCheck size={18} />}</span>
        </div>

        <div className="auth-mode-tabs" aria-label="认证方式">
          <button type="button" className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>
            登录
          </button>
          <button type="button" className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>
            注册
          </button>
          <button type="button" className={mode === "recover" ? "active" : ""} onClick={() => setMode("recover")}>
            找回
          </button>
        </div>

        <form className="auth-form" onSubmit={submit}>
          {mode === "register" ? (
            <label>
              显示名称
              <span>
                <UserRound size={15} />
                <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
              </span>
            </label>
          ) : null}
          <label>
            邮箱
            <span>
              <Mail size={15} />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@example.com"
                autoComplete="email"
              />
            </span>
          </label>
          {mode !== "recover" ? (
            <label>
              密码
              <span>
                <LockKeyhole size={15} />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="至少 8 位"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                />
              </span>
            </label>
          ) : null}
          {mode === "register" ? (
            <div className="auth-form-grid">
              <label>
                年龄段
                <select value={ageGroup} onChange={(event) => setAgeGroup(event.target.value as PersonalAgeGroup)}>
                  {AGE_GROUP_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                角色
                <select value={role} onChange={(event) => setRole(event.target.value as PersonalRole)}>
                  {ROLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}
          {error ? <p className="auth-feedback error">{error}</p> : null}
          {message ? <p className="auth-feedback">{message}</p> : null}
          <button className="auth-submit" type="submit" disabled={busy}>
            {busy ? "处理中..." : mode === "login" ? "登录并进入" : mode === "register" ? "创建并进入" : "查看重置指引"}
            <ArrowRight size={16} />
          </button>
        </form>

        <button className="auth-guest-button" type="button" onClick={onContinueAsGuest}>
          以本地来访者继续
        </button>
        <p className="auth-local-note">
          当前版本为本地认证原型，适合流程验证。生产环境应使用后端会话、HttpOnly Cookie、限流、MFA 与审计策略。
        </p>
      </section>
    </main>
  );
}
