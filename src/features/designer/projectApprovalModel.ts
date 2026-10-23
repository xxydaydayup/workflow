import type { Edge, Node } from '@xyflow/react'
export type {
  ProjectApprovalBranch,
  ProjectApprovalFlow,
  ProjectApprovalModel,
  ProjectApprovalNode,
  ProjectApprovalNodeType,
} from '@/api/projectApprovalModel'
import type { ProjectApprovalModel } from '@/api/projectApprovalModel'

export type ProjectNodeKind = 'start' | 'approval' | 'condition' | 'countersign' | 'end'
export type ProjectBranch = 'continue' | 'pass' | 'reject'
export type ProjectNodeData = {
  kind: ProjectNodeKind
  name: string
}

export type ProjectEdgeData = { branch: ProjectBranch }
export type ProjectFlowNode = Node<ProjectNodeData, 'business'>
export type ProjectFlowEdge = Edge<ProjectEdgeData>

export function inferApplicationNodeId(
  nodes: ProjectFlowNode[],
  edges: ProjectFlowEdge[],
): string | undefined {
  const rejectionEdges = edges.filter(
    (edge) =>
      edge.data?.branch === 'reject' &&
      nodes.some((node) => node.id === edge.source && node.data.kind === 'condition'),
  )
  if (rejectionEdges.length > 0) {
    const returnTargets = new Set(rejectionEdges.map((edge) => edge.target))
    if (returnTargets.size !== 1) return undefined
    const target = nodes.find((node) => node.id === rejectionEdges[0]?.target)
    return target?.data.kind === 'approval' ? target.id : undefined
  }

  const starts = nodes.filter((node) => node.data.kind === 'start')
  if (starts.length === 1) {
    const firstApprovals = edges
      .filter((edge) => edge.source === starts[0].id)
      .map((edge) => nodes.find((node) => node.id === edge.target))
      .filter((node) => node?.data.kind === 'approval')
    if (firstApprovals.length === 1) return firstApprovals[0]?.id
    if (firstApprovals.length > 1) return undefined
  }

  return undefined
}

export function toProjectApprovalModel(
  nodes: ProjectFlowNode[],
  edges: ProjectFlowEdge[],
): ProjectApprovalModel {
  return {
    processId: 'project-approval',
    processName: '立项审批',
    nodes: nodes.map((node) => ({
      id: node.id,
      type: node.data.kind,
      name: node.data.name.trim(),
      x: Math.round(node.position.x),
      y: Math.round(node.position.y),
      ...(node.data.kind === 'countersign' ? { approveMode: 'ALL' as const } : {}),
    })),
    flows: edges.map((edge) => ({
      source: edge.source,
      target: edge.target,
      ...(edge.data?.branch === 'pass' || edge.data?.branch === 'reject'
        ? { branch: edge.data.branch }
        : {}),
    })),
  }
}

export interface ProjectValidationIssue {
  message: string
  locationLabel?: string
  nodeId?: string
  edgeId?: string
}

const nodeLabelsForValidation: Record<ProjectNodeKind, string> = {
  start: '开始',
  approval: '审批',
  condition: '条件分支',
  countersign: '会签',
  end: '结束',
}

function nodeLabel(node: ProjectFlowNode | undefined, fallback = '未命名步骤'): string {
  const name = node?.data.name.trim()
  return name || fallback
}

function issueLocation(
  nodes: ProjectFlowNode[],
  edges: ProjectFlowEdge[],
  issue: Pick<ProjectValidationIssue, 'nodeId' | 'edgeId'>,
): Pick<ProjectValidationIssue, 'locationLabel'> {
  if (issue.edgeId) {
    const edge = edges.find((candidate) => candidate.id === issue.edgeId)
    if (edge) {
      return {
        locationLabel:
          nodeLabel(nodes.find((candidate) => candidate.id === edge.source)) +
          ' → ' +
          nodeLabel(nodes.find((candidate) => candidate.id === edge.target)),
      }
    }
  }
  if (issue.nodeId) {
    const node = nodes.find((candidate) => candidate.id === issue.nodeId)
    return { locationLabel: nodeLabel(node) }
  }
  return {}
}

