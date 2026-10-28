# 任务：参照 Dify 工作流编辑器的架构，重构本项目的流程设计器

## 背景

本项目的流程设计器在 `src/features/designer/`，基于 React Flow 实现审批流设计器。目前节点渲染、面板配置、状态管理集中在大文件中（DesignerPrototype.tsx、DesignerUiPrototype.tsx、editorStore.ts），节点类型增多后会难以维护。

Dify 的前端工作流编辑器是同类系统的成熟实现，源码在本机可直接读取：
`d:\Code\github.com\langgenius\dify\web\app\components\workflow\`
下文所有相对路径均基于此前缀。先读真源码理解模式，再动手改本项目。

## 参考地图（按主题阅读 Dify 源码）

1. **状态管理 slice 模式**
   - `store/workflow/index.ts` — 单 store 按 slice 组合，经 Context 分发（支持多画布），zundo temporal 实现撤销重做
   - `store/workflow/workflow-draft-slice.ts` — nodes/edges/viewport 草稿切片的典型结构
2. **节点五件套范式**
   - `nodes/components.ts` — 节点类型 → 组件的注册表
   - `nodes/_base/node.tsx` 与 `nodes/_base/components/` — 通用基座：容器、Handle、缩放、状态边框、next-step，业务节点只写差异
   - `nodes/if-else/`（node.tsx / panel.tsx / default.ts / types.ts / use-config.ts）— 五件套完整范例
   - `nodes/human-input/` — 审批类节点范例：为每个 user_action 动态生成 sourceHandle 分支
3. **交互 hooks 化**
   - `hooks/use-workflow.ts`（约 L360-400）— isValidConnection：同父容器校验、类型白名单、hasCycle 防环
   - `hooks/use-nodes-interactions.ts` — 节点增删改、复制粘贴
   - `hooks/use-edges-interactions.ts`（约 L73-118）— 按分支删除边的联动逻辑
4. **保存与发布校验**
   - `hooks/use-nodes-sync-draft.ts` — 变更防抖同步
   - `hooks/use-checklist.ts` — 发布前汇总各节点 checkValid 结果

## 执行流程

### 第一步：勘探与差距分析

阅读本项目 AGENTS.md、GLOSSARY.md、`src/features/designer/` 全部源码，回答：

- 编辑器状态分几块？store 是什么结构？
- 目前有几种节点类型？新增一种节点要改几处？
- 连线规则在哪校验？有无防环？有无撤销重做？
- 节点默认值和校验逻辑如何组织？

产出一份差距清单：每条对照上述 Dify 模式，标注差距和涉及的文件。

### 第二步：制定分阶段改造计划

按价值排序拆为独立可验收的阶段，每阶段一个 commit 粒度，至少覆盖：

1. store slice 化（拆分 editorStore + 接入撤销重做）
2. 节点五件套目录结构与注册表迁移
3. 交互逻辑 hooks 化 + isValidConnection（含防环）
4. 节点默认值工厂 + checkValid 发布校验

计划文件保存到 `.scratch/`，沿用本项目现有的 issue 驱动格式。计划完成后先向我确认再执行。

### 第三步：逐阶段执行

- 每个阶段：先补/改测试 → 重构 → 测试全绿 → 进入下一阶段
- 业务模型编译层（approvalModel、projectApprovalModel、bpmn.ts、templateDeployment）保持现状，本次只重构 UI 与交互层的数据流
- 遵循 AGENTS.md 的代码与提交规范

## 硬约束

- 渐进式：任何时刻项目测试命令全绿，现有 UI 行为零回归
- 依赖以本项目 package.json 现状为准；引入新依赖（如 zundo）需在计划中单独论证
- 借鉴的是架构模式，保持本项目自己的命名与领域术语（对照 GLOSSARY.md）

## 完成标准

- 差距清单、分阶段计划、各阶段实现与测试全部完成
- 新增一种节点类型 = 新建一个五件套目录 + 注册表加一行
- 撤销/重做可用；连线校验含防环；节点校验可汇总展示
