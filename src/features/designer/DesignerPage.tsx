import { useMemo, useState } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import {
  ApartmentOutlined,
  CheckCircleFilled,
  CodeOutlined,
  CopyOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EyeOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import {
  Alert,
  Button,
  Checkbox,
  DatePicker,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Tag,
  message,
} from 'antd'
import { copyText } from '@/utils/clipboard'
import {
  createInitialApprovalModel,
  createModelId,
  fieldTypeLabels,
  methodLabels,
  nodeTypeLabels,
  operatorLabels,
  validateApprovalModel,
  type ApprovalConditionRule,
  type ApprovalEdge,
  type ApprovalFieldOption,
  type ApprovalFormField,
  type ApprovalMethod,
  type ApprovalModel,
  type ApprovalNode,
  type ApprovalNodeType,
  type ApprovalOperator,
} from './approvalModel'
import styles from './DesignerPage.module.less'
import '@xyflow/react/dist/style.css'

type PositionMap = Record<string, { x: number; y: number }>
type ViewData = { kind: ApprovalNodeType; label: string; meta: string }
type ViewNode = Node<ViewData, 'approvalNode'>
type ViewEdge = Edge<{ label?: string; isDefault?: boolean }>
const initialPositions: PositionMap = {
  start_1: { x: 20, y: 220 },
  approve_1: { x: 190, y: 205 },
  branch_1: { x: 410, y: 215 },
  approve_2: { x: 630, y: 75 },
  cc_1: { x: 850, y: 215 },
  end_1: { x: 1050, y: 215 },
}
const nodeOrder: ApprovalNodeType[] = ['start', 'approval', 'condition', 'cc', 'end']
const operatorOptions = Object.entries(operatorLabels).map(([value, label]) => ({ value, label }))

function describeEdge(model: ApprovalModel, edge: ApprovalEdge): string {
  if (edge.isDefault) return '默认情况'
  return (edge.conditions || [])
    .map((rule) => {
      const field = model.form.fields.find((item) => item.id === rule.field)
      const value =
        field?.type === 'enum'
          ? field.options?.find((option) => option.value === String(rule.value))?.label ||
            rule.value
          : rule.value
      return (field?.label || rule.field) + ' ' + operatorLabels[rule.operator] + ' ' + value
    })
    .join(' 且 ')
}

function FlowNodeView({ data }: NodeProps<ViewNode>) {
  const icon =
    data.kind === 'start'
      ? '始'
      : data.kind === 'end'
        ? '终'
        : data.kind === 'condition'
          ? '◇'
          : data.kind === 'cc'
            ? '知'
            : '审'
  return (
    <div className={styles.flowNode + ' ' + styles['kind' + data.kind]}>
      {data.kind !== 'start' && (
        <Handle type="target" position={Position.Left} className={styles.handle} />
      )}
      <div className={styles.nodeIcon}>{icon}</div>
      <div className={styles.nodeText}>
        <b>{data.label}</b>
        {data.meta && <small>{data.meta}</small>}
      </div>
      {data.kind !== 'end' && (
        <Handle type="source" position={Position.Right} className={styles.handle} />
      )}
    </div>
  )
}
const nodeTypes = { approvalNode: FlowNodeView }

function ModelCanvas({
  model,
  positions,
  onPosition,
  onConnect,
  onSelectNode,
  onSelectEdge,
}: {
  model: ApprovalModel
  positions: PositionMap
  onPosition: (id: string, position: { x: number; y: number }) => void
  onConnect: (connection: Connection) => void
  onSelectNode: (id: string) => void
  onSelectEdge: (id: string) => void
}) {
  const nodes = useMemo<ViewNode[]>(
    () =>
      model.flow.nodes.map((node, index) => {
        const people =
          node.approver?.mode === 'starterSelect'
            ? '发起人选择审批人'
            : node.approver?.members?.filter(Boolean).join('、') || ''
        const meta =
          node.type === 'approval'
            ? methodLabels[node.method || 'single'] + ' · ' + people
            : node.type === 'cc'
              ? '通知 ' + (node.receivers?.filter(Boolean).join('、') || '待设置')
              : node.type === 'condition'
                ? model.flow.edges.filter((edge) => edge.source === node.id).length + ' 条路径'
                : ''
        return {
          id: node.id,
          type: 'approvalNode',
          position: positions[node.id] || {
            x: 80 + (index % 4) * 200,
            y: 90 + Math.floor(index / 4) * 150,
          },
          data: { kind: node.type, label: node.name || nodeTypeLabels[node.type], meta },
        }
      }),
    [model, positions],
  )
  const edges = useMemo<ViewEdge[]>(
    () =>
      model.flow.edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: 'smoothstep',
        label: edge.conditions?.length || edge.isDefault ? describeEdge(model, edge) : undefined,
        data: { label: describeEdge(model, edge), isDefault: edge.isDefault },
        style: { stroke: '#719080', strokeWidth: 2 },
        labelStyle: { fill: '#62776b', fontSize: 11 },
        labelBgStyle: { fill: '#fff', fillOpacity: 0.92 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#719080' },
      })),
    [model],
  )
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodeDragStop={(_, node) => onPosition(node.id, node.position)}
      onConnect={onConnect}
      onNodeClick={(_, node) => onSelectNode(node.id)}
      onEdgeClick={(_, edge) => onSelectEdge(edge.id)}
      fitView
      fitViewOptions={{ padding: 0.16 }}
      proOptions={{ hideAttribution: true }}
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#dce6e1" />
      <Controls position="bottom-left" />
    </ReactFlow>
  )
}

