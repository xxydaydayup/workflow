# 流程设计器重构勘探与差距分析

Status: 勘探完成

## 范围与结论口径

本次按 `.scratch/dify-refactor/prompt.md` 完成第一步，记录当时的现状和与 Dify 架构的差距，不实施重构。初次勘探时原型未定，故先区分了当前默认设计器与两个开发态变体。随后用户已确认以 `DesignerUiPrototype`（`/designer?variant=prototype-a`）作为最终原型；本文件末尾补充了按该决定收敛后的架构取舍，旧差距列表保留为勘探时的全目录基线。

当前生产路由 `/designer` 挂载 `DesignerPrototype`。开发环境可用 `?variant=prototype-a` 查看 `DesignerUiPrototype`，用 `?variant=generic` 查看 `DesignerPage` 中的 `ProductionDesignerPage`。因此目录内实际有三套画布/模型实现，而不是一个编辑器加几份纯展示代码。

## 问题回答

### 编辑器状态分几块，store 是什么结构？

当前至少有三种互不共享的状态组织方式：

| 编辑器                                     | 流程数据与画布状态                                                                             | 选择、界面及衍生状态                                                                                                   |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `DesignerPrototype`（默认/生产）           | React Flow 的 `useNodesState`、`useEdgesState` 分别保存节点与连线；画布坐标在 node.position 中 | 组件内保存选中节点/连线、检查面板、编译/发布状态、错误和发布结果；检查结果、业务模型 JSON、申请填写步骤由节点/连线派生 |
| `DesignerUiPrototype`（开发原型 A）        | 独立的 React Flow 节点/连线状态；流程名称和标识单独保存                                        | 组件内保存选中项、JSON 弹窗、检查状态；服务地址、会签方式等直接放在 node.data                                          |
| `ProductionDesignerPage`（开发态通用分支） | `ApprovalModel` 用一个 React state 持有；节点位置另存为 `positions`，没有成为业务模型的一部分  | 组件内另存选中项、导出和表单预览状态；校验结果从 model 派生                                                            |

`editorStore.ts` 用全局 Zustand `create` 建立了一个只含 `selectedNodeId`/`setSelectedNodeId` 的 store，但全仓搜索显示它没有消费者；当前三个编辑器都用各自的 React state/React Flow hooks。没有按职责拆分的 slice，没有编辑器 Context 实例，没有画布历史、撤销或重做。项目当前依赖 Zustand `^4.4.3`，未依赖 `zundo`。

Dify 的参照模式是由 `store/workflow/index.ts` 组合多个 slice，使用 vanilla Zustand store 并通过 `WorkflowContext` 为每个工作流实例注入；temporal 仅跟踪选定的历史状态。草稿、工作流数据和历史分别有 slice/边界，React 组件通过 selector 读取。

### 目前有几种节点类型？新增一种节点要改几处？

这取决于观察哪套原型：

- 默认的 `DesignerPrototype` 有 5 种 `ProjectNodeKind`：`start`、`approval`、`condition`、`countersign`、`end`。申请填写和审批共用 `approval` 类型，以 `purpose`/图关系区分。
- `DesignerUiPrototype` 有 6 种：以上类型加 `service`。
- `ProductionDesignerPage` 的审批业务模型有 5 种：`start`、`approval`、`condition`、`cc`、`end`。
- 整个目录的并集是 7 种：`start`、`approval`、`condition`、`countersign`、`end`、`service`、`cc`。这只是原型代码覆盖面，不表示这些种类都已成为产品契约。

当前没有按业务节点拆分的组件注册表：每个画布各有一个 React Flow renderer 类型（`business`、`workflowNode` 或 `approvalNode`），再由同一个 renderer 检查 `data.kind`。在默认画布中，新增类型至少需要考虑：模型类型与业务 DTO 转换、节点标签/说明/节点库、默认构造、画布 renderer 图标/文案、属性面板分支、节点级模型校验和样式；如涉及特殊字段，还要调整节点 data、导出形状及检查结果。部分入口可复用现有通用名称编辑，但职责仍分散在至少 3 个 TS 源文件和样式文件。另两个变体各自重复节点类型、renderer、默认构造、属性配置和 JSON/校验逻辑；若它们在原型定稿后删除，这些重复点不应计入最终节点扩展成本。

Dify 的完整节点边界更明确：`nodes/components.ts` 注册类型到画布组件；`nodes/_base/node.tsx` 统一容器、Handles、运行状态和通用装饰；节点自己的 `node.tsx` 展示差异，`panel.tsx`/`use-config.ts` 配置和修改数据，`default.ts` 提供默认值与 `checkValid`，`types.ts` 定义节点数据。以 if-else 为例，节点按每条条件与 ELSE 分支生成不同 `sourceHandle`；human-input 按 user action 生成分支 Handle。

### 连线规则在哪校验？有无防环？有无撤销重做？

