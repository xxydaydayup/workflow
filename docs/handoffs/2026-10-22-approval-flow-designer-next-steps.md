# 立项审批流程设计器后续工作交接

## 下一步目标

issue 02 的真实转换验证和 issue 03–05 的前端实现均已完成。当前接续 issue 06（[编译并发布立项审批流程](../../.scratch/approval-flow-prototype/issues/06-编译并发布立项审批流程.md)）：编译已返回有效 XML 并通过结构/业务语义核对；发布交互已实现，但真实部署需要明确是否更新现有 `project-approval` 任务模板。状态见 [主题地图](../../.scratch/approval-flow-prototype/map.md)。

## 继续前先读

- 工作拆分、阻塞关系及每张任务的验收标准：[主题地图](../../.scratch/approval-flow-prototype/map.md)、[issue 03](../../.scratch/approval-flow-prototype/issues/03-对齐业务模型契约.md)、[issue 04](../../.scratch/approval-flow-prototype/issues/04-实现三栏流程设计器.md)、[issue 05](../../.scratch/approval-flow-prototype/issues/05-检查审批路径并定位问题.md)、[issue 06](../../.scratch/approval-flow-prototype/issues/06-编译并发布立项审批流程.md)、[issue 07](../../.scratch/approval-flow-prototype/issues/07-按启动说明发起审批实例.md)。
- 已确认的业务模型契约：[project_approval_json](../examples/立项申请/project_approval_json.md)。
- 现行架构边界：[ADR-0001：业务模型层与后端编译](../adr/0001-approval-model-and-backend-compilation.md)；当前术语定义：[GLOSSARY](../../GLOSSARY.md)。
- 业务行为基准：[立项申请 BPMN](../examples/立项申请.bpmn)。出现歧义时遵循用户确认的立项审批业务语义，不从 Camunda 技术配置推断业务行为。
- 当前原型实现位于 [DesignerPrototype.tsx](../../src/features/designer/DesignerPrototype.tsx)、[DesignerPrototype.module.less](../../src/features/designer/DesignerPrototype.module.less) 和 [projectApprovalModel.ts](../../src/features/designer/projectApprovalModel.ts)，通过 `/designer?variant=canvas` 查看。

## 已确认的产品方向

- 采用流程设计器常见的三栏布局：左侧是美观、业务化的节点库；中间画布支持从节点库拖入节点、移动节点、创建及调整连线；右侧在选中节点或连线时显示属性面板；完成后可以检查流程。
- 前端编辑业务模型并通过适配层生成后端接受的 project_approval_json。设计者不暴露 BPMN、Camunda 变量、EL 或引擎配置；审批人员在设计期不配置。
- 表单字段由业务系统固定提供，不在流程设计器中设计；会签规则按后端约定固定。当前实例启动所需审批人员字段描述由后端针对已发布流程提供，调用方在启动时按描述提交后端认可的人员标识。
- 审批结果按审批步骤后的结果分支表达；打回回到申请填写步骤，并按业务流程重新经过后续审批。前端检查提供及时反馈，后端在编译或发布时做最终校验。
- 当前没有草稿保存接口；设计期编辑可先只保存在页面内。用户确认现有 `/v1/bpmn/json2xml` 作为业务模型转换接口；前端直接传业务模型，编译和流程发布分开处理。

## 已完成：issue 03–05

issue 03 已对齐 `project_approval_json`：节点类型为 `start`、`approval`、`condition`、`countersign`、`end`；会签使用独立 `countersign` 类型和固定 `approveMode: ALL`。申请填写节点按完整图中的审批驳回目标识别，未完成时临时使用开始节点后的首个审批节点推断，不加入用途字段或固定节点 ID 依赖。契约和示例见[文档](../examples/立项申请/project_approval_json.md)。

issue 04 已实现三栏 React Flow 原型、业务模型 JSON 预览和下载。验证通过：34 项测试、类型检查、lint、生产构建；浏览器确认默认流程检查通过，模型 JSON 不含用途字段，节点属性和连线属性可用。构建会提示 JS bundle 超过 500 KB。

