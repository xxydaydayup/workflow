/**
 * Throwaway UI prototype for the business-first approval flow designer.
 * The existing /designer route mounts it only in development with ?variant=canvas.
 */
import { useCallback, useMemo, useState, type DragEvent } from 'react'
import {
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  reconnectEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import {
  ApartmentOutlined,
  CheckCircleFilled,
  CloseOutlined,
  DeleteOutlined,
  DragOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
  InfoCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Alert, Button, Input, Select, Tag } from 'antd'
import styles from './DesignerPrototype.module.less'

type NodeKind = 'start' | 'approval' | 'condition' | 'countersign' | 'end'
type Branch = 'continue' | 'pass' | 'reject'
type NodeData = { kind: NodeKind; name: string; purpose?: 'application' | 'review' }
type EdgeData = { branch: Branch }
type PaletteEntry = {
  kind: NodeKind
  title: string
  detail: string
  icon: string
  purpose?: 'application' | 'review'
}
type BusinessNode = Node<NodeData, 'business'>
type BusinessEdge = Edge<EdgeData>
type ValidationIssue = { message: string; nodeId?: string; edgeId?: string }

const nodeLabels: Record<NodeKind, string> = {
  start: '开始',
  approval: '审批',
  condition: '条件分支',
  countersign: '会签',
  end: '结束',
}
const nodeDescriptions: Record<NodeKind, string> = {
  start: '流程的唯一入口',
  approval: '按流程约定完成审批表决',
  condition: '依据上一步的审批结果分流',
  countersign: '所有参与人同意后继续',
  end: '流程的唯一完成出口',
}
const purposeLabels = { application: '申请填写', review: '审批' } as const
const purposeDescriptions = {
  application: '发起人填写或修改固定的立项申请单',
  review: '按流程约定完成审批表决',
} as const
const paletteNodes: PaletteEntry[] = [
  { kind: 'start', title: '开始', detail: '流程入口', icon: '始' },
  {
    kind: 'approval',
    title: '申请填写',
    detail: '填写或修改立项申请单',
    icon: '表',
    purpose: 'application',
  },
  { kind: 'approval', title: '审批', detail: '单人审批表决', icon: '审', purpose: 'review' },
  { kind: 'condition', title: '条件分支', detail: '按审批结果分流', icon: '◇' },
  { kind: 'countersign', title: '会签', detail: '所有人同意后通过', icon: '签' },
  { kind: 'end', title: '结束', detail: '流程完成', icon: '终' },
]

const initialNodes: BusinessNode[] = [
  {
    id: 'start',
    type: 'business',
    position: { x: 250, y: 12 },
    data: { kind: 'start', name: '发起' },
  },
  {
    id: 'apply',
    type: 'business',
    position: { x: 250, y: 122 },
    data: { kind: 'approval', name: '立项申请单', purpose: 'application' },
  },
  {
    id: 'minister',
    type: 'business',
    position: { x: 250, y: 238 },
    data: { kind: 'approval', name: '部长审批', purpose: 'review' },
  },
  {
    id: 'minister-result',
    type: 'business',
    position: { x: 250, y: 354 },
    data: { kind: 'condition', name: '部长审批结果' },
  },
  {
    id: 'managers',
    type: 'business',
    position: { x: 548, y: 438 },
    data: { kind: 'countersign', name: '各部门经理会签' },
  },
  {
    id: 'manager-result',
    type: 'business',
    position: { x: 250, y: 548 },
    data: { kind: 'condition', name: '会签结果' },
  },
  {
    id: 'end',
    type: 'business',
    position: { x: 250, y: 658 },
    data: { kind: 'end', name: '审批完成' },
  },
]

const makeEdge = (
  id: string,
  source: string,
  target: string,
  branch: Branch = 'continue',
): BusinessEdge => ({
  id,
  source,
  target,
  type: 'smoothstep',
  data: { branch },
  label: branch === 'pass' ? '通过' : branch === 'reject' ? '驳回，返回申请' : undefined,
  style: { stroke: branch === 'reject' ? '#d58a78' : '#92aa9d', strokeWidth: 1.8 },
  labelStyle: { fill: branch === 'reject' ? '#a85e4b' : '#527463', fontSize: 11 },
  labelBgStyle: { fill: '#ffffff', fillOpacity: 0.95 },
  markerEnd: { type: MarkerType.ArrowClosed, color: branch === 'reject' ? '#d58a78' : '#92aa9d' },
})
const initialEdges: BusinessEdge[] = [
  makeEdge('start-apply', 'start', 'apply'),
  makeEdge('apply-minister', 'apply', 'minister'),
  makeEdge('minister-result', 'minister', 'minister-result'),
  makeEdge('result-managers', 'minister-result', 'managers', 'pass'),
  makeEdge('result-apply', 'minister-result', 'apply', 'reject'),
  makeEdge('managers-result', 'managers', 'manager-result'),
  makeEdge('manager-result-end', 'manager-result', 'end', 'pass'),
  makeEdge('manager-result-apply', 'manager-result', 'apply', 'reject'),
]
const nodeTypes = { business: BusinessFlowNode }
const displayNodeLabel = (node: BusinessNode) =>
  node.data.purpose ? purposeLabels[node.data.purpose] : nodeLabels[node.data.kind]
const displayNodeDescription = (node: BusinessNode) =>
  node.data.purpose ? purposeDescriptions[node.data.purpose] : nodeDescriptions[node.data.kind]

function BusinessFlowNode({ data, selected }: NodeProps<BusinessNode>) {
  const icon = paletteNodes.find(
    (item) => item.kind === data.kind && item.purpose === data.purpose,
  )?.icon
  return (
    <div
      className={
        styles.flowNode +
        ' ' +
        styles['node-' + data.kind] +
        (data.purpose ? ' ' + styles['purpose-' + data.purpose] : '') +
        (selected ? ' ' + styles.nodeSelected : '')
      }
    >
      {data.kind !== 'start' && (
        <Handle type="target" position={Position.Top} className={styles.handle} />
      )}
      <span className={styles.nodeIcon}>{icon}</span>
      <span className={styles.nodeCopy}>
        <b>{data.name}</b>
        <small>
          {data.kind === 'countersign'
            ? '全员同意 · ALL'
            : data.purpose
              ? purposeDescriptions[data.purpose]
              : nodeDescriptions[data.kind]}
        </small>
      </span>
      {data.kind === 'approval' && (
        <span className={styles.nodeBadge}>
          <UserOutlined /> 启动时指定
        </span>
      )}
      {data.kind !== 'end' && (
        <Handle type="source" position={Position.Bottom} className={styles.handle} />
      )}
    </div>
  )
}

function inspectFlow(nodes: BusinessNode[], edges: BusinessEdge[]): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const starts = nodes.filter((node) => node.data.kind === 'start')
  const ends = nodes.filter((node) => node.data.kind === 'end')
  if (starts.length !== 1) issues.push({ message: '流程需要且只能有一个开始节点。' })
  if (ends.length !== 1) issues.push({ message: '流程需要且只能有一个结束节点。' })
  if (!nodes.some((node) => node.data.purpose === 'application'))
    issues.push({ message: '流程中需要包含立项申请填写步骤。' })

  const byId = new Map(nodes.map((node) => [node.id, node]))
  const outgoing = new Map<string, BusinessEdge[]>()
  const incoming = new Map<string, BusinessEdge[]>()
  const edgePairs = new Set<string>()
  for (const edge of edges) {
    const source = byId.get(edge.source)
    const target = byId.get(edge.target)
    if (!source || !target) {
      issues.push({ message: '有连线指向已删除或不存在的节点。', edgeId: edge.id })
      continue
    }
    if (edge.source === edge.target)
      issues.push({ message: '节点不能连接到自身。', edgeId: edge.id })
    const pair = edge.source + '->' + edge.target
    if (edgePairs.has(pair))
      issues.push({ message: '同一对节点之间存在重复连线。', edgeId: edge.id })
    edgePairs.add(pair)
    outgoing.set(edge.source, [...(outgoing.get(edge.source) || []), edge])
    incoming.set(edge.target, [...(incoming.get(edge.target) || []), edge])
    if (source.data.kind === 'end')
      issues.push({ message: '结束节点不能再连接后续步骤。', edgeId: edge.id })
    if (target.data.kind === 'start')
      issues.push({ message: '开始节点不能有流入连线。', edgeId: edge.id })
  }
  for (const node of nodes) {
    if (!node.data.name.trim())
      issues.push({
        message: '请填写“' + nodeLabels[node.data.kind] + '”节点名称。',
        nodeId: node.id,
      })
    const next = outgoing.get(node.id) || []
    const previous = incoming.get(node.id) || []
    if (node.data.kind !== 'end' && next.length === 0)
      issues.push({ message: '“' + node.data.name + '”没有后续步骤。', nodeId: node.id })
    if (node.data.kind !== 'start' && previous.length === 0)
      issues.push({ message: '“' + node.data.name + '”没有上游步骤。', nodeId: node.id })
    if (node.data.kind === 'condition') {
      const priorKind = byId.get(previous[0]?.source || '')?.data.kind
      if (previous.length !== 1 || !['approval', 'countersign'].includes(priorKind || ''))
        issues.push({
          message: '“' + node.data.name + '”应紧接在审批或会签节点之后。',
          nodeId: node.id,
        })
      const pass = next.filter((edge) => edge.data?.branch === 'pass')
      const reject = next.filter((edge) => edge.data?.branch === 'reject')
      if (pass.length !== 1)
        issues.push({
          message: '“' + node.data.name + '”需要且只能有一条“通过”路径。',
          nodeId: node.id,
        })
      if (reject.length !== 1)
        issues.push({
          message: '“' + node.data.name + '”需要且只能有一条“驳回”路径。',
          nodeId: node.id,
        })
      if (reject.length === 1 && byId.get(reject[0].target)?.data.purpose !== 'application')
        issues.push({
          message: '“' + node.data.name + '”的驳回路径应返回申请填写步骤。',
          edgeId: reject[0].id,
        })
    }
    if (
      node.data.kind === 'countersign' ||
      (node.data.kind === 'approval' && node.data.purpose !== 'application')
    ) {
      if (next.length !== 1 || byId.get(next[0]?.target || '')?.data.kind !== 'condition')
        issues.push({
          message: '“' + node.data.name + '”后需要连接条件分支，用于配置通过和驳回去向。',
          nodeId: node.id,
        })
    }
  }
  const start = starts[0]
  if (start) {
    const reachable = new Set<string>()
    const queue = [start.id]
    while (queue.length) {
      const current = queue.shift()!
      if (reachable.has(current)) continue
      reachable.add(current)
      for (const edge of outgoing.get(current) || []) queue.push(edge.target)
    }
    for (const node of nodes) {
      if (!reachable.has(node.id))
        issues.push({ message: '“' + node.data.name + '”从开始节点无法到达。', nodeId: node.id })
    }
    const canFinish = new Set(ends.map((node) => node.id))
    let changed = true
    while (changed) {
      changed = false
      for (const edge of edges) {
        if (canFinish.has(edge.target) && !canFinish.has(edge.source)) {
          canFinish.add(edge.source)
          changed = true
        }
      }
    }
    for (const node of nodes) {
      if (!canFinish.has(node.id))
        issues.push({
          message: '“' + node.data.name + '”之后没有通往结束节点的路径。',
          nodeId: node.id,
        })
    }
  }
  return issues
}