function parsePeople(value: string): string[] {
  return value
    .split(/[\n,，、]/)
    .map((name) => name.trim())
    .filter(Boolean)
}
function defaultRule(field?: ApprovalFormField): ApprovalConditionRule {
  return {
    field: field?.id || '',
    operator: field?.type === 'number' ? '>' : '==',
    value:
      field?.type === 'number' ? 0 : field?.type === 'enum' ? field.options?.[0]?.value || '' : '',
  }
}
function optionValue(label: string, options: ApprovalFieldOption[], ignoreIndex = -1): string {
  const latin = label
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  let hash = 2166136261
  for (const character of label) hash = Math.imul(hash ^ character.codePointAt(0)!, 16777619)
  const base = latin || 'option_' + (hash >>> 0).toString(36)
  let value = base
  let suffix = 2
  while (options.some((option, index) => index !== ignoreIndex && option.value === value))
    value = base + '_' + suffix++
  return value
}

function FormEditor({
  fields,
  update,
  preview,
}: {
  fields: ApprovalFormField[]
  update: (fields: ApprovalFormField[]) => void
  preview: () => void
}) {
  const add = () => {
    const index = fields.length + 1
    let id = 'field_' + index
    while (fields.some((field) => field.id === id))
      id = 'field_' + index + '_' + createModelId('v').slice(-4)
    update([...fields, { id, label: '新表单项', type: 'text', required: false }])
  }
  const change = (index: number, patch: Partial<ApprovalFormField>) =>
    update(fields.map((field, i) => (i === index ? { ...field, ...patch } : field)))
  const updateOption = (
    field: ApprovalFormField,
    index: number,
    patch: Partial<ApprovalFieldOption>,
  ) => (field.options || []).map((option, i) => (i === index ? { ...option, ...patch } : option))
  return (
    <section className={styles.panelSection}>
      <div className={styles.sectionHeading}>
        <div>
          <b>发起表单</b>
          <small>表单字段也用于设置条件分支</small>
        </div>
        <Space size={5}>
          <Button size="small" icon={<EyeOutlined />} onClick={preview}>
            预览
          </Button>
          <Button size="small" icon={<PlusOutlined />} onClick={add}>
            添加字段
          </Button>
        </Space>
      </div>
      <div className={styles.fieldCards}>
        {fields.map((field, index) => (
          <article className={styles.fieldCard} key={field.id + index}>
            <div className={styles.fieldCardHeading}>
              <span>
                <i>{index + 1}</i>
                <b>{field.label || '未命名字段'}</b>
              </span>
              <Button
                aria-label={'删除' + (field.label || '表单字段')}
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={() => update(fields.filter((_, i) => i !== index))}
              />
            </div>
            <div className={styles.fieldEditor}>
              <label>显示名称</label>
              <Input
                value={field.label}
                maxLength={60}
                placeholder="例如：预计请假天数"
                onChange={(event) => change(index, { label: event.target.value })}
              />
              <label>表单类型</label>
              <Select
                value={field.type}
                options={Object.entries(fieldTypeLabels).map(([value, label]) => ({
                  value,
                  label,
                }))}
                onChange={(type: ApprovalFormField['type']) =>
                  change(index, {
                    type,
                    options:
                      type === 'enum'
                        ? field.options || [{ value: 'option_1', label: '选项一' }]
                        : undefined,
                  })
                }
              />
              <label>填写要求</label>
              <Checkbox
                checked={field.required}
                onChange={(event) => change(index, { required: event.target.checked })}
              >
                必填
              </Checkbox>
              {field.type === 'enum' && (
                <div className={styles.optionsEditor}>
                  <div className={styles.optionsHeading}>
                    <b>可选项</b>
                    <Button
                      size="small"
                      type="link"
                      icon={<PlusOutlined />}
                      onClick={() => {
                        const options = field.options || []
                        const label = '新选项'
                        change(index, {
                          options: [...options, { value: optionValue(label, options), label }],
                        })
                      }}
                    >
                      添加选项
                    </Button>
                  </div>
                  {(field.options || []).map((option, optionIndex) => (
                    <div className={styles.optionRow} key={option.value + optionIndex}>
                      <Input
                        aria-label="选项名称"
                        value={option.label}
                        placeholder="显示名称"
                        onChange={(event) =>
                          change(index, {
                            options: updateOption(field, optionIndex, {
                              label: event.target.value,
                            }),
                          })
                        }
                      />
                      <Button
                        aria-label="删除选项"
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() =>
                          change(index, {
                            options: field.options?.filter((_, i) => i !== optionIndex),
                          })
                        }
                      />
                    </div>
                  ))}
                  <small>选项保存值由系统生成，业务人员只需维护显示名称。</small>
                </div>
              )}
            </div>
          </article>
        ))}
        {!fields.length && (
          <div className={styles.emptyCard}>添加表单字段后，发起人填写的信息才能进入审批流程。</div>
        )}
      </div>
    </section>
  )
}