issue 05 已完成流程检查与问题定位：错误项带可读的节点或连线位置；点击后选择对应元素并适配画布。结构检查覆盖必需节点、节点名称、拓扑、分支路径、申请回流、起点入口和 ALL 会签；36 项测试、类型检查、lint、构建与浏览器验证通过。2026-10-23 新增启动变量元数据筛选测试后，全套测试为 37 项。

2026-10-23 用户确认现有 `/v1/bpmn/json2xml` 作为业务模型转换接口。真实调用 POST `/api/v1/bpmn/json2xml` 返回 HTTP 200 和可解析 BPMN XML；核对到 7 个流程节点、8 条流转、审批通过/驳回路径及 `${managers_approverList}` / `${managers_decided}` 会签结构。早先的 HTTP 500 已被本次成功复测取代。
模板变量 `source` / `required` 已按 Swagger 补齐前端类型；启动字段筛选仅包括 `source=start`，`complete` 在办理任务时传，`engine` 由后端生成，旧字段缺少 source 时兼容为启动字段。编译、查看结果、发布交互已实现；发布操作尚未执行。此前只读查询发现当前 `project-approval` 模板为 v4、可启动且未挂起，并含后端约定的三个启动人员字段。v4 XML 另有 `FinishNotify_1` external topic `task_finish`，新编译 XML 没有。本次复核直连后端和 Vite 代理请求均超时；仓库没有部署增强实现，暂时不能确认发布端会否补入该任务或其运行时要求。未调用发布接口，v4 保持不变。

## Ticket 顺序

2026-10-23 部署复核：此前只读查询发现 project-approval v4 含 FinishNotify_1 external topic task_finish，而新编译 XML 不含该任务。本轮直连后端和 Vite 代理请求均超时，TCP 端口探测失败；仓库没有部署端增强实现，无法确认发布端是否自动补入通知任务、该任务的运行依赖或版本历史行为。未调用发布接口，现有 v4 保持不变。后端恢复可达后先只读确认，再优先用独立 taskKey 验证；不要把编译成功说成已发布或运行时验收通过。

1. 03 对齐业务模型契约：已完成。
2. 04 实现三栏流程设计器：已完成。
3. 05 检查审批路径并定位问题：已完成。
4. 02 立项模型编译契约：已完成；现有 `/v1/bpmn/json2xml` 真实转换成功，返回 XML 与立项审批语义符合。
5. 06 编译并发布：编译和前端发布交互完成，真实 XML 已检查；尚未部署新版本。现有 v4 的 `task_finish` 外部通知任务不在新 XML 中；后端网络不可达且仓库无部署实现，恢复后需先确认发布增强、通知任务及版本历史行为，再决定发布方式。不得在差异未确认前覆盖 `project-approval`。
6. 07 按启动说明发起实例：依赖 06。

## 工作区注意事项

- 工作分支为 codex/designer-ui-prototype。此前提交 91791b3 提供了三栏画布原型基础；本地未提交改动已将其对齐立项业务模型契约。
- 工作区保留本任务开始前已有的本地变更：`docs/adr/0002-form-owned-by-approval-model.md` 删除、`eslint.config.js` 修改，以及未跟踪的 issues 03–07、`docs/examples/立项申请/` 和本交接文档。不要重置或清理。
- docs/adr/0002-form-owned-by-approval-model.md 当前在工作区显示为删除；继续工作时先确认它与已同意的表单固定方案是否冲突，再决定如何更新，不要因缺失文件直接恢复旧决策。
- 本任务已修改原型代码与跟踪文档，尚未提交。保留此前已有的 ADR-0002 删除、eslint 配置和其他未跟踪 ticket/示例文件。

## 后续可用技能

- `react-flow-implementation`：如需扩展连线、定位和画布交互。
- `code-review`：完成后续实现切片后，对照 ticket 验收范围审查改动。

下一步需在后端 `192.168.124.202:9000` 可达后，查询 Swagger 与模板并确认部署增强是否会补入 `task_finish`、该任务的运行时依赖及同一 taskKey 的版本历史行为。后端当前不可达，不能把编译成功说成已发布或运行时验收通过。恢复后优先用独立 taskKey 验证发布，再按返回的启动字段说明执行 issue 07；只有独立验证证明不会破坏既有通知约定，才讨论更新 `project-approval`。
