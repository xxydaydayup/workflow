# 立项审批业务模型契约

本文记录流程设计器提交给后端的 `project_approval_json`。契约采用后端提供的立项样例结构，并按已确认方向把会签作为独立节点类型；它是业务流程描述，不含 Camunda 变量名、表单 schema 或引擎配置。

## 顶层结构

| 字段          | 含义                                               |
| ------------- | -------------------------------------------------- |
| `processId`   | 流程业务标识；立项审批为 `project-approval`。      |
| `processName` | 流程显示名称。                                     |
| `nodes`       | 节点集合，包含节点标识、类型、名称和画布坐标。     |
| `flows`       | 有向连线集合，引用起止节点，并可标注审批结果分支。 |

节点 `id` 在流程内唯一，节点移动或编辑名称时保持不变。`x`、`y` 仅供画布布局使用。当前节点类型为：`start`、`approval`、`condition`、`countersign`、`end`。会签节点使用 `countersign`，其 `approveMode` 固定为 `ALL`；不提供配置入口。普通 `approval` 节点和会签节点保持区分。

`flows` 使用 `source` 和 `target` 引用节点。普通流转不设置 `branch`；条件分支路径使用 `pass` 或 `reject`。`condition` 节点负责表达审批结果分叉；驳回路径的 `target` 就是重新开始后续流程的步骤，因此可返回申请填写、前序审批或其他合法步骤。示例将驳回目标连回申请填写步骤；重新提交后沿现有流程图继续。连线标识不是当前后端样例的一部分。

申请填写步骤同样以 approval 表示，由拓扑识别：开始节点直接连接的首个 approval 是申请填写步骤。驳回路径可以连接任意合法的审批或会签步骤，并从该步骤继续；无需所有驳回路径都返回申请填写步骤。审批决定节点连接到结果 condition 节点。无需依赖固定节点 ID。

流程设计不配置审批人。后端按已发布流程返回启动所需的人员字段说明，启动调用方按说明传入后端认可的人员标识。固定的立项申请表单由业务系统提供，不包含在流程设计 DTO 中。

## 立项审批样例

```json
{
  "processId": "project-approval",
  "processName": "立项审批",
  "nodes": [
    { "id": "start", "type": "start", "name": "发起", "x": 100, "y": 165 },
    { "id": "apply", "type": "approval", "name": "立项审批单", "x": 180, "y": 145 },
    { "id": "minister", "type": "approval", "name": "部长审批", "x": 340, "y": 145 },
    { "id": "gwMinister", "type": "condition", "name": "部长审批结果", "x": 500, "y": 160 },
    {
      "id": "managers",
      "type": "countersign",
      "name": "各部门经理会签",
      "approveMode": "ALL",
      "x": 600,
      "y": 145
    },
    { "id": "gwManagers", "type": "condition", "name": "会签结果", "x": 760, "y": 160 },
    { "id": "end", "type": "end", "name": "结束", "x": 860, "y": 165 }
  ],
  "flows": [
    { "source": "start", "target": "apply" },
    { "source": "apply", "target": "minister" },
    { "source": "minister", "target": "gwMinister" },
    { "source": "gwMinister", "target": "managers", "branch": "pass" },
    { "source": "gwMinister", "target": "apply", "branch": "reject" },
    { "source": "managers", "target": "gwManagers" },
    { "source": "gwManagers", "target": "end", "branch": "pass" },
    { "source": "gwManagers", "target": "apply", "branch": "reject" }
  ]
}
```

## 接口边界与待后端确认

- 用户于 2026-10-23 确认现有 `/v1/bpmn/json2xml` 就作为业务模型转换接口；前端直接提交本契约。2026-10-23 实测返回 HTTP 200 和可解析 BPMN XML，并核验了审批结果分支、打回回流、会签人员集合与完成条件。
- 转换成功后再调用流程发布接口；转换和发布分开处理。此前成功读取的 Swagger 基线使用 `POST /v1/template` 上传 BPMN XML，并以 `template-key` 指定模板标识。
- 用户反馈后端于 2026-10-27 升级 Camunda 并调整了部分接口路径；2026-10-28 Swagger 当前不可达，所以上述路径只代表升级前最后核对的契约，恢复访问后需重新确认。当前 `project-approval` v4 的 BPMN XML 含 `FinishNotify_1` external task（topic `task_finish`），而转换接口返回的 XML 未包含它；发布端是否自动补入、是否必需及版本历史语义仍待确认。
- 模板 `globalVariables` 字段描述包含 `name`、`type`、`description`、`source`、`required`、`value`。`source=start` 表示启动变量，`complete` 在办理任务时传入，`engine` 由后端写入；未分类历史变量按 `start` 兼容。前端 `TaskTemplateVariable` 已反映 `source` / `required`。
- 后端仍需确认其编译器按图结构识别申请填写与普通审批节点的实现规则；当前前端按首个发起后审批节点或完整流程中的 reject 连线目标推断申请填写节点，不增加用途字段，也不依赖固定 ID。
- 编译错误的节点/连线定位格式待后端提供；本地结构检查不替代后端编译。真实发布与运行时实例仍须单独验证。