export function DesignerPrototype() {
  return (
    <ReactFlowProvider>
      <PrototypeEditor />
    </ReactFlowProvider>
  )
}

function PrototypeEditor() {
  const [nodes, setNodes, onNodesChange] = useNodesState<BusinessNode>(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState<BusinessEdge>(initialEdges)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [checkOpen, setCheckOpen] = useState(false)
  const [hasChecked, setHasChecked] = useState(false)
  const { screenToFlowPosition, fitView } = useReactFlow<BusinessNode, BusinessEdge>()
  const issues = useMemo(() => inspectFlow(nodes, edges), [nodes, edges])
  const selectedNode = nodes.find((node) => node.id === selectedNodeId)
  const selectedEdge = edges.find((edge) => edge.id === selectedEdgeId)
  const clearSelection = () => {
    setSelectedNodeId(null)
    setSelectedEdgeId(null)
  }
  const selectNode = (id: string) => {
    setSelectedNodeId(id)
    setSelectedEdgeId(null)
    setCheckOpen(false)
  }
  const selectEdge = (id: string) => {
    setSelectedEdgeId(id)
    setSelectedNodeId(null)
    setCheckOpen(false)
  }
  const updateNodeName = (name: string) => {
    if (!selectedNodeId) return
    setHasChecked(false)
    setNodes((current) =>
      current.map((node) =>
        node.id === selectedNodeId ? { ...node, data: { ...node.data, name } } : node,
      ),
    )
  }
  const addNode = useCallback(
    (kind: NodeKind, position?: { x: number; y: number }, purpose?: 'application' | 'review') => {
      if ((kind === 'start' || kind === 'end') && nodes.some((node) => node.data.kind === kind))
        return
      const id = kind + '-' + Math.random().toString(36).slice(2, 8)
      const base = nodes[nodes.length - 1]?.position || { x: 250, y: 700 }
      const node: BusinessNode = {
        id,
        type: 'business',
        position: position || { x: base.x + 30, y: base.y + 112 },
        data: {
          kind,
          name:
            kind === 'approval'
              ? purpose === 'application'
                ? '立项申请单'
                : '新审批步骤'
              : nodeLabels[kind],
          ...(kind === 'approval' ? { purpose: purpose || 'review' } : {}),
        },
      }
      setNodes((current) => [...current, node])
      setHasChecked(false)
      selectNode(id)
    },
    [nodes, setNodes],
  )
  const onDragStart = (event: DragEvent<HTMLButtonElement>, entry: PaletteEntry) => {
    event.dataTransfer.setData(
      'application/workflow-node',
      JSON.stringify({ kind: entry.kind, purpose: entry.purpose }),
    )
    event.dataTransfer.effectAllowed = 'move'
  }
  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    const payload = event.dataTransfer.getData('application/workflow-node')
    if (!payload) return
    let entry: Pick<PaletteEntry, 'kind' | 'purpose'>
    try {
      entry = JSON.parse(payload) as Pick<PaletteEntry, 'kind' | 'purpose'>
    } catch {
      return
    }
    if (
      !paletteNodes.some(
        (candidate) => candidate.kind === entry.kind && candidate.purpose === entry.purpose,
      )
    )
      return
    addNode(entry.kind, screenToFlowPosition({ x: event.clientX, y: event.clientY }), entry.purpose)
  }
  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return
      const source = nodes.find((node) => node.id === connection.source)
      const sourceBranches = edges.filter((edge) => edge.source === connection.source)
      const branch: Branch =
        source?.data.kind === 'condition'
          ? sourceBranches.some((edge) => edge.data?.branch === 'pass')
            ? 'reject'
            : 'pass'
          : 'continue'
      const edge = makeEdge(
        'path-' + Math.random().toString(36).slice(2, 8),
        connection.source,
        connection.target,
        branch,
      )
      setEdges((current) => addEdge(edge, current))
      setSelectedEdgeId(edge.id)
      setSelectedNodeId(null)
      setCheckOpen(false)
      setHasChecked(false)
    },
    [edges, nodes, setEdges],
  )
  const onReconnect = useCallback(
    (oldEdge: BusinessEdge, connection: Connection) => {
      if (!connection.source || !connection.target) return
      setEdges((current) => reconnectEdge(oldEdge, connection, current))
      setHasChecked(false)
    },
    [setEdges],
  )
  const updateEdgeBranch = (branch: Branch) => {
    if (!selectedEdgeId) return
    setHasChecked(false)
    setEdges((current) =>
      current.map((edge) =>
        edge.id === selectedEdgeId ? makeEdge(edge.id, edge.source, edge.target, branch) : edge,
      ),
    )
  }
  const deleteNode = () => {
    if (!selectedNode || selectedNode.data.kind === 'start' || selectedNode.data.kind === 'end')
      return
    setNodes((current) => current.filter((node) => node.id !== selectedNode.id))
    setEdges((current) =>
      current.filter((edge) => edge.source !== selectedNode.id && edge.target !== selectedNode.id),
    )
    clearSelection()
    setHasChecked(false)
  }
  const deleteEdge = () => {
    if (!selectedEdgeId) return
    setEdges((current) => current.filter((edge) => edge.id !== selectedEdgeId))
    clearSelection()
    setHasChecked(false)
  }
  const isValidConnection = useCallback(
    (connection: Connection | BusinessEdge) => {
      if (!connection.source || !connection.target || connection.source === connection.target)
        return false
      const source = nodes.find((node) => node.id === connection.source)
      const target = nodes.find((node) => node.id === connection.target)
      if (!source || !target || source.data.kind === 'end' || target.data.kind === 'start')
        return false
      return !edges.some(
        (edge) => edge.source === connection.source && edge.target === connection.target,
      )
    },
    [edges, nodes],
  )
  const reset = () => {
    setNodes(initialNodes)
    setEdges(initialEdges)
    clearSelection()
    setCheckOpen(false)
    setHasChecked(false)
  }
  const openCheck = () => {
    setHasChecked(true)
    setCheckOpen(true)
    clearSelection()
  }

  return (
    <div className={styles.prototype}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <div className={styles.breadcrumb}>
            流程设计 <span>/</span> 立项审批 <Tag color="gold">交互原型</Tag>
          </div>
          <h1>立项审批流程</h1>
          <p>拖入业务节点、在画布上连接步骤，完成后检查流程结构。</p>
        </div>
        <div className={styles.actions}>
          <span className={styles.sessionNote}>
            <i /> 编辑暂存在当前页面
          </span>
          <Button icon={<ReloadOutlined />} onClick={reset}>
            恢复示例
          </Button>
          <Button type="primary" icon={<CheckCircleFilled />} onClick={openCheck}>
            检查流程
          </Button>
        </div>
      </header>
      <div className={styles.flowSummary}>
        <span className={styles.summaryIcon}>
          <ApartmentOutlined />
        </span>
        <div className={styles.summaryCopy}>
          <b>立项审批</b>
          <small>审批人由实例发起方按已发布流程的字段说明提供 · 会签规则固定为全员同意</small>
        </div>
        <span className={styles.summaryStats}>
          <b>{nodes.length}</b> 个节点 <i /> <b>{edges.length}</b> 条连线 <i />
          {hasChecked ? (
            issues.length ? (
              <em className={styles.hasIssues}>
                <ExclamationCircleOutlined /> {issues.length} 项待处理
              </em>
            ) : (
              <em>
                <CheckCircleFilled /> 检查通过
              </em>
            )
          ) : (
            <span>尚未检查</span>
          )}
        </span>
      </div>
      <main className={styles.workspace}>
        <aside className={styles.palette}>
          <div className={styles.panelHeading}>
            <b>节点库</b>
            <small>拖到画布中添加</small>
          </div>
          <div className={styles.paletteGroupLabel}>流程步骤</div>
          <div className={styles.paletteList}>
            {paletteNodes.map((entry) => {
              const singletonUsed =
                (entry.kind === 'start' || entry.kind === 'end') &&
                nodes.some((node) => node.data.kind === entry.kind)
              return (
                <button
                  key={entry.purpose || entry.kind}
                  type="button"
                  draggable={!singletonUsed}
                  disabled={singletonUsed}
                  className={styles.paletteItem}
                  onDragStart={(event) => onDragStart(event, entry)}
                  onClick={() => addNode(entry.kind, undefined, entry.purpose)}
                  title={
                    singletonUsed
                      ? '流程只需要一个' + entry.title + '节点'
                      : '拖动或点击添加' + entry.title + '节点'
                  }
                >
                  <span
                    className={
                      styles.paletteIcon +
                      ' ' +
                      styles['node-' + entry.kind] +
                      (entry.purpose ? ' ' + styles['purpose-' + entry.purpose] : '')
                    }
                  >
                    {entry.icon}
                  </span>
                  <span className={styles.paletteText}>
                    <b>{entry.title}</b>
                    <small>{entry.detail}</small>
                  </span>
                  <PlusOutlined className={styles.palettePlus} />
                </button>
              )
            })}
          </div>
          <div className={styles.paletteHint}>
            <DragOutlined />
            <span>拖入画布后，可移动节点并从连接点拖出连线。</span>
          </div>
          <section className={styles.formCard}>
            <div className={styles.formTitle}>
              <span>
                <FileTextOutlined />
              </span>
              <div>
                <b>立项申请表单</b>
                <small>业务系统固定提供</small>
              </div>
            </div>
            <div className={styles.fieldRow}>
              项目名称 <i>必填</i>
              <small>文本</small>
            </div>
            <div className={styles.fieldRow}>
              项目类型 <i>必填</i>
              <small>单选</small>
            </div>
            <div className={styles.fieldRow}>
              计划金额 <i>必填</i>
              <small>数字</small>
            </div>
            <div className={styles.formFoot}>
              <InfoCircleOutlined /> 表单字段在此流程中只读
            </div>
          </section>
        </aside>
        <section className={styles.canvasPanel}>
          <div className={styles.canvasToolbar}>
            <div>
              <b>流程画布</b>
              <small>拖动节点调整位置 · 拖连接点创建连线</small>
            </div>
            <Button size="small" onClick={() => void fitView({ padding: 0.16, duration: 250 })}>
              适应画布
            </Button>
          </div>
          <div
            className={styles.canvas}
            onDrop={onDrop}
            onDragOver={(event) => {
              event.preventDefault()
              event.dataTransfer.dropEffect = 'move'
            }}
          >
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={(changes) => {
                onNodesChange(changes)
                if (
                  changes.some((change) => change.type === 'position' || change.type === 'remove')
                )
                  setHasChecked(false)
              }}
              onEdgesChange={(changes) => {
                onEdgesChange(changes)
                if (changes.some((change) => change.type === 'remove')) setHasChecked(false)
              }}
              onConnect={onConnect}
              onReconnect={onReconnect}
              edgesReconnectable
              isValidConnection={isValidConnection}
              onNodeClick={(_, node) => selectNode(node.id)}
              onEdgeClick={(_, edge) => selectEdge(edge.id)}
              onPaneClick={clearSelection}
              fitView
              fitViewOptions={{ padding: 0.16, maxZoom: 0.9, minZoom: 0.42 }}
              minZoom={0.3}
              maxZoom={1.5}
              nodesConnectable
              nodesDraggable
              elementsSelectable
              deleteKeyCode={null}
              proOptions={{ hideAttribution: true }}
            >
              <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#dce7e1" />
              <Controls position="bottom-left" showInteractive={false} />
            </ReactFlow>
            {nodes.length === 0 && (
              <div className={styles.emptyCanvas}>
                <ApartmentOutlined />
                <b>从左侧添加第一个业务节点</b>
                <span>拖动节点到画布，开始设计流程</span>
              </div>
            )}
          </div>
        </section>
        <aside className={styles.inspector}>
          <div className={styles.inspectorHeader}>
            <div>
              <small>
                {selectedEdge
                  ? '连线属性'
                  : selectedNode
                    ? displayNodeLabel(selectedNode) + '节点'
                    : checkOpen
                      ? '流程检查'
                      : '流程属性'}
              </small>
              <h2>
                {selectedEdge
                  ? '设置路径含义'
                  : selectedNode
                    ? selectedNode.data.name
                    : checkOpen
                      ? '检查结果'
                      : '立项审批'}
              </h2>
            </div>
            {(selectedNode || selectedEdge || checkOpen) && (
              <button
                className={styles.closePanel}
                aria-label="关闭属性面板"
                onClick={() => {
                  clearSelection()
                  setCheckOpen(false)
                }}
              >
                <CloseOutlined />
              </button>
            )}
          </div>
          {selectedNode ? (
            <NodeProperties node={selectedNode} onName={updateNodeName} onDelete={deleteNode} />
          ) : selectedEdge ? (
            <EdgeProperties
              edge={selectedEdge}
              source={nodes.find((node) => node.id === selectedEdge.source)}
              target={nodes.find((node) => node.id === selectedEdge.target)}
              onBranch={updateEdgeBranch}
              onDelete={deleteEdge}
            />
          ) : checkOpen ? (
            <CheckResults
              issues={issues}
              onSelect={(issue) =>
                issue.nodeId
                  ? selectNode(issue.nodeId)
                  : issue.edgeId
                    ? selectEdge(issue.edgeId)
                    : undefined
              }
            />
          ) : (
            <FlowProperties onCheck={openCheck} />
          )}
        </aside>
      </main>
      <footer className={styles.footer}>
        <span>
          <InfoCircleOutlined /> 业务流程原型 · 不保存草稿，不涉及审批人员配置或流程引擎变量
        </span>
        <span>
          <b>{nodes.length}</b> 个节点 <i /> <b>{edges.length}</b> 条连线
        </span>
      </footer>
    </div>
  )
}

