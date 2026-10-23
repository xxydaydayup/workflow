import { describe, expect, it } from 'vitest'
import {
  inferApplicationNodeId,
  toProjectApprovalModel,
  validateProjectApprovalFlow,
  type ProjectFlowEdge,
  type ProjectFlowNode,
} from './projectApprovalModel'

describe('project approval model adapter', () => {
  it('maps canvas nodes and result paths to the backend business DTO', () => {
    const nodes: ProjectFlowNode[] = [
      {
        id: 'apply',
        type: 'business',
        position: { x: 180.4, y: 145.2 },
        data: { kind: 'approval', name: '立项审批单' },
      },
      {
        id: 'minister',
        type: 'business',
        position: { x: 340, y: 145 },
        data: { kind: 'approval', name: '部长审批' },
      },
      {
        id: 'managers',
        type: 'business',
        position: { x: 600, y: 145 },
        data: { kind: 'countersign', name: '各部门经理会签' },
      },
    ]
    const edges: ProjectFlowEdge[] = [
      { id: 'start-apply', source: 'start', target: 'apply', data: { branch: 'continue' } },
      { id: 'apply-minister', source: 'apply', target: 'minister', data: { branch: 'continue' } },
      {
        id: 'minister-condition',
        source: 'minister',
        target: 'minister-result',
        data: { branch: 'continue' },
      },
      {
        id: 'to-managers',
        source: 'minister-result',
        target: 'managers',
        data: { branch: 'pass' },
      },
      {
        id: 'return-to-apply',
        source: 'minister-result',
        target: 'apply',
        data: { branch: 'reject' },
      },
      {
        id: 'managers-condition',
        source: 'managers',
        target: 'manager-result',
        data: { branch: 'continue' },
      },
      { id: 'to-end', source: 'manager-result', target: 'end', data: { branch: 'pass' } },
      {
        id: 'return-to-apply-again',
        source: 'manager-result',
        target: 'apply',
        data: { branch: 'reject' },
      },
    ]

    nodes.push(
      {
        id: 'start',
        type: 'business',
        position: { x: 100, y: 165 },
        data: { kind: 'start', name: '发起' },
      },
      {
        id: 'minister-result',
        type: 'business',
        position: { x: 500, y: 160 },
        data: { kind: 'condition', name: '部长审批结果' },
      },
      {
        id: 'manager-result',
        type: 'business',
        position: { x: 760, y: 160 },
        data: { kind: 'condition', name: '会签结果' },
      },
      {
        id: 'end',
        type: 'business',
        position: { x: 860, y: 165 },
        data: { kind: 'end', name: '结束' },
      },
    )

    expect(inferApplicationNodeId(nodes, edges)).toBe('apply')
    expect(validateProjectApprovalFlow(nodes, edges)).toEqual([])

    expect(toProjectApprovalModel(nodes, edges)).toEqual({
      processId: 'project-approval',
      processName: '立项审批',
      nodes: [
        { id: 'apply', type: 'approval', name: '立项审批单', x: 180, y: 145 },
        { id: 'minister', type: 'approval', name: '部长审批', x: 340, y: 145 },
        {
          id: 'managers',
          type: 'countersign',
          name: '各部门经理会签',
          x: 600,
          y: 145,
          approveMode: 'ALL',
        },
        { id: 'start', type: 'start', name: '发起', x: 100, y: 165 },
        { id: 'minister-result', type: 'condition', name: '部长审批结果', x: 500, y: 160 },
        { id: 'manager-result', type: 'condition', name: '会签结果', x: 760, y: 160 },
        { id: 'end', type: 'end', name: '结束', x: 860, y: 165 },
      ],
      flows: [
        { source: 'start', target: 'apply' },
        { source: 'apply', target: 'minister' },
        { source: 'minister', target: 'minister-result' },
        { source: 'minister-result', target: 'managers', branch: 'pass' },
        { source: 'minister-result', target: 'apply', branch: 'reject' },
        { source: 'managers', target: 'manager-result' },
        { source: 'manager-result', target: 'end', branch: 'pass' },
        { source: 'manager-result', target: 'apply', branch: 'reject' },
      ],
    })
  })

  it('requires each approval decision to flow to a result condition', () => {
    const nodes: ProjectFlowNode[] = [
      {
        id: 'start',
        type: 'business',
        position: { x: 0, y: 0 },
        data: { kind: 'start', name: '发起' },
      },
      {
        id: 'apply',
        type: 'business',
        position: { x: 0, y: 100 },
        data: { kind: 'approval', name: '申请填写' },
      },
      {
        id: 'approve',
        type: 'business',
        position: { x: 0, y: 200 },
        data: { kind: 'approval', name: '审批' },
      },
      {
        id: 'end',
        type: 'business',
        position: { x: 0, y: 300 },
        data: { kind: 'end', name: '结束' },
      },
    ]
    const edges: ProjectFlowEdge[] = [
      { id: 'start-apply', source: 'start', target: 'apply' },
      { id: 'apply-approve', source: 'apply', target: 'approve' },
      { id: 'approve-end', source: 'approve', target: 'end' },
    ]

    expect(validateProjectApprovalFlow(nodes, edges)).toContainEqual(
      expect.objectContaining({
        nodeId: 'approve',
        message: '“审批”后需要连接条件分支，用于设置通过和驳回去向。',
      }),
    )
  })

  it('does not infer the application step from a reject label on an ordinary connection', () => {
    const nodes: ProjectFlowNode[] = [
      {
        id: 'apply',
        type: 'business',
        position: { x: 0, y: 0 },
        data: { kind: 'approval', name: '申请填写' },
      },
      {
        id: 'approve',
        type: 'business',
        position: { x: 0, y: 100 },
        data: { kind: 'approval', name: '审批' },
      },
    ]
    const edges: ProjectFlowEdge[] = [
      { id: 'ordinary-reject', source: 'approve', target: 'apply', data: { branch: 'reject' } },
    ]

    expect(inferApplicationNodeId(nodes, edges)).toBeUndefined()
    expect(validateProjectApprovalFlow(nodes, edges)).toContainEqual(
      expect.objectContaining({ edgeId: 'ordinary-reject' }),
    )
  })

  it('infers the application step from the first approval after start while the flow is being drawn', () => {
    const nodes: ProjectFlowNode[] = [
      {
        id: 'start',
        type: 'business',
        position: { x: 0, y: 0 },
        data: { kind: 'start', name: '发起' },
      },
      {
        id: 'step-a',
        type: 'business',
        position: { x: 0, y: 100 },
        data: { kind: 'approval', name: '申请填写' },
      },
    ]
    const edges: ProjectFlowEdge[] = [{ id: 'start-step-a', source: 'start', target: 'step-a' }]

    expect(inferApplicationNodeId(nodes, edges)).toBe('step-a')
  })

  it('does not fall back to the start path when completed rejection paths point elsewhere', () => {
    const nodes: ProjectFlowNode[] = [
      {
        id: 'start',
        type: 'business',
        position: { x: 0, y: 0 },
        data: { kind: 'start', name: '发起' },
      },
      {
        id: 'apply',
        type: 'business',
        position: { x: 0, y: 100 },
        data: { kind: 'approval', name: '申请填写' },
      },
      {
        id: 'approve',
        type: 'business',
        position: { x: 0, y: 200 },
        data: { kind: 'approval', name: '审批' },
      },
      {
        id: 'result',
        type: 'business',
        position: { x: 0, y: 300 },
        data: { kind: 'condition', name: '审批结果' },
      },
      {
        id: 'end',
        type: 'business',
        position: { x: 0, y: 400 },
        data: { kind: 'end', name: '结束' },
      },
    ]
    const edges: ProjectFlowEdge[] = [
      { id: 'start-apply', source: 'start', target: 'apply' },
      { id: 'apply-approve', source: 'apply', target: 'approve' },
      { id: 'approve-result', source: 'approve', target: 'result' },
      { id: 'result-end', source: 'result', target: 'end', data: { branch: 'reject' } },
    ]

    expect(inferApplicationNodeId(nodes, edges)).toBeUndefined()
  })

  it('returns actionable labels for missing names and isolated nodes', () => {
    const nodes: ProjectFlowNode[] = [
      {
        id: 'start',
        type: 'business',
        position: { x: 0, y: 0 },
        data: { kind: 'start', name: '发起' },
      },
      {
        id: 'apply',
        type: 'business',
        position: { x: 0, y: 100 },
        data: { kind: 'approval', name: '申请填写' },
      },
      {
        id: 'orphan',
        type: 'business',
        position: { x: 300, y: 100 },
        data: { kind: 'approval', name: '   ' },
      },
      {
        id: 'end',
        type: 'business',
        position: { x: 0, y: 300 },
        data: { kind: 'end', name: '结束' },
      },
    ]
    const edges: ProjectFlowEdge[] = [
      { id: 'start-apply', source: 'start', target: 'apply', data: { branch: 'reject' } },
    ]
    const issues = validateProjectApprovalFlow(nodes, edges)

    expect(issues).toContainEqual(
      expect.objectContaining({
        nodeId: 'orphan',
        message: '请填写“审批”节点名称。',
        locationLabel: '未命名步骤',
      }),
    )
    expect(issues).toContainEqual(
      expect.objectContaining({
        nodeId: 'orphan',
        message: '“   ”从开始节点无法到达。',
        locationLabel: '未命名步骤',
      }),
    )
    expect(issues).toContainEqual(
      expect.objectContaining({ edgeId: 'start-apply', locationLabel: '发起 → 申请填写' }),
    )
  })

  it('identifies an incorrect start path and keeps both endpoints available for navigation', () => {
    const nodes: ProjectFlowNode[] = [
      {
        id: 'start',
        type: 'business',
        position: { x: 0, y: 0 },
        data: { kind: 'start', name: '发起' },
      },
      {
        id: 'apply',
        type: 'business',
        position: { x: 0, y: 100 },
        data: { kind: 'approval', name: '申请填写' },
      },
      {
        id: 'review',
        type: 'business',
        position: { x: 200, y: 100 },
        data: { kind: 'approval', name: '审批' },
      },
      {
        id: 'result',
        type: 'business',
        position: { x: 200, y: 200 },
        data: { kind: 'condition', name: '审批结果' },
      },
      {
        id: 'end',
        type: 'business',
        position: { x: 200, y: 300 },
        data: { kind: 'end', name: '结束' },
      },
    ]
    const edges: ProjectFlowEdge[] = [
      { id: 'start-review', source: 'start', target: 'review' },
      { id: 'review-result', source: 'review', target: 'result' },
      { id: 'result-apply', source: 'result', target: 'apply', data: { branch: 'reject' } },
      { id: 'result-end', source: 'result', target: 'end', data: { branch: 'pass' } },
      { id: 'apply-end', source: 'apply', target: 'end' },
    ]
    const issue = validateProjectApprovalFlow(nodes, edges).find(
      (candidate) => candidate.message === '开始节点应直接连接到立项申请填写步骤。',
    )

    expect(issue).toMatchObject({
      edgeId: 'start-review',
      nodeId: 'review',
      locationLabel: '发起 → 审批',
    })
  })
})
