export type ApprovalFieldType = 'text' | 'number' | 'date' | 'enum'
export type ApprovalNodeType = 'start' | 'approval' | 'condition' | 'cc' | 'end'
export type ApprovalMethod = 'single' | 'countersign' | 'orsign'
export type ApprovalOperator = '==' | '!=' | '>' | '>=' | '<' | '<='

export interface ApprovalFieldOption {
  value: string
  label: string
}

export interface ApprovalFormField {
  id: string
  label: string
  type: ApprovalFieldType
  required: boolean
  options?: ApprovalFieldOption[]
}

export interface ApprovalConditionRule {
  field: string
  operator: ApprovalOperator
  value: string | number
}

export interface ApprovalNode {
  id: string
  type: ApprovalNodeType
  name?: string
  approver?: { mode: 'member' | 'starterSelect'; members?: string[] }
  method?: ApprovalMethod
  receivers?: string[]
}

export interface ApprovalEdge {
  id: string
  source: string
  target: string
  conditions?: ApprovalConditionRule[]
  isDefault?: true
}

export interface ApprovalModel {
  schemaVersion: '1'
  process: { name: string; code: string }
  rejectBehavior: 'returnToInitiator'
  form: { fields: ApprovalFormField[] }
  flow: { nodes: ApprovalNode[]; edges: ApprovalEdge[] }
}

export const fieldTypeLabels: Record<ApprovalFieldType, string> = {
  text: '文本',
  number: '数字',
  date: '日期',
  enum: '单选项',
}

export const nodeTypeLabels: Record<ApprovalNodeType, string> = {
  start: '发起',
  approval: '审批',
  condition: '条件分支',
  cc: '抄送',
  end: '结束',
}

export const methodLabels: Record<ApprovalMethod, string> = {
  single: '单人审批',
  countersign: '会签',
  orsign: '或签',
}

export const operatorLabels: Record<ApprovalOperator, string> = {
  '==': '等于',
  '!=': '不等于',
  '>': '大于',
  '>=': '大于或等于',
  '<': '小于',
  '<=': '小于或等于',
}

export function createInitialApprovalModel(): ApprovalModel {
  return {
    schemaVersion: '1',
    process: { name: '请假审批', code: 'leave_approval' },
    rejectBehavior: 'returnToInitiator',
    form: {
      fields: [
        {
          id: 'leaveType',
          label: '请假类型',
          type: 'enum',
          required: true,
          options: [
            { value: 'personal', label: '事假' },
            { value: 'annual', label: '年假' },
            { value: 'sick', label: '病假' },
          ],
        },
        { id: 'startDate', label: '开始日期', type: 'date', required: true },
        { id: 'endDate', label: '结束日期', type: 'date', required: true },
        { id: 'leaveDays', label: '请假天数', type: 'number', required: true },
        { id: 'reason', label: '事由', type: 'text', required: false },
      ],
    },
    flow: {
      nodes: [
        { id: 'start_1', type: 'start' },
        {
          id: 'approve_1',
          type: 'approval',
          name: '主管审批',
          approver: { mode: 'member', members: ['张伟'] },
          method: 'single',
        },
        { id: 'branch_1', type: 'condition', name: '天数判断' },
        {
          id: 'approve_2',
          type: 'approval',
          name: 'HR 审批',
          approver: { mode: 'member', members: ['李娜', '王芳'] },
          method: 'countersign',
        },
        { id: 'cc_1', type: 'cc', name: '抄送行政', receivers: ['赵敏'] },
        { id: 'end_1', type: 'end' },
      ],
      edges: [
        { id: 'e1', source: 'start_1', target: 'approve_1' },
        { id: 'e2', source: 'approve_1', target: 'branch_1' },
        {
          id: 'e3',
          source: 'branch_1',
          target: 'approve_2',
          conditions: [{ field: 'leaveDays', operator: '>', value: 3 }],
        },
        { id: 'e4', source: 'branch_1', target: 'cc_1', isDefault: true },
        { id: 'e5', source: 'approve_2', target: 'cc_1' },
        { id: 'e6', source: 'cc_1', target: 'end_1' },
      ],
    },
  }
}