- 默认画布的拖线拦截在 `DesignerPrototype.tsx` 的 `isValidConnection`，作为 prop 交给 React Flow。当前拒绝缺失端点、自连、结束节点出线、开始节点入线和重复的 source-target 对；没有遍历后续节点来拒绝间接成环。
- 默认画布另有 `projectApprovalModel.ts` 的 `validateProjectApprovalFlow`，发布编译前调用。它检查开始/结束数量、节点名称和连线引用、分支语义、特定审批拓扑、从开始可达以及能否到达结束；它没有报告任意有向环。
- 这点必须依业务语义处理：`docs/examples/立项申请.bpmn` 和 ADR-0001 都明确存在审批打回后回到申请填写或先前审批步骤的合法回流。Dify `use-workflow.ts` 的 `isValidConnection` 使用后继遍历拒绝环，不能把这条规则原样套到本审批流；重构需要区分允许的打回回流和不合法循环。
- `DesignerUiPrototype` 没有传 `isValidConnection`；`onConnect` 调用 React Flow `addEdge`，未见本地类型白名单、终点约束或防环校验。其 `checkFlow` 只检查开始/结束是否存在、是否有悬空边及固定服务 URL 格式。
- `ProductionDesignerPage.connect` 只拒绝缺失端点、自连和重复端点对，没有显式调用 React Flow `isValidConnection`，也没有来源/目标类型白名单或防环。更完整的 `validateApprovalModel` 在业务模型层检查开始/结束约束、默认分支、条件规则和图可达性，但没有环检测。
- 三个编辑器均未实现撤销/重做。React Flow state hook 本身不是历史记录。Dify 的撤销/重做基于 `zundo` temporal，并由历史 hook 记录明确的用户操作；它把选择等纯 UI 变化排除在历史之外。

### 节点默认值和校验逻辑如何组织？

- 默认画布的初始示例图在 `DesignerPrototype.tsx` 顶层常量 `initialNodes`/`initialEdges` 中；新增节点的默认名称在 `addNode` 内按 `kind` 与申请填写用途分支生成。除通用名称外，当前这套节点 data 没有节点专属默认配置。
- `DesignerUiPrototype` 也把样例图放在 TSX 常量中；`addNode` 内联填写名称、会签默认 `ALL`，但没有集中节点定义或节点级校验器。固定服务样例值只存在于 initial node；新建 service 没有相同的服务配置初始化。
- `ProductionDesignerPage` 的完整审批业务默认模型集中在 `approvalModel.ts:createInitialApprovalModel`，含示例表单、节点和连线；新增步骤另在 `DesignerPage.tsx:addNode` 的 `Record<ApprovalNodeType, ApprovalNode>` 中重复维护默认值。
- 默认生产路径的发布校验集中在 `projectApprovalModel.ts:validateProjectApprovalFlow`，以图结构为主；审批人或服务类节点的专属校验接口尚不存在。开发态业务模型路径使用 `approvalModel.ts:validateApprovalModel`，覆盖表单、审批人、抄送对象、条件字段、分支和可达性。原型 A 只有页面级结构/URL 检查，没有节点校验结果汇总。
- Dify 把单节点默认值与 `checkValid` 放在同一 `NodeDefault` 定义，检查清单按节点类型解析对应验证器，并把各节点结果汇总为可定位的问题；配置修改由节点自己的 `use-config.ts` 处理。

## 差距清单