export function validateProjectApprovalFlow(
  nodes: ProjectFlowNode[],
  edges: ProjectFlowEdge[],
): ProjectValidationIssue[] {
  const issues: ProjectValidationIssue[] = []
  const starts = nodes.filter((node) => node.data.kind === 'start')
  const ends = nodes.filter((node) => node.data.kind === 'end')
  if (starts.length !== 1)
    issues.push({ message: '流程需要且只能有一个开始节点。', nodeId: starts[0]?.id })
  if (ends.length !== 1)
    issues.push({ message: '流程需要且只能有一个结束节点。', nodeId: ends[0]?.id })

  const byId = new Map(nodes.map((node) => [node.id, node]))
  const outgoing = new Map<string, ProjectFlowEdge[]>()
  const incoming = new Map<string, ProjectFlowEdge[]>()
  const edgePairs = new Set<string>()
  for (const edge of edges) {
    const source = byId.get(edge.source)
    const target = byId.get(edge.target)
    if (!source || !target) {
      issues.push({
        message: '有连线指向已删除或不存在的节点。',
        edgeId: edge.id,
        ...(source ? { nodeId: source.id } : {}),
      })
      continue
    }
    if (edge.source === edge.target)
      issues.push({ message: '节点不能连接到自身。', edgeId: edge.id })
    const pair = edge.source + '->' + edge.target
    if (edgePairs.has(pair))
      issues.push({ message: '同一对节点之间存在重复连线。', edgeId: edge.id })
    edgePairs.add(pair)
    outgoing.set(edge.source, [...(outgoing.get(edge.source) || []), edge])
    incoming.set(edge.target, [...(incoming.get(edge.target) || []), edge])
    if (source.data.kind === 'end')
      issues.push({ message: '结束节点不能再连接后续步骤。', edgeId: edge.id })
    if (target.data.kind === 'start')
      issues.push({ message: '开始节点不能有流入连线。', edgeId: edge.id })
    if (
      (edge.data?.branch === 'pass' || edge.data?.branch === 'reject') &&
      source.data.kind !== 'condition'
    )
      issues.push({
        message: '“通过”或“驳回”含义只能配置在条件分支发出的路径上。',
        edgeId: edge.id,
      })
    if (source.data.kind === 'condition' && edge.data?.branch === 'continue')
      issues.push({ message: '条件分支路径必须标记为“通过”或“驳回”。', edgeId: edge.id })
  }

  const rejectTargets = new Set(
    edges
      .filter(
        (edge) =>
          edge.data?.branch === 'reject' &&
          nodes.some((node) => node.id === edge.source && node.data.kind === 'condition'),
      )
      .map((edge) => edge.target),
  )
  const applicationId = inferApplicationNodeId(nodes, edges)
  if (!applicationId) {
    issues.push({
      message: '流程需要且只能有一个申请填写步骤；将审批结果的“驳回”路径连接回该步骤。',
    })
  }

  for (const node of nodes) {
    if (!node.data.name.trim())
      issues.push({
        message: '请填写“' + nodeLabelsForValidation[node.data.kind] + '”节点名称。',
        nodeId: node.id,
      })
    const next = outgoing.get(node.id) || []
    const previous = incoming.get(node.id) || []
    if (node.data.kind !== 'end' && next.length === 0)
      issues.push({ message: '“' + node.data.name + '”没有后续步骤。', nodeId: node.id })
    if (node.data.kind !== 'start' && previous.length === 0)
      issues.push({ message: '“' + node.data.name + '”没有上游步骤。', nodeId: node.id })

    if (node.data.kind === 'condition') {
      const priorKind = byId.get(previous[0]?.source || '')?.data.kind
      if (previous.length !== 1 || !['approval', 'countersign'].includes(priorKind || ''))
        issues.push({
          message: '“' + node.data.name + '”应紧接在审批或会签节点之后。',
          nodeId: node.id,
        })
      const pass = next.filter((edge) => edge.data?.branch === 'pass')
      const reject = next.filter((edge) => edge.data?.branch === 'reject')
      if (pass.length !== 1)
        issues.push({
          message: '“' + node.data.name + '”需要且只能有一条“通过”路径。',
          nodeId: node.id,
        })
      if (reject.length !== 1)
        issues.push({
          message: '“' + node.data.name + '”需要且只能有一条“驳回”路径。',
          nodeId: node.id,
        })
      if (reject.length === 1 && rejectTargets.size > 1)
        issues.push({
          message: '所有审批结果的“驳回”路径都应返回同一个申请填写步骤。',
          edgeId: reject[0].id,
        })
      if (reject.length === 1 && applicationId && reject[0].target !== applicationId)
        issues.push({
          message: '“' + node.data.name + '”的驳回路径应返回申请填写步骤。',
          edgeId: reject[0].id,
        })
    }

    if (
      (node.data.kind === 'approval' && node.id !== applicationId) ||
      node.data.kind === 'countersign'
    ) {
      if (next.length !== 1 || byId.get(next[0]?.target || '')?.data.kind !== 'condition')
        issues.push({
          message: '“' + node.data.name + '”后需要连接条件分支，用于设置通过和驳回去向。',
          nodeId: node.id,
        })
    }
  }

  const start = starts[0]
  if (start) {
    const reachable = new Set<string>()
    const queue = [start.id]
    while (queue.length) {
      const current = queue.shift()!
      if (reachable.has(current)) continue
      reachable.add(current)
      for (const edge of outgoing.get(current) || []) queue.push(edge.target)
    }
    for (const node of nodes) {
      if (!reachable.has(node.id))
        issues.push({ message: '“' + node.data.name + '”从开始节点无法到达。', nodeId: node.id })
    }
    const canFinish = new Set(ends.map((node) => node.id))
    let changed = true
    while (changed) {
      changed = false
      for (const edge of edges) {
        if (canFinish.has(edge.target) && !canFinish.has(edge.source)) {
          canFinish.add(edge.source)
          changed = true
        }
      }
    }
    for (const node of nodes) {
      if (!canFinish.has(node.id))
        issues.push({
          message: '“' + node.data.name + '”之后没有通往结束节点的路径。',
          nodeId: node.id,
        })
    }
  }

  if (starts.length === 1) {
    const entryEdges = outgoing.get(starts[0].id) || []
    if (entryEdges.length !== 1)
      issues.push({
        message: '开始节点需要且只能连接一个申请填写步骤。',
        nodeId: starts[0].id,
        ...(entryEdges[0] ? { edgeId: entryEdges[0].id } : {}),
      })
    if (entryEdges.length === 1) {
      const entry = byId.get(entryEdges[0].target)
      if (entry && (entry.data.kind !== 'approval' || entry.id !== applicationId))
        issues.push({
          message: '开始节点应直接连接到立项申请填写步骤。',
          edgeId: entryEdges[0].id,
          nodeId: entry.id,
        })
    }
  }

  return issues.map((issue) => ({ ...issue, ...issueLocation(nodes, edges, issue) }))
}
