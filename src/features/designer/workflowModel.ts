import type { Edge, Node } from '@xyflow/react'
import type { WorkflowModel, WorkflowNodeType } from '@/api/workflowModel'

export type WorkflowNodeData = {
  kind: WorkflowNodeType
  name: string
  form?: string
  assignee?: string
  sequential?: boolean
  reminderEnabled?: boolean
  reminderDuration?: string
  reminderName?: string
  serviceName?: string
  serviceUrl?: string
  approveMode?: string
  passRate?: string
}

export type WorkflowEdgeData = { branch?: 'pass' | 'reject'; conditionExpression?: string }
export type WorkflowCanvasNode = Node<WorkflowNodeData, 'workflowNode'>
export type WorkflowCanvasEdge = Edge<WorkflowEdgeData>

export function supportsResultBranch(type: WorkflowNodeType): boolean {
  return type === 'approval' || type === 'countersign' || type === 'service' || type === 'condition'
}

export interface WorkflowValidationIssue {
  message: string
  nodeId?: string
  edgeId?: string
  locationLabel?: string
}

const nodeLabels: Record<WorkflowNodeType, string> = {
  start: '开始',
  approval: '审批',
  countersign: '会签',
  service: '服务调用',
  condition: '条件分支',
  end: '结束',
}

export function toWorkflowModel(
  processId: string,
  processName: string,
  nodes: WorkflowCanvasNode[],
  edges: WorkflowCanvasEdge[],
): WorkflowModel {
  return {
    processId: processId.trim(),
    processName: processName.trim(),
    nodes: nodes.map(({ id, position, data }) => ({
      id,
      type: data.kind,
      name: data.name.trim(),
      x: Math.round(position.x),
      y: Math.round(position.y),
      ...(data.form?.trim() ? { form: data.form.trim() } : {}),
      ...(data.kind === 'approval' && data.assignee?.trim()
        ? { assignee: data.assignee.trim() }
        : {}),
      ...(data.kind === 'countersign' ? { sequential: data.sequential ?? false } : {}),
      ...((data.kind === 'approval' || data.kind === 'countersign') && data.reminderEnabled
        ? {
            reminder: {
              ...(data.reminderDuration?.trim() ? { duration: data.reminderDuration.trim() } : {}),
              ...(data.reminderName?.trim() ? { name: data.reminderName.trim() } : {}),
            },
          }
        : {}),
      ...(data.kind === 'service' && data.serviceName?.trim()
        ? { serviceName: data.serviceName.trim() }
        : {}),
      ...(data.kind === 'service' && data.serviceUrl?.trim()
        ? { serviceUrl: data.serviceUrl.trim() }
        : {}),
      ...(data.kind === 'countersign' && data.approveMode?.trim()
        ? { approveMode: data.approveMode.trim() }
        : {}),
      ...(data.kind === 'countersign' && data.passRate?.trim()
        ? { passRate: data.passRate.trim() }
        : {}),
    })),
    flows: edges.map(({ source, target, data }) => ({
      source,
      target,
      ...(data?.branch ? { branch: data.branch } : {}),
      ...(data?.conditionExpression?.trim()
        ? { conditionExpression: data.conditionExpression.trim() }
        : {}),
    })),
  }
}

function hasPath(from: string, to: string, outgoing: Map<string, string[]>): boolean {
  const visited = new Set<string>()
  const pending = [from]
  while (pending.length) {
    const current = pending.pop()!
    if (current === to) return true
    if (visited.has(current)) continue
    visited.add(current)
    pending.push(...(outgoing.get(current) || []))
  }
  return false
}

export function wouldCreateOrdinaryCycle(
  edges: WorkflowCanvasEdge[],
  source: string,
  target: string,
  excludeEdgeId?: string,
): boolean {
  const outgoing = new Map<string, string[]>()
  for (const edge of edges) {
    if (edge.id === excludeEdgeId || edge.data?.branch === 'reject') continue
    outgoing.set(edge.source, [...(outgoing.get(edge.source) || []), edge.target])
  }
  return hasPath(target, source, outgoing)
}

function edgeLocation(
  edgeId: string,
  edges: WorkflowCanvasEdge[],
  nodeNames: Map<string, string>,
): string | undefined {
  const edge = edges.find((candidate) => candidate.id === edgeId)
  if (!edge) return undefined
  return (
    (nodeNames.get(edge.source) || edge.source) +
    ' → ' +
    (nodeNames.get(edge.target) || edge.target)
  )
}