| #   | 对照的 Dify 模式                                                                     | 当前差距                                                                                                                                                   | 主要涉及文件                                                                                                                                                                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Store 按 slice 组合，通过 Context 按画布实例创建；temporal 历史只追踪业务编辑状态    | 当前有 3 套彼此独立的本地状态模型；唯一 Zustand store 只有未使用的选中节点字段。没有 slice、编辑器实例隔离或撤销重做                                       | `src/features/designer/editorStore.ts`、`DesignerPrototype.tsx`、`DesignerUiPrototype.tsx`、`DesignerPage.tsx`；依赖配置 `package.json`                                                                                                                                                               |
| 2   | 节点类型注册表 + 通用 BaseNode + 每节点独立配置/类型/默认值/视图                     | 3 个画布都以单一 renderer 加条件分支渲染多种业务类型，节点目录、注册表、共享 Handle/容器基座与专属面板均不存在。节点新增需横跨模型、视图、编辑、校验和样式 | `DesignerPrototype.tsx`、`DesignerUiPrototype.tsx`、`DesignerPage.tsx`、`projectApprovalModel.ts`、`approvalModel.ts`、对应 `.module.less`                                                                                                                                                            |
| 3   | `isValidConnection` 在交互时验证父容器、来源/目标类型及有向环；边界操作由 hooks 封装 | 默认画布只有端点类别、重复和自连限制，没有间接环判定；另外两套缺少等价规则。Dify 的“拒绝所有环”与审批业务允许打回回流冲突，需要采用业务规则而非照抄算法    | `DesignerPrototype.tsx:isValidConnection`、`DesignerPage.tsx:connect`、`DesignerUiPrototype.tsx:onConnect`、`projectApprovalModel.ts:validateProjectApprovalFlow`、`approvalModel.ts:validateApprovalModel`、`docs/examples/立项申请.bpmn`、`docs/adr/0001-approval-model-and-backend-compilation.md` |
| 4   | 节点 `default.ts` 同时声明默认值与 `checkValid`；发布 checklist 逐节点汇总           | 默认样例、单节点新增默认值和校验分散在模型模块与大型 UI 组件中；只有业务模型变体有较细的节点/模型校验，生产主画布没有通用的每节点 `checkValid` 汇总契约    | `approvalModel.ts`、`projectApprovalModel.ts`、`DesignerPrototype.tsx`、`DesignerPage.tsx`、`DesignerUiPrototype.tsx`                                                                                                                                                                                 |
| 5   | 节点配置 hook 封装更新；节点分支变化联动清理对应边                                   | 默认画布主要操作内联在约 1,300 行组件中；删除节点时清理关联边等操作在 UI 中完成。条件分支的连接语义主要由校验器发现，尚未形成专用交互 hook/分支联动边界    | `DesignerPrototype.tsx`、`DesignerPage.tsx`、`DesignerUiPrototype.tsx`、`projectApprovalModel.ts`                                                                                                                                                                                                     |
| 6   | 草稿同步 hook 与画布编辑历史分离                                                     | 当前默认编辑器没有草稿保存/防抖同步；prototype A 只提示修改保存在本页。若产品需要持久化，本地页面状态无法提供同步、冲突或保存状态边界                      | `DesignerPrototype.tsx`、`DesignerUiPrototype.tsx`、`editorStore.ts`                                                                                                                                                                                                                                  |
| 7   | 单一节点 schema 驱动画布、面板、默认值和校验                                         | 当前目录暴露 3 套节点枚举和 DTO/校验语义；例如 `service` 只出现在 UI 原型、`cc` 只在审批模型变体中。原型定稿和节点业务契约是建立注册表前置决策             | `projectApprovalModel.ts`、`approvalModel.ts`、`DesignerPrototype.tsx`、`DesignerUiPrototype.tsx`、`DesignerPage.tsx`、`docs/adr/0001-approval-model-and-backend-compilation.md`                                                                                                                      |

## 领域与架构边界

仓库 ADR-0001 规定前端唯一编辑对象是与 BPMN 解耦的业务模型，流程定义由后端编译生成；设计器不维护立项申请表单 schema、审批人或 Camunda 配置。后续重构需复用 Dify 的 UI/状态/交互组织方式，同时让审批业务 DTO 和打回语义继续遵从本项目的词汇表、ADR 与 BPMN 业务基准。Dify 的任意环过滤只能作为对照实现，不能直接视为本项目正确规则。

勘探读取了根 `AGENTS.md`、`GLOSSARY.md`、领域与 issue-tracker 指引、ADR-0001、立项申请 BPMN、`src/features/designer/` 下的源码/测试，以及 prompt 所列 Dify 参考文件。仓库没有 `.codegraph/`，因此未调用 CodeGraph。没有运行测试或启动界面；本阶段仅作只读勘探并写入本差距分析。执行期间发现的未提交工作区改动均保留。

## 原型确认后的适配结论

最终采用 prototype-a 后，重构范围不再是把三套编辑器合并成一个通用框架，而是把该单画布原型接到正式业务模型与路由，并删除其余过时编辑器。prototype-a 已有六类节点、三栏布局、节点属性面板和业务 JSON 预览；主要缺口是其仍为独立原型数据模型，节点/边/流程状态及检查逻辑集中在一个大型页面中，服务和会签契约尚未进入共享 DTO，正式路由也尚未切换到它。

适合采用 Dify 的职责分离方向：把业务模型与 React Flow 视图数据适配收在少量模块中；以轻量节点定义表集中默认值、展示元数据及可选校验；把编辑操作与通用结构检查从页面 JSX 收拢。节点保持共享 renderer 和统一属性面板即可，不必每种节点新建完整五件套，也不必引入多画布 Context store、复杂 slice 历史、草稿同步、协作、嵌套容器或全量 checklist。撤销重做可在确有产品需要时单独决策。

连线规则需要基于本项目业务语义：显式 `reject` 打回路径可以形成回流；未标记的普通路径不得形成环。这样复用 Dify 将规则放在连接校验入口的做法，但不照抄拒绝所有环的行为。会签 `approveMode` 当前包含 `ALL`、`ANY`、`VOTE`，后端未来提供的动态模式值和 `allowed` 集合必须保持可扩展；`passRate` 遵循 `(0, 1]`，模板期与实例启动期规则按后端元数据执行。

按上述取舍形成的依赖票据见 [通用流程设计器票据地图](../service-node-designer/map.md)。
