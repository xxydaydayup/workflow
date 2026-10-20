import { beforeEach, describe, expect, it, vi } from 'vitest'
import { requestData } from '@/utils/request'
import { businessWorkflowGateway as gateway } from './index'

vi.mock('@/utils/request', () => ({ requestData: vi.fn() }))

describe('workflow Swagger contracts', () => {
  beforeEach(() => vi.resetAllMocks())

  it('serializes deployment metadata as multipart fields without losing false and zero', async () => {
    await gateway.publishTemplate({
      xml: '<definitions/>',
      deploymentName: '审批/流程',
      taskKey: 'approval',
      version: 0,
      startable: false,
      suspended: false,
      globalVariables: [{ name: 'days', type: 'Integer', value: 1 }],
      displayJson: { nodes: [] },
      extra: { department: 'HR' },
    })
    const config = vi.mocked(requestData).mock.calls[0][0]
    const form = config.data as FormData
    expect(config).toMatchObject({ method: 'POST', url: '/v1/task/deployments' })
    expect(form.get('task-key')).toBe('approval')
    expect(form.get('version')).toBe('0')
    expect(form.get('startable')).toBe('false')
    expect(form.get('suspended')).toBe('false')
    expect(JSON.parse(form.get('global-variables') as string)).toEqual([
      { name: 'days', type: 'Integer', value: 1 },
    ])
    expect(JSON.parse(form.get('display-json') as string)).toEqual({ nodes: [] })
    expect(JSON.parse(form.get('extra') as string)).toEqual({ department: 'HR' })
    const file = form.get('file') as File
    expect(file.name).toBe('审批_流程.bpmn')
    expect(await file.text()).toBe('<definitions/>')
  })

  it('encodes business keys as a single URL segment and forwards query cancellation', async () => {
    const signal = new AbortController().signal
    await gateway.getTaskTree('业务/001?', signal)
    expect(requestData).toHaveBeenLastCalledWith({
      method: 'GET',
      url: '/v1/task/instances/by-business-key/' + encodeURIComponent('业务/001?') + '/tree',
      signal,
    })
    const query = { firstResult: 0, maxResults: 10, active: false }
    await gateway.listTasks(query, signal)
    expect(requestData).toHaveBeenLastCalledWith({
      method: 'GET',
      url: '/v1/tasks',
      params: query,
      signal,
    })
  })

  it('keeps ordinary startup variables and Camunda task-completion variables distinct', async () => {
    const input = { taskKey: 'approval', businessKey: '001', variables: { days: 3 } }
    await gateway.startTaskInstance(input)
    expect(requestData).toHaveBeenLastCalledWith(
      expect.objectContaining({
        url: '/v1/task/instances/start',
        data: input,
      }),
    )
    const variables = { approved: { value: false, type: 'Boolean' } }
    await gateway.completeTask('task/001', variables)
    expect(requestData).toHaveBeenLastCalledWith(
      expect.objectContaining({
        url: '/v1/tasks/task%2F001/complete',
        data: { variables },
      }),
    )
  })

  it('preserves nested batch items and maps reassignment to userId', async () => {
    const items = [
      { taskKey: 'root', businessKey: '1', children: [{ taskKey: 'child', businessKey: '2' }] },
    ]
    await gateway.batchStartTaskInstances(items)
    expect(requestData).toHaveBeenLastCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: '/v1/task/instances/batch-start',
        data: { items },
      }),
    )
    await gateway.reassignTask('task', 'alice')
    expect(requestData).toHaveBeenLastCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: '/v1/tasks/task/reassign',
        data: { userId: 'alice' },
      }),
    )
  })
})
