# 服务节点与通用流程设计器

## Notes

- 原型已收敛为正式页面 `/designer`（prototype-a 三栏布局）。实现只借鉴 Dify 的模块职责和注册方式，控制在本项目规模，不复制多画布 store、完整节点五件套、协作或草稿同步系统。
- 本轮优先交付正式设计器：可添加/编辑节点、连接路径、填写当前已纳入范围的节点属性，并预览/下载业务 JSON。浏览器 2026-10-28 实操确认会签顺序、VOTE、比例、提醒属性进入业务 JSON，原分支和坐标保持。后端编译、发布、实例启动、服务 worker 执行及其它票据的端到端验收留待后续。
- 验证：`pnpm typecheck`、`pnpm lint`、`pnpm build` 与 `git diff --check` 通过；`pnpm test` 为 37/40，3 项 `src/api/workflow/index.test.ts` 仍断言旧发布路由和旧 `taskKey` 字段，未改测试文件。
- 服务执行细节和动态地址限制需后端确认；端到端验收依赖可用环境及隔离服务。
- 2026-10-28 最新 `/bpmn/spec` 约定可持续演进，`approveMode` 属于 `nodes[]` 会签节点字段，`allowed` 是字段可接受值元数据（不是参数名）；只有节点未固化模式时，启动请求才用 `{nodeId}_approveMode`，如 `managers_approveMode`。当前编译器仅支持 `ALL`/`ANY`/`VOTE`，第四个动态模式尚未公布。
- `/bpmn/spec` 当前允许 `branch` 标记审批、会签、服务或条件节点出边；条件节点用 branch 时须恰有一个直接审批类上游，否则需 `conditionExpression`。连线属性面板支持直接填写可选表达式，校验按契约保留其优先级。
- 2026-10-28 按用户收窄范围，本轮 `/designer` 仅保留画布编辑、属性面板、结构检查及业务 JSON 预览/下载；暂不从该页面触发编译、发布或实例发起。当前面板支持通用 `form`、approval 的 `assignee`/reminder、countersign 的 `sequential`/`approveMode`/`passRate`/reminder、service 地址/名称及 flow 的 branch/conditionExpression。提醒时长和会签比例留空时可由运行时变量补齐。
- API 路径复核：Swagger 模板、启动、编译仍为 `/api/v1/template`、`/api/v1/task/instances/start`、`/api/v1/bpmn/json2xml`；Swagger 仍漏列 service 字段，以 `/bpmn/spec` 与编译结果作为 service 契约依据。

## Decisions-so-far

- 前端唯一编辑对象是业务模型，后端编译为流程定义；遵从 [ADR-0001](../../docs/adr/0001-approval-model-and-backend-compilation.md)。
- `service` 节点可配置 `serviceName` 与 `serviceUrl`；地址缺失或空白为动态，非空为固定。动态服务地址从模板启动元数据确定变量名和必填规则。
- 流程业务模型保留 `processId`、`processName`、`nodes`、`flows`；连线引用继续为 `source`、`target` 和可选 `branch`。
- 会签 `approveMode`/`passRate` 按 `/bpmn/spec` 作为节点属性提交；模板未固化时，才在启动变量中使用 `{nodeId}_approveMode` / `{nodeId}_passRate`。业务 JSON 契约持续演进，新增节点和属性按产品范围逐步接入。
- 打回的 reject 连线可以回到较早审批节点；普通未标记路径造成的循环由通用流程检查拒绝。
- 采用轻量、局部的模块划分；不引入 Dify 的多上下文 store、复杂节点容器、完整 checklist 或协作/同步能力。
- 使用领域术语“业务模型”“流程定义”“编译”“审批步骤”“条件分支”“打回”。
- 总体规格见 [spec](spec.md)，勘探差距见 [差距分析](../dify-refactor/gap-analysis.md)。

## Issues

- [01 明确服务与会签节点契约](issues/01-明确服务与会签节点契约.md)：确认服务运行契约、动态服务地址及模板期/发起期会签变量规则。
- [02 扩展通用业务模型契约](issues/02-扩展通用业务模型契约.md)：服务节点和可扩展的动态会签字段。
- [03 按业务模型编辑并导出通用流程](issues/03-按业务模型编辑并导出通用流程.md)：用选定的 prototype-a 实现轻量通用编辑和 JSON 导出（本轮主要目标）。
- [04 检查通用流程并定位问题](issues/04-检查通用流程并定位问题.md)：校验通用结构、业务分支、服务和会签配置，并允许打回回流。
- [05 收敛正式流程设计器实现](issues/05-收敛正式流程设计器实现.md)：让 prototype-a 成为唯一正式设计器并清理旧实现。
- [06 按模板契约发起动态节点流程](issues/06-按模板契约发起动态节点流程.md)：按模板元数据收集动态服务地址与会签参数。
- [07 编译发布并验证通用流程](issues/07-编译发布并验证通用流程.md)：后续范围，覆盖真实编译、发布、启动和服务执行验收。

## Dependency graph

```text
01 → 02 → 03 → 04 → 05 → 07
         └───────────────┘
01, 02 → 06 ─────────────────→ 07
```

## Fog

- 2026-10-28 后续复核：Swagger JSON 已可读，模板/启动/编译 API 路径与字段仍一致。`/bpmn/spec` 增加/明确了 service 节点与分支契约；Swagger 节点 schema 仍未同步 service 字段。
- 上述本轮超时期间没有调用发布、启动或删除接口。
- `FOURTH_MODE` 的旧只读编译探测曾返回 HTTP 500；当前 `/bpmn/spec` 明确规定 `approveMode` 只能为 `ALL`/`ANY`/`VOTE`。未来动态模式的值未公布，之后以后端更新的约定为准。
- 本轮 Swagger 路径已确认；服务 worker 行为、固定地址发布行为、动态地址目标策略及隔离测试仍待核实。
- 模板读写、实例启动与编译 API 路径曾按升级前最后可读的 Swagger 核对；2026-10-27 Camunda 升级后的兼容性尚未验证。只读服务节点编译探测通过；两条隔离模板发布/查回曾通过，但本轮因 Swagger 未描述服务字段，没有再次部署。一次动态服务隔离实例被误触发后按业务编号删除，状态为 `FAILED`。它提交的 URL 是本机回环地址，worker 是否实际请求此地址未知；在核查后端日志与网络策略前不再运行该流程。
- Swagger 的模板发布参数未包含 `version`，前端不再上传版本值，由后端维护模板版本。模板只读详情查询成功、旧模板路径返回 404。
- 本轮创建的两条隔离模板业务记录已删除；引擎部署按 API 语义保留。共享 `project-approval` 未覆盖。
