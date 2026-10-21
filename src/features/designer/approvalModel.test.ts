import { describe, expect, it } from 'vitest'
import { createInitialApprovalModel, validateApprovalModel } from './approvalModel'

describe('approval model contract', () => {
  it('accepts the leave approval example from the business contract', () => {
    expect(validateApprovalModel(createInitialApprovalModel())).toEqual([])
  })

  it('requires an explicit multi-person approval method', () => {
    const model = createInitialApprovalModel()
    model.flow.nodes[1].approver = { mode: 'member', members: ['张伟', '李娜'] }

    expect(validateApprovalModel(model)).toContain('“主管审批”有多位审批人，请选择会签或或签。')
  })

  it('requires exactly one default path for each condition step', () => {
    const model = createInitialApprovalModel()
    model.flow.edges.find((edge) => edge.id === 'e4')!.isDefault = undefined

    expect(validateApprovalModel(model)).toContain('“天数判断”需要且只能有一个默认分支。')
  })

  it('rejects conditions that reference fields outside the form', () => {
    const model = createInitialApprovalModel()
    model.flow.edges.find((edge) => edge.id === 'e3')!.conditions![0].field = 'missingField'

    expect(validateApprovalModel(model)).toContain('分支条件引用了不存在的表单字段：missingField')
  })

  it('preserves the workflow code when initializing and editing business names', () => {
    const model = createInitialApprovalModel()
    const code = model.process.code
    model.process.name = '出差审批'

    expect(model.process.code).toBe(code)
    expect(validateApprovalModel(model)).toEqual([])
  })

  it('requires each step to be reachable from the start and able to reach the end', () => {
    const model = createInitialApprovalModel()
    model.flow.edges = model.flow.edges.filter((edge) => edge.id !== 'e6')

    expect(validateApprovalModel(model)).toContain('“抄送行政”之后没有通往结束步骤的路径。')
  })
})