export function validateWorkflowModel(model: WorkflowModel): WorkflowValidationIssue[] {
  const issues: WorkflowValidationIssue[] = []
  const nodes = model.nodes
  const edges: WorkflowCanvasEdge[] = model.flows.map((flow, index) => ({
    id: 'flow_' + index,
    source: flow.source,
    target: flow.target,
    data: {
      ...(flow.branch ? { branch: flow.branch } : {}),
      ...(flow.conditionExpression ? { conditionExpression: flow.conditionExpression } : {}),
    },
  }))
  const byId = new Map<string, WorkflowModel['nodes'][number]>()
  const ids = new Set<string>()
  const nodeNames = new Map<string, string>()
  const outgoing = new Map<string, WorkflowModel['flows']>()
  const incoming = new Map<string, WorkflowModel['flows']>()

  if (!model.processName.trim()) issues.push({ message: '请填写流程名称。' })
  if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(model.processId)) {
    issues.push({ message: '流程标识必须以英文字母开头，只能包含英文字母、数字、下划线和连字符。' })
  }

  if (nodes.filter((node) => node.type === 'start').length !== 1) {
    issues.push({
      message: '流程需要且只能有一个开始节点。',
      nodeId: nodes.find((node) => node.type === 'start')?.id,
    })
  }
  if (nodes.filter((node) => node.type === 'end').length !== 1) {
    issues.push({
      message: '流程需要且只能有一个结束节点。',
      nodeId: nodes.find((node) => node.type === 'end')?.id,
    })
  }

  for (const node of nodes) {
    if (!node.id.trim()) issues.push({ message: '流程中存在缺少标识的节点。' })
    else if (ids.has(node.id)) issues.push({ message: '节点标识重复：' + node.id, nodeId: node.id })
    ids.add(node.id)
    byId.set(node.id, node)
    nodeNames.set(node.id, node.name.trim() || nodeLabels[node.type])
    if (!node.name.trim()) {
      issues.push({ message: '请填写“' + nodeLabels[node.type] + '”节点名称。', nodeId: node.id })
    }
    if (node.type === 'service' && node.serviceUrl?.trim()) {
      try {
        const url = new URL(node.serviceUrl.trim())
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error('scheme')
      } catch {
        issues.push({ message: '“' + node.name + '”的服务地址格式无效。', nodeId: node.id })
      }
    }
    if (node.type === 'countersign') {
      if (node.approveMode?.trim() === 'VOTE' && !node.passRate?.trim()) {
        issues.push({
          message: '模板固定为 VOTE 时需要填写通过比例；留空模式可在发起时传入比例。',
          nodeId: node.id,
        })
      }
      if (node.passRate?.trim()) {
        const rate = Number(node.passRate)
        if (!Number.isFinite(rate) || rate <= 0 || rate > 1) {
          issues.push({ message: '通过比例必须大于 0 且不超过 1。', nodeId: node.id })
        }
      }
    }
  }

  const pairs = new Set<string>()
  for (let index = 0; index < model.flows.length; index += 1) {
    const flow = model.flows[index]
    const edgeId = edges[index].id
    const source = byId.get(flow.source)
    const target = byId.get(flow.target)
    if (!source || !target) {
      issues.push({ message: '连线引用了不存在的节点。', edgeId })
      continue
    }
    if (flow.source === flow.target) issues.push({ message: '节点不能连接到自身。', edgeId })
    const pair = flow.source + '→' + flow.target
    if (pairs.has(pair)) issues.push({ message: '同一对节点之间存在重复连线。', edgeId })
    pairs.add(pair)
    outgoing.set(flow.source, [...(outgoing.get(flow.source) || []), flow])
    incoming.set(flow.target, [...(incoming.get(flow.target) || []), flow])
    if (source.type === 'end') issues.push({ message: '结束节点不能有后续步骤。', edgeId })
    if (target.type === 'start') issues.push({ message: '开始节点不能有上游步骤。', edgeId })
    if (source.type === 'condition' && target.type === 'condition') {
      issues.push({ message: '条件分支不能直接连接到另一个条件分支。', edgeId })
    }
    if (flow.branch && !supportsResultBranch(source.type)) {
      issues.push({ message: '开始节点和结束节点不能配置通过或驳回路径。', edgeId })
    }
    if (source.type === 'condition' && !flow.branch && !flow.conditionExpression?.trim()) {
      issues.push({ message: '条件分支的路径需要标记为通过或驳回。', edgeId })
    }
  }

  for (const node of nodes) {
    const next = outgoing.get(node.id) || []
    const previous = incoming.get(node.id) || []
    if (node.type !== 'end' && next.length === 0) {
      issues.push({ message: '“' + nodeNames.get(node.id) + '”没有后续步骤。', nodeId: node.id })
    }
    if (node.type !== 'start' && previous.length === 0) {
      issues.push({ message: '“' + nodeNames.get(node.id) + '”没有上游步骤。', nodeId: node.id })
    }
    if (node.type === 'condition') {
      const pass = next.filter((flow) => flow.branch === 'pass')
      const reject = next.filter((flow) => flow.branch === 'reject')
      const usesExplicitExpression = next.some((flow) => Boolean(flow.conditionExpression?.trim()))
      if (
        !usesExplicitExpression &&
        (next.length !== 2 || pass.length !== 1 || reject.length !== 1)
      ) {
        issues.push({
          message:
            '“' +
            nodeNames.get(node.id) +
            '”需要且只能有一条通过路径和一条驳回路径，或为各出边填写显式条件表达式。',
          nodeId: node.id,
        })
      }
      if (next.some((flow) => flow.branch && !flow.conditionExpression?.trim())) {
        const upstream = incoming.get(node.id) || []
        const resultSources = upstream
          .map((flow) => byId.get(flow.source))
          .filter((source): source is WorkflowModel['nodes'][number] =>
            Boolean(source && supportsResultBranch(source.type) && source.type !== 'condition'),
          )
        if (upstream.length !== 1 || resultSources.length !== 1) {
          issues.push({
            message:
              '“' +
              nodeNames.get(node.id) +
              '”的通过/驳回路径需要且只能有一个审批、会签或服务节点作为直接上游。',
            nodeId: node.id,
          })
        }
      }
    }
  }

  const ordinaryOutgoing = new Map<string, string[]>()
  for (const flow of model.flows.filter((item) => item.branch !== 'reject')) {
    ordinaryOutgoing.set(flow.source, [...(ordinaryOutgoing.get(flow.source) || []), flow.target])
  }
  const ordinaryCycle = model.flows.find(
    (flow) => flow.branch !== 'reject' && hasPath(flow.target, flow.source, ordinaryOutgoing),
  )
  if (ordinaryCycle) {
    const edgeId = 'flow_' + model.flows.indexOf(ordinaryCycle)
    issues.push({
      message: '普通流转路径不能形成循环；需要回流时请将对应审批、会签、服务或条件路径标记为驳回。',
      edgeId,
    })
  }

  const start = nodes.find((node) => node.type === 'start')
  const ends = nodes.filter((node) => node.type === 'end')
  if (start) {
    const allOutgoing = new Map<string, string[]>()
    for (const flow of model.flows) {
      allOutgoing.set(flow.source, [...(allOutgoing.get(flow.source) || []), flow.target])
    }
    const reachable = new Set<string>()
    const pending = [start.id]
    while (pending.length) {
      const current = pending.pop()!
      if (reachable.has(current)) continue
      reachable.add(current)
      pending.push(...(allOutgoing.get(current) || []))
    }
    for (const node of nodes) {
      if (!reachable.has(node.id)) {
        issues.push({
          message: '“' + nodeNames.get(node.id) + '”从开始节点无法到达。',
          nodeId: node.id,
        })
      }
    }
    const canReachEnd = new Set(ends.map((node) => node.id))
    let changed = true
    while (changed) {
      changed = false
      for (const flow of model.flows) {
        if (canReachEnd.has(flow.target) && !canReachEnd.has(flow.source)) {
          canReachEnd.add(flow.source)
          changed = true
        }
      }
    }
    for (const node of nodes) {
      if (!canReachEnd.has(node.id)) {
        issues.push({
          message: '“' + nodeNames.get(node.id) + '”之后没有通往结束节点的路径。',
          nodeId: node.id,
        })
      }
    }
  }

  return issues.map((issue) => ({
    ...issue,
    ...(issue.edgeId
      ? { locationLabel: edgeLocation(issue.edgeId, edges, nodeNames) }
      : issue.nodeId
        ? { locationLabel: nodeNames.get(issue.nodeId) }
        : {}),
  }))
}
