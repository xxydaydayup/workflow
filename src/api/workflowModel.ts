/** Business workflow contract shared by the designer and the compiler API. */
export type WorkflowNodeType =
  'start' | 'approval' | 'countersign' | 'service' | 'condition' | 'end'

export type WorkflowBranch = 'pass' | 'reject'

export interface WorkflowNode {
  id: string
  type: WorkflowNodeType
  name: string
  x: number
  y: number
  form?: string
  sequential?: boolean
  reminder?: { duration?: string; name?: string }
  serviceName?: string
  serviceUrl?: string
  /** Kept open so backend-provided modes can be added without a client release. */
  approveMode?: string
  /** String value by contract; numeric range is validated at the boundary. */
  passRate?: string
}

export interface WorkflowFlow {
  source: string
  target: string
  branch?: WorkflowBranch
  conditionExpression?: string
}

export interface WorkflowModel {
  processId: string
  processName: string
  nodes: WorkflowNode[]
  flows: WorkflowFlow[]
}
