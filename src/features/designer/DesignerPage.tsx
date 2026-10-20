import { useCallback, useEffect, useMemo, useState } from 'react'
import type { DragEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from '@xyflow/react'
import {
  ApartmentOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  CheckCircleFilled,
  CloudUploadOutlined,
  CodeOutlined,
  DeleteOutlined,
  PlusOutlined,
  ShareAltOutlined,
} from '@ant-design/icons'
import { Button, Input, Modal, Select, Switch, Tabs, Tag } from 'antd'
import type {
  BpmnFormField as FormField,
  BpmnFormFieldConstraint as FormFieldConstraint,
  BpmnFormFieldType as FormFieldType,
  BpmnJSONRequest as DTO,
  BpmnMultiInstance as MultiInstance,
  BpmnNodeType as Kind,
  BpmnTaskListener as TaskListener,
} from '@/api/bpmn'
import type { TaskTemplate } from '@/api/workflow'
import { ProcessExportDrawer, type ExportFormat } from './ProcessExportDrawer'
import styles from './DesignerPage.module.less'
import '@xyflow/react/dist/style.css'

type Data = {
  kind: Kind
  name: string
  assignee?: string
  formKey?: string
  multiInstance?: MultiInstance
  taskListeners?: TaskListener[]
  formFields?: FormField[]
}
type FlowData = { conditionExpression?: string }
type PNode = Node<Data, 'processNode'>
type PEdge = Edge<FlowData>
type Variant = 'canvas' | 'steps' | 'structure'
type FieldsProps = {
  processId: string
  processName: string
  setProcessId: (v: string) => void
  setProcessName: (v: string) => void
}
type InspectorProps = {
  node?: PNode
  edge?: PEdge
  onNode: (key: 'name' | 'assignee' | 'formKey', value: string) => void
  onEdge: (value: string) => void
  onDelete: () => void
  onAdvanced: () => void
}
type Shared = {
  nodes: PNode[]
  edges: PEdge[]
  onNodesChange: (c: NodeChange<PNode>[]) => void
  onEdgesChange: (c: EdgeChange<PEdge>[]) => void
  onConnect: (c: Connection) => void
  selectNode: (e: unknown, n: PNode) => void
  selectEdge: (e: unknown, f: PEdge) => void
  clear: () => void
  add: (kind: Kind, position?: { x: number; y: number }) => void
  connect: (s?: string, t?: string) => void
  fields: FieldsProps
  inspector: InspectorProps
  open: () => void
  processId: string
  processName: string
  sourceId: string
  targetId: string
  setSourceId: (id: string) => void
  setTargetId: (id: string) => void
}
const kinds: Array<{ kind: Kind; label: string }> = [
  { kind: 'startEvent', label: '开始事件' },
  { kind: 'userTask', label: '用户任务' },
  { kind: 'exclusiveGateway', label: '排他网关' },
  { kind: 'endEvent', label: '结束事件' },
]
const names: Record<Kind, string> = {
  startEvent: '开始事件',
  userTask: '用户任务',
  exclusiveGateway: '排他网关',
  endEvent: '结束事件',
}
const variants: Array<{ id: Variant; label: string }> = [
  { id: 'canvas', label: '画布编辑' },
  { id: 'steps', label: '步骤编排' },
  { id: 'structure', label: '结构清单' },
]
const nodeTypes = { processNode: FlowNode }
const fieldTypes: Array<{ value: FormFieldType; label: string }> = [
  { value: 'string', label: '文本' },
  { value: 'long', label: '整数' },
  { value: 'boolean', label: '布尔值' },
  { value: 'date', label: '日期' },
  { value: 'enum', label: '枚举' },
]
const listenerEvents = [
  { value: 'create', label: '创建' },
  { value: 'assignment', label: '指派' },
  { value: 'complete', label: '完成' },
  { value: 'delete', label: '删除' },
] as const
const listenerTypes = [
  { value: 'class', label: 'Java 类' },
  { value: 'expression', label: '表达式' },
  { value: 'delegateExpression', label: '委托 Bean' },
] as const
const fieldConstraints = [
  { value: 'required', label: '必填' },
  { value: 'readonly', label: '只读' },
  { value: 'minlength', label: '最小长度' },
  { value: 'maxlength', label: '最大长度' },
] as const
function FlowNode({ data, selected }: { data: Data; selected: boolean }) {
  return (
    <div className={`${styles.nodeWrap} ${styles['node' + data.kind]}`}>
      {data.kind !== 'startEvent' && (
        <Handle type="target" position={Position.Left} className={styles.handle} />
      )}
      {data.kind === 'exclusiveGateway' ? (
        <div className={styles.gateway}>◇</div>
      ) : data.kind === 'startEvent' || data.kind === 'endEvent' ? (
        <div className={styles.event + (data.kind === 'endEvent' ? ' ' + styles.eventEnd : '')}>
          {data.kind === 'startEvent' ? '▶' : '■'}
          <small>{data.name}</small>
        </div>
      ) : (
        <div className={styles.task + (selected ? ' ' + styles.selected : '')}>
          <i>✓</i>
          {data.name}
          {data.multiInstance?.enable || data.formFields?.length || data.taskListeners?.length ? (
            <small className={styles.nodeBadge}>
              {data.multiInstance?.enable ? '会签' : ''}
              {data.formFields?.length ? '表单' : ''}
              {data.taskListeners?.length ? '监听' : ''}
            </small>
          ) : null}
        </div>
      )}
      {data.kind === 'exclusiveGateway' && <small className={styles.caption}>{data.name}</small>}
      {data.kind !== 'endEvent' && (
        <Handle type="source" position={Position.Right} className={styles.handle} />
      )}
    </div>
  )
}
function makeNodes(): PNode[] {
  return [
    {
      id: 'start_apply',
      type: 'processNode',
      position: { x: 60, y: 225 },
      data: { kind: 'startEvent', name: '提交申请' },
    },
    {
      id: 'task_apply',
      type: 'processNode',
      position: { x: 220, y: 208 },
      data: {
        kind: 'userTask',
        name: '填写申请',
        assignee: '$' + '{initiator}',
        formKey: 'leave-apply-form',
        formFields: [
          {
            id: 'leaveDays',
            label: '请假天数',
            type: 'long',
            defaultValue: '1',
            constraints: [{ name: 'required' }, { name: 'minlength', config: '1' }],
          },
          {
            id: 'leaveType',
            label: '请假类型',
            type: 'enum',
            values: [
              { id: 'annual', name: '年假' },
              { id: 'sick', name: '病假' },
            ],
          },
        ],
      },
    },
    {
      id: 'task_manager',
      type: 'processNode',
      position: { x: 420, y: 208 },
      data: {
        kind: 'userTask',
        name: '部门负责人审批',
        assignee: 'dept_manager',
        taskListeners: [
          {
            event: 'create',
            type: 'expression',
            value: '$' + '{taskListener.notify(task, eventName)}',
          },
        ],
      },
    },
    {
      id: 'gateway_days',
      type: 'processNode',
      position: { x: 645, y: 219 },
      data: { kind: 'exclusiveGateway', name: '天数判断' },
    },
    {
      id: 'task_hr',
      type: 'processNode',
      position: { x: 850, y: 92 },
      data: {
        kind: 'userTask',
        name: '人事复核',
        assignee: '$' + '{hrApprover}',
        multiInstance: {
          enable: true,
          sequential: false,
          collection: 'hrApprovers',
          elementVariable: 'hrApprover',
          completionCondition: '$' + '{nrOfCompletedInstances == nrOfInstances}',
        },
      },
    },
    {
      id: 'end_done',
      type: 'processNode',
      position: { x: 1100, y: 225 },
      data: { kind: 'endEvent', name: '审批完成' },
    },
  ]
}
function makeEdges(): PEdge[] {
  return [
    { id: 'flow_1', source: 'start_apply', target: 'task_apply', type: 'smoothstep', data: {} },
    { id: 'flow_1b', source: 'task_apply', target: 'task_manager', type: 'smoothstep', data: {} },
    { id: 'flow_2', source: 'task_manager', target: 'gateway_days', type: 'smoothstep', data: {} },
    {
      id: 'flow_3',
      source: 'gateway_days',
      target: 'task_hr',
      type: 'smoothstep',
      label: '${leaveDays > 3}',
      data: { conditionExpression: '${leaveDays > 3}' },
    },
    {
      id: 'flow_4',
      source: 'gateway_days',
      target: 'end_done',
      type: 'smoothstep',
      label: '${leaveDays <= 3}',
      data: { conditionExpression: '${leaveDays <= 3}' },
    },
    { id: 'flow_5', source: 'task_hr', target: 'end_done', type: 'smoothstep', data: {} },
  ].map((edge) => ({
    ...edge,
    style: { stroke: '#718e7d', strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#718e7d' },
  }))
}
function getSchemaIssues(dto: DTO) {
  const issues: string[] = []
  // XML NCName ids allow hyphens and dots; the schema example itself uses leave-approval.
  if (!/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(dto.processId))
    issues.push('流程标识需以字母或下划线开头，后续可包含字母、数字、下划线、连字符和点。')
  const nodeIds = new Set<string>()
  const allIds = new Set<string>()
  for (const node of dto.nodes) {
    if (!node.id.trim()) issues.push('存在缺少 ID 的节点。')
    else if (allIds.has(node.id)) issues.push('节点或连线 ID 重复：' + node.id)
    allIds.add(node.id)
    nodeIds.add(node.id)
    if (node.type === 'userTask') {
      if (node.multiInstance?.enable && !node.multiInstance.collection?.trim())
        issues.push(node.name + '：启用会签时必须填写处理人集合变量。')
      const fieldIds = new Set<string>()
      for (const field of node.formFields || []) {
        if (!field.id.trim()) issues.push(node.name + '：表单字段 ID 不能为空。')
        else if (fieldIds.has(field.id)) issues.push(node.name + '：表单字段 ID 重复：' + field.id)
        fieldIds.add(field.id)
        if (field.type === 'enum' && !field.values)
          issues.push(node.name + '：枚举字段必须配置选项列表。')
        if (
          (field.constraints || []).some(
            (constraint) =>
              ['minlength', 'maxlength'].includes(constraint.name) && !constraint.config?.trim(),
          )
        )
          issues.push(node.name + '：最小长度和最大长度约束必须填写配置值。')
        if (field.type === 'enum' && field.values?.some((value) => !value.id.trim()))
          issues.push(node.name + '：枚举选项 ID 不能为空。')
      }
      if (node.taskListeners?.some((listener) => !listener.value.trim()))
        issues.push(node.name + '：任务监听器的实现值不能为空。')
    }
  }
  if (!dto.nodes.some((node) => node.type === 'startEvent'))
    issues.push('流程至少需要一个开始事件。')
  for (const flow of dto.flows) {
    if (!flow.id.trim()) issues.push('存在缺少 ID 的连线。')
    else if (allIds.has(flow.id)) issues.push('节点或连线 ID 重复：' + flow.id)
    allIds.add(flow.id)
    if (!nodeIds.has(flow.source) || !nodeIds.has(flow.target))
      issues.push('连线引用了不存在的节点：' + flow.id)
  }
  return issues
}
function makeId(prefix: string) {
  return prefix + '_' + Math.random().toString(36).slice(2, 7)
}
function Palette({
  add,
  compact = false,
  draggable = false,
}: {
  add: Shared['add']
  compact?: boolean
  draggable?: boolean
}) {
  return (
    <div className={styles.palette + (compact ? ' ' + styles.compact : '')}>
      {!compact && (
        <div className={styles.sectionLabel}>
          添加节点 <small>4 种基础节点</small>
        </div>
      )}
      {kinds.map((k, i) => (
        <button
          key={k.kind}
          draggable={draggable}
          onDragStart={(event) => {
            event.dataTransfer.setData('application/x-process-node', k.kind)
            event.dataTransfer.effectAllowed = 'move'
          }}
          onClick={() => add(k.kind)}
        >
          <i className={styles['p' + i]}>{['开', '审', '判', '终'][i]}</i>
          {k.label}
          <PlusOutlined />
        </button>
      ))}
    </div>
  )
}
function Fields({ processId, processName, setProcessId, setProcessName }: FieldsProps) {
  const processIdValid = /^[A-Za-z_][A-Za-z0-9_.-]*$/.test(processId)
  return (
    <div className={styles.fields}>
      <b className={styles.sectionLabel}>流程信息</b>
      <label>流程名称</label>
      <Input size="small" value={processName} onChange={(e) => setProcessName(e.target.value)} />
      <label>
        流程标识 <small>首位为字母或下划线</small>
      </label>
      <Input
        size="small"
        value={processId}
        status={processIdValid ? undefined : 'error'}
        onChange={(e) => setProcessId(e.target.value)}
      />
      {!processIdValid && (
        <small className={styles.fieldError}>
          首位需为字母或下划线，后续可用字母、数字、下划线、连字符和点。
        </small>
      )}
    </div>
  )
}
function Inspector({ node, edge, onNode, onEdge, onDelete, onAdvanced }: InspectorProps) {
  if (!node && !edge)
    return (
      <div className={styles.empty}>
        <ApartmentOutlined />
        <b>选择节点或连线</b>
        <span>在这里编辑流程属性</span>
      </div>
    )
  if (edge)
    return (
      <div className={styles.inspector}>
        <b>
          <ShareAltOutlined /> 流程连线
        </b>
        <small>
          {edge.source} → {edge.target}
        </small>
        <label>分支条件 · EL 表达式</label>
        <Input.TextArea
          rows={3}
          value={edge.data?.conditionExpression || ''}
          placeholder="例如：${leaveDays > 3}"
          onChange={(e) => onEdge(e.target.value)}
        />
        <p>排他网关出边可以配置分支条件。留空表示默认分支。</p>
        <Button danger type="text" icon={<DeleteOutlined />} onClick={onDelete}>
          删除连线
        </Button>
      </div>
    )
  if (!node) return null
  return (
    <div className={styles.inspector}>
      <b>
        <i className={styles.nodeType}>{names[node.data.kind]}</i>
        {names[node.data.kind]}
      </b>
      <small>{node.id}</small>
      <label>节点名称</label>
      <Input size="small" value={node.data.name} onChange={(e) => onNode('name', e.target.value)} />
      {node.data.kind === 'userTask' && (
        <>
          <label>处理人标识</label>
          <Input
            size="small"
            value={node.data.assignee || ''}
            placeholder="例如：dept_manager"
            onChange={(e) => onNode('assignee', e.target.value)}
          />
          <p>填写 Camunda assignee 用户 ID 或表达式。</p>
          <label>表单 Key</label>
          <Input
            size="small"
            value={node.data.formKey || ''}
            placeholder="例如：leave-approval-form"
            onChange={(e) => onNode('formKey', e.target.value)}
          />
          <div className={styles.taskOptions}>
            <span>
              {node.data.multiInstance?.enable ? '已配置会签' : '未配置会签'}
              {node.data.formFields?.length
                ? ' · ' + node.data.formFields.length + ' 个表单字段'
                : ''}
              {node.data.taskListeners?.length
                ? ' · ' + node.data.taskListeners.length + ' 个监听器'
                : ''}
            </span>
            <Button size="small" onClick={onAdvanced}>
              高级配置
            </Button>
          </div>
        </>
      )}
      <Button danger type="text" icon={<DeleteOutlined />} onClick={onDelete}>
        删除节点
      </Button>
    </div>
  )
}
function AdvancedTaskConfig({
  node,
  close,
  onChange,
}: {
  node: PNode
  close: () => void
  onChange: (data: Data) => void
}) {
  const data = node.data
  const multi = data.multiInstance ?? { enable: false, sequential: false }
  const fields = data.formFields ?? []
  const listeners = data.taskListeners ?? []
  const update = (patch: Partial<Data>) => onChange({ ...data, ...patch })
  const updateField = (index: number, patch: Partial<FormField>) =>
    update({ formFields: fields.map((field, i) => (i === index ? { ...field, ...patch } : field)) })
  const updateListener = (index: number, patch: Partial<TaskListener>) =>
    update({
      taskListeners: listeners.map((listener, i) =>
        i === index ? { ...listener, ...patch } : listener,
      ),
    })
  const fieldTab = (
    <div className={styles.advancedPanel}>
      <div className={styles.advancedIntro}>
        <span>定义用户任务提交或审批时使用的 Camunda 内置表单字段。</span>
        <Button
          size="small"
          icon={<PlusOutlined />}
          onClick={() =>
            update({
              formFields: [...fields, { id: makeId('field'), label: '新字段', type: 'string' }],
            })
          }
        >
          添加字段
        </Button>
      </div>
      {fields.length === 0 ? (
        <div className={styles.advancedEmpty}>还没有表单字段，可以先添加一个审批表单项。</div>
      ) : (
        <div className={styles.fieldList}>
          {fields.map((field, index) => (
            <div className={styles.fieldCard} key={field.id + index}>
              <div className={styles.fieldCardHead}>
                <b>字段 {index + 1}</b>
                <Button
                  danger
                  type="text"
                  size="small"
                  icon={<DeleteOutlined />}
                  aria-label="删除表单字段"
                  onClick={() => update({ formFields: fields.filter((_, i) => i !== index) })}
                />
              </div>
              <div className={styles.fieldGrid}>
                <label>字段 ID</label>
                <Input
                  size="small"
                  value={field.id}
                  onChange={(e) => updateField(index, { id: e.target.value })}
                />
                <label>显示名称</label>
                <Input
                  size="small"
                  value={field.label || ''}
                  onChange={(e) => updateField(index, { label: e.target.value })}
                />
                <label>字段类型</label>
                <Select
                  size="small"
                  value={field.type}
                  options={fieldTypes}
                  onChange={(type: FormFieldType) =>
                    updateField(index, {
                      type,
                      values: type === 'enum' ? (field.values ?? []) : undefined,
                      datePattern:
                        type === 'date' ? (field.datePattern ?? 'yyyy-MM-dd') : undefined,
                    })
                  }
                />
                <label>默认值</label>
                <Input
                  size="small"
                  value={field.defaultValue || ''}
                  onChange={(e) => updateField(index, { defaultValue: e.target.value })}
                />
                {field.type === 'date' && (
                  <>
                    <label>日期格式</label>
                    <Input
                      size="small"
                      value={field.datePattern || ''}
                      placeholder="yyyy-MM-dd"
                      onChange={(e) => updateField(index, { datePattern: e.target.value })}
                    />
                  </>
                )}
                {field.type === 'enum' && (
                  <>
                    <label>枚举选项</label>
                    <Input.TextArea
                      rows={2}
                      value={(field.values || [])
                        .map((value) => value.id + (value.name ? '=' + value.name : ''))
                        .join('\n')}
                      placeholder={'annual=年假\nsick=病假'}
                      onChange={(e) =>
                        updateField(index, {
                          values: e.target.value
                            .split('\n')
                            .filter(Boolean)
                            .map((line) => {
                              const [id, ...label] = line.split('=')
                              return {
                                id: id.trim(),
                                ...(label.length ? { name: label.join('=').trim() } : {}),
                              }
                            }),
                        })
                      }
                    />
                  </>
                )}
                <label>校验约束</label>
                <Select
                  mode="multiple"
                  size="small"
                  value={(field.constraints || []).map((constraint) => constraint.name)}
                  options={fieldConstraints.map(({ value, label }) => ({ value, label }))}
                  onChange={(values: FormFieldConstraint['name'][]) =>
                    updateField(index, {
                      constraints: values.map((name) => ({
                        name,
                        ...(['minlength', 'maxlength'].includes(name)
                          ? {
                              config:
                                field.constraints?.find((item) => item.name === name)?.config ||
                                '1',
                            }
                          : {}),
                      })),
                    })
                  }
                />
              </div>
              {(field.constraints || []).some(
                (constraint) => constraint.name === 'minlength' || constraint.name === 'maxlength',
              ) && (
                <div className={styles.constraintList}>
                  {(field.constraints || [])
                    .filter(
                      (constraint) =>
                        constraint.name === 'minlength' || constraint.name === 'maxlength',
                    )
                    .map((constraint) => (
                      <label key={constraint.name}>
                        {constraint.name === 'minlength' ? '最小长度' : '最大长度'}
                        <Input
                          size="small"
                          value={constraint.config || ''}
                          onChange={(e) =>
                            updateField(index, {
                              constraints: (field.constraints || []).map((item) =>
                                item.name === constraint.name
                                  ? { ...item, config: e.target.value }
                                  : item,
                              ),
                            })
                          }
                        />
                      </label>
                    ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
  const multiTab = (
    <div className={styles.advancedPanel}>
      <div className={styles.switchRow}>
        <span>
          <b>启用会签</b>
          <small>把处理人集合拆成多个审批实例</small>
        </span>
        <Switch
          checked={multi.enable}
          onChange={(enable) => update({ multiInstance: { ...multi, enable } })}
        />
      </div>
      {multi.enable ? (
        <div className={styles.multiGrid}>
          <label>审批方式</label>
          <Select
            value={multi.sequential ? 'sequential' : 'parallel'}
            options={[
              { value: 'parallel', label: '并行会签' },
              { value: 'sequential', label: '串行会签' },
            ]}
            onChange={(value: 'parallel' | 'sequential') =>
              update({ multiInstance: { ...multi, sequential: value === 'sequential' } })
            }
          />
          <label>
            处理人集合变量 <i>必填</i>
          </label>
          <Input
            value={multi.collection || ''}
            placeholder="例如：approvers"
            onChange={(e) => update({ multiInstance: { ...multi, collection: e.target.value } })}
          />
          <label>当前处理人变量</label>
          <Input
            value={multi.elementVariable || ''}
            placeholder="例如：approver"
            onChange={(e) =>
              update({ multiInstance: { ...multi, elementVariable: e.target.value } })
            }
          />
          <label>提前结束条件</label>
          <Input.TextArea
            rows={2}
            value={multi.completionCondition || ''}
            placeholder={'例如：$' + '{nrOfCompletedInstances == nrOfInstances}'}
            onChange={(e) =>
              update({ multiInstance: { ...multi, completionCondition: e.target.value } })
            }
          />
          <small>留空时等待所有实例完成；表达式按 Camunda EL 传给后端。</small>
        </div>
      ) : (
        <div className={styles.advancedEmpty}>开启后可配置串行或并行会签，以及会签完成条件。</div>
      )}
    </div>
  )
  const listenerTab = (
    <div className={styles.advancedPanel}>
      <div className={styles.advancedIntro}>
        <span>在任务创建、指派、完成或删除时调用后端监听器。</span>
        <Button
          size="small"
          icon={<PlusOutlined />}
          onClick={() =>
            update({
              taskListeners: [...listeners, { event: 'create', type: 'expression', value: '' }],
            })
          }
        >
          添加监听器
        </Button>
      </div>
      {listeners.length === 0 ? (
        <div className={styles.advancedEmpty}>当前任务没有监听器。</div>
      ) : (
        <div className={styles.listenerList}>
          {listeners.map((listener, index) => (
            <div className={styles.listenerRow} key={index}>
              <Select
                size="small"
                value={listener.event}
                options={listenerEvents.map(({ value, label }) => ({ value, label }))}
                onChange={(event: TaskListener['event']) => updateListener(index, { event })}
              />
              <Select
                size="small"
                value={listener.type}
                options={listenerTypes.map(({ value, label }) => ({ value, label }))}
                onChange={(type: TaskListener['type']) => updateListener(index, { type })}
              />
              <Input
                size="small"
                value={listener.value}
                placeholder={
                  listener.type === 'class' ? '监听器全类名' : '根据实现类型填写表达式或 Bean'
                }
                status={listener.value.trim() ? undefined : 'error'}
                onChange={(e) => updateListener(index, { value: e.target.value })}
              />
              <Button
                danger
                type="text"
                size="small"
                icon={<DeleteOutlined />}
                aria-label="删除任务监听器"
                onClick={() => update({ taskListeners: listeners.filter((_, i) => i !== index) })}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
  return (
    <Modal
      open
      title={
        <span>
          用户任务配置 <small className={styles.modalSubtitle}>{data.name}</small>
        </span>
      }
      width={760}
      onCancel={close}
      onOk={close}
      okText="完成"
      cancelButtonProps={{ style: { display: 'none' } }}
      destroyOnClose
    >
      <Tabs
        items={[
          {
            key: 'form',
            label: '表单字段' + (fields.length ? ' · ' + fields.length : ''),
            children: fieldTab,
          },
          { key: 'multi', label: '会签' + (multi.enable ? ' · 已启用' : ''), children: multiTab },
          {
            key: 'listeners',
            label: '任务监听器' + (listeners.length ? ' · ' + listeners.length : ''),
            children: listenerTab,
          },
        ]}
      />
    </Modal>
  )
}
function Header({
  name,
  count,
  edges,
  open,
  convert,
  deploy,
  publication,
  publishedCurrent,
}: {
  name: string
  count: number
  edges: number
  open: () => void
  convert: () => void
  deploy: () => void
  publication?: TaskTemplate
  publishedCurrent: boolean
}) {
  return (
    <header className={styles.header}>
      <div>
        <div className={styles.eyebrow}>流程工作台 / 新建流程</div>
        <h1>
          {name}{' '}
          <Tag>
            {publishedCurrent
              ? '已部署 · v' + publication?.version
              : publication
                ? '有未部署修改'
                : '未发布'}
          </Tag>{' '}
          <small>
            <i /> 本地草稿
          </small>
        </h1>
        <p>拖入节点、连接审批路径，快速生成可提交给 Camunda 的流程定义。</p>
      </div>
      <div className={styles.headerActions}>
        <span>
          {count} 个节点 · {edges} 条连线
        </span>
        <Button icon={<CodeOutlined />} onClick={open}>
          生成请求 JSON
        </Button>
        <Button icon={<CodeOutlined />} onClick={convert}>
          转为 XML
        </Button>
        <Button type="primary" icon={<CloudUploadOutlined />} onClick={deploy}>
          部署任务模板
        </Button>
      </div>
    </header>
  )
}
function InteractiveFlow({ s }: { s: Shared }) {
  const { screenToFlowPosition } = useReactFlow()
  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    const kind = event.dataTransfer.getData('application/x-process-node') as Kind
    if (!kinds.some((item) => item.kind === kind)) return
    s.add(kind, screenToFlowPosition({ x: event.clientX, y: event.clientY }))
  }
  return (
    <ReactFlow
      nodes={s.nodes}
      edges={s.edges}
      nodeTypes={nodeTypes}
      onNodesChange={s.onNodesChange}
      onEdgesChange={s.onEdgesChange}
      onConnect={s.onConnect}
      connectionDragThreshold={1}
      defaultEdgeOptions={{
        type: 'smoothstep',
        style: { stroke: '#718e7d', strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#718e7d' },
      }}
      onNodeClick={s.selectNode}
      onEdgeClick={s.selectEdge}
      onPaneClick={s.clear}
      onDragOver={(event) => {
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
      }}
      onDrop={onDrop}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      proOptions={{ hideAttribution: true }}
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#dce6e1" />
      <Controls position="bottom-left" />
      <MiniMap
        position="bottom-right"
        nodeColor={(n) => ((n.data as Data).kind === 'userTask' ? '#d9a85b' : '#73a18e')}
      />
    </ReactFlow>
  )
}
function Canvas({ s }: { s: Shared }) {
  return (
    <div className={styles.canvasLayout}>
      <aside className={styles.left}>
        <Palette add={s.add} draggable />
        <p>
          从节点边缘拖出连线
          <br />
          点击对象可修改属性
        </p>
      </aside>
      <div className={styles.canvas}>
        <div className={styles.canvasBar}>
          <span>
            <i />
            画布编辑 / 拖动节点调整布局
          </span>
          <Button type="link" onClick={s.open}>
            查看请求结构 ↓
          </Button>
        </div>
        <div className={styles.flow}>
          <ReactFlowProvider>
            <InteractiveFlow s={s} />
          </ReactFlowProvider>
          <span className={styles.flowTip}>节点可从左侧拖入 · 点击连接点并拖到另一节点连线</span>
        </div>
      </div>
      <aside className={styles.right}>
        <Fields {...s.fields} />
        <div className={styles.config}>
          <b className={styles.sectionLabel}>节点配置</b>
          <Inspector {...s.inspector} />
        </div>
        <div className={styles.footer}>
          <CheckCircleFilled /> 更改仅在当前页面生效
        </div>
      </aside>
    </div>
  )
}
function Steps({ s }: { s: Shared }) {
  return (
    <div className={styles.stepsLayout}>
      <main>
        <div className={styles.stepsHeading}>
          <div>
            <small>STEP BUILDER</small>
            <h2>把审批流程排成步骤</h2>
            <p>按执行顺序查看节点，分支条件显示在连线卡片中。</p>
          </div>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => s.add('userTask')}>
            添加审批步骤
          </Button>
        </div>
        <Palette add={s.add} compact />
        <div className={styles.stepList}>
          {s.nodes.map((n, i) => (
            <div key={n.id}>
              <button className={styles.step} onClick={() => s.selectNode(undefined, n)}>
                <i>{String(i + 1).padStart(2, '0')}</i>
                <span>
                  <b>{n.data.name}</b>
                  <small>
                    {names[n.data.kind]} · {n.id}
                  </small>
                </span>
                {n.data.kind === 'userTask' && <em>{n.data.assignee || '未配置处理人'}</em>}
              </button>
              {i < s.nodes.length - 1 && (
                <div className={styles.stepLink}>
                  {s.edges
                    .filter((e) => e.source === n.id)
                    .map((e) => (
                      <button key={e.id} onClick={() => s.selectEdge(undefined, e)}>
                        ↓ {s.nodes.find((x) => x.id === e.target)?.data.name}
                        {e.data?.conditionExpression || '无条件'}
                      </button>
                    ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className={styles.quickConnect}>
          <b>快速连线</b>
          <Select
            value={s.sourceId}
            placeholder="源节点"
            options={s.nodes.map((n) => ({ value: n.id, label: n.data.name }))}
            onChange={s.setSourceId}
          />
          <span>→</span>
          <Select
            value={s.targetId}
            placeholder="目标节点"
            options={s.nodes.map((n) => ({ value: n.id, label: n.data.name }))}
            onChange={s.setTargetId}
          />
          <Button onClick={() => s.connect(s.sourceId, s.targetId)}>添加连线</Button>
        </div>
      </main>
      <aside>
        <Fields {...s.fields} />
        <div className={styles.asideLabel}>当前选中</div>
        <Inspector {...s.inspector} />
        <div className={styles.summary}>
          <small>{s.processId}</small>
          {s.nodes.length} 个节点 · {s.edges.length} 条连线
          <Button type="primary" block onClick={s.open}>
            预览提交 JSON
          </Button>
        </div>
      </aside>
    </div>
  )
}
function Structure({ s }: { s: Shared }) {
  return (
    <div className={styles.structure}>
      <header>
        <div>
          <small>PROCESS DEFINITION</small>
          <h2>流程结构清单</h2>
          <p>像检查接口数据一样快速核对节点和连线。</p>
        </div>
        <Button type="primary" icon={<CodeOutlined />} onClick={s.open}>
          查看完整 JSON
        </Button>
      </header>
      <div className={styles.structureBody}>
        <main>
          <div className={styles.processLine}>
            <b>{s.processName}</b>
            <code>{s.processId}</code>
            <Tag color="green">JSON Schema v1.0</Tag>
            <Button size="small" onClick={() => s.add('userTask')} icon={<PlusOutlined />}>
              添加用户任务
            </Button>
          </div>
          <h3>
            节点清单 <small>{s.nodes.length}</small>
          </h3>
          <div className={styles.tableHead}>
            <span>节点</span>
            <span>类型</span>
            <span>处理人</span>
            <span>坐标</span>
          </div>
          {s.nodes.map((n, i) => (
            <button className={styles.row} key={n.id} onClick={() => s.selectNode(undefined, n)}>
              <span>
                <i>{i + 1}</i>
                <b>{n.data.name}</b>
                <small>{n.id}</small>
              </span>
              <span>{names[n.data.kind]}</span>
              <span>{n.data.assignee || '—'}</span>
              <span>
                {Math.round(n.position.x)}, {Math.round(n.position.y)}
              </span>
            </button>
          ))}
          <h3>
            连线规则 <small>{s.edges.length}</small>
          </h3>
          {s.edges.map((e) => (
            <button
              className={styles.edgeRow}
              key={e.id}
              onClick={() => s.selectEdge(undefined, e)}
            >
              <span>{s.nodes.find((n) => n.id === e.source)?.data.name}</span>→
              <span>{s.nodes.find((n) => n.id === e.target)?.data.name}</span>
              <code>{e.data?.conditionExpression || '无条件'}</code>
            </button>
          ))}
        </main>
        <aside>
          <Fields {...s.fields} />
          <div className={styles.asideLabel}>编辑属性</div>
          <Inspector {...s.inspector} />
          <pre>
            {JSON.stringify(
              { processId: s.processId, nodes: s.nodes.length, flows: s.edges.length },
              null,
              2,
            )}
          </pre>
        </aside>
      </div>
    </div>
  )
}
export function DesignerPage() {
  const [params, setParams] = useSearchParams()
  const asked = params.get('variant') as Variant | null
  const variant = variants.some((v) => v.id === asked) ? asked! : 'canvas'
  const [nodes, setNodes, onNodesChange] = useNodesState<PNode>(makeNodes())
  const [edges, setEdges, onEdgesChange] = useEdgesState<PEdge>(makeEdges())
  const [processId, setProcessId] = useState('leave_approval')
  const [processName, setProcessName] = useState('请假审批流程')
  const [sourceId, setSourceId] = useState('')
  const [targetId, setTargetId] = useState('')
  const [nodeId, setNodeId] = useState<string | null>(null)
  const [edgeId, setEdgeId] = useState<string | null>(null)
  const [advancedNodeId, setAdvancedNodeId] = useState<string | null>(null)
  const [exportFormat, setExportFormat] = useState<ExportFormat | null>(null)
  const [publication, setPublication] = useState<{ template: TaskTemplate; definition: string }>()
  const node = nodes.find((n) => n.id === nodeId)
  const edge = edges.find((e) => e.id === edgeId)
  const advancedNode = nodes.find((n) => n.id === advancedNodeId)
  const setVariant = useCallback(
    (v: Variant) =>
      setParams(
        (p) => {
          const q = new URLSearchParams(p)
          q.set('variant', v)
          return q
        },
        { replace: true },
      ),
    [setParams],
  )
  const add = useCallback(
    (kind: Kind, position?: { x: number; y: number }) => {
      const prefix =
        kind === 'userTask'
          ? 'task'
          : kind === 'exclusiveGateway'
            ? 'gateway'
            : kind === 'startEvent'
              ? 'start'
              : 'end'
      const id = makeId(prefix)
      const name =
        kind === 'userTask'
          ? '新建审批'
          : kind === 'exclusiveGateway'
            ? '条件判断'
            : kind === 'startEvent'
              ? '开始'
              : '结束'
      setNodes((cur) => [
        ...cur,
        {
          id,
          type: 'processNode',
          position: position ?? {
            x: 220 + (cur.length % 3) * 190,
            y: 180 + Math.floor(cur.length / 3) * 120,
          },
          data: { kind, name, ...(kind === 'userTask' ? { assignee: '' } : {}) },
        },
      ])
      setNodeId(id)
      setEdgeId(null)
    },
    [setNodes],
  )
  const connect = useCallback(
    (source?: string, target?: string) => {
      if (!source || !target || source === target) return
      setEdges((cur) =>
        cur.some((e) => e.source === source && e.target === target)
          ? cur
          : addEdge(
              {
                id: makeId('flow'),
                source,
                target,
                type: 'smoothstep',
                style: { stroke: '#718e7d', strokeWidth: 2 },
                markerEnd: { type: MarkerType.ArrowClosed, color: '#718e7d' },
                data: {},
              },
              cur,
            ),
      )
    },
    [setEdges],
  )
  const onConnect = useCallback(
    (c: Connection) =>
      setEdges((cur) =>
        addEdge(
          {
            ...c,
            id: makeId('flow'),
            type: 'smoothstep',
            style: { stroke: '#4f8664', strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#4f8664' },
            data: {},
          },
          cur,
        ),
      ),
    [setEdges],
  )
  const updateNode = (key: 'name' | 'assignee' | 'formKey', value: string) => {
    if (nodeId)
      setNodes((cur) =>
        cur.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, [key]: value || undefined } } : n,
        ),
      )
  }
  const updateNodeData = (id: string, data: Data) => {
    setNodes((cur) => cur.map((n) => (n.id === id ? { ...n, data } : n)))
  }
  const updateEdge = (value: string) => {
    if (edgeId)
      setEdges((cur) =>
        cur.map((e) =>
          e.id === edgeId
            ? {
                ...e,
                label: value || undefined,
                data: { ...e.data, conditionExpression: value || undefined },
              }
            : e,
        ),
      )
  }
  const remove = () => {
    if (nodeId) {
      setNodes((cur) => cur.filter((n) => n.id !== nodeId))
      setEdges((cur) => cur.filter((e) => e.source !== nodeId && e.target !== nodeId))
      setNodeId(null)
    }
    if (edgeId) {
      setEdges((cur) => cur.filter((e) => e.id !== edgeId))
      setEdgeId(null)
    }
  }
  const dto = useMemo<DTO>(
    () => ({
      processId,
      processName,
      nodes: nodes.map((n) => ({
        id: n.id,
        type: n.data.kind,
        name: n.data.name,
        x: Math.round(n.position.x),
        y: Math.round(n.position.y),
        ...(n.data.kind === 'userTask' && n.data.assignee ? { assignee: n.data.assignee } : {}),
        ...(n.data.kind === 'userTask' && n.data.formKey ? { formKey: n.data.formKey } : {}),
        ...(n.data.kind === 'userTask' && n.data.multiInstance?.enable
          ? {
              multiInstance: {
                enable: true,
                ...(n.data.multiInstance.sequential !== undefined
                  ? { sequential: n.data.multiInstance.sequential }
                  : {}),
                ...(n.data.multiInstance.collection
                  ? { collection: n.data.multiInstance.collection }
                  : {}),
                ...(n.data.multiInstance.elementVariable
                  ? { elementVariable: n.data.multiInstance.elementVariable }
                  : {}),
                ...(n.data.multiInstance.completionCondition
                  ? { completionCondition: n.data.multiInstance.completionCondition }
                  : {}),
              },
            }
          : {}),
        ...(n.data.kind === 'userTask' && n.data.taskListeners?.length
          ? {
              taskListeners: n.data.taskListeners.map(({ event, type, value }) => ({
                event,
                type,
                value,
              })),
            }
          : {}),
        ...(n.data.kind === 'userTask' && n.data.formFields?.length
          ? {
              formFields: n.data.formFields.map((field) => ({
                id: field.id,
                ...(field.label ? { label: field.label } : {}),
                type: field.type,
                ...(field.defaultValue ? { defaultValue: field.defaultValue } : {}),
                ...(field.type === 'date' && field.datePattern
                  ? { datePattern: field.datePattern }
                  : {}),
                ...(field.type === 'enum' ? { values: field.values || [] } : {}),
                ...(field.constraints?.length
                  ? {
                      constraints: field.constraints.map((constraint) => ({
                        name: constraint.name,
                        ...(constraint.config ? { config: constraint.config } : {}),
                      })),
                    }
                  : {}),
              })),
            }
          : {}),
      })),
      flows: edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        ...(e.data?.conditionExpression ? { conditionExpression: e.data.conditionExpression } : {}),
      })),
    }),
    [processId, processName, nodes, edges],
  )
  const fields: FieldsProps = { processId, processName, setProcessId, setProcessName }
  const inspector: InspectorProps = {
    node,
    edge,
    onNode: updateNode,
    onEdge: updateEdge,
    onDelete: remove,
    onAdvanced: () => {
      if (node?.data.kind === 'userTask') setAdvancedNodeId(node.id)
    },
  }
  const shared: Shared = {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    selectNode: (_e, n) => {
      setNodeId(n.id)
      setEdgeId(null)
    },
    selectEdge: (_e, e) => {
      setEdgeId(e.id)
      setNodeId(null)
    },
    clear: () => {
      setNodeId(null)
      setEdgeId(null)
    },
    add,
    connect,
    fields,
    inspector,
    open: () => setExportFormat('json'),
    processId,
    processName,
    sourceId,
    targetId,
    setSourceId,
    setTargetId,
  }
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const key = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLElement &&
        (e.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName))
      )
        return
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      e.preventDefault()
      const i = variants.findIndex((v) => v.id === variant)
      setVariant(variants[(i + (e.key === 'ArrowRight' ? 1 : 2)) % 3].id)
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [variant, setVariant])
  return (
    <section className={styles.page}>
      <Header
        name={processName}
        count={nodes.length}
        edges={edges.length}
        open={() => setExportFormat('json')}
        convert={() => setExportFormat('xml')}
        deploy={() => setExportFormat('deploy')}
        publication={publication?.template}
        publishedCurrent={publication?.definition === JSON.stringify(dto)}
      />
      {variant === 'canvas' && <Canvas s={shared} />}
      {variant === 'steps' && <Steps s={shared} />}
      {variant === 'structure' && <Structure s={shared} />}
      {import.meta.env.DEV && (
        <div className={styles.switcher}>
          <button
            aria-label="上一个方案"
            onClick={() =>
              setVariant(variants[(variants.findIndex((v) => v.id === variant) + 2) % 3].id)
            }
          >
            <ArrowLeftOutlined />
          </button>
          <span>
            <i>PROTOTYPE</i>
            <b>{variants.find((v) => v.id === variant)?.label}</b>
          </span>
          <button
            aria-label="下一个方案"
            onClick={() =>
              setVariant(variants[(variants.findIndex((v) => v.id === variant) + 1) % 3].id)
            }
          >
            <ArrowRightOutlined />
          </button>
        </div>
      )}
      {exportFormat && (
        <ProcessExportDrawer
          definition={dto}
          initialFormat={exportFormat}
          issues={getSchemaIssues(dto)}
          close={() => setExportFormat(null)}
          onPublished={(template, definition) =>
            setPublication({ template, definition: JSON.stringify(definition) })
          }
        />
      )}
      {advancedNode?.data.kind === 'userTask' && (
        <AdvancedTaskConfig
          node={advancedNode}
          close={() => setAdvancedNodeId(null)}
          onChange={(data) => updateNodeData(advancedNode.id, data)}
        />
      )}
    </section>
  )
}
