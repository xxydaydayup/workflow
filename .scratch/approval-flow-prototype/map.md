# 审批流 MVP 原型

## Notes

- 为尽快验证流程构建交互，复用现有 `/designer` React Flow 页面作为宿主。
- 本轮关注编辑体验和 DTO 映射，不连接真实服务。

## Decisions-so-far

- React Flow 编辑模型与后端 `ProcessDefinitionDTO` 通过显式适配转换，不能互相当成同一结构。证据：本地 issue `01-可视化原型.md` 及分支 `codex/approval-flow-prototype`。

## Fog

- 尚未确认具体 JSON→XML 后端请求/响应格式、鉴权方式和发布接口。
- 后续需基于后端约束确定流程完整性规则与错误反馈。
