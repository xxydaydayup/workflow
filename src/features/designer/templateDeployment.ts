import { isAxiosError } from 'axios'
import type { TaskTemplate, TaskTemplateVariable } from '@/api/workflow'
import { ApiError } from '@/utils/request'

export function assertDeploymentResult(template: TaskTemplate): void {
  if (
    [template?.taskKey, template?.deploymentId, template?.processDefinitionId].some(
      (value) => typeof value !== 'string' || !value.trim(),
    ) ||
    !Number.isInteger(template?.version) ||
    template.version < 1
  ) {
    throw new ApiError(
      '后端未返回有效的模板标识、版本和部署/流程定义信息，尚不能确认部署成功',
      'INVALID_DEPLOYMENT_RESULT',
    )
  }
}

export function getTemplateStartVariables(template: TaskTemplate): TaskTemplateVariable[] {
  return (template.globalVariables || []).filter(
    (variable) => !variable.source || variable.source === 'start',
  )
}

export function isDeploymentUncertain(cause: unknown): boolean {
  if (isAxiosError(cause)) {
    const status = cause.response?.status
    return !status || status >= 500 || status === 408
  }
  return (
    !(cause instanceof ApiError) ||
    ['INVALID_RESPONSE', 'INVALID_DEPLOYMENT_RESULT'].includes(cause.code)
  )
}