function ModelExport({
  model,
  issues,
  close,
}: {
  model: ApprovalModel
  issues: string[]
  close: () => void
}) {
  const json = JSON.stringify(model, null, 2)
  const [copying, setCopying] = useState(false)
  const download = () => {
    if (issues.length) return
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = model.process.code + '.approval.json'
    link.click()
    URL.revokeObjectURL(url)
  }
  const copy = async () => {
    setCopying(true)
    try {
      await copyText(json)
      message.success('业务模型 JSON 已复制')
    } catch (cause) {
      message.error(cause instanceof Error ? cause.message : '复制失败')
    } finally {
      setCopying(false)
    }
  }
  return (
    <Modal
      open
      width={760}
      title={
        <span>
          <CodeOutlined /> 业务模型 JSON
        </span>
      }
      onCancel={close}
      footer={
        <Space>
          <Button onClick={close}>关闭</Button>
          <Button icon={<DownloadOutlined />} disabled={Boolean(issues.length)} onClick={download}>
            下载 JSON
          </Button>
          <Button
            type="primary"
            icon={<CopyOutlined />}
            loading={copying}
            onClick={() => void copy()}
          >
            复制 JSON
          </Button>
        </Space>
      }
    >
      {issues.length > 0 && (
        <Alert
          type="warning"
          showIcon
          message="模型还需要完善"
          description={
            <ul className={styles.issueList}>
              {issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          }
        />
      )}
      <p className={styles.exportNote}>
        这是业务模型契约，不含画布坐标或流程引擎配置；校验通过后可下载并交给后端编译。
      </p>
      <Input.TextArea
        aria-label="业务模型 JSON 内容"
        value={json}
        readOnly
        autoSize={{ minRows: 15, maxRows: 25 }}
        className={styles.jsonPreview}
      />
    </Modal>
  )
}

export function DesignerPage() {
  const [model, setModel] = useState(createInitialApprovalModel)
  const [positions, setPositions] = useState<PositionMap>(initialPositions)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [formPreviewOpen, setFormPreviewOpen] = useState(false)
  const issues = useMemo(() => validateApprovalModel(model), [model])
  const selectedNode = model.flow.nodes.find((node) => node.id === selectedNodeId)
  const selectedEdge = model.flow.edges.find((edge) => edge.id === selectedEdgeId)
  const edit = (change: (current: ApprovalModel) => ApprovalModel) =>
    setModel((current) => change(current))
  const updateNode = (id: string, patch: Partial<ApprovalNode>) =>
    edit((current) => ({
      ...current,
      flow: {
        ...current.flow,
        nodes: current.flow.nodes.map((node) => (node.id === id ? { ...node, ...patch } : node)),
      },
    }))
  const addNode = (type: ApprovalNodeType) => {
    if (
      (type === 'start' || type === 'end') &&
      model.flow.nodes.some((node) => node.type === type)
    ) {
      message.info('流程只需要一个' + nodeTypeLabels[type] + '步骤。')
      return
    }
    const id = createModelId(type)
    const defaults: Record<ApprovalNodeType, ApprovalNode> = {
      start: { id, type },
      approval: {
        id,
        type,
        name: '新审批步骤',
        approver: { mode: 'member', members: [] },
        method: 'single',
      },
      condition: { id, type, name: '条件分支' },
      cc: { id, type, name: '抄送步骤', receivers: [] },
      end: { id, type },
    }
    edit((current) => ({
      ...current,
      flow: { ...current.flow, nodes: [...current.flow.nodes, defaults[type]] },
    }))
    setPositions((current) => ({
      ...current,
      [id]: {
        x: 120 + (model.flow.nodes.length % 4) * 210,
        y: 330 + Math.floor(model.flow.nodes.length / 4) * 130,
      },
    }))
    setSelectedNodeId(id)
    setSelectedEdgeId(null)
  }
  const removeNode = (id: string) => {
    edit((current) => ({
      ...current,
      flow: {
        nodes: current.flow.nodes.filter((node) => node.id !== id),
        edges: current.flow.edges.filter((edge) => edge.source !== id && edge.target !== id),
      },
    }))
    setSelectedNodeId(null)
    setSelectedEdgeId(null)
  }
  const connect = (connection: Connection) => {
    if (
      !connection.source ||
      !connection.target ||
      connection.source === connection.target ||
      model.flow.edges.some(
        (edge) => edge.source === connection.source && edge.target === connection.target,
      )
    )
      return
    const isCondition =
      model.flow.nodes.find((node) => node.id === connection.source)?.type === 'condition'
    const hasDefault = model.flow.edges.some(
      (edge) => edge.source === connection.source && edge.isDefault,
    )
    const edge: ApprovalEdge = {
      id: createModelId('edge'),
      source: connection.source,
      target: connection.target,
      ...(isCondition && !hasDefault ? { isDefault: true } : {}),
    }
    edit((current) => ({
      ...current,
      flow: { ...current.flow, edges: [...current.flow.edges, edge] },
    }))
    setSelectedEdgeId(edge.id)
    setSelectedNodeId(null)
  }
  const updateEdge = (id: string, patch: Partial<ApprovalEdge>) =>
    edit((current) => ({
      ...current,
      flow: {
        ...current.flow,
        edges: current.flow.edges.map((edge) => {
          if (edge.id === id) return { ...edge, ...patch }
          const selected = current.flow.edges.find((item) => item.id === id)
          if (patch.isDefault && selected && edge.source === selected.source)
            return { ...edge, isDefault: undefined }
          return edge
        }),
      },
    }))
  const addRule = (edge: ApprovalEdge) =>
    updateEdge(edge.id, {
      isDefault: undefined,
      conditions: [
        ...(edge.conditions || []),
        defaultRule(model.form.fields.find((field) => field.type !== 'date')),
      ],
    })
  const updateRule = (edge: ApprovalEdge, index: number, patch: Partial<ApprovalConditionRule>) => {
    if (patch.field === '__remove__') {
      updateEdge(edge.id, { conditions: edge.conditions?.filter((_, i) => i !== index) })
      return
    }
    const conditions = (edge.conditions || []).map((rule, i) => {
      if (i !== index) return rule
      if (patch.field)
        return {
          ...defaultRule(model.form.fields.find((field) => field.id === patch.field)),
          ...patch,
        }
      return { ...rule, ...patch }
    })
    updateEdge(edge.id, { conditions, isDefault: undefined })
  }
  const removeEdge = (id: string) => {
    edit((current) => ({
      ...current,
      flow: { ...current.flow, edges: current.flow.edges.filter((edge) => edge.id !== id) },
    }))
    setSelectedEdgeId(null)
  }
  const fieldsForRules = model.form.fields
    .filter((field) => field.type !== 'date')
    .map((field) => ({ value: field.id, label: field.label || '未命名字段' }))
  const updateFields = (fields: ApprovalFormField[]) =>
    edit((current) => ({
      ...current,
      form: { fields },
      flow: {
        ...current.flow,
        edges: current.flow.edges.map((edge) => ({
          ...edge,
          conditions: edge.conditions?.filter((rule) =>
            fields.some((field) => field.id === rule.field),
          ),
        })),
      },
    }))
  const updateProcessName = (name: string) =>
    edit((current) => ({ ...current, process: { ...current.process, name } }))

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headingCopy}>
          <div className={styles.eyebrow}>审批流程 / 业务模型</div>
          <div className={styles.titleLine}>
            <h1>{model.process.name || '未命名审批'}</h1>
            <Tag color={issues.length ? 'orange' : 'green'}>
              {issues.length ? '待完善' : '模型有效'}
            </Tag>
          </div>
          <p>用业务语言配置表单与审批步骤，系统会将模型交给后端编译。</p>
        </div>
        <div className={styles.headerActions}>
          <span>
            {model.flow.nodes.length} 个步骤 · {model.flow.edges.length} 条路径
          </span>
          <Button type="primary" icon={<CodeOutlined />} onClick={() => setExportOpen(true)}>
            查看业务模型 JSON
          </Button>
        </div>
      </header>
      <div className={styles.modelWorkspace}>
        <aside className={styles.leftPanel}>
          <section className={styles.panelSection}>
            <div className={styles.sectionHeading}>
              <div>
                <b>添加步骤</b>
                <small>将流程拆成清楚的业务步骤</small>
              </div>
            </div>
            <div className={styles.nodePalette}>
              {nodeOrder.map((type) => (
                <Button
                  key={type}
                  disabled={
                    (type === 'start' || type === 'end') &&
                    model.flow.nodes.some((node) => node.type === type)
                  }
                  onClick={() => addNode(type)}
                >
                  <i className={styles['palette' + type]}>
                    {type === 'condition' ? '◇' : nodeTypeLabels[type].slice(0, 1)}
                  </i>
                  {nodeTypeLabels[type]}
                  <PlusOutlined />
                </Button>
              ))}
            </div>
          </section>
          <FormEditor
            fields={model.form.fields}
            update={updateFields}
            preview={() => setFormPreviewOpen(true)}
          />
          <section className={styles.rejectNote}>
            <CheckCircleFilled />
            <span>
              <b>审批打回</b>
              <small>发起人修改表单并重新提交后，流程回到打回它的审批步骤。</small>
            </span>
          </section>
        </aside>
        <main className={styles.flowPanel}>
          <div className={styles.flowBar}>
            <span>
              <ApartmentOutlined /> 流程预览
            </span>
            <small>拖动步骤调整布局 · 从步骤右侧连接点拖出路径</small>
          </div>
          <div className={styles.flowCanvas}>
            <ReactFlowProvider>
              <ModelCanvas
                model={model}
                positions={positions}
                onPosition={(id, position) =>
                  setPositions((current) => ({ ...current, [id]: position }))
                }
                onConnect={connect}
                onSelectNode={(id) => {
                  setSelectedNodeId(id)
                  setSelectedEdgeId(null)
                }}
                onSelectEdge={(id) => {
                  setSelectedEdgeId(id)
                  setSelectedNodeId(null)
                }}
              />
            </ReactFlowProvider>
          </div>
          <div className={styles.flowHint}>条件分支需要至少两条路径，并且恰好一条默认分支。</div>
        </main>
        <aside className={styles.rightPanel}>
          <section className={styles.panelSection}>
            <div className={styles.sectionHeading}>
              <div>
                <b>流程信息</b>
                <small>供业务人员识别</small>
              </div>
            </div>
            <label className={styles.formLabel}>流程名称</label>
            <Input
              value={model.process.name}
              maxLength={120}
              onChange={(event) => updateProcessName(event.target.value)}
            />
          </section>
          <section className={styles.inspectorSection}>
            <div className={styles.sectionHeading}>
              <div>
                <b>{selectedNode ? '步骤设置' : selectedEdge ? '路径设置' : '编辑说明'}</b>
                <small>
                  {selectedNode
                    ? nodeTypeLabels[selectedNode.type]
                    : selectedEdge
                      ? '设置业务条件'
                      : '选择流程中的步骤或路径'}
                </small>
              </div>
            </div>
            {!selectedNode && !selectedEdge && (
              <div className={styles.inspectorEmpty}>
                <ApartmentOutlined />
                <b>选择步骤或路径</b>
                <span>右侧显示业务设置，不需要填写流程引擎配置。</span>
              </div>
            )}
            {selectedNode && (
              <div className={styles.inspector}>
                {!['start', 'end'].includes(selectedNode.type) && (
                  <>
                    <label className={styles.formLabel}>步骤名称</label>
                    <Input
                      value={selectedNode.name || ''}
                      onChange={(event) =>
                        updateNode(selectedNode.id, { name: event.target.value })
                      }
                    />
                  </>
                )}
                {selectedNode.type === 'approval' && (
                  <ApprovalInspector node={selectedNode} update={updateNode} />
                )}
                {selectedNode.type === 'cc' && (
                  <>
                    <label className={styles.formLabel}>通知对象</label>
                    <Input.TextArea
                      rows={3}
                      value={(selectedNode.receivers || []).join('、')}
                      placeholder="每行填写一位成员姓名"
                      onChange={(event) =>
                        updateNode(selectedNode.id, { receivers: parsePeople(event.target.value) })
                      }
                    />
                    <small>填写一位或多位接收通知的成员。</small>
                  </>
                )}
                {selectedNode.type === 'condition' && (
                  <p className={styles.helperText}>
                    选中每条路径设置表单字段条件，并指定一条默认分支。
                  </p>
                )}
                {selectedNode.type === 'start' && (
                  <p className={styles.helperText}>审批从这里开始，发起人填写左侧定义的表单。</p>
                )}
                {selectedNode.type === 'end' && (
                  <p className={styles.helperText}>审批完成后到达这里。</p>
                )}
                <Button
                  className={styles.removeButton}
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => removeNode(selectedNode.id)}
                >
                  删除此步骤
                </Button>
              </div>
            )}
            {selectedEdge && (
              <EdgeInspector
                edge={selectedEdge}
                model={model}
                fieldOptions={fieldsForRules}
                updateRule={updateRule}
                updateEdge={updateEdge}
                addRule={addRule}
                remove={removeEdge}
              />
            )}
          </section>
          <div className={styles.validationBox}>
            <div className={styles.validationHeading}>
              <b>导出前检查</b>
              <span>{issues.length ? issues.length + ' 项待完善' : '全部通过'}</span>
            </div>
            {issues.length ? (
              <ul>
                {issues.slice(0, 4).map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            ) : (
              <p>表单、审批人和分支结构符合业务模型约定。</p>
            )}
            {issues.length > 4 && <small>还有 {issues.length - 4} 项，打开 JSON 查看全部。</small>}
          </div>
        </aside>
      </div>
      {formPreviewOpen && (
        <Modal open title="发起表单预览" footer={null} onCancel={() => setFormPreviewOpen(false)}>
          <div className={styles.previewForm}>
            <p>发起人会填写以下内容，然后提交审批。</p>
            {model.form.fields.length ? (
              model.form.fields.map((field) => (
                <label key={field.id}>
                  <span>
                    {field.label || '未命名字段'}
                    {field.required && <i>必填</i>}
                  </span>
                  {field.type === 'enum' ? (
                    <Select
                      placeholder="请选择"
                      options={(field.options || []).map((option) => ({
                        value: option.value,
                        label: option.label,
                      }))}
                    />
                  ) : field.type === 'number' ? (
                    <InputNumber placeholder="请输入数字" style={{ width: '100%' }} />
                  ) : field.type === 'date' ? (
                    <DatePicker placeholder="请选择日期" style={{ width: '100%' }} />
                  ) : (
                    <Input placeholder="请输入" />
                  )}
                </label>
              ))
            ) : (
              <div className={styles.emptyCard}>表单还没有字段，请先添加表单项。</div>
            )}
          </div>
        </Modal>
      )}
      {exportOpen && (
        <ModelExport model={model} issues={issues} close={() => setExportOpen(false)} />
      )}
    </section>
  )
}

