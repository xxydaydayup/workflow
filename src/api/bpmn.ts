import { requestData } from '@/utils/request'
import type { ProjectApprovalModel } from './projectApprovalModel'

export interface BpmnXMLResult {
  bpmnXml: string
}

/**
 * The backend currently exposes this as BPMN JSON conversion. The approved
 * product contract treats the endpoint as the project approval model compiler.
 */
export async function compileProjectApprovalModel(
  definition: ProjectApprovalModel,
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

export { compileProjectApprovalModel as convertBpmnToXml }
