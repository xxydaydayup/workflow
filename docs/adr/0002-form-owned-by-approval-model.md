---
status: accepted
---

# 0002 - 表单归属业务模型，不进 BPMN

表单定义（字段、类型、枚举选项）存储在业务模型/任务模板元数据中，由前端按定义渲染（发起时填写、审批时只读），字段值通过启动变量传给引擎；不编译进 BPMN，`formKey` 与 Camunda Generated Forms 从系统中移除。引擎的职责收缩为"人处理 + 变量 + 流转"。

## Considered Options

- 编译进 BPMN（Generated Forms / formKey）：被拒。表单 schema 演进被引擎绑定，且 Generated Forms 能力贫弱，正是旧设计器表单配置复杂的根源之一。
- 独立表单服务：被拒。调研阶段无多系统共享表单的需求，过度设计。

## Consequences

- 表单是业务数据而非流程定义：表单变更不触动流程定义结构，但删除字段仍受条件分支引用校验约束。
- 前端承担发起页/审批页的表单渲染，后端只需原样透传启动变量（现有 start 接口已支持）。
