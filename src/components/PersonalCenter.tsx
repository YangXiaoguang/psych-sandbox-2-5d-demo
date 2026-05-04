import {
  Archive,
  Brain,
  CheckCircle2,
  Download,
  Fingerprint,
  History,
  KeyRound,
  Plus,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { AgentConversation, SandboxAnalysis, SandboxEvent, SandboxObject } from "../types";
import {
  CONSENT_DEFINITIONS,
  type CommunicationPreferences,
  type ConsentRecord,
  type ConsentType,
  type CreatePersonalUserInput,
  type IdentityProfile,
  type PersonalAgeGroup,
  type PersonalDataBundle,
  type PersonalRole,
} from "../personal/types";
import {
  exportPersonalArchive,
  getActiveAccount,
  getActivePreferences,
  getActiveProfile,
  getUserConsents,
  recordPersonalAudit,
} from "../personal/localMemoryStore";

interface PersonalCenterProps {
  personalData: PersonalDataBundle;
  objects: SandboxObject[];
  events: SandboxEvent[];
  conversations: AgentConversation[];
  analysis: SandboxAnalysis;
  onPersonalDataChange: (data: PersonalDataBundle) => void;
  onCreateUser: (input: CreatePersonalUserInput) => void;
  onSwitchUser: (userId: string) => void;
}

const AGE_GROUP_LABELS: Record<PersonalAgeGroup, string> = {
  child: "儿童",
  teen: "青少年",
  adult: "成人",
  elder: "长者",
  unknown: "未指定",
};

const ROLE_LABELS: Record<PersonalRole, string> = {
  client: "来访者",
  student: "学生",
  parent: "家长",
  clinician: "咨询师",
  researcher: "研究者",
  demo: "本地原型",
};

const TONE_LABELS: Record<CommunicationPreferences["preferredTone"], string> = {
  gentle: "温和陪伴",
  structured: "结构化梳理",
  direct: "直接清晰",
  playful: "轻松一点",
};

const REPLY_LENGTH_LABELS: Record<CommunicationPreferences["replyLength"], string> = {
  short: "简短",
  balanced: "适中",
  deep: "深入",
};

export function PersonalCenter({
  personalData,
  objects,
  events,
  conversations,
  analysis,
  onPersonalDataChange,
  onCreateUser,
  onSwitchUser,
}: PersonalCenterProps): JSX.Element {
  const activeAccount = getActiveAccount(personalData);
  const activeProfile = getActiveProfile(personalData);
  const preferences = getActivePreferences(personalData);
  const consents = getUserConsents(personalData, activeAccount.userId);
  const activeWorkspace = personalData.workspaces.find((workspace) => workspace.userId === activeAccount.userId);
  const activeAuditLogs = personalData.auditLogs.filter((log) => log.userId === activeAccount.userId).slice(0, 8);
  const grantedCount = consents.filter((consent) => consent.granted).length;
  const [newUserName, setNewUserName] = useState("");
  const [newAgeGroup, setNewAgeGroup] = useState<PersonalAgeGroup>("unknown");
  const [newRole, setNewRole] = useState<PersonalRole>("client");

  const dataDomains = useMemo(
    () => [
      {
        icon: <Archive size={18} />,
        label: "当前沙盘",
        value: `${objects.length}`,
        detail: `${events.length} 条事件已进入用户命名空间`,
      },
      {
        icon: <Brain size={18} />,
        label: "AI 会话",
        value: `${conversations.length}`,
        detail: "Agent 对话按当前用户隔离保存",
      },
      {
        icon: <ShieldCheck size={18} />,
        label: "授权项",
        value: `${grantedCount}/${consents.length}`,
        detail: "长期记忆默认需要额外确认",
      },
      {
        icon: <Fingerprint size={18} />,
        label: "中心对象",
        value: `${analysis.centerObjects.length}`,
        detail: "用于后续沙盘记忆摘要，不等于诊断",
      },
    ],
    [analysis.centerObjects.length, consents.length, conversations.length, events.length, grantedCount, objects.length],
  );

  const updateProfile = (patch: Partial<IdentityProfile>) => {
    const now = new Date().toISOString();
    onPersonalDataChange({
      ...personalData,
      accounts: personalData.accounts.map((account) =>
        account.userId === activeAccount.userId && patch.displayName
          ? { ...account, displayName: patch.displayName, lastActiveAt: now }
          : account,
      ),
      profiles: personalData.profiles.map((profile) =>
        profile.userId === activeAccount.userId ? { ...profile, ...patch, updatedAt: now } : profile,
      ),
    });
  };

  const updatePreferences = (patch: Partial<CommunicationPreferences>) => {
    const now = new Date().toISOString();
    onPersonalDataChange({
      ...personalData,
      preferences: personalData.preferences.map((item) =>
        item.userId === activeAccount.userId ? { ...item, ...patch, updatedAt: now } : item,
      ),
    });
  };

  const updateConsent = (consentType: ConsentType, granted: boolean) => {
    const now = new Date().toISOString();
    const definition = CONSENT_DEFINITIONS.find((item) => item.type === consentType);
    const nextData = {
      ...personalData,
      consents: personalData.consents.map((consent) =>
        consent.userId === activeAccount.userId && consent.consentType === consentType
          ? {
              ...consent,
              granted,
              updatedAt: now,
              revokedAt: granted ? undefined : now,
            }
          : consent,
      ),
    };
    onPersonalDataChange(
      recordPersonalAudit(nextData, {
        action: granted ? "consent_granted" : "consent_revoked",
        resourceType: "consent",
        resourceId: consentType,
        detail: `${granted ? "开启" : "关闭"}授权：${definition?.title ?? consentType}`,
      }),
    );
  };

  const handleCreateUser = () => {
    onCreateUser({
      displayName: newUserName.trim() || "新的本地用户",
      ageGroup: newAgeGroup,
      role: newRole,
    });
    setNewUserName("");
    setNewAgeGroup("unknown");
    setNewRole("client");
  };

  const handleExportArchive = () => {
    exportPersonalArchive(personalData);
    onPersonalDataChange(
      recordPersonalAudit(personalData, {
        action: "personal_archive_exported",
        resourceType: "archive",
        detail: "已导出本地个人档案 JSON。该文件只下载到本机，没有上传到第三方。",
      }),
    );
  };

  return (
    <main className="personal-shell" aria-label="个人中心">
      <section className="personal-hero">
        <div>
          <p className="eyebrow">Personal Memory OS</p>
          <h2>个人中心</h2>
          <p>
            管理本地身份、授权边界、沙盘工作区和个人记忆准备状态。当前版本是本地原型，后续可平滑迁移到真实账号与后端。
          </p>
        </div>
        <div className="personal-hero-card" aria-label="当前用户">
          <span>
            <UserRound size={19} />
          </span>
          <div>
            <strong>{activeProfile.displayName}</strong>
            <em>
              {ROLE_LABELS[activeProfile.role]} · {AGE_GROUP_LABELS[activeProfile.ageGroup]}
            </em>
          </div>
        </div>
      </section>

      <section className="personal-layout">
        <aside className="admin-card personal-identity-rail" aria-label="本地用户">
          <div className="admin-card-header">
            <div>
              <p className="eyebrow">Local Identity</p>
              <h3>注册 / 切换</h3>
            </div>
          </div>
          <div className="personal-account-list">
            {personalData.accounts.map((account) => (
              <button
                key={account.userId}
                type="button"
                className={account.userId === activeAccount.userId ? "active" : ""}
                onClick={() => onSwitchUser(account.userId)}
              >
                <span>
                  <UserRound size={16} />
                </span>
                <strong>{account.displayName}</strong>
                <em>{account.localHandle}</em>
              </button>
            ))}
          </div>
          <div className="personal-create-box">
            <h4>
              <Plus size={15} />
              新增本地用户
            </h4>
            <label>
              显示名称
              <input value={newUserName} onChange={(event) => setNewUserName(event.target.value)} placeholder="例如：小明 / 我自己" />
            </label>
            <label>
              年龄段
              <select value={newAgeGroup} onChange={(event) => setNewAgeGroup(event.target.value as PersonalAgeGroup)}>
                {Object.entries(AGE_GROUP_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              角色
              <select value={newRole} onChange={(event) => setNewRole(event.target.value as PersonalRole)}>
                {Object.entries(ROLE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" onClick={handleCreateUser}>
              <Plus size={15} />
              创建并进入
            </button>
          </div>
          <p className="personal-local-note">
            <KeyRound size={14} />
            这里先实现本地身份与工作区隔离，不保存真实密码。生产版本应接入服务端认证、加密和权限系统。
          </p>
        </aside>

        <section className="personal-main-column">
          <div className="personal-status-grid" aria-label="个人数据概览">
            {dataDomains.map((item) => (
              <article key={item.label} className="personal-status-card">
                <span>{item.icon}</span>
                <div>
                  <strong>{item.value}</strong>
                  <em>{item.label}</em>
                  <p>{item.detail}</p>
                </div>
              </article>
            ))}
          </div>

          <section className="admin-card personal-profile-card" aria-label="基础资料">
            <div className="admin-card-header">
              <div>
                <p className="eyebrow">Identity Profile</p>
                <h3>基础资料</h3>
              </div>
              <button className="admin-config-actions-button" type="button" onClick={handleExportArchive}>
                <Download size={15} />
                导出档案
              </button>
            </div>
            <div className="admin-form">
              <div className="form-grid-2">
                <label>
                  显示名称
                  <input value={activeProfile.displayName} onChange={(event) => updateProfile({ displayName: event.target.value })} />
                </label>
                <label>
                  时区
                  <input value={activeProfile.timezone} onChange={(event) => updateProfile({ timezone: event.target.value })} />
                </label>
                <label>
                  年龄段
                  <select value={activeProfile.ageGroup} onChange={(event) => updateProfile({ ageGroup: event.target.value as PersonalAgeGroup })}>
                    {Object.entries(AGE_GROUP_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  角色
                  <select value={activeProfile.role} onChange={(event) => updateProfile({ role: event.target.value as PersonalRole })}>
                    {Object.entries(ROLE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  监护人 / 重要支持者
                  <input value={activeProfile.guardianName ?? ""} onChange={(event) => updateProfile({ guardianName: event.target.value })} />
                </label>
                <label>
                  咨询师 / 陪伴者
                  <input value={activeProfile.clinicianName ?? ""} onChange={(event) => updateProfile({ clinicianName: event.target.value })} />
                </label>
              </div>
              <label>
                个人备注
                <textarea
                  value={activeProfile.notes ?? ""}
                  onChange={(event) => updateProfile({ notes: event.target.value })}
                  placeholder="可以记录当前服务场景、需要注意的边界或用户主动补充的信息。"
                />
              </label>
              <div className="form-grid-2">
                <label>
                  AI 沟通语气
                  <select
                    value={preferences.preferredTone}
                    onChange={(event) =>
                      updatePreferences({ preferredTone: event.target.value as CommunicationPreferences["preferredTone"] })
                    }
                  >
                    {Object.entries(TONE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  回复长度
                  <select
                    value={preferences.replyLength}
                    onChange={(event) =>
                      updatePreferences({ replyLength: event.target.value as CommunicationPreferences["replyLength"] })
                    }
                  >
                    {Object.entries(REPLY_LENGTH_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="switch-row">
                <input
                  type="checkbox"
                  checked={preferences.prefersVisualExplanation}
                  onChange={(event) => updatePreferences({ prefersVisualExplanation: event.target.checked })}
                />
                偏好图像化解释与沙盘结构提示
              </label>
            </div>
          </section>

          <section className="admin-card personal-consent-card" aria-label="授权设置">
            <div className="admin-card-header">
              <div>
                <p className="eyebrow">Consent & Scope</p>
                <h3>授权与使用边界</h3>
              </div>
              <span className="personal-pill">{grantedCount} 项已开启</span>
            </div>
            <div className="personal-consent-list">
              {consents.map((consent) => {
                const definition = CONSENT_DEFINITIONS.find((item) => item.type === consent.consentType);
                return (
                  <label key={consent.consentId} className="personal-consent-row">
                    <input
                      type="checkbox"
                      checked={consent.granted}
                      onChange={(event) => updateConsent(consent.consentType, event.target.checked)}
                    />
                    <span>
                      <strong>{definition?.title ?? consent.consentType}</strong>
                      <em>{definition?.description ?? consent.reason}</em>
                    </span>
                  </label>
                );
              })}
            </div>
          </section>
        </section>

        <aside className="admin-card personal-governance-panel" aria-label="记忆治理状态">
          <div className="admin-card-header">
            <div>
              <p className="eyebrow">Memory Governance</p>
              <h3>记忆准备状态</h3>
            </div>
          </div>
          <div className="personal-governance-body">
            <section>
              <h4>
                <CheckCircle2 size={15} />
                当前已完成
              </h4>
              <ul>
                <li>本地用户身份与工作区隔离</li>
                <li>沙盘作品按用户命名空间保存</li>
                <li>Agent 会话按用户命名空间保存</li>
                <li>授权项与审计日志可见</li>
              </ul>
            </section>
            <section>
              <h4>
                <Brain size={15} />
                下一阶段
              </h4>
              <ul>
                <li>沙盘会话档案与历史作品</li>
                <li>候选记忆提取与用户确认</li>
                <li>Context Packet 注入 Agent</li>
                <li>我的记忆 Dashboard</li>
              </ul>
            </section>
            <section className="personal-workspace-card">
              <h4>
                <Archive size={15} />
                当前工作区
              </h4>
              <strong>{activeWorkspace?.title ?? "默认工作区"}</strong>
              <p>{activeWorkspace?.description ?? "本地沙盘工作区"}</p>
            </section>
            <section>
              <h4>
                <History size={15} />
                审计日志
              </h4>
              <div className="personal-audit-list">
                {activeAuditLogs.length > 0 ? (
                  activeAuditLogs.map((log) => (
                    <article key={log.id}>
                      <strong>{log.detail}</strong>
                      <time>{new Date(log.createdAt).toLocaleString("zh-CN")}</time>
                    </article>
                  ))
                ) : (
                  <p>暂无该用户的审计记录。</p>
                )}
              </div>
            </section>
          </div>
        </aside>
      </section>
    </main>
  );
}
