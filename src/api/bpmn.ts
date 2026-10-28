import { requestData } from '@/utils/request'
import type { WorkflowModel } from './workflowModel'

export interface BpmnXMLResult {
  bpmnXml: string
}

/** Compile a business workflow model through the backend's BPMN JSON endpoint. */
export async function compileWorkflowModel(
  definition: WorkflowModel,
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

/** @deprecated Use compileWorkflowModel for all workflow models. */
export const compileProjectApprovalModel = compileWorkflowModel
export const convertBpmnToXml = compileWorkflowModel