function ApprovalInspector({
  node,
  update,
}: {
  node: ApprovalNode
  update: (id: string, patch: Partial<ApprovalNode>) => void
}) {
  const mode = node.approver?.mode || 'member'
  const members = node.approver?.members || []
  const method = node.method || 'single'
  return (
    <div className={styles.inspectorGroup}>
      <label className={styles.formLabel}>审批人来源</label>
      <Select
        value={mode}
        options={[
          { value: 'member', label: '指定成员' },
          { value: 'starterSelect', label: '发起人自选' },
        ]}
        onChange={(value: 'member' | 'starterSelect') =>
          update(node.id, {
            approver: { mode: value, ...(value === 'member' ? { members } : {}) },
            method: 'single',
          })
        }
      />
      {mode === 'member' ? (
        <>
          <label className={styles.formLabel}>审批成员</label>
          <Input.TextArea
            rows={3}
            value={members.join('、')}
            placeholder="例如：张伟、李娜"
            onChange={(event) => {
              const nextMembers = parsePeople(event.target.value)
              update(node.id, {
                approver: { mode: 'member', members: nextMembers },
                ...(nextMembers.length <= 1
                  ? { method: 'single' }
                  : method === 'single'
                    ? { method: undefined }
                    : {}),
              })
            }}
          />
          <small>
            按姓名填写，一行一人；第一版暂不连接组织通讯录。姓名暂不核验，填写错误会导致待办无人可见。
          </small>
        </>
      ) : (
        <p className={styles.helperText}>发起人在提交表单时选择一位审批人。</p>
      )}
      {mode === 'member' && (
        <>
          <label className={styles.formLabel}>审批方式</label>
          <Select
            value={node.method}
            placeholder="请选择审批方式"
            options={Object.entries(methodLabels).map(([value, label]) => ({ value, label }))}
            onChange={(value: ApprovalMethod) => update(node.id, { method: value })}
          />
        </>
      )}
      {mode === 'member' && members.filter(Boolean).length > 1 && method === 'single' && (
        <Alert type="warning" showIcon message="多位审批人需要选择会签或或签。" />
      )}
      {method === 'countersign' && <small>所有审批成员都通过后，这一步才完成。</small>}
      {method === 'orsign' && <small>任意一位审批成员通过后，这一步就完成。</small>}
    </div>
  )
}

