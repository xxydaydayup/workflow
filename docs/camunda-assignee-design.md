# Camunda 审批人变量设计规范（后端实施指南）

> 目标：废除 `approval_{随机ID}_assignee` 这类生成式变量名，统一审批人变量契约，让前端永远不需要硬编码任何后端生成的变量名。

## 1. 背景与问题

当前链路：流程设计器画图 → 业务 JSON → 后端生成 Camunda XML（流程模板）。审批节点由后端自动生成，审批人变量形如 `approval_4dvjc_assignee`，流程走到该节点时，前端必须以 `{approval_4dvjc_assignee: xxx}` 传参。

问题：

1. 变量名是前后端之间的**隐形契约**，且值随机，前端无法在开发期得知，只能靠运行时元数据拼字符串。
2. 随机后缀导致联调、排查、日志检索成本高。
3. `${assignee}` 这类统一命名被放弃，纯粹是因为生成器没有更好的槽位机制。

## 2. 前置知识（实施前必须理解）

1. **求值时机**：`camunda:assignee="${xxx}"` 在**任务创建时**求值。变量必须在任务创建前就位——即由"上一个任务的 complete 请求"或"流程发起请求"写入，而不是"流程走到该节点后"再写。
2. **变量作用域**：流程变量默认为**流程实例级（全局）**。多个审批节点读同一个变量会读到同一个值；多实例（会签）中每个实例有独立的局部变量作用域。
3. **`${assignee}` 没有任何引擎特殊地位**，只是官方示例惯例。统一命名没有引擎层面障碍，缺的只是"每份审批人一个独立槽位"的机制。

核心设计思想：**审批人槽位的载体可以从"变量名"换成"map 的 key"或"集合的元素"**。变量名固定，槽位靠数据结构区分，命名即可统一。

## 3. 目标契约总览

三个固定变量名，全平台唯一，前后端硬约定：

| 变量名          | 类型                 | 用途                                | 槽位载体           |
| --------------- | -------------------- | ----------------------------------- | ------------------ |
| `assignee`      | String               | 串行审批链的当前审批人              | 变量本身（覆盖式） |
| `nextApprovers` | `Map<String,String>` | 并行分支的指派表，key = 审批节点 ID | map key            |
| `signers`       | `List<String>`       | 会签节点的人员名单                  | 集合元素           |

场景 → 方案决策表：

| 场景                           | 方案                                         | XML 写法                           |
| ------------------------------ | -------------------------------------------- | ---------------------------------- |
| 串行审批（一次只有一个人审批） | 覆盖式 `${assignee}`                         | `camunda:assignee="${assignee}"`   |
| 并行分支（多个节点同时活跃）   | `nextApprovers` map + TaskListener           | 节点不写 assignee，挂 listener     |
| 会签（多人共审一个节点）       | `signers` 集合 + 多实例                      | `multiInstanceLoopCharacteristics` |
| 发起时预选全程审批人           | 同样用 `nextApprovers` map，发起时一次传全量 | 同并行方案                         |

## 4. 生成器模板

### 4.1 串行审批节点

```xml
<userTask id="approval_1" name="部门审批"
          camunda:assignee="${assignee}" />
```

时序约定：完成任务 A 时随 complete 请求传 `{assignee: "李四"}` → 引擎写入流程变量 → 任务 B 创建时求值 `${assignee}` 得到李四 → 完成任务 B 时传 `{assignee: "王五"}` 覆盖。

流程第一个审批节点的变量由**发起请求**传入。

### 4.2 并行分支节点

节点**不写** `camunda:assignee`，统一挂 create 事件监听器：

```xml
<userTask id="node_b" name="审批B">
  <extensionElements>
    <camunda:taskListener event="create"
      delegateExpression="${nextApproverListener}" />
  </extensionElements>
</userTask>
```

完成任务 A 时一次传多个人的指派表：

```json
{ "nextApprovers": { "node_b": "李四", "node_c": "王五" } }
```

### 4.3 会签节点

使用 Camunda 原生多实例，集合元素作为每个实例的局部变量 `assignee`：

```xml
<userTask id="countersign_1" name="会签"
          camunda:assignee="${assignee}">
  <multiInstanceLoopCharacteristics isSequential="false"
      camunda:collection="${signers}"
      camunda:elementVariable="assignee">
    <completionCondition>${nrOfCompletedInstances == nrOfInstances}</completionCondition>
  </multiInstanceLoopCharacteristics>
</userTask>
```

说明：

- `camunda:elementVariable="assignee"` 把集合元素存为每个实例的**局部变量**，作用域互相隔离，因此所有会签节点都能统一写 `${assignee}`，不冲突。
- `completionCondition` 按设计器里选择的通过规则生成：

| 通过规则 | completionCondition                                                                         |
| -------- | ------------------------------------------------------------------------------------------- |
| 全票通过 | `${nrOfCompletedInstances == nrOfInstances}`                                                |
| 一票通过 | `${nrOfCompletedInstances >= 1}`                                                            |
| 一票否决 | 完成任务时维护计数变量，如 `${vetoCount > 0}`（任务完成回调中检测否决票并 `vetoCount + 1`） |
| 按比例   | `${nrOfCompletedInstances / nrOfInstances >= 0.5}`（阈值由节点配置注入）                    |

