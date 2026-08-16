# dsh-superpowers-workflow ⚡

Superpowers 风格的 **DeepSeek Harness (DSH) 开发工作流插件**。

引导 Agent 按 **头脑风暴 → 计划 → TDD → 调试** 的结构化流程工作,每一步都记录在案,最终可一键导出完整 Markdown 总结。灵感来自 [obra/superpowers](https://github.com/obra/superpowers) 的技能集,以 Cordis 插件 + 模型工具的形式落地到 DSH。

> 当前版本为 **Host 工具版**:8 个 `sup_*` 模型工具 + 会话内状态机 + Markdown 导出,纯工具即可完成完整工作流,不依赖浏览器 UI。
> 带可视化仪表盘的浏览器版(`dsh.client` web 插件)见下方 Roadmap。

---

## 功能

启动一个工作流后,模型会在你的引导下按阶段推进,所有记录保存在插件实例内(会话期间有效):

| 阶段 | 工具 | 作用 |
|---|---|---|
| 启动 | `sup_start` | 创建新工作流(标题、目标、起始阶段) |
| 任意 | `sup_status` | 查看当前阶段与各项统计快照 |
| 💡 头脑风暴 | `sup_brainstorm` | 新增想法 / 采纳·拒绝(`accept`/`reject`)/ wrapup 进入计划 |
| 📐 计划 | `sup_plan` | 添加步骤(标题+细节+验收标准)/ 更新状态 / 定稿进入 TDD |
| 🔴🟢🔧 TDD | `sup_tdd` | 记录 red → green → refactor 循环,带下一步引导 |
| 🐞 调试 | `sup_debug` | 打开会话(现象+假设)/ 更新(根因+修复)/ 关闭(验证) |
| ⏭ 推进 | `sup_advance` | 按顺序推进到下一阶段,或跳转到指定阶段 |
| 📄 导出 | `sup_export` | 导出完整 Markdown 总结(目标、想法、计划、TDD、调试、时间线) |

## 安装

### 1. 安装包

```bash
npm install github:<你的用户名>/superpowers-workflow
```

(或发布到 npm 后:`npm install dsh-superpowers-workflow`)

### 2. 在 agent preset 中启用

编辑你的 agent preset 的 `agent.cordis.yml`,加入一行:

```yaml
- id: tool-superpowers-workflow
  name: dsh-superpowers-workflow
```

完整示例见 [`example/agent.cordis.yml`](example/agent.cordis.yml)。

### 3. 重启会话

重启 DSH 会话后,模型即可调用 `sup_*` 工具。

## 使用

直接对 Agent 说:

> 用 Superpowers 流程帮我实现一个 XX 功能

Agent 会自动调用 `sup_start` 启动工作流,并按阶段引导:

1. **头脑风暴**:`sup_brainstorm { action: "add", ideas: [...] }` 记录想法,`decide` 筛选,`wrapup` 结束
2. **制定计划**:`sup_plan { action: "add", step: { title, detail, acceptance } }` 逐条添加,`finalize` 定稿
3. **TDD**:按 `sup_tdd { action: "cycle", state: "red"|"green"|"refactor" }` 记录红绿重构循环
4. **调试**:`sup_debug` 打开/更新/关闭调试会话

随时可以:

- `sup_status` — 查看进度
- `sup_advance` — 手动推进阶段
- `sup_export` — 导出总结,让 Agent 保存为文件或分享

### 导出示例

```markdown
# 实现用户登录模块

> 目标: 支持邮箱+密码注册登录,带 JWT 会话
> 当前阶段: 测试驱动开发 · 创建于 2026-08-16T…

## 头脑风暴
- [x] 邮箱+密码登录, bcrypt 加密 — accepted
- [x] JWT 会话, 7 天有效期 — accepted
- [ ] 短信验证码登录 — rejected

## 计划
- [x] **数据库用户表与迁移** — 验收: 能建表并 CRUD (done)
- [x] **注册/登录 API** — 验收: 集成测试通过 (done)

## TDD 循环
- 第 1 轮 [red] — 先写注册接口失败测试 (…)
- 第 2 轮 [green] — 最小实现通过 (…)

## 调试会话
- 登录返回 500 [closed]
  - 根因: bcrypt 版本不兼容
  - 修复: 锁定 bcryptjs 版本
  - 已验证: ✓

## 时间线
- (…) 工作流启动
- (…) 头脑风暴完成(采纳 2 条想法),进入制定计划
```

## 发布到 DSH 插件市场

DSH 社区存在多个 GitHub 插件市场(如 [dsh-market](https://github.com/dsh-market/dsh-market)、[AwesomeHou/dsh-plugin-marketplace](https://github.com/AwesomeHou/dsh-plugin-marketplace)、[whalehub-dsh](https://github.com/vvlife/whalehub-dsh)),其中不少会**实时同步 GitHub 上带 `dsh-plugin` 话题(topic)的仓库**。因此:

1. 把本仓库推送到 GitHub
2. 在仓库 **Settings → Topics** 添加话题:`dsh-plugin`
3. 社区市场会自动收录(取决于各市场同步策略),或向市场仓库提交收录请求

## Roadmap

- [x] Host 工具版(8 个 `sup_*` 工具 + 状态机 + Markdown 导出)
- [ ] 浏览器仪表盘:`dsh.client` web 插件(阶段进度条 + 输入区状态条,动态版已实现,待按官方 web 构建管线打包)
- [ ] 状态持久化(跨会话保存工作流)
- [ ] 与 `todo_write` / goal 工具的联动

## 许可证

MIT
