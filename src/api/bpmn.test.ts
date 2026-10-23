import { beforeEach, describe, expect, it, vi } from 'vitest'
import { requestData } from '@/utils/request'
import type { ProjectApprovalModel } from './projectApprovalModel'
import { compileProjectApprovalModel } from './bpmn'

vi.mock('@/utils/request', () => ({ requestData: vi.fn() }))

const definition: ProjectApprovalModel = {
  processId: 'project-approval',
  processName: '立项审批',
  nodes: [
    { id: 'start', type: 'start', name: '发起', x: 100, y: 165 },
    { id: 'apply', type: 'approval', name: '立项申请单', x: 180, y: 145 },
    { id: 'minister', type: 'approval', name: '部长审批', x: 340, y: 145 },
    { id: 'gwMinister', type: 'condition', name: '部长审批结果', x: 500, y: 160 },
    {
      id: 'managers',
      type: 'countersign',
      name: '各部门经理会签',
      approveMode: 'ALL',
      x: 600,
      y: 145,
    },
    { id: 'gwManagers', type: 'condition', name: '会签结果', x: 760, y: 160 },
    { id: 'end', type: 'end', name: '结束', x: 860, y: 165 },
  ],
  flows: [
    { source: 'start', target: 'apply' },
    { source: 'apply', target: 'minister' },
    { source: 'minister', target: 'gwMinister' },
    { source: 'gwMinister', target: 'managers', branch: 'pass' },
    { source: 'gwMinister', target: 'apply', branch: 'reject' },
    { source: 'managers', target: 'gwManagers' },
    { source: 'gwManagers', target: 'end', branch: 'pass' },
    { source: 'gwManagers', target: 'apply', branch: 'reject' },
  ],
}

describe('project approval model compilation contract', () => {
  beforeEach(() => vi.resetAllMocks())

  it('sends the business model directly and preserves returned XML exactly', async () => {
    const xml = '<?xml version="1.0"?>\r\n<definitions>中文 &amp; XML</definitions>\r\n'
    vi.mocked(requestData).mockResolvedValue({ bpmnXml: xml })
    const signal = new AbortController().signal
    await expect(compileProjectApprovalModel(definition, signal)).resolves.toBe(xml)
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
      await expect(compileProjectApprovalModel(definition)).rejects.toThrow(
        '后端未返回有效的 BPMN XML',
      )
    },
  )

  it('propagates backend compile errors', async () => {
    vi.mocked(requestData).mockRejectedValue(new Error('驳回路径未连接申请节点'))
    await expect(compileProjectApprovalModel(definition)).rejects.toThrow('驳回路径未连接申请节点')
  })
})