function NodeProperties({
  node,
  onName,
  onDelete,
}: {
  node: BusinessNode
  onName: (name: string) => void
  onDelete: () => void
}) {
  const { kind } = node.data
  return (
    <div className={styles.propertyBody}>
      <div
        className={
          styles.propertyKind +
          ' ' +
          styles['node-' + kind] +
          (node.data.purpose ? ' ' + styles['purpose-' + node.data.purpose] : '')
        }
      >
        <span>
          {
            paletteNodes.find((item) => item.kind === kind && item.purpose === node.data.purpose)
              ?.icon
          }
        </span>
        <div>
          <b>{displayNodeLabel(node)}</b>
          <small>{displayNodeDescription(node)}</small>
        </div>
      </div>
      <label className={styles.fieldLabel} htmlFor="node-name">
        节点名称
      </label>
      <Input
        id="node-name"
        value={node.data.name}
        maxLength={40}
        onChange={(event) => onName(event.target.value)}
      />
      {kind === 'approval' && (
        <div className={styles.infoCard}>
          <UserOutlined />
          <div>
            <b>审批人在发起时提供</b>
            <small>流程设计时不配置人员。实例发起方按已发布流程返回的字段说明提交人员标识。</small>
          </div>
        </div>
      )}
      {kind === 'countersign' && (
        <div className={styles.infoCard}>
          <CheckCircleFilled />
          <div>
            <b>会签方式：全员同意</b>
            <small>所有会签参与人同意后通过；驳回路径返回申请填写步骤。</small>
          </div>
        </div>
      )}
      {node.data.purpose === 'application' && (
        <div className={styles.infoCard}>
          <FileTextOutlined />
          <div>
            <b>使用固定的立项申请表单</b>
            <small>被驳回后，发起人回到此步骤修改并重新提交。</small>
          </div>
        </div>
      )}
      {kind === 'condition' && (
        <div className={styles.infoCard}>
          <ApartmentOutlined />
          <div>
            <b>依据上一步的审批结果分流</b>
            <small>连接“通过”和“驳回”两条路径，再选中连线设置路径含义。</small>
          </div>
        </div>
      )}
      {(kind === 'start' || kind === 'end') && (
        <Alert
          type="info"
          showIcon
          message={kind === 'start' ? '开始节点是流程入口。' : '结束节点是流程完成出口。'}
        />
      )}
      <div className={styles.propertyDivider} />
      <div className={styles.connectionMeta}>
        <span>节点类型</span>
        <b>{nodeLabels[kind]}</b>
      </div>
      <div className={styles.connectionMeta}>
        <span>节点标识</span>
        <code>{node.id}</code>
      </div>
      <div className={styles.propertyActions}>
        <Button
          danger
          icon={<DeleteOutlined />}
          disabled={kind === 'start' || kind === 'end'}
          onClick={onDelete}
        >
          删除节点
        </Button>
        <small>删除后，与此节点相连的路径也会移除</small>
      </div>
    </div>
  )
}

