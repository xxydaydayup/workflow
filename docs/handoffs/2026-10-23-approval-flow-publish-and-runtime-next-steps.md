# 立项审批流程发布与运行时验收续接

## 本次续接目标

继续完成立项审批流程 issue 06 的真实发布验证，并在发布后推进 issue 07 的启动实例验收。开始前先检查后端是否恢复可达，再核对已有模板中的通知任务与部署版本行为。

## 先读这些记录

- [审批流主题地图](../../.scratch/approval-flow-prototype/map.md)：整体决策、issue 状态及阻塞关系。
- [issue 06：编译并发布立项审批流程](../../.scratch/approval-flow-prototype/issues/06-编译并发布立项审批流程.md)：编译/发布实现、已知模板差异和部署侧诊断。
- [issue 07：按启动说明发起审批实例](../../.scratch/approval-flow-prototype/issues/07-按启动说明发起审批实例.md)：发布后的运行时验收范围。
- [project_approval_json 契约](../examples/立项申请/project_approval_json.md) 与 [立项申请 BPMN 业务基准](../examples/立项申请.bpmn)：模型与业务语义。
- [较早的设计器交接](2026-10-22-approval-flow-designer-next-steps.md)：产品方向、已完成的 issue 03–05 和原型实现背景。
- [README](../../README.md)：接口和本地运行说明。

## 当前确认状态

- 用户已确认继续用现有 `/v1/bpmn/json2xml` 作为业务模型转换接口。2026-10-23 真实转换返回 HTTP 200 和可解析 BPMN XML；立项审批的审批结果分支、驳回回流及 ALL 会签结构已核对。
- 设计器业务模型、流程检查、编译和发布交互已实现；issue 02–05 已完成。工作区已有实现及文档改动均未提交，请保留，不要重置或清理。
- 此前只读查询发现 `project-approval` 模板为 v4，可启动且未挂起，含启动人员字段 `apply_assignee`、`minister_assignee`、`managers_approverList`。其 XML 含 `FinishNotify_1` external topic `task_finish`，新编译 XML 未见该任务。
- 2026-10-23 复核时，直连 Swagger、模板查询和 TCP 端口探测均不可达/超时，经本地 Vite 代理查询也超时。仓库没有部署端增强代码；历史部署错误不足以判断当前发布行为。当前不能确认通知任务是否自动补入、运行时是否需要它，或同一 `taskKey` 发布的版本历史处理方式。
- 本轮没有调用发布或启动接口，`project-approval` v4 保持未改动。真实编译成功不等于已部署或运行时验收通过。
- 最近一次文档检查 `git diff --check` 通过；之前实现的 typecheck、lint、37 项测试、build 和浏览器检查结果见上述 issue/旧交接。

## 后端恢复可达后的顺序

1. 只读重试 Swagger 和 `project-approval` 模板查询，记录模板版本、启动字段及 BPMN XML 中的服务任务/通知 topic。不得输出 `.env.local` 中的代理认证信息。
2. 确认 `/task/deployments` 的 XML 增强是否注入 `task_finish`、该任务的运行时依赖，以及部署记录/流程定义的版本语义。仓库没有部署服务实现时，以可核验的 Swagger、后端行为或用户提供的后端说明为依据，不作推测。
3. 若接口行为明确且可安全隔离，优先用独立 `taskKey` 完成真实转换 → 发布 → 模板查询验证。不要在差异未澄清前覆盖 `project-approval`。
4. 发布验收通过后，按 issue 07 和后端返回的启动字段描述验证实例启动、普通审批人与会签人员集合；确认错误反馈与实际字段格式。用户此前已授权继续完成流程发布和后续验收，但需要避免破坏现有共享模板。
5. 更新 issue 06/07 与主题地图中的状态、证据和剩余限制；再运行适当检查并汇报实际验证边界。保留所有当前未提交改动，不创建提交。

## Suggested skills

- `agent-browser`：后端恢复后浏览器验证设计器和真实接口流程；先按技能说明加载 CLI 的 core 用法。
- `diagnosing-bugs`：若部署结果或通知任务行为与预期不符，用诊断流程建立可复现的反馈回路。
- `handoff`：仅在之后还需要把未完成工作转交给另一会话时使用。
