import { requestData } from '@/utils/request'

export type BpmnNodeType = 'startEvent' | 'userTask' | 'exclusiveGateway' | 'endEvent'
export type BpmnFormFieldType = 'string' | 'long' | 'boolean' | 'date' | 'enum'
export type BpmnFormFieldValue = { id: string; name?: string }
export type BpmnFormFieldConstraint = {
  name: 'required' | 'readonly' | 'minlength' | 'maxlength'
  config?: string
}
export interface BpmnFormField {
  id: string
  label?: string
  type: BpmnFormFieldType
  defaultValue?: string
  datePattern?: string
  values?: BpmnFormFieldValue[]
  constraints?: BpmnFormFieldConstraint[]
}
export interface BpmnMultiInstance {
  enable: boolean
  sequential?: boolean
  collection?: string
  elementVariable?: string
  completionCondition?: string
}
export interface BpmnTaskListener {
  event: 'create' | 'assignment' | 'complete' | 'delete'
  type: 'class' | 'expression' | 'delegateExpression'
  value: string
}
export interface BpmnJSONNode {
  id: string
  type: BpmnNodeType
  name: string
  x: number
  y: number
  width?: number
  height?: number
  assignee?: string
  formKey?: string
  multiInstance?: BpmnMultiInstance
  taskListeners?: BpmnTaskListener[]
  formFields?: BpmnFormField[]
}
export interface BpmnJSONFlow {
  id: string
  source: string
  target: string
  conditionExpression?: string
}
export interface BpmnJSONRequest {
  processId: string
  processName: string
  nodes: BpmnJSONNode[]
  flows: BpmnJSONFlow[]
}
export interface BpmnXMLResult {
  bpmnXml: string
}

export async function convertBpmnToXml(
  definition: BpmnJSONRequest,
  signal?: AbortSignal,
): Promise<string> {
  const result = await requestData<BpmnXMLResult>({
    method: 'POST',
    url: '/v1/bpmn/json2xml',
    data: definition,
    signal,
  })
  if (typeof result?.bpmnXml !== 'string' || !result.bpmnXml.trim()) {
    throw new Error('后端未返回有效的 BPMN XML，请重试或检查转换接口')
  }
  return result.bpmnXml
}