function EdgeProperties({
  edge,
  source,
  target,
  onBranch,
  onDelete,
}: {
  edge: BusinessEdge
  source?: BusinessNode
  target?: BusinessNode
  onBranch: (branch: Branch) => void
  onDelete: () => void
}) {
  const isDecision = source?.data.kind === 'condition'
  return (
    <div className={styles.propertyBody}>
      <div className={styles.routePreview}>
        <span>{source?.data.name || '未命名'}</span>
        <i>→</i>
        <span>{target?.data.name || '未命名'}</span>
      </div>
      <label className={styles.fieldLabel}>路径含义</label>
      {isDecision ? (
        <Select
          value={edge.data?.branch || 'continue'}
          onChange={onBranch}
          options={[
            { value: 'pass', label: '审批通过' },
            { value: 'reject', label: '审批驳回' },
            { value: 'continue', label: '继续流转' },
          ]}
        />
      ) : (
        <div className={styles.fixedRoute}>
          <CheckCircleFilled /> 普通流转
        </div>
      )}
      {isDecision && edge.data?.branch === 'reject' && (
        <div className={styles.infoCard}>
          <InfoCircleOutlined />
          <div>
            <b>驳回后返回申请步骤</b>
            <small>发起人修改申请并重新提交后，流程继续向下审批。</small>
          </div>
        </div>
      )}
      <div className={styles.propertyDivider} />
      <div className={styles.connectionMeta}>
        <span>起点</span>
        <b>{source?.data.name || '节点不存在'}</b>
      </div>
      <div className={styles.connectionMeta}>
        <span>终点</span>
        <b>{target?.data.name || '节点不存在'}</b>
      </div>
      <div className={styles.propertyActions}>
        <Button danger icon={<DeleteOutlined />} onClick={onDelete}>
          删除连线
        </Button>
        <small>也可以在画布中选中连线后删除</small>
      </div>
    </div>
  )
}

