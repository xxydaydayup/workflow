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
  CheckOutlined,
  CloseOutlined,
  CodeOutlined,
  CopyOutlined,
  DeleteOutlined,
  PlusOutlined,
  ShareAltOutlined,
} from '@ant-design/icons'
import { Button, Input, Select, Tag, message } from 'antd'
import styles from './DesignerPage.module.less'
import '@xyflow/react/dist/style.css'

type Kind = 'startEvent' | 'userTask' | 'exclusiveGateway' | 'endEvent'
type Data = { kind: Kind; name: string; assignee?: string }
type FlowData = { conditionExpression?: string }
type PNode = Node<Data, 'processNode'>
type PEdge = Edge<FlowData>
type Variant = 'canvas' | 'steps' | 'structure'
type DTO = {
  processId: string
  processName: string
  nodes: Array<{ id: string; type: Kind; name: string; x: number; y: number; assignee?: string }>
  flows: Array<{ id: string; source: string; target: string; conditionExpression?: string }>
}
type FieldsProps = {
  processId: string
  processName: string
  setProcessId: (v: string) => void
  setProcessName: (v: string) => void
}
type InspectorProps = {
  node?: PNode
  edge?: PEdge
  onNode: (key: 'name' | 'assignee', value: string) => void
  onEdge: (value: string) => void
  onDelete: () => void
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
      id: 'task_manager',
      type: 'processNode',
      position: { x: 220, y: 208 },
      data: { kind: 'userTask', name: '部门负责人审批', assignee: 'dept_manager' },
    },
    {
      id: 'gateway_days',
      type: 'processNode',
      position: { x: 445, y: 219 },
      data: { kind: 'exclusiveGateway', name: '天数判断' },
    },
    {
      id: 'task_hr',
      type: 'processNode',
      position: { x: 650, y: 92 },
      data: { kind: 'userTask', name: '人事复核', assignee: 'hr' },
    },
    {
      id: 'end_done',
      type: 'processNode',
      position: { x: 900, y: 225 },
      data: { kind: 'endEvent', name: '审批完成' },
    },
  ]
}
function makeEdges(): PEdge[] {
  return [
    { id: 'flow_1', source: 'start_apply', target: 'task_manager', type: 'smoothstep', data: {} },
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
  return (
    <div className={styles.fields}>
      <b className={styles.sectionLabel}>流程信息</b>
      <label>流程名称</label>
      <Input size="small" value={processName} onChange={(e) => setProcessName(e.target.value)} />
      <label>
        流程标识 <small>仅字母、数字、下划线</small>
      </label>
      <Input
        size="small"
        value={processId}
        onChange={(e) => setProcessId(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
      />
    </div>
  )
}
function Inspector({ node, edge, onNode, onEdge, onDelete }: InspectorProps) {
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
        </>
      )}
      <Button danger type="text" icon={<DeleteOutlined />} onClick={onDelete}>
        删除节点
      </Button>
    </div>
  )
}
function Header({
  name,
  count,
  edges,
  open,
}: {
  name: string
  count: number
  edges: number
  open: () => void
}) {
  return (
    <header className={styles.header}>
      <div>
        <div className={styles.eyebrow}>流程工作台 / 新建流程</div>
        <h1>
          {name} <Tag>未发布</Tag>{' '}
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
function Drawer({ dto, close }: { dto: DTO; close: () => void }) {
  const [copied, setCopied] = useState(false)
  const json = JSON.stringify(dto, null, 2)
  const copy = async () => {
    await navigator.clipboard?.writeText(json)
    setCopied(true)
    message.success('请求 JSON 已复制')
  }
  return (
    <div
      className={styles.backdrop}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close()
      }}
    >
      <section className={styles.drawer}>
        <header>
          <div>
            <CodeOutlined />
            <span>
              <b>后端请求 JSON</b>
              <small>POST /api/v1/bpmn/json2xml · 暂未连接接口</small>
            </span>
          </div>
          <button onClick={close}>
            <CloseOutlined />
          </button>
        </header>
        <p>
          <CheckOutlined /> 已整理为 ProcessDefinitionDTO 结构
        </p>
        <pre>{json}</pre>
        <footer>
          <span>
            {dto.nodes.length} nodes · {dto.flows.length} flows
          </span>
          <Button type="primary" icon={<CopyOutlined />} onClick={copy}>
            {copied ? '已复制' : '复制 JSON'}
          </Button>
        </footer>
      </section>
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
  const [open, setOpen] = useState(false)
  const node = nodes.find((n) => n.id === nodeId)
  const edge = edges.find((e) => e.id === edgeId)
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
  const updateNode = (key: 'name' | 'assignee', value: string) => {
    if (nodeId)
      setNodes((cur) =>
        cur.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, [key]: value } } : n)),
      )
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
    open: () => setOpen(true),
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
        open={() => setOpen(true)}
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
      {open && <Drawer dto={dto} close={() => setOpen(false)} />}
    </section>
  )
}