export function createModelId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`
}

export function validateApprovalModel(model: ApprovalModel): string[] {
  const issues: string[] = []
  if (!model.process.name.trim()) issues.push('请填写流程名称。')
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(model.process.code))
    issues.push('流程业务标识必须以英文字母或下划线开头，只能包含英文字母、数字和下划线。')
  if (model.flow.nodes.filter((node) => node.type === 'start').length !== 1)
    issues.push('流程需要且只能有一个发起步骤。')
  if (model.flow.nodes.filter((node) => node.type === 'end').length !== 1)
    issues.push('流程需要且只能有一个结束步骤。')
  const fieldIds = new Set<string>()
  for (const field of model.form.fields) {
    if (!field.id.trim()) issues.push(`表单字段“${field.label || '未命名'}”缺少系统标识。`)
    else if (fieldIds.has(field.id)) issues.push(`表单字段标识重复：${field.id}`)
    fieldIds.add(field.id)
    if (!field.label.trim()) issues.push('每个表单字段都需要填写显示名称。')
    if (field.id && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(field.id))
      issues.push(
        '“' + field.label + '”的系统标识只能包含英文字母、数字和下划线，且不能以数字开头。',
      )
    if (field.type === 'enum') {
      if (!field.options?.length) issues.push(`“${field.label}”至少需要一个选项。`)
      const optionValues = new Set<string>()
      for (const option of field.options || []) {
        if (!option.value.trim() || !option.label.trim())
          issues.push(`“${field.label}”的选项需要同时填写值和名称。`)
        if (option.value && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(option.value))
          issues.push(
            `“${field.label}”的选项保存值只能包含英文字母、数字和下划线，且不能以数字开头。`,
          )
        if (optionValues.has(option.value))
          issues.push(`“${field.label}”的选项值重复：${option.value}`)
        optionValues.add(option.value)
      }
    }
  }

  const nodeIds = new Set<string>()
  const nodes = new Map<string, ApprovalNode>()
  for (const node of model.flow.nodes) {
    if (!node.id.trim()) issues.push('流程中存在缺少系统标识的步骤。')
    else if (nodeIds.has(node.id)) issues.push(`步骤标识重复：${node.id}`)
    nodeIds.add(node.id)
    nodes.set(node.id, node)
    if (['approval', 'condition', 'cc'].includes(node.type) && !node.name?.trim())
      issues.push(`“${nodeTypeLabels[node.type]}”步骤需要填写名称。`)
    if (node.type === 'approval') {
      const mode = node.approver?.mode
      const members = node.approver?.members?.map((member) => member.trim()).filter(Boolean) || []
      if (!mode) issues.push('“' + node.name + '”需要选择审批人来源。')
      if (!node.method) issues.push('“' + node.name + '”需要选择审批方式。')
      if (mode === 'member' && !members.length) issues.push(`“${node.name}”至少需要一位审批人。`)
      if (mode === 'member' && members.length >= 2 && node.method === 'single')
        issues.push(`“${node.name}”有多位审批人，请选择会签或或签。`)
      if (mode === 'starterSelect' && node.method !== 'single')
        issues.push(`“${node.name}”由发起人自选时，当前版本仅支持单人审批。`)
    }
    if (node.type === 'cc' && !node.receivers?.some((receiver) => receiver.trim()))
      issues.push(`“${node.name}”至少需要一位抄送对象。`)
  }

  const edgeIds = new Set<string>()
  const outgoing = new Map<string, ApprovalEdge[]>()
  const incoming = new Map<string, ApprovalEdge[]>()
  for (const edge of model.flow.edges) {
    if (!edge.id.trim()) issues.push('流程中存在缺少系统标识的连接。')
    else if (nodeIds.has(edge.id) || edgeIds.has(edge.id))
      issues.push(`步骤或连接标识重复：${edge.id}`)
    edgeIds.add(edge.id)
    if (!nodes.has(edge.source) || !nodes.has(edge.target)) {
      issues.push('有连接指向不存在的步骤。')
      continue
    }
    outgoing.set(edge.source, [...(outgoing.get(edge.source) || []), edge])
    incoming.set(edge.target, [...(incoming.get(edge.target) || []), edge])
    const sourceNode = nodes.get(edge.source)!
    if (edge.isDefault && sourceNode.type !== 'condition')
      issues.push('默认分支只能从条件分支步骤发出。')
    if (edge.conditions?.length && sourceNode.type !== 'condition')
      issues.push('条件只能配置在条件分支步骤的路径上。')
    if (edge.isDefault && edge.conditions?.length) issues.push('默认分支不能同时设置条件。')
    if (!edge.isDefault && nodes.get(edge.source)?.type === 'condition' && !edge.conditions?.length)
      issues.push('条件分支的每条非默认路径都需要设置条件。')
    for (const rule of edge.conditions || []) {
      const field = model.form.fields.find((candidate) => candidate.id === rule.field)
      if (!field) issues.push(`分支条件引用了不存在的表单字段：${rule.field}`)
      else if (field.type === 'date')
        issues.push('日期字段“' + field.label + '”目前不能用于条件分支。')
      else if (field.type !== 'number' && ['>', '>=', '<', '<='].includes(rule.operator))
        issues.push(`“${field.label}”目前只能使用等于或不等于条件。`)
      if (field?.type === 'number' && typeof rule.value !== 'number')
        issues.push(`数字字段“${field.label}”的条件值必须是数字。`)
      if (
        field?.type === 'number' &&
        typeof rule.value === 'number' &&
        !Number.isInteger(rule.value)
      )
        issues.push(`数字字段“${field.label}”目前只支持整数。`)
      if (field && field.type !== 'number' && typeof rule.value !== 'string')
        issues.push(`“${field.label}”的条件值必须是文本。`)
      if (
        rule.value === '' ||
        (typeof rule.value === 'string' && !rule.value.trim()) ||
        rule.value === undefined ||
        rule.value === null
      )
        issues.push('条件分支中的比较值不能为空。')
      if (
        field?.type === 'enum' &&
        !field.options?.some((option) => option.value === String(rule.value))
      )
        issues.push(`条件值不属于“${field.label}”的可选范围。`)
    }
  }
  for (const node of model.flow.nodes.filter((candidate) => candidate.type === 'condition')) {
    const edges = outgoing.get(node.id) || []
    const defaults = edges.filter((edge) => edge.isDefault)
    if (edges.length < 2) issues.push(`“${node.name}”至少需要两条分支路径。`)
    if (defaults.length !== 1) issues.push(`“${node.name}”需要且只能有一个默认分支。`)
  }
  for (const node of model.flow.nodes) {
    if (node.type === 'start' && incoming.has(node.id)) issues.push('发起步骤不能有流入路径。')
    if (node.type === 'end' && outgoing.has(node.id)) issues.push('结束步骤不能有流出路径。')
  }
  const start = model.flow.nodes.find((node) => node.type === 'start')
  if (start) {
    const reachable = new Set<string>()
    const pending = [start.id]
    while (pending.length) {
      const current = pending.pop()!
      if (reachable.has(current)) continue
      reachable.add(current)
      for (const edge of outgoing.get(current) || []) pending.push(edge.target)
    }
    for (const node of model.flow.nodes) {
      if (!reachable.has(node.id))
        issues.push('“' + (node.name || nodeTypeLabels[node.type]) + '”从发起步骤无法到达。')
    }
    const canReachEnd = new Set(
      model.flow.nodes.filter((node) => node.type === 'end').map((node) => node.id),
    )
    let expanded = true
    while (expanded) {
      expanded = false
      for (const edge of model.flow.edges) {
        if (canReachEnd.has(edge.target) && !canReachEnd.has(edge.source)) {
          canReachEnd.add(edge.source)
          expanded = true
        }
      }
    }
    for (const node of model.flow.nodes) {
      if (!canReachEnd.has(node.id))
        issues.push(
          '“' + (node.name || nodeTypeLabels[node.type]) + '”之后没有通往结束步骤的路径。',
        )
    }
  }
  return [...new Set(issues)]
}