function FlowProperties({ onCheck }: { onCheck: () => void }) {
  return (
    <div className={styles.propertyBody}>
      <div className={styles.flowNameCard}>
        <span>
          <ApartmentOutlined />
        </span>
        <div>
          <b>立项审批流程</b>
          <small>当前流程使用立项申请单</small>
        </div>
      </div>
      <div className={styles.metaSection}>
        <b>设计约定</b>
        <div className={styles.metaRow}>
          <span>审批人员</span>
          <b>实例发起时提供</b>
        </div>
        <div className={styles.metaRow}>
          <span>会签规则</span>
          <b>全员同意</b>
        </div>
        <div className={styles.metaRow}>
          <span>驳回去向</span>
          <b>返回申请填写</b>
        </div>
        <div className={styles.metaRow}>
          <span>流程表单</span>
          <b>系统固定提供</b>
        </div>
      </div>
      <div className={styles.infoCard}>
        <InfoCircleOutlined />
        <div>
          <b>从左侧拖节点到画布</b>
          <small>
            点击节点可以修改名称。拖动连接点即可建立路径，选中路径后可设置通过或驳回含义。
          </small>
        </div>
      </div>
      <div className={styles.checkCallout}>
        <b>流程绘制完成后</b>
        <span>检查开始和结束节点、审批分支、路径连接及流程可达性。</span>
        <Button type="primary" block onClick={onCheck}>
          检查流程
        </Button>
      </div>
    </div>
  )
}

function CheckResults({
  issues,
  onSelect,
}: {
  issues: ValidationIssue[]
  onSelect: (issue: ValidationIssue) => void
}) {
  if (!issues.length)
    return (
      <div className={styles.checkSuccess}>
        <CheckCircleFilled />
        <h3>流程检查通过</h3>
        <p>节点和连线结构完整，所有步骤都能从开始节点到达，并且存在通往结束节点的路径。</p>
        <Tag color="success">可以进入下一步</Tag>
      </div>
    )
  return (
    <div className={styles.checkBody}>
      <Alert
        type="warning"
        showIcon
        message={'发现 ' + issues.length + ' 项需要处理'}
        description="点击检查项可定位到对应节点或连线。"
      />
      <div className={styles.issueList}>
        {issues.map((issue, index) => (
          <button
            key={(issue.nodeId || issue.edgeId || 'flow') + '-' + index}
            onClick={() => onSelect(issue)}
          >
            <ExclamationCircleOutlined />
            <span>{issue.message}</span>
            <i>查看</i>
          </button>
        ))}
      </div>
    </div>
  )
}
