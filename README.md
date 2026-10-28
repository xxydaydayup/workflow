# 流程工作台

基于 React 的流程设计与监控管理台。流程设计器支持节点、连线、节点属性配置、结构检查和业务 JSON 预览/下载。后端编译、模板发布、实例发起及服务执行验收按后续范围逐步完善；固定业务表单由业务系统提供。监控数字、流程和人员仍使用本地演示数据。

`/designer` 是唯一的流程设计器：流程管理员通过开始、审批、会签、服务、条件分支和结束节点表达业务流程。前端将编辑状态映射为 `processId / processName / nodes / flows` 业务模型，可进行结构检查并预览、下载 JSON；当前页面不触发后端编译、模板发布或实例发起。

审批、会签或服务节点可直接在出边标记 `pass` / `reject`；条件节点也可用这两个分支值，但必须恰有一个直接审批、会签或服务节点作为上游，否则后端要求 `conditionExpression`。`reject` 连线的目标决定打回去向。会签完成时机与表决结果是不同规则。当前原型会签按“全员同意通过、任一人驳回立即完成并取消其余待办”的方向实现，仍需在办理闭环与后端运行时验收中确认。

## 环境要求

- Node.js `>=20.19.0`
- pnpm `>=9`

## 开始开发

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

在 `.env.local` 中设置 `API_PROXY_TARGET` 和 `API_PROXY_AUTH=用户名:密码`。
当前后端为 `http://192.168.124.202:9000`；Basic Auth 用户名对应租户 ID。后端于 2026-10-27 升级 Camunda；2026-10-28 重新读取 Swagger 后确认模板、实例启动和编译路径仍与代码一致。详见 [设计器差距记录](.scratch/service-node-designer/map.md)。
修改环境变量后需重启开发服务。`.env.local` 已被 Git 忽略。

浏览器使用 `VITE_API_BASE_URL=/api`，Vite 开发与预览服务将 `/api` 原样代理到后端，
并在服务端注入 Basic Auth。认证信息只放在 `API_PROXY_AUTH`，不使用 `VITE_` 前缀。
生产构建需由部署环境提供同源 `/api` 反向代理与认证；Vite 代理配置不会打包进静态文件。

## JSON 转 BPMN XML

当前设计器仅提供 JSON 预览和下载；编译操作留待后续按需接入。后端编译路径为
`POST /api/v1/bpmn/json2xml`，返回 `data.bpmnXml`。

## 部署任务模板

2026-10-23 的历史验收覆盖了立项审批业务模型编译、独立 taskKey 发布和启动。2026-10-28 重新核对了 Camunda 升级后的 Swagger 路径。当前设计器范围不包含模板发布；共享 `project-approval` v5 未覆盖，后续发布前仍需确定 `task_finish` 通知节点的兼容方案。

模板发布留待后续按需接回设计器；以下接口行为和历史验收记录作为后续实现参考。

## 发起流程实例

工作台保留 **实例发起** 页面作为后续流程：它按模板 `source=start` 元数据收集启动变量；`complete` 变量由办理任务提交，`engine` 变量由后端生成。业务表单值由业务系统提供 JSON，流程设计器不定义表单 schema。会签节点的 `approveMode` 是业务模型 `nodes[]` 属性；节点未固化模式时，启动变量才使用 `{nodeId}_approveMode`，如 `managers_approveMode`。`allowed` 表示该字段当前可接受的值。当前范围不从设计器启动实例。

页面依据模板 `required` 元数据在客户端校验必填字段。当前启动 API 会接受缺少 required 字段的请求，且仓库没有人员目录接口，因此后端字段必填行为与人员标识有效性仍需后端补充验证。

2026-10-20 实际联调中，转换接口成功，部署接口返回 HTTP 400 `ENGINE_ERROR`。
默认审批流程的错误为 `<incoming>` 包含 `flow_4, flow_5`，不符合单个 QName 引用格式；
最小单线路流程的错误为找不到 `FinishNotifyFlow_1`，该引用不存在于转换原文。
这些错误在提交后由后端返回，当前尚未验证通过真实部署；后端需检查部署前的流程增强与 XML 序列化。

## API 服务

`src/utils/request.ts` 保留 `request<T>()` 返回 HTTP 响应体，新增 `requestData<T>()`
处理 Swagger 的 `{ code, message, data }` 信封；`code !== 'OK'` 抛出包含业务码的错误，
HTTP 失败优先保留后端 `message`。

`src/api/bpmn.ts` 提供类型化的 JSON 转 XML 服务。`src/api/workflow/` 按 2026-10-28 重新核对的 Swagger 契约提供
模板部署/查询/删除、实例启动/批量启动/终止/任务树和任务查询/完成/拒绝/重派封装，
支持 `AbortSignal`。这些 API 路径和请求字段已于 2026-10-28 与 Camunda 升级后的 Swagger 复核。启动实例的变量使用普通 JSON；完成任务的变量采用 Camunda
`{ value, type?, valueInfo? }` 格式。部署接口使用 multipart，保留 `display-json`、全局变量等元数据。

业务 API 封装供后续页面按需接入。当前 `/designer` 生成业务 JSON，不调用编译、模板发布或实例启动接口。

## 常用命令

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

初始化约定和暂缓项见 [docs/initialization-plan.md](docs/initialization-plan.md)。

Git hooks 由 Husky 管理。若在当前工作区安装时看到无法写入 .git/config 的提示，请在有仓库配置权限的环境运行 pnpm exec husky，使本地 hooksPath 生效。
