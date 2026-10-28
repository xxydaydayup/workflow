import type { TaskTemplateVariable } from '@/api/workflow'

export type StartupFieldValues = Record<string, string>

export interface ApprovalStartValidationResult {
  variables?: Record<string, unknown>
  errors: string[]
}

export function parseBusinessFormValues(input: string): {
  values?: Record<string, unknown>
  error?: string
} {
  let parsed: unknown
  try {
    parsed = JSON.parse(input)
  } catch {
    return { error: '业务表单数据必须是有效的 JSON 对象。' }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { error: '业务表单数据必须是 JSON 对象。' }
  }

  return { values: parsed as Record<string, unknown> }
}

function parseStartupField(variable: TaskTemplateVariable, rawValue: string): unknown {
  const value = rawValue.trim()
  const type = variable.type.toLowerCase()
  if (['array', 'list', 'collection'].includes(type) || type.endsWith('[]')) {
    return value
      .split(/[\n,，]/)
      .map((entry) => entry.trim())
      .filter(Boolean)
  }

  if (type === 'boolean') {
    if (!value) return undefined
    if (value.toLowerCase() === 'true') return true
    if (value.toLowerCase() === 'false') return false
    return Number.NaN
  }
  if (['integer', 'long', 'double', 'number'].includes(type)) {
    if (!value) return undefined
    const number = Number(value)
    return Number.isFinite(number) ? number : Number.NaN
  }

  if (['object', 'json'].includes(variable.type.toLowerCase())) {
    if (!value) return undefined
    try {
      return JSON.parse(value) as unknown
    } catch {
      return Number.NaN
    }
  }

  return value || undefined
}

function validateMetadataConstraints(
  variable: TaskTemplateVariable,
  value: unknown,
): string | undefined {
  if (typeof value === 'string' && variable.allowed?.length && !variable.allowed.includes(value)) {
    return '“' + (variable.description?.trim() || variable.name) + '”不在模板允许范围内。'
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (variable.minimum !== undefined) {
      const invalid = variable.exclusiveMinimum
        ? value <= variable.minimum
        : value < variable.minimum
      if (invalid) return '“' + (variable.description?.trim() || variable.name) + '”低于允许范围。'
    }
    if (variable.maximum !== undefined && value > variable.maximum) {
      return '“' + (variable.description?.trim() || variable.name) + '”超过允许范围。'
    }
  }
  return undefined
}

export function validateApprovalStart(
  startVariables: TaskTemplateVariable[],
  fieldValues: StartupFieldValues,
  businessFormInput: string,
): ApprovalStartValidationResult {
  const errors: string[] = []
  const form = parseBusinessFormValues(businessFormInput)
  if (form.error) errors.push(form.error)

  const variables: Record<string, unknown> = { ...(form.values || {}) }
  for (const variable of startVariables.filter(
    (candidate) => !candidate.source || candidate.source === 'start',
  )) {
    const parsed = parseStartupField(variable, fieldValues[variable.name] || '')
    const label = variable.description?.trim() || variable.name

    if (parsed === undefined) {
      if (variable.required) errors.push('请填写“' + label + '”。')
      continue
    }
    if (typeof parsed === 'number' && Number.isNaN(parsed)) {
      errors.push('“' + label + '”的格式不正确。')
      continue
    }
    if (Array.isArray(parsed) && parsed.length === 0) {
      if (variable.required) errors.push('请至少填写一位“' + label + '”。')
      continue
    }
    if (Array.isArray(parsed) && new Set(parsed).size !== parsed.length) {
      errors.push('“' + label + '”中不能重复填写同一人员。')
      continue
    }
    const constraintError = validateMetadataConstraints(variable, parsed)
    if (constraintError) {
      errors.push(constraintError)
      continue
    }
    if (Object.hasOwn(variables, variable.name)) {
      errors.push('业务表单数据与审批字段“' + variable.name + '”重复，无法安全提交。')
      continue
    }
    variables[variable.name] = parsed
  }

  return errors.length > 0 ? { errors } : { variables, errors }
}
