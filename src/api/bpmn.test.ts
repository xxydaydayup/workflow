import { beforeEach, describe, expect, it, vi } from 'vitest'
import { requestData } from '@/utils/request'
import { convertBpmnToXml, type BpmnJSONRequest } from './bpmn'

vi.mock('@/utils/request', () => ({ requestData: vi.fn() }))

const definition: BpmnJSONRequest = {
  processId: 'approval',
  processName: '审批',
  nodes: [
    {
      id: 'approval_task',
      type: 'userTask',
      name: '审批',
      x: 200,
      y: 100,
      assignee: '${approver}',
      formKey: 'approval-form',
      multiInstance: {
        enable: true,
        collection: 'approvers',
        elementVariable: 'approver',
        sequential: false,
      },
      taskListeners: [
        { event: 'complete', type: 'delegateExpression', value: '${approvalListener}' },
      ],
      formFields: [{ id: 'result', type: 'enum', values: [{ id: 'yes', name: '同意' }] }],
    },
  ],
  flows: [
    { id: 'flow', source: 'approval_task', target: 'end', conditionExpression: '${approved}' },
  ],
}

describe('BPMN conversion contract', () => {
  beforeEach(() => vi.resetAllMocks())

  it('sends the process DTO directly and preserves the returned XML exactly', async () => {
    const xml = '<?xml version="1.0"?>\r\n<definitions>中文 &amp; XML</definitions>\r\n'
    vi.mocked(requestData).mockResolvedValue({ bpmnXml: xml })
    const signal = new AbortController().signal
    await expect(convertBpmnToXml(definition, signal)).resolves.toBe(xml)
    expect(requestData).toHaveBeenCalledWith({
      method: 'POST',
      url: '/v1/bpmn/json2xml',
      data: definition,
      signal,
    })
  })

  it.each([null, {}, { bpmnXml: '' }, { bpmnXml: '  ' }, { bpmnXml: 42 }])(
    'rejects missing or empty XML: %j',
    async (result) => {
      vi.mocked(requestData).mockResolvedValue(result)
      await expect(convertBpmnToXml(definition)).rejects.toThrow('后端未返回有效的 BPMN XML')
    },
  )

  it('propagates the backend conversion failure', async () => {
    vi.mocked(requestData).mockRejectedValue(new Error('节点未连接'))
    await expect(convertBpmnToXml(definition)).rejects.toThrow('节点未连接')
  })
})