走到会签节点前（上一个任务 complete 时）传：`{signers: ["李四", "王五", "赵六"]}`。

## 5. 核心代码：NextApproverListener

```java
@Component("nextApproverListener")
public class NextApproverListener implements TaskListener {

    @Override
    public void notify(DelegateTask delegateTask) {
        Object raw = delegateTask.getExecution().getVariable("nextApprovers");
        if (raw instanceof Map) {
            Object assignee = ((Map<?, ?>) raw).get(delegateTask.getTaskDefinitionKey());
            if (assignee instanceof String && !((String) assignee).isEmpty()) {
                delegateTask.setAssignee((String) assignee);
                return;
            }
        }
        // 兜底策略（二选一，需团队确认）：
        // 1. 强制选人：抛异常，阻止无审批人任务产生（推荐，契约更硬）
        throw new BpmnError("ASSIGNEE_REQUIRED",
                "节点 " + delegateTask.getTaskDefinitionKey() + " 未指派审批人");
        // 2. 留空转候选组：不设置 assignee，由候选人认领（claim）
    }
}
```

要点：

- 从 `nextApprovers` map 中按 **taskDefinitionKey（即节点 ID）** 取值，串行 / 并行 / 发起预选三种场景共用同一实现。
- map 取不到时按团队约定兜底：推荐**抛 BpmnError 强制前端选人**，避免产生无人认领的孤儿任务。
- 该 listener 同时是"发起时预选"的实现载体：发起请求传入完整 map，后续节点创建时依次取值。

## 6. 前后端接口契约

### 6.1 发起流程

```json
POST /process/start
{
  "processKey": "leave_v2",
  "variables": {
    "assignee": "张三",
    "nextApprovers": { "node_manager": "李四" },
    "title": "请假申请"
  }
}
```

- 串行链首节点：传 `assignee`。
- 并行 / 预选全程：传 `nextApprovers`（可一次传全链路）。

### 6.2 完成任务

```json
POST /task/{taskId}/complete
{
  "variables": {
    "assignee": "王五"
  }
}
```

后端将 `variables` 原样透传给 `taskService.complete(taskId, variables)`。**禁止**在该接口做按节点拼接变量名的逻辑——变量名只允许是契约表中的三个固定名。

### 6.3 节点元数据（给前端渲染表单用）

流程定义详情接口为每个审批节点输出元数据：

```json
{
  "nodes": [
    { "nodeId": "node_manager", "assigneeMode": "nextApprover", "selectPolicy": "single" },
    { "nodeId": "node_gm", "assigneeMode": "countersign", "selectPolicy": "multiple" }
  ]
}
```

| 字段           | 取值                                        | 含义                  |
| -------------- | ------------------------------------------- | --------------------- |
| `assigneeMode` | `assignee` / `nextApprover` / `countersign` | 对应三种契约变量      |
| `selectPolicy` | `single` / `multiple`                       | 前端选人控件单选/多选 |

前端依据元数据渲染控件，控件数据最终装配进契约变量，**前端代码中不允许出现任何 `approval_*` 格式的变量名**。

## 7. 退回 / 驳回的变量清理

退回会导致流程重走节点，而契约变量残留旧值，必须在退回操作中清理：

| 变量            | 残留问题                           | 处理                                                                                   |
| --------------- | ---------------------------------- | -------------------------------------------------------------------------------------- |
| `assignee`      | 重走节点直接使用旧审批人           | 退回时 `runtimeService.setVariable(executionId, "assignee", null)`，重走时强制重新指定 |
| `nextApprovers` | 同 key 残留旧值，listener 直接取到 | 退回时移除该变量或覆盖新值                                                             |
| `signers`       | 重走到会签节点复用旧名单           | 业务上确认：允许复用则保留，需重选则清理                                               |

建议将清理逻辑集中在退回接口的统一后置处理中，而不是散落在各业务流程。

## 8. 存量兼容与迁移

1. **运行中实例**：旧实例仍引用 `approval_{nodeId}_assignee` 变量，listener 取不到 map 值时的兜底分支可临时回退读取旧变量（标注 `@Deprecated`，随旧版本流程定义退役后删除）。
2. **按流程定义版本灰度**：新版本流程定义走新契约，旧定义保持原生成逻辑，互不影响。
3. **历史查询**：检查项目中所有按变量名查询的代码（`historyService.createHistoricVariableInstanceQuery().variableName(...)`）、报表和监控，凡引用旧变量名模式的地方需适配。

## 9. 落地检查清单

- [ ] 生成器：串行节点输出 `camunda:assignee="${assignee}"`
- [ ] 生成器：并行分支节点输出 TaskListener 配置，不再生成 `approval_*_assignee`
- [ ] 生成器：会签节点输出 multiInstance + `signers` 集合 + 对应 completionCondition
- [ ] 部署 `NextApproverListener`，确认兜底策略（强制选人 / 候选组）
- [ ] 发起 / 完成接口透传契约变量，移除按节点拼变量名的代码
- [ ] 流程定义接口输出节点元数据（`assigneeMode` / `selectPolicy`），同步给前端
- [ ] 退回 / 驳回接口增加变量清理逻辑
- [ ] 排查历史查询、报表中对旧变量名的引用
- [ ] 与前端联调验证：串行、并行、会签、退回重走、发起预选五条路径
