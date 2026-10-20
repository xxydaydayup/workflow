# JSON 转 XML 后发布任务模板失败

Type: bug
Status: 待分流

## 问题

2026-10-20，使用 Swagger 定义的 `POST /api/v1/bpmn/json2xml` 转换成功，随后将返回的
XML 原文通过 multipart 上传到 `POST /api/v1/task/deployments`，返回 HTTP 400、
`code=ENGINE_ERROR`。鉴权沿用本地 `.env.local` 的服务端代理配置。

## 复现

1. 在 `/designer` 保留默认的六节点审批流程，将流程标识改为独立测试标识。
2. 点击“部署任务模板”，等待转换成功，检查 XML。
3. 点击“确认部署”。

返回错误片段：

```text
ENGINE-09005 Could not parse BPMN process. Errors:
* cvc-datatype-valid.1.2.1: 'flow_4, flow_5' 不是 'QName' 的有效值。
* cvc-type.3.1.3: 元素 'incoming' 的值 'flow_4, flow_5' 无效。
```

默认流程有两条连线 `flow_4`、`flow_5` 进入结束节点。转换接口的原始 XML 不包含
`incoming` 元素，该错误在部署阶段出现。应检查部署增强后是否将多个引用合并为逗号字符串；
标准 BPMN 需要多个独立的 `<incoming>` 元素。

## 最小单线路复现

转换以下 JSON，将 `data.bpmnXml` 原样作为 `.bpmn` 文件发布：

```json
{
  "processId": "workflow_deploy_probe_<unique_suffix>",
  "processName": "JSON 转 XML 部署验证",
  "nodes": [
    { "id": "start", "type": "startEvent", "name": "开始", "x": 100, "y": 100 },
    { "id": "approve", "type": "userTask", "name": "审批", "x": 260, "y": 100, "assignee": "demo" },
    { "id": "end", "type": "endEvent", "name": "结束", "x": 460, "y": 100 }
  ],
  "flows": [
    { "id": "flow_start", "source": "start", "target": "approve" },
    { "id": "flow_end", "source": "approve", "target": "end" }
  ]
}
```

将 `<unique_suffix>` 替换为字母数字后缀。部署返回：

```text
Invalid reference in 'bpmnElement' attribute, sequenceFlow FinishNotifyFlow_1not found
```

转换原文中没有 `FinishNotifyFlow_1`，说明需核对后端部署时对通知任务/连线的处理。
诊断用 XML 补上 `isExecutable="true"` 及命名空间正确的
`camunda:historyTimeToLive="30"` 后，仍然出现通知节点和连线引用缺失，
故补属性不足以解决本次错误。前端产品未应用该诊断修改。

## 验收方向

- 默认审批流程与最小流程均可通过转换 → 发布，返回有效部署 ID、流程定义 ID。
- 部署增强后所有 `bpmnElement` 均指向存在的模型元素。
- 多条入线使用独立引用元素。
- 转换器按目标引擎需求生成可执行流程与历史保留配置。

## Comments

前端已接入部署与模板查询，保留转换 XML 原文并展示后端错误。成功页面、请求中锁定、
异常结果核对使用浏览器模拟响应验证；真实引擎尚未通过部署。
