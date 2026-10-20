import { requestData } from '@/utils/request'
import type {
  BatchStartItem,
  BatchStartResult,
  BusinessTaskInstance,
  BusinessTaskQuery,
  BusinessUserTask,
  CamundaVariables,
  PublishTemplateInput,
  StartBusinessTaskInput,
  TaskCompletionResult,
  TaskRefuseResult,
  TaskReassignResult,
  TaskTemplate,
  TaskTemplateDeleteResult,
  TaskTemplateDetail,
  TaskTemplateQuery,
  TaskTreeNode,
} from './types'

export * from './types'

const basePath = '/v1'
const segment = encodeURIComponent

export const businessWorkflowGateway = {
  publishTemplate(input: PublishTemplateInput, signal?: AbortSignal): Promise<TaskTemplate> {
    const { xml, deploymentName, ...metadata } = input
    const form = new FormData()
    const name = deploymentName?.trim() || '流程任务模板'
    const filename = name.replace(/[\\/:*?"<>|]/g, '_') + '.bpmn'
    form.append('deployment-name', name)
    form.append('file', new Blob([xml], { type: 'application/xml' }), filename)
    const fields = {
      taskKey: 'task-key',
      taskName: 'task-name',
      version: 'version',
      category: 'category',
      versionTag: 'version-tag',
      description: 'description',
      formKey: 'form-key',
      startable: 'startable',
      suspended: 'suspended',
      globalVariables: 'global-variables',
      displayJson: 'display-json',
      extra: 'extra',
      createdBy: 'created-by',
    } as const
    for (const key of Object.keys(fields) as Array<keyof typeof fields>) {
      const value = metadata[key]
      if (value !== undefined) {
        form.append(fields[key], typeof value === 'object' ? JSON.stringify(value) : String(value))
      }
    }
    return requestData({ method: 'POST', url: basePath + '/task/deployments', data: form, signal })
  },

  listTemplates(query?: TaskTemplateQuery, signal?: AbortSignal): Promise<TaskTemplate[]> {
    return requestData({
      method: 'GET',
      url: basePath + '/task/deployments',
      params: query,
      signal,
    })
  },

  getTemplate(taskKey: string, signal?: AbortSignal): Promise<TaskTemplateDetail> {
    return requestData({
      method: 'GET',
      url: basePath + '/task/deployments/' + segment(taskKey),
      signal,
    })
  },

  deleteTemplate(taskKey: string, signal?: AbortSignal): Promise<TaskTemplateDeleteResult> {
    return requestData({
      method: 'DELETE',
      url: basePath + '/task/deployments/' + segment(taskKey),
      signal,
    })
  },

  startTaskInstance(
    input: StartBusinessTaskInput,
    signal?: AbortSignal,
  ): Promise<BusinessTaskInstance> {
    return requestData({
      method: 'POST',
      url: basePath + '/task/instances/start',
      data: input,
      signal,
    })
  },

  batchStartTaskInstances(
    items: BatchStartItem[],
    signal?: AbortSignal,
  ): Promise<BatchStartResult> {
    return requestData({
      method: 'POST',
      url: basePath + '/task/instances/batch-start',
      data: { items },
      signal,
    })
  },

  deleteTaskInstance(businessKey: string, signal?: AbortSignal): Promise<null> {
    return requestData({
      method: 'DELETE',
      url: basePath + '/task/instances/by-business-key/' + segment(businessKey),
      signal,
    })
  },

  getTaskTree(businessKey: string, signal?: AbortSignal): Promise<TaskTreeNode> {
    return requestData({
      method: 'GET',
      url: basePath + '/task/instances/by-business-key/' + segment(businessKey) + '/tree',
      signal,
    })
  },

  listTasks(query?: BusinessTaskQuery, signal?: AbortSignal): Promise<BusinessUserTask[]> {
    return requestData({ method: 'GET', url: basePath + '/tasks', params: query, signal })
  },

  completeTask(
    taskId: string,
    variables: CamundaVariables = {},
    signal?: AbortSignal,
  ): Promise<TaskCompletionResult> {
    return requestData({
      method: 'POST',
      url: basePath + '/tasks/' + segment(taskId) + '/complete',
      data: { variables },
      signal,
    })
  },

  refuseTask(taskId: string, signal?: AbortSignal): Promise<TaskRefuseResult> {
    return requestData({
      method: 'POST',
      url: basePath + '/tasks/' + segment(taskId) + '/refuse',
      signal,
    })
  },

  reassignTask(taskId: string, userId: string, signal?: AbortSignal): Promise<TaskReassignResult> {
    return requestData({
      method: 'POST',
      url: basePath + '/tasks/' + segment(taskId) + '/reassign',
      data: { userId },
      signal,
    })
  },
}
