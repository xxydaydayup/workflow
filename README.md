# 流程工作台

基于 React 的流程设计与监控管理台。流程设计器支持节点、连线、会签和审批路径配置，并调用后端生成 BPMN XML、发布任务模板以验证部署结果；固定业务表单由业务系统提供。监控数字、流程和人员仍使用本地演示数据。

默认 `/designer` 使用立项审批业务模型设计器：管理员通过业务节点和连线表达流程，前端提交业务模型，由后端编译为 Camunda 流程定义。旧通用设计器暂留作对照，仅开发环境可通过 `/designer?variant=generic` 访问。

审批或会签节点的驳回去向由条件分支的 `reject` 连线指定；目标是流程重新开始办理的步骤，可以是申请填写或前序审批。会签完成时机与表决结果是不同规则。当前原型会签按“全员同意通过、任一人驳回立即完成并取消其余待办”的方向实现，仍需在办理闭环与后端运行时验收中确认。

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
当前后端为 `http://192.168.124.202:9000`；Basic Auth 用户名对应租户 ID。
修改环境变量后需重启开发服务。`.env.local` 已被 Git 忽略。

浏览器使用 `VITE_API_BASE_URL=/api`，Vite 开发与预览服务将 `/api` 原样代理到后端，
并在服务端注入 Basic Auth。认证信息只放在 `API_PROXY_AUTH`，不使用 `VITE_` 前缀。
生产构建需由部署环境提供同源 `/api` 反向代理与认证；Vite 代理配置不会打包进静态文件。

## JSON 转 BPMN XML

在流程设计页面点击 **转为 XML**，使用打开面板时的流程快照调用
`POST /api/v1/bpmn/json2xml`，展示后端返回的 `data.bpmnXml`。
也可以从 **生成请求 JSON** 打开面板，再切换至 **BPMN XML**。

- **请求 JSON** 展示 `processId / processName / nodes / flows`，描述审批步骤、会签和路径条件；固定业务表单由业务系统提供。
- **复制 XML** 将返回的 XML 原文复制到剪贴板；局域网 HTTP 下尝试使用浏览器复制命令，失败时可在文本框手动选择复制。
- **下载 .bpmn** 保存为 `<processId>.bpmn`，可导入目标系统。
- 转换中显示加载状态，关闭面板会取消请求；失败时显示后端原因并支持重试。
- 本地配置检查失败时阻止转换，仍保留 JSON 查看与复制，便于排查。

接口转换成功不等于目标系统部署成功。XML 保留后端返回原文，
目标系统的引擎版本、表达式依赖、表单与监听器实现、可执行性等仍需实际验证。
当前联调后端返回的 `<process>` 未声明 `isExecutable="true"`；如果目标系统要求可执行流程，
需由后端转换器补齐该属性，或在目标系统验证时处理。

## 部署任务模板

2026-10-23，立项审批业务模型真实编译、独立 taskKey 发布及启动验收已完成。Swagger 确认同一 `(tenant, taskKey)` 的业务模板当前记录会被覆盖；独立验收验证了 v1→v2 和旧实例绑定旧流程定义。共享 `project-approval` v5 未覆盖；它含 `task_finish` 外部任务，而新编译 XML 不含此节点，后续发布前仍需确定通知兼容方案。

在流程设计页面点击 **部署任务模板**，自动将当前 JSON 转为 XML；也可在 XML 页签中点击
**部署任务模板**。检查流程标识、发布名称和待部署 XML，然后点击 **确认部署**。

通过 `POST /api/v1/task/deployments` 以 multipart 上传 XML 和 `display-json` 流程快照，
后端同时部署流程并保存任务模板。相同租户与流程标识的重复发布会更新已有模板。
提交的 XML 与预览、复制、下载的内容一致；前端不会自动补写流程属性或移除图形信息。

- 成功时展示后端的模板版本、部署 ID、流程定义 ID 和可发起状态，页面标记为已部署。修改流程后标记为有未部署修改。
- 部署期间阻止重复提交和关闭面板；失败保留 XML 和后端错误，支持修正后重新打开转换或重试部署。
- 超时、断网、服务端错误或返回信息缺失时，显示结果尚未确认，支持按流程标识查询当前模板；核对后才能重试。查询到的模板可能是旧版本，不会直接视为本次部署成功。
- 部署成功仅表示引擎接受定义并返回模板；流程启动、变量求值、表单与监听器执行需另行验证。

## 发起立项审批

工作台的 **发起审批** 入口演示按已发布模板启动立项流程：页面读取模板返回的 `source=start` 字段说明，按字段类型收集单人审批标识或会签人员集合；`complete` 变量留到任务办理时提交，`engine` 变量由后端生成。业务系统提供固定立项申请表单和值，并以 JSON 对象传入；流程设计器不定义这些表单字段。

页面依据模板 `required` 元数据在客户端校验必填字段。当前启动 API 会接受缺少 required 字段的请求，且仓库没有人员目录接口，因此后端字段必填行为与人员标识有效性仍需后端补充验证。

2026-10-20 实际联调中，转换接口成功，部署接口返回 HTTP 400 `ENGINE_ERROR`。
默认审批流程的错误为 `<incoming>` 包含 `flow_4, flow_5`，不符合单个 QName 引用格式；
最小单线路流程的错误为找不到 `FinishNotifyFlow_1`，该引用不存在于转换原文。
这些错误在提交后由后端返回，当前尚未验证通过真实部署；后端需检查部署前的流程增强与 XML 序列化。

## API 服务

`src/utils/request.ts` 保留 `request<T>()` 返回 HTTP 响应体，新增 `requestData<T>()`
处理 Swagger 的 `{ code, message, data }` 信封；`code !== 'OK'` 抛出包含业务码的错误，
HTTP 失败优先保留后端 `message`。

`src/api/bpmn.ts` 提供类型化的 JSON 转 XML 服务。`src/api/workflow/` 按 Swagger 提供
模板部署/查询/删除、实例启动/批量启动/终止/任务树和任务查询/完成/拒绝/重派封装，
支持 `AbortSignal`。启动实例的变量使用普通 JSON；完成任务的变量采用 Camunda
`{ value, type?, valueInfo? }` 格式。部署接口使用 multipart，保留 `display-json`、全局变量等元数据。

当前页面调用转换、模板部署及部署结果核对接口；其余业务 API 封装供后续页面接入。

## 常用命令

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

初始化约定和暂缓项见 [docs/initialization-plan.md](docs/initialization-plan.md)。

Git hooks 由 Husky 管理。若在当前工作区安装时看到无法写入 .git/config 的提示，请在有仓库配置权限的环境运行 pnpm exec husky，使本地 hooksPath 生效。
