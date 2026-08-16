/**
 * dsh-superpowers-workflow
 *
 * Superpowers 风格的开发工作流插件(DeepSeek Harness / DSH + Cordis)。
 * 引导模型按 头脑风暴 → 计划 → TDD → 调试 的结构化流程工作,
 * 提供 8 个 sup_* 模型工具,状态保存在插件实例内,
 * 可随时导出完整 Markdown 总结(目标、想法、计划、TDD、调试、时间线)。
 *
 * 安装后在 agent preset 的 cordis.yml 中加入一行:
 *   - id: tool-superpowers-workflow
 *     name: dsh-superpowers-workflow
 */
import { defineTool } from '@deepseek-ai/dsh-tools'

export const name = 'dsh-superpowers-workflow'
export const inject = ['tools']

export function apply(ctx) {
  const PHASES = ['brainstorm', 'plan', 'tdd', 'debug']
  const LABELS = { brainstorm: '头脑风暴', plan: '制定计划', tdd: '测试驱动开发', debug: '调试' }
  const NEXT = { brainstorm: 'plan', plan: 'tdd', tdd: 'debug', debug: 'done' }
  const now = () => new Date().toISOString()

  let state = fresh()
  let seq = 0

  function fresh() {
    return {
      active: false,
      title: '',
      goal: '',
      phase: null,
      createdAt: null,
      updatedAt: null,
      history: [],
      ideas: [],
      planSteps: [],
      tddCycles: [],
      debugSessions: [],
    }
  }

  function uid(p) {
    return p + (++seq)
  }

  function record(summary) {
    state.history.push({ phase: state.phase, at: now(), summary })
    state.updatedAt = now()
  }

  function snapshot() {
    const accepted = state.ideas.filter((i) => i.status === 'accepted').length
    const rejected = state.ideas.filter((i) => i.status === 'rejected').length
    const planDone = state.planSteps.filter((s) => s.status === 'done').length
    return {
      active: state.active,
      title: state.title,
      goal: state.goal,
      phase: state.phase,
      phaseLabel: state.phase ? LABELS[state.phase] : null,
      createdAt: state.createdAt,
      updatedAt: state.updatedAt,
      ideas: state.ideas.slice(-12).map((i) => ({ id: i.id, text: i.text, status: i.status })),
      ideaCounts: {
        total: state.ideas.length,
        accepted,
        rejected,
        open: state.ideas.length - accepted - rejected,
      },
      planSteps: state.planSteps.slice(0, 20).map((s) => ({ id: s.id, title: s.title, status: s.status })),
      planCounts: { total: state.planSteps.length, done: planDone },
      tddCycle: state.tddCycles.length,
      tddLast: state.tddCycles.length ? state.tddCycles[state.tddCycles.length - 1] : null,
      debugSessions: state.debugSessions.slice(-10).map((d) => ({ id: d.id, symptom: d.symptom, status: d.status })),
      debugOpen: state.debugSessions.filter((d) => d.status === 'open').length,
      history: state.history.slice(-8),
    }
  }

  function start(title, goal, phase) {
    state = fresh()
    state.active = true
    state.title = title
    state.goal = goal
    state.phase = phase
    state.createdAt = now()
    record('工作流启动')
    return snapshot()
  }

  function requireActive() {
    return state.active ? null : '当前没有进行中的工作流,请先调用 sup_start 启动。'
  }

  function advance(to) {
    if (!state.active) return { ok: false, message: '当前没有进行中的工作流。' }
    if (state.phase === 'done' && !to) return { ok: false, message: '工作流已完成,用 sup_start 开启新会话。' }
    if (to) {
      if (!PHASES.includes(to)) return { ok: false, message: '未知阶段 ' + to + ',可选 ' + PHASES.join(' / ') }
      state.phase = to
      record('切换到阶段 ' + LABELS[to])
    } else {
      const next = NEXT[state.phase]
      if (next === 'done') {
        state.phase = 'done'
        record('工作流完成 🎉')
      } else {
        state.phase = next
        record('进入阶段 ' + LABELS[next])
      }
    }
    return { ok: true, snapshot: snapshot() }
  }

  function markdown() {
    const L = []
    L.push('# ' + state.title)
    L.push('')
    L.push('> 目标: ' + state.goal)
    L.push('> 当前阶段: ' + (state.phase ? LABELS[state.phase] : '未开始') + ' · 创建于 ' + state.createdAt)
    L.push('')
    L.push('## 头脑风暴')
    if (!state.ideas.length) L.push('(暂无)')
    else state.ideas.forEach((i) => L.push('- [' + (i.status === 'accepted' ? 'x' : ' ') + '] ' + i.text + ' — ' + i.status))
    L.push('')
    L.push('## 计划')
    if (!state.planSteps.length) L.push('(暂无)')
    else
      state.planSteps.forEach((s) =>
        L.push(
          '- [' + (s.status === 'done' ? 'x' : ' ') + '] **' + s.title + '**' +
          (s.detail ? ' — ' + s.detail : '') +
          (s.acceptance ? ' (验收: ' + s.acceptance + ')' : '') +
          ' (' + s.status + ')',
        ),
      )
    L.push('')
    L.push('## TDD 循环')
    if (!state.tddCycles.length) L.push('(暂无)')
    else state.tddCycles.forEach((c) => L.push('- 第 ' + c.cycle + ' 轮 [' + c.state + ']' + (c.note ? ' — ' + c.note : '') + ' (' + c.at + ')'))
    L.push('')
    L.push('## 调试会话')
    if (!state.debugSessions.length) L.push('(暂无)')
    else
      state.debugSessions.forEach((d) => {
        L.push('- ' + d.symptom + ' [' + d.status + ']')
        if (d.hypothesis) L.push('  - 假设: ' + d.hypothesis)
        if (d.rootCause) L.push('  - 根因: ' + d.rootCause)
        if (d.fix) L.push('  - 修复: ' + d.fix)
        if (d.verified) L.push('  - 已验证: ✓')
      })
    L.push('')
    L.push('## 时间线')
    state.history.forEach((h) => L.push('- (' + h.at + ') ' + h.summary))
    return L.join('\n')
  }

  function strTool(desc, parameters, run) {
    return defineTool({
      name: desc.name,
      description: desc.description,
      parameters,
      output: {
        schema: { type: 'string' },
        render: (_a, v) => [{ type: 'text', text: String(v) }],
      },
      async execute(args) {
        return String(await run(args))
      },
    })
  }

  ctx.tools.register(strTool({
    name: 'sup_start',
    description: '启动一个新的 Superpowers 开发工作流(头脑风暴 → 计划 → TDD → 调试),会重置当前会话状态。',
  }, {
    title: { type: 'string', required: true, description: '工作流标题,例如「实现用户登录模块」' },
    goal: { type: 'string', required: true, description: '本次开发的目标描述' },
    phase: { type: 'string', description: '起始阶段,默认 brainstorm', enum: ['brainstorm', 'plan', 'tdd', 'debug'] },
  }, async (args) => {
    const phase = args.phase || 'brainstorm'
    if (!PHASES.includes(phase)) return '未知阶段 ' + phase
    const s = start(String(args.title), String(args.goal), phase)
    return '✅ 工作流已启动「' + s.title + '」\n当前阶段: ' + s.phaseLabel + '\n目标: ' + s.goal + '\n\n下一步: 调用 sup_brainstorm 记录想法,或 sup_advance 跳到计划阶段。'
  }))

  ctx.tools.register(strTool({
    name: 'sup_status',
    description: '查看当前 Superpowers 开发工作流的状态快照(阶段、想法、计划步骤、TDD 循环、调试会话统计)。',
  }, {}, async () => {
    if (!state.active) return '当前没有进行中的工作流。调用 sup_start { title, goal } 开始一个新工作流。'
    const s = snapshot()
    const lines = [
      '📋 ' + s.title,
      '阶段: ' + s.phaseLabel,
      '目标: ' + s.goal,
      '想法: ' + s.ideaCounts.total + ' 条(采纳 ' + s.ideaCounts.accepted + ' / 拒绝 ' + s.ideaCounts.rejected + ' / 待定 ' + s.ideaCounts.open + ')',
      '计划: ' + s.planCounts.total + ' 步(完成 ' + s.planCounts.done + ')',
      'TDD: ' + s.tddCycle + ' 轮循环',
      '调试: ' + s.debugOpen + ' 个会话进行中',
    ]
    if (s.history.length) lines.push('最近记录: ' + s.history.slice(-3).map((h) => h.summary).join(' / '))
    return lines.join('\n')
  }))

  ctx.tools.register(strTool({
    name: 'sup_brainstorm',
    description: '记录/筛选头脑风暴想法,或结束头脑风暴进入计划阶段。',
  }, {
    action: { type: 'string', required: true, description: 'add=新增想法;decide=接受/拒绝某条想法;wrapup=结束头脑风暴进入计划', enum: ['add', 'decide', 'wrapup'] },
    idea: { type: 'string', description: 'action=add 时的单条想法文本' },
    ideas: { type: 'array', description: 'action=add 时的批量想法文本列表', items: { type: 'string' } },
    ideaId: { type: 'string', description: 'action=decide 时的想法 id' },
    decision: { type: 'string', description: 'action=decide 时的决定', enum: ['accept', 'reject'] },
  }, async (args) => {
    const err = requireActive()
    if (err) return err
    if (args.action === 'add') {
      const texts = []
      if (args.idea && String(args.idea).trim()) texts.push(String(args.idea).trim())
      if (Array.isArray(args.ideas)) args.ideas.forEach((t) => { if (typeof t === 'string' && t.trim()) texts.push(t.trim()) })
      if (!texts.length) return '请提供 idea(单条)或 ideas(批量)。'
      texts.forEach((t) => state.ideas.push({ id: uid('i'), text: t, status: 'open', at: now() }))
      state.updatedAt = now()
      const accepted = state.ideas.filter((i) => i.status === 'accepted').length
      return '✅ 已记录 ' + texts.length + ' 条想法,当前共 ' + state.ideas.length + ' 条(已采纳 ' + accepted + ')。\n用 sup_brainstorm { action: "decide", ideaId, decision: "accept"|"reject" } 筛选方向,或 action: "wrapup" 结束头脑风暴。'
    }
    if (args.action === 'decide') {
      const idea = state.ideas.find((i) => i.id === args.ideaId)
      if (!idea) return '未找到想法 ' + args.ideaId + '。调用 sup_status 查看想法 id。'
      idea.status = args.decision
      state.updatedAt = now()
      record('想法「' + idea.text.slice(0, 40) + '」已' + (args.decision === 'accept' ? '采纳' : '拒绝'))
      return '✅ 想法「' + idea.text + '」已标记为 ' + args.decision + '。'
    }
    if (args.action === 'wrapup') {
      const accepted = state.ideas.filter((i) => i.status === 'accepted').length
      state.phase = 'plan'
      record('头脑风暴完成(采纳 ' + accepted + ' 条想法),进入制定计划')
      return '🎉 头脑风暴结束,采纳 ' + accepted + ' 条想法。现在用 sup_plan { action: "add", step: { title, detail?, acceptance? } } 制定计划。'
    }
    return 'action 必须是 add / decide / wrapup。'
  }))

  ctx.tools.register(strTool({
    name: 'sup_plan',
    description: '制定/更新开发计划步骤,或计划定稿后进入 TDD 阶段。',
  }, {
    action: { type: 'string', required: true, description: 'add=添加计划步骤;update=更新步骤状态/内容;finalize=计划定稿进入 TDD', enum: ['add', 'update', 'finalize'] },
    step: {
      type: 'object',
      additionalProperties: true,
      description: 'action=add 时的步骤对象',
      properties: {
        title: { type: 'string', required: true, description: '步骤标题' },
        detail: { type: 'string', description: '步骤细节' },
        acceptance: { type: 'string', description: '验收标准' },
      },
    },
    stepId: { type: 'string', description: 'action=update 时的步骤 id' },
    status: { type: 'string', description: 'action=update 时的新状态', enum: ['todo', 'doing', 'done'] },
    detail: { type: 'string', description: 'action=update 时更新的细节' },
    acceptance: { type: 'string', description: 'action=update 时更新的验收标准' },
  }, async (args) => {
    const err = requireActive()
    if (err) return err
    if (args.action === 'add') {
      const step = args.step
      if (!step || !step.title) return 'add 需要 step: { title, detail?, acceptance? }'
      state.planSteps.push({ id: uid('p'), title: String(step.title), detail: step.detail ? String(step.detail) : '', acceptance: step.acceptance ? String(step.acceptance) : '', status: 'todo' })
      state.updatedAt = now()
      return '✅ 已添加计划步骤「' + step.title + '」,当前共 ' + state.planSteps.length + ' 步。'
    }
    if (args.action === 'update') {
      const step = state.planSteps.find((s) => s.id === args.stepId)
      if (!step) return '未找到步骤 ' + args.stepId + '。'
      if (args.status) {
        step.status = args.status
        if (args.status === 'done') record('计划步骤「' + step.title + '」完成')
      }
      if (args.detail !== undefined) step.detail = String(args.detail)
      if (args.acceptance !== undefined) step.acceptance = String(args.acceptance)
      state.updatedAt = now()
      return '✅ 步骤「' + step.title + '」已更新(status: ' + step.status + ')。'
    }
    if (args.action === 'finalize') {
      state.phase = 'tdd'
      record('计划定稿,进入测试驱动开发')
      return '🎉 计划已定稿。按 sup_tdd 的 red → green → refactor 循环逐条实现,先写失败测试(red)。'
    }
    return 'action 必须是 add / update / finalize。'
  }))

  ctx.tools.register(strTool({
    name: 'sup_tdd',
    description: '记录 TDD 红绿重构循环(red → green → refactor)或备注。',
  }, {
    action: { type: 'string', required: true, description: 'cycle=记录一轮红绿重构;note=记录一条备注', enum: ['cycle', 'note'] },
    state: { type: 'string', description: 'action=cycle 时的循环状态', enum: ['red', 'green', 'refactor'] },
    note: { type: 'string', description: '本轮/备注内容' },
  }, async (args) => {
    const err = requireActive()
    if (err) return err
    if (args.action === 'cycle') {
      const cycle = state.tddCycles.length + 1
      state.tddCycles.push({ cycle, state: args.state, note: args.note ? String(args.note) : '', at: now() })
      state.updatedAt = now()
      record('TDD 第 ' + cycle + ' 轮: ' + args.state)
      const guide = args.state === 'red' ? '下一步写最小实现让测试通过(green)。' : args.state === 'green' ? '下一步重构,保持测试全绿(refactor)。' : '下一步进入下一条需求或验收,或调用 sup_advance 进入调试阶段。'
      return '✅ 已记录 TDD 第 ' + cycle + ' 轮: ' + args.state + (args.note ? ' — ' + args.note : '') + '\n' + guide
    }
    if (args.action === 'note') {
      record('TDD 备注: ' + (args.note ? String(args.note) : ''))
      return '✅ 已记录备注。'
    }
    return 'action 必须是 cycle / note。'
  }))

  ctx.tools.register(strTool({
    name: 'sup_debug',
    description: '管理调试会话:打开(现象+假设)、更新(根因/修复)、关闭(验证)。',
  }, {
    action: { type: 'string', required: true, description: 'open=打开调试会话;update=更新会话进展;close=关闭会话', enum: ['open', 'update', 'close'] },
    symptom: { type: 'string', description: 'action=open 时的故障现象' },
    hypothesis: { type: 'string', description: 'open 时的初步假设 / update 时更新假设' },
    sessionId: { type: 'string', description: 'action=update/close 时的会话 id' },
    rootCause: { type: 'string', description: 'action=update 时定位到的根因' },
    fix: { type: 'string', description: 'action=update 时提出的修复方案' },
    verified: { type: 'boolean', description: 'action=close 时是否已验证修复,默认 true' },
  }, async (args) => {
    const err = requireActive()
    if (err) return err
    if (args.action === 'open') {
      if (!args.symptom) return 'open 需要 symptom(故障现象)。'
      state.debugSessions.push({ id: uid('d'), symptom: String(args.symptom), hypothesis: args.hypothesis ? String(args.hypothesis) : '', rootCause: '', fix: '', status: 'open', at: now() })
      state.updatedAt = now()
      record('打开调试会话: ' + String(args.symptom).slice(0, 40))
      return '✅ 已打开调试会话。复现 → 定位 → 修复 → 验证,随时用 sup_debug { action: "update", sessionId, ... } 记录进展。'
    }
    if (args.action === 'update') {
      const s = state.debugSessions.find((x) => x.id === args.sessionId)
      if (!s) return '未找到会话 ' + args.sessionId + '。'
      if (args.hypothesis !== undefined) s.hypothesis = String(args.hypothesis)
      if (args.rootCause !== undefined) { s.rootCause = String(args.rootCause); record('定位根因: ' + String(args.rootCause).slice(0, 60)) }
      if (args.fix !== undefined) { s.fix = String(args.fix); record('提出修复: ' + String(args.fix).slice(0, 60)) }
      state.updatedAt = now()
      return '✅ 调试会话已更新。'
    }
    if (args.action === 'close') {
      const s = state.debugSessions.find((x) => x.id === args.sessionId)
      if (!s) return '未找到会话 ' + args.sessionId + '。'
      s.status = 'closed'
      s.verified = args.verified !== false
      state.updatedAt = now()
      record('调试会话关闭: ' + s.symptom.slice(0, 40))
      return '✅ 调试会话已关闭(verified: ' + s.verified + ')。'
    }
    return 'action 必须是 open / update / close。'
  }))

  ctx.tools.register(strTool({
    name: 'sup_advance',
    description: '推进工作流阶段:省略 to 时按 brainstorm → plan → tdd → debug → done 顺序推进,也可跳到指定阶段。',
  }, {
    to: { type: 'string', description: '目标阶段;省略则按顺序推进', enum: ['brainstorm', 'plan', 'tdd', 'debug'] },
  }, async (args) => {
    const r = advance(args.to)
    if (!r.ok) return r.message
    const s = r.snapshot
    if (s.phase === 'done') return '🎉 工作流已完成!用 sup_export 导出总结,或 sup_start 开启新会话。'
    const hint = s.phase === 'plan' ? '用 sup_plan 制定计划。' : s.phase === 'tdd' ? '用 sup_tdd 开始红绿重构循环。' : s.phase === 'debug' ? '用 sup_debug 记录调试会话。' : '用 sup_brainstorm 记录想法。'
    return '✅ 当前阶段: ' + s.phaseLabel + '。' + hint
  }))

  ctx.tools.register(strTool({
    name: 'sup_export',
    description: '导出当前工作流的完整 Markdown 总结(目标、想法、计划、TDD、调试、时间线)。',
  }, {}, async () => {
    if (!state.active) return '当前没有进行中的工作流。'
    return markdown()
  }))
}
