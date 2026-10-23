import { describe, expect, it } from 'vitest'
import type { TaskTemplateVariable } from '@/api/workflow'
import { parseBusinessFormValues, validateApprovalStart } from './approvalStart'

const variables: TaskTemplateVariable[] = [
  { name: 'reviewer', type: 'String', description: '单人审批人', source: 'start', required: true },
  { name: 'signers', type: 'Array', description: '会签人员', source: 'start', required: true },
  { name: 'decision', type: 'Boolean', source: 'complete', required: true },
  { name: 'approvalMode', type: 'String', source: 'engine', required: false },
  { name: 'legacy', type: 'String' },
]

describe('approval instance startup', () => {
  it('merges business form values with required start fields and excludes non-start variables', () => {
    expect(
      validateApprovalStart(
        variables,
        { reviewer: ' alice ', signers: 'bob\ncarol', legacy: 'old' },
        '{"requestId":"R-1"}',
      ),
    ).toEqual({
      errors: [],
      variables: { requestId: 'R-1', reviewer: 'alice', signers: ['bob', 'carol'], legacy: 'old' },
    })
  })

  it('reports required missing values, empty signer collections, and duplicate signers', () => {
    expect(
      validateApprovalStart(variables, { reviewer: 'alice', signers: '  ,\n ' }, '{}').errors,
    ).toContain('请至少填写一位“会签人员”。')
    expect(
      validateApprovalStart(variables, { reviewer: '', signers: 'alice\nalice' }, '{}').errors,
    ).toEqual(
      expect.arrayContaining(['请填写“单人审批人”。', '“会签人员”中不能重复填写同一人员。']),
    )
  })

  it('accepts a legacy field with no source and rejects invalid form payloads and key collisions', () => {
    expect(parseBusinessFormValues('[]').error).toBe('业务表单数据必须是 JSON 对象。')
    expect(parseBusinessFormValues('{').error).toBe('业务表单数据必须是有效的 JSON 对象。')
    const duplicateNames = [
      { name: 'reviewer', type: 'String', source: 'start' as const, required: true },
      { name: 'requestId', type: 'String', source: 'start' as const, required: true },
    ]
    expect(
      validateApprovalStart(
        duplicateNames,
        { reviewer: 'alice', requestId: 'R-1' },
        '{"reviewer":"form"}',
      ).errors,
    ).toContain('业务表单数据与审批字段“reviewer”重复，无法安全提交。')
  })
})
