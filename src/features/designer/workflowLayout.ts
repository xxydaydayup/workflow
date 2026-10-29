import ELK, { type ElkNode } from 'elkjs/lib/elk-api'
import elkWorkerUrl from 'elkjs/lib/elk-worker.min.js?url'
import type { WorkflowCanvasEdge, WorkflowCanvasNode } from './workflowModel'

export const WORKFLOW_NODE_WIDTH = 154
export const WORKFLOW_NODE_HEIGHT = 58

const elk = new ELK({ workerUrl: elkWorkerUrl })

export function isFeedbackRejectEdge(
  edge: WorkflowCanvasEdge,
  edges: WorkflowCanvasEdge[],
): boolean {
  if (edge.data?.branch !== 'reject') return false
  const outgoing = new Map<string, string[]>()
  for (const candidate of edges) {
    if (candidate.id === edge.id || candidate.data?.branch === 'reject') continue
    outgoing.set(candidate.source, [...(outgoing.get(candidate.source) ?? []), candidate.target])
  }

  const visited = new Set<string>()
  const pending = [edge.target]
  while (pending.length) {
    const current = pending.pop()!
    if (current === edge.source) return true
    if (visited.has(current)) continue
    visited.add(current)
    pending.push(...(outgoing.get(current) ?? []))
  }
  return false
}

export async function layoutWorkflow(
  nodes: WorkflowCanvasNode[],
  edges: WorkflowCanvasEdge[],
): Promise<{ nodes: WorkflowCanvasNode[]; edges: WorkflowCanvasEdge[] }> {
  const feedbackEdges = new Set(
    edges.filter((edge) => isFeedbackRejectEdge(edge, edges)).map((edge) => edge.id),
  )
  const routedEdges = edges.filter((edge) => !feedbackEdges.has(edge.id))
  const elkNodes: ElkNode[] = nodes.map((node) => ({
    id: node.id,
    width: WORKFLOW_NODE_WIDTH,
    height: WORKFLOW_NODE_HEIGHT,
    ports: [
      {
        id: node.id + '-in',
        width: 1,
        height: 1,
        layoutOptions: { 'elk.port.side': 'WEST' },
      },
      {
        id: node.id + '-out',
        width: 1,
        height: 1,
        layoutOptions: { 'elk.port.side': 'EAST' },
      },
    ],
    layoutOptions: { 'elk.portConstraints': 'FIXED_SIDE' },
  }))
  const graph: ElkNode = {
    id: 'workflow',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.layered.spacing.nodeNodeBetweenLayers': '105',
      'elk.spacing.nodeNode': '82',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
      'elk.layered.thoroughness': '5',
    },
    children: elkNodes,
    edges: routedEdges.map((edge) => ({
      id: edge.id,
      sources: [edge.source + '-out'],
      targets: [edge.target + '-in'],
    })),
  }

  const result = await elk.layout(graph)
  const positions = new Map((result.children ?? []).map((node) => [node.id, node]))
  const routes = new Map(
    (result.edges ?? []).map((edge) => [
      edge.id,
      edge.sections
        ?.flatMap((section) => [
          section.startPoint,
          ...(section.bendPoints ?? []),
          section.endPoint,
        ])
        .filter((point): point is { x: number; y: number } => Boolean(point)) ?? [],
    ]),
  )

  return {
    nodes: nodes.map((node) => {
      const position = positions.get(node.id)
      return position
        ? {
            ...node,
            position: { x: position.x ?? node.position.x, y: position.y ?? node.position.y },
          }
        : node
    }),
    edges: edges.map((edge) => ({
      ...edge,
      type: 'workflowRoute',
      data: {
        ...edge.data,
        feedback: feedbackEdges.has(edge.id),
        routePoints: routes.get(edge.id),
      },
    })),
  }
}

export function clearWorkflowEdgeRoutes(edges: WorkflowCanvasEdge[]): WorkflowCanvasEdge[] {
  const feedbackIds = new Set(
    edges.filter((edge) => isFeedbackRejectEdge(edge, edges)).map((edge) => edge.id),
  )
  return edges.map((edge) => ({
    ...edge,
    data: {
      ...edge.data,
      routePoints: undefined,
      feedback: feedbackIds.has(edge.id),
    },
  }))
}

export function getRejectRoutePoints(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  nodes: WorkflowCanvasNode[],
): { x: number; y: number }[] {
  const channelY = Math.max(...nodes.map((node) => node.position.y + WORKFLOW_NODE_HEIGHT), 0) + 80
  const sourceExitX = sourceX + 30
  const targetEntryX = targetX - 30
  return [
    { x: sourceX, y: sourceY },
    { x: sourceExitX, y: sourceY },
    { x: sourceExitX, y: channelY },
    { x: targetEntryX, y: channelY },
    { x: targetEntryX, y: targetY },
    { x: targetX, y: targetY },
  ]
}
