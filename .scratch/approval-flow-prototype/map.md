# 审批流 MVP 原型

## Notes

- 为尽快验证流程构建交互，复用现有 `/designer` React Flow 页面作为宿主。
- 本轮关注编辑体验和 DTO 映射，不连接真实服务。
- 2026-10-20 grilling 会话（grill-with-docs）完成设计收敛：结论是旧思路"换画布"未触及病灶，病灶在概念层；已确立业务模型 + 后端编译架构。

## Decisions-so-far

- React Flow 编辑模型与后端 `ProcessDefinitionDTO` 通过显式适配转换，不能互相当成同一结构。证据：本地 issue `01-可视化原型.md` 及分支 `codex/approval-flow-prototype`。
- 前端唯一编辑对象是与 BPMN 解耦的业务模型；业务模型到流程定义的编译在后端完成；表达力收缩为枚举化审批模式。见 [ADR-0001](../../docs/adr/0001-approval-model-and-backend-compilation.md)。
- 表单定义归属业务模型，由前端渲染，字段值走启动变量；formKey / Generated Forms 移除。见 [ADR-0002](../../docs/adr/0002-form-owned-by-approval-model.md)。
- 第一版审批模式：发起、审批（单人/会签/或签）、条件分支、抄送、结束。并行分支、子流程、超时、加签、转交不进第一版。
- 打回语义：拒绝即打回发起人，重新提交后回到打回它的节点（运行时跳转，非静态回边）。
- 审批人第一版：指定成员（手输人名）+ 发起人自选；`leader` / `role` 为 schema 预留，等组织架构 API（当前后端无此 API）。
- 变量唯一来源是表单字段；条件 = 字段 + 运算符 + 值，仅 AND 组合，条件分支必有默认分支。
- 部署改一步式接口（业务模型 JSON 进，编译+部署+落库出）；旧 `json2xml` 路径废弃，其 `<incoming>` bug 不修。
- 实施切新分支进行；垂直切片先行——硬编码业务模型 JSON 验证后端编译器，见 issue `02-业务模型编译契约.md`。
- 监控页第一版不动。
- 验收主场景：HR 无 BPMN 知识独立配置请假流程（≤3 天主管审批，>3 天主管 + HR 会签）并发布成功。

## Fog

- 后端编译器的可实现性：会签（多实例）打回的 activity instance 跳转、抄送 serviceTask 实现方式——待与后端按 issue 02 契约对齐。
- 业务模型层校验规则待定：条件引用的字段存在性、审批人非空、图连通性、默认分支唯一性。
- 前端人名输入与未来组织架构 userId 的映射升级路径（编译器单点替换，无需 schema 变更，待验证）。
