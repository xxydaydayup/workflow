import { AxiosError } from 'axios'
import { describe, expect, it } from 'vitest'
import type { TaskTemplate, TaskTemplateVariable } from '@/api/workflow'
import { ApiError } from '@/utils/request'
import {
  assertDeploymentResult,
  getTemplateStartVariables,
  isDeploymentUncertain,
} from './templateDeployment'

describe('deployment outcomes', () => {
  const template = {
    taskKey: 'approval',
    version: 1,
    deploymentId: 'deployment-1',
    processDefinitionId: 'approval:1:definition-1',
  } as TaskTemplate

  it('requires backend deployment and process definition IDs before reporting success', () => {
    expect(() => assertDeploymentResult(template)).not.toThrow()
    for (const key of ['taskKey', 'deploymentId', 'processDefinitionId']) {
      expect(() => assertDeploymentResult({ ...template, [key]: '' })).toThrow(ApiError)
    }
    for (const version of [0, -1, 1.5, Number.NaN]) {
      expect(() => assertDeploymentResult({ ...template, version })).toThrow(ApiError)
    }
  })

  it('treats network failures, timeouts and server errors as uncertain without auto-retrying', () => {
    expect(isDeploymentUncertain(new AxiosError('Network Error'))).toBe(true)
    expect(isDeploymentUncertain(new AxiosError('Timeout', 'ECONNABORTED'))).toBe(true)
    for (const status of [408, 500, 502]) {
      const error = Object.assign(new AxiosError('failed'), { response: { status } })
      expect(isDeploymentUncertain(error)).toBe(true)
    }
  })

  it('allows retry after a definite validation or authentication failure', () => {
    for (const status of [400, 401, 403, 422]) {
      const error = Object.assign(new AxiosError('failed'), { response: { status } })
      expect(isDeploymentUncertain(error)).toBe(false)
    }
    expect(isDeploymentUncertain(new ApiError('引擎拒绝部署', 'ENGINE_ERROR'))).toBe(false)
  })

  it('does not present malformed successful responses as confirmed deployments', () => {
    for (const code of ['INVALID_RESPONSE', 'INVALID_DEPLOYMENT_RESULT']) {
      expect(isDeploymentUncertain(new ApiError('返回数据缺失', code))).toBe(true)
    }
  })

  it('uses backend variable metadata to expose only fields supplied when starting an instance', () => {
    const variables: TaskTemplateVariable[] = [
      { name: 'minister_assignee', type: 'String', source: 'start', required: true },
      { name: 'vote', type: 'String', source: 'complete', required: true },
      { name: 'managers_approveMode', type: 'String', source: 'engine', required: false },
      { name: 'legacyStartField', type: 'String' },
    ]
    expect(getTemplateStartVariables({ ...template, globalVariables: variables })).toEqual([
      variables[0],
      variables[3],
    ])
    expect(getTemplateStartVariables(template)).toEqual([])
  })
})
