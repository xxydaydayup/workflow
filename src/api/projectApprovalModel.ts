export type ProjectApprovalNodeType = 'start' | 'approval' | 'condition' | 'countersign' | 'end'
export type ProjectApprovalBranch = 'pass' | 'reject'

export interface ProjectApprovalNode {
  id: string
  type: ProjectApprovalNodeType
  name: string
  x: number
  y: number
  approveMode?: 'ALL'
}

export interface ProjectApprovalFlow {
  source: string
  target: string
  branch?: ProjectApprovalBranch
}

export interface ProjectApprovalModel {
  processId: string
  processName: string
  nodes: ProjectApprovalNode[]
  flows: ProjectApprovalFlow[]
}
