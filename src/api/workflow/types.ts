export type BusinessVariables = Record<string, unknown>

export interface TaskTemplateVariable {
  name: string
  type: string
  value?: unknown
  description?: string
}

export interface TaskTemplate {
  id: number
  tenantId: string
  taskKey: string
  taskName: string
  version: number
  deploymentId: string
  processDefinitionKey: string
  processDefinitionId: string
  category?: string
  versionTag?: string
  description?: string
  formKey?: string
  startable: boolean
  suspended: boolean
  globalVariables?: TaskTemplateVariable[]
  displayJson?: Record<string, unknown> | null
  extra?: Record<string, unknown> | null
  createdAt?: string
  updatedAt?: string
  createdBy?: string
  updatedBy?: string
}

export interface TaskTemplateDetail extends TaskTemplate {
  bpmnXml: string
}

export interface PublishTemplateInput {
  xml: string
  deploymentName?: string
  taskKey?: string
  taskName?: string
  version?: number
  category?: string
  versionTag?: string
  description?: string
  formKey?: string
  startable?: boolean
  suspended?: boolean
  globalVariables?: TaskTemplateVariable[]
  displayJson?: Record<string, unknown>
  extra?: Record<string, unknown>
  createdBy?: string
}

export interface TaskTemplateQuery {
  key?: string
  keyLike?: string
  nameLike?: string
  category?: string
  processDefinitionKey?: string
  suspendedOnly?: boolean
  firstResult?: number
  maxResults?: number
}

export interface StartBusinessTaskInput {
  taskKey: string
  businessKey: string
  variables?: BusinessVariables
  callbackUrl?: string
  extra?: Record<string, unknown>
  parentBusinessKey?: string
  predecessorConstraint?: boolean
}

export interface BusinessTaskInstance extends StartBusinessTaskInput {
  id: number
  tenantId: string
  taskName: string
  taskTemplateId: number
  processDefinitionKey: string
  processDefinitionId: string
  processInstanceId: string
  status: string
  isNotifySuccess?: boolean
  startedAt?: string
  createdAt?: string
  updatedAt?: string
}

export interface BatchStartItem extends StartBusinessTaskInput {
  children?: BatchStartItem[]
}

export interface BatchStartFailure {
  businessKey: string
  error: string
  index: number
  phase: 'validate' | 'engine' | 'db' | 'skipped'
  processInstanceId?: string
}

export interface BatchStartResult {
  total: number
  success: BusinessTaskInstance[]
  failures: BatchStartFailure[]
}

export interface TaskTreeNode {
  id: number
  businessKey: string
  parentBusinessKey?: string
  processInstanceId: string
  taskKey: string
  taskName: string
  status: string
  startedAt?: string
  children?: TaskTreeNode[]
}

export interface CamundaVariable {
  value: unknown
  type?: string
  valueInfo?: unknown
}
export type CamundaVariables = Record<string, CamundaVariable>

export interface BusinessUserTask {
  id: string
  name?: string
  assignee?: string
  owner?: string
  description?: string
  priority?: number
  processDefinitionId?: string
  processDefinitionKey?: string
  processInstanceId?: string
  executionId?: string
  taskDefinitionKey?: string
  caseDefinitionId?: string
  caseExecutionId?: string
  caseInstanceId?: string
  delegationState?: string
  created?: string
  due?: string
  followUp?: string
  formKey?: string
  tenantId?: string
  variables?: CamundaVariables
  suspensionState?: number
}

export interface BusinessTaskQuery {
  assignee?: string
  owner?: string
  candidateUser?: string
  candidateGroup?: string
  processInstanceId?: string
  processDefinitionKey?: string
  processDefinitionId?: string
  taskDefinitionKey?: string
  name?: string
  nameLike?: string
  description?: string
  priority?: number
  minPriority?: number
  maxPriority?: number
  active?: boolean
  suspended?: boolean
  includeAssignedTasks?: boolean
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  firstResult?: number
  maxResults?: number
}

export interface TaskTemplateDeleteResult {
  taskKey: string
  status: 'deleted'
}
export interface TaskCompletionResult {
  taskId: string
  status: 'completed'
}
export interface TaskRefuseResult {
  taskId: string
  status: 'refused'
}
export interface TaskReassignResult {
  taskId: string
  status: 'reassigned'
  assignee: string
}