function EdgeInspector({
  edge,
  model,
  fieldOptions,
  updateRule,
  updateEdge,
  addRule,
  remove,
}: {
  edge: ApprovalEdge
  model: ApprovalModel
  fieldOptions: Array<{ value: string; label: string }>
  updateRule: (edge: ApprovalEdge, index: number, patch: Partial<ApprovalConditionRule>) => void
  updateEdge: (id: string, patch: Partial<ApprovalEdge>) => void
  addRule: (edge: ApprovalEdge) => void
  remove: (id: string) => void
}) {
  const source = model.flow.nodes.find((node) => node.id === edge.source)
  const target = model.flow.nodes.find((node) => node.id === edge.target)
  const isCondition = source?.type === 'condition'
  return (
    <div className={styles.inspector}>
      <small className={styles.edgeCaption}>
        {source?.name || nodeTypeLabels[source?.type || 'start']} →{' '}
        {target?.name || nodeTypeLabels[target?.type || 'end']}
      </small>
      {isCondition && (
        <Checkbox
          checked={Boolean(edge.isDefault)}
          onChange={(event) =>
            updateEdge(edge.id, {
              isDefault: event.target.checked ? true : undefined,
              conditions: event.target.checked ? undefined : [],
            })
          }
        >
          设为默认分支
        </Checkbox>
      )}
      {isCondition && !edge.isDefault && (
        <div className={styles.ruleList}>
          <div className={styles.ruleHeading}>
            <b>满足以下条件时经过</b>
            <Button
              type="link"
              size="small"
              disabled={!model.form.fields.some((field) => field.type !== 'date')}
              onClick={() => addRule(edge)}
            >
              添加条件
            </Button>
          </div>
          {(edge.conditions || []).map((rule, index) => {
            const field = model.form.fields.find((item) => item.id === rule.field)
            const operators =
              field?.type === 'number' ? operatorOptions : operatorOptions.slice(0, 2)
            return (
              <div className={styles.ruleCard} key={rule.field + index}>
                <div className={styles.ruleCardHeading}>
                  <span>条件 {index + 1}</span>
                  <Button
                    type="text"
                    danger
                    size="small"
                    aria-label="删除条件"
                    icon={<DeleteOutlined />}
                    onClick={() => updateRule(edge, index, { field: '__remove__' })}
                  />
                </div>
                <label className={styles.formLabel}>表单字段</label>
                <Select
                  value={rule.field || undefined}
                  placeholder="选择字段"
                  options={fieldOptions}
                  onChange={(value: string) => updateRule(edge, index, { field: value })}
                />
                {field && (
                  <>
                    <label className={styles.formLabel}>比较方式</label>
                    <Select
                      value={rule.operator}
                      options={operators}
                      onChange={(value: ApprovalOperator) =>
                        updateRule(edge, index, { operator: value })
                      }
                    />
                    <label className={styles.formLabel}>比较值</label>
                    {field.type === 'enum' ? (
                      <Select
                        value={String(rule.value)}
                        options={(field.options || []).map((option) => ({
                          value: option.value,
                          label: option.label,
                        }))}
                        onChange={(value: string) => updateRule(edge, index, { value })}
                      />
                    ) : (
                      <Input
                        type={
                          field.type === 'number'
                            ? 'number'
                            : field.type === 'date'
                              ? 'date'
                              : 'text'
                        }
                        value={String(rule.value)}
                        onChange={(event) =>
                          updateRule(edge, index, {
                            value:
                              field.type === 'number' && event.target.value !== ''
                                ? Number(event.target.value)
                                : event.target.value,
                          })
                        }
                      />
                    )}
                  </>
                )}
              </div>
            )
          })}
          {!(edge.conditions || []).length && (
            <div className={styles.emptyRule}>
              {model.form.fields.some((field) => field.type !== 'date')
                ? '添加一个条件，或将这条路径设为默认分支。'
                : '先在左侧添加文本、数字或单选项字段，再设置条件。'}
            </div>
          )}
          {(edge.conditions || []).length > 1 && <small>多个条件需同时满足。</small>}
        </div>
      )}
      {!isCondition && <p className={styles.helperText}>普通步骤之间的连接不需要额外设置条件。</p>}
      <Button
        className={styles.removeButton}
        danger
        icon={<DeleteOutlined />}
        onClick={() => remove(edge.id)}
      >
        删除这条路径
      </Button>
    </div>
  )
}
