import { isAxiosError } from 'axios'
import type { TaskTemplate } from '@/api/workflow'
import { ApiError } from '@/utils/request'

export function assertDeploymentResult(template: TaskTemplate): void {
  if (
    [template?.taskKey, template?.deploymentId, template?.processDefinitionId].some(
      (value) => typeof value !== 'string' || !value.trim(),
    )
  ) {
    throw new ApiError(
      '后端未返回完整的任务模板、部署 ID 和流程定义 ID，尚不能确认部署成功',
      'INVALID_DEPLOYMENT_RESULT',
    )
  }
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
