# Backend-Ready Contract Track

日期：2026-08-04  
适用对象：前端工程、后端工程、LLM Proxy、QA

## 目标

本阶段不是接入真实后端，而是把当前本地 Demo 的数据边界整理成可迁移、可测试、可交接的 API 契约。

保留现状：

- 默认仍使用 localStorage，可离线运行。
- Mock API Adapter 只在前端生成 DTO 样例，不发起真实网络请求。
- 沙盘编辑、Stage v2、AI 伙伴、JSON/PNG 导出和 Snapshot/Insight 边界不变。
- LLM API Key 仍不得明文进入导出报告。

## 核心产物

| 产物 | 文件 | 用途 |
|---|---|---|
| DTO 与错误码 | `src/api/contracts.ts` | 真实后端必须实现的请求/响应结构、错误码和分页协议。 |
| 服务边界清单 | `API_SERVICE_BOUNDARIES` | 把端点归属到 Auth、User、Sandtray、Memory、Asset、Agent、LLM Proxy、Task 等服务。 |
| Mock Adapter | `src/api/mockApiAdapter.ts` | 生成分页样例、遮罩 LLM Key、当前沙盘 Snapshot response。 |
| API Client | `src/api/client.ts` | 统一 HTTP header、认证上下文、超时和错误归一化。 |
| Repository Report | `src/platform/*RepositoryAdapter.ts` | 展示 localStorage、mockApi、remoteApi 三种模式的迁移状态。 |

## 服务边界

| 边界 | 后端归属 | 优先级 | 说明 |
|---|---|---|---|
| `auth` | Auth Service | P0 | 注册、登录、会话上下文。生产环境必须接后端。 |
| `users` | User Service | P0 | 万级用户目录、画像编辑、状态治理。 |
| `workspaces` | Workspace Service | P0 | 工作区归属、作品归属、未来机构扩展。 |
| `access` | Access Control Service | P0 | 后台角色、工作区范围、拒绝权限和审计。 |
| `sandtraySessions` | Sandtray Service | P0 | 当前草稿、历史作品、环境、事件流、快照。 |
| `memoryCandidates` | Memory Service | P1 | 记忆候选、屏蔽规则、未来 Context Packet。 |
| `assets` | Asset Service | P1 | 300+ 沙具资产搜索、健康检查、批量维护。 |
| `agents` | Agent Configuration Service | P1 | 心理学取向 Agent 角色、提示词和 LLM 绑定。 |
| `llmProxy` | LLM Proxy Service | P1 | 密钥托管、连接测试、真实流式模型调用。 |
| `tasks` | Task Service | P2 | 导入、导出、批量资产、记忆重建、连接测试等长任务。 |

## 端点覆盖规则

每个 endpoint 必须满足：

- 有 method + path。
- 有 request DTO 和 response DTO 名称。
- 有认证要求。
- 有错误码引用。
- 有迁移优先级。
- 被至少一个 `API_SERVICE_BOUNDARIES` 条目归属。

每个 service boundary 必须满足：

- 有后端 owner。
- 有当前实现说明和未来后端目标。
- 声明数据分级，例如 `personal`、`sensitive`、`secret`、`derived`。
- 声明读写端点。
- 如涉及长任务，声明 `asyncTasks`。

## LLM 与个人数据边界

当前 LLM 输入仍只允许：

- `CurrentSandboxSnapshot`
- `CurrentSandboxInsight`
- 用户当前输入

默认禁止进入 LLM：

- 事件流
- 个人记忆
- 用户身份
- 授权上下文
- 截图
- API Key

后续如果加入个人记忆，必须通过独立的 Context Packet 授权链路，不得直接扩展当前 Snapshot 的最小边界。

## 后端迁移顺序

1. 实现 Auth、Users、Workspaces、Access、Sandtray Sessions 五个 P0 服务。
2. 把大规模列表切到服务端分页和筛选。
3. 把 LLM API Key 移出浏览器，改为服务端加密存储或 KMS。
4. 通过 LLM Proxy 接管真实流式调用。
5. 增加 Task Service，承接导入导出、批量资产和记忆重建。
6. Context Packet 独立上线，并加入授权预览、撤销和审计。

## 质量门

本阶段至少运行：

```bash
npm run build
npm run qa:api-contract
npm run qa:api-client
npm run qa:mock-api
npm run qa:repository
```

通过标准：

- API contract report 包含 endpoint、error catalog、pagination、service boundaries 和样例数据。
- 所有 endpoint 都被服务边界覆盖。
- LLM provider 只输出 `apiKeyConfigured` 与 `apiKeyPreview`。
- repository report 覆盖 localStorage、mockApi、remoteApi 三种模式。
- repository domain 包含后台任务队列，避免长任务成为无归属功能。
