/** Single-canvas workflow designer using the accepted A-layout prototype. */
import { memo, useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import {
  addEdge,
  BaseEdge,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  getSmoothStepPath,
  MarkerType,
  MiniMap,
  NodeToolbar,
  Position,
  reconnectEdge,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesInitialized,
  useNodesState,
  useReactFlow,
  type Connection,
  type EdgeChange,
  type EdgeProps,
  type NodeChange,
  type NodeProps,
} from '@xyflow/react'
import {
  ApiOutlined,
  ApartmentOutlined,
  AuditOutlined,
  BranchesOutlined,
  CheckCircleOutlined,
  CodeOutlined,
  CopyOutlined,
  DeleteOutlined,
  DownloadOutlined,
  FlagOutlined,
  InfoCircleOutlined,
  LinkOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { Alert, Button, Form, Input, message, Modal, Select, Tag } from 'antd'
import { compileWorkflowModel } from '@/api/bpmn'
import type { WorkflowModel } from '@/api/workflowModel'
import {
  clearWorkflowEdgeRoutes,
  getRejectRoutePoints,
  isFeedbackRejectEdge,
  layoutWorkflow,
} from './workflowLayout'
import styles from './DesignerUiPrototype.module.less'
import '@xyflow/react/dist/style.css'
import {
  toWorkflowModel,
  supportsResultBranch,
  validateWorkflowModel,
  wouldCreateOrdinaryCycle,
  type WorkflowCanvasEdge,
  type WorkflowCanvasNode,
  type WorkflowNodeData,
  type WorkflowValidationIssue,
} from './workflowModel'

type NodeKind = WorkflowCanvasNode['data']['kind']
type CanvasNode = WorkflowCanvasNode
type CanvasEdge = WorkflowCanvasEdge
type PaletteItem = {
  kind: NodeKind
  title: string
  summary: string
  icon: typeof PlayCircleOutlined
}

const paletteItems: PaletteItem[] = [
  { kind: 'start', title: '开始', summary: '流程唯一入口', icon: PlayCircleOutlined },
  { kind: 'approval', title: '审批', summary: '人工处理步骤', icon: AuditOutlined },
  { kind: 'countersign', title: '会签', summary: '多人审批任务', icon: TeamOutlined },
  { kind: 'service', title: '服务调用', summary: '调用业务服务', icon: ApiOutlined },
  { kind: 'condition', title: '条件分支', summary: '按结果选择路径', icon: BranchesOutlined },
  { kind: 'end', title: '结束', summary: '流程完成出口', icon: FlagOutlined },
]

const configuredApproveModes = new Set(['ALL', 'ANY', 'VOTE'])

const initialNodes: CanvasNode[] = [
  {
    id: 'start',
    type: 'workflowNode',
    position: { x: 20, y: 190 },
    data: { kind: 'start', name: '发起' },
  },
  {
    id: 'apply',
    type: 'workflowNode',
    position: { x: 170, y: 190 },
    data: { kind: 'approval', name: '出库申请' },
  },
  {
    id: 'managers',
    type: 'workflowNode',
    position: { x: 330, y: 190 },
    data: { kind: 'countersign', name: '部门经理会签', approveMode: 'ALL' },
  },
  {
    id: 'check_stock',
    type: 'workflowNode',
    position: { x: 490, y: 190 },
    data: {
      kind: 'service',
      name: '库存校验',
      serviceName: '库存服务',
    },
  },
  {
    id: 'gwMinister',
    type: 'workflowNode',
    position: { x: 650, y: 200 },
    data: { kind: 'condition', name: '库存校验结果' },
  },
  {
    id: 'end',
    type: 'workflowNode',
    position: { x: 810, y: 190 },
    data: { kind: 'end', name: '结束' },
  },
]

const initialEdges: CanvasEdge[] = [
  {
    id: 'start-apply',
    source: 'start',
    target: 'apply',
    type: 'workflowRoute',
    markerEnd: { type: MarkerType.ArrowClosed },
  },
  {
    id: 'apply-service',
    source: 'apply',
    target: 'managers',
    type: 'workflowRoute',
    markerEnd: { type: MarkerType.ArrowClosed },
  },
  {
    id: 'managers-service',
    source: 'managers',
    target: 'check_stock',
    type: 'workflowRoute',
    markerEnd: { type: MarkerType.ArrowClosed },
  },
  {
    id: 'service-result',
    source: 'check_stock',
    target: 'gwMinister',
    type: 'workflowRoute',
    markerEnd: { type: MarkerType.ArrowClosed },
  },
  {
    id: 'result-end',
    source: 'gwMinister',
    target: 'end',
    type: 'workflowRoute',
    label: '通过',
    data: { branch: 'pass' },
    markerEnd: { type: MarkerType.ArrowClosed },
  },
  {
    id: 'result-apply',
    source: 'gwMinister',
    target: 'apply',
    type: 'workflowRoute',
    label: '驳回',
    className: 'branch-reject',
    data: { branch: 'reject' },
    markerEnd: { type: MarkerType.ArrowClosed },
  },
]

const kindMeta: Record<NodeKind, { label: string; tone: string; icon: typeof PlayCircleOutlined }> =
  {
    start: { label: '流程入口', tone: 'start', icon: PlayCircleOutlined },
    approval: { label: '人工审批', tone: 'approval', icon: AuditOutlined },
    countersign: { label: '多人任务', tone: 'countersign', icon: TeamOutlined },
    service: { label: '服务调用', tone: 'service', icon: ApiOutlined },
    condition: { label: '结果判断', tone: 'condition', icon: BranchesOutlined },
    end: { label: '流程出口', tone: 'end', icon: FlagOutlined },
  }

const nodeTypes = { workflowNode: memo(WorkflowNodeView) }
const fitViewOptions = { padding: 0.04, maxZoom: 1.15 }
const defaultEdgeOptions = {
  type: 'workflowRoute',
  markerEnd: { type: MarkerType.ArrowClosed },
}
const edgeTypes = { workflowRoute: memo(WorkflowRouteEdge) }

function isWorkflowModel(value: unknown): value is WorkflowModel {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const model = value as Partial<WorkflowModel>
  const nodeTypes = ['start', 'approval', 'countersign', 'service', 'condition', 'end']

  return (
    typeof model.processId === 'string' &&
    typeof model.processName === 'string' &&
    Array.isArray(model.nodes) &&
    model.nodes.every(
      (node) =>
        Boolean(node) &&
        typeof node.id === 'string' &&
        nodeTypes.includes(node.type) &&
        typeof node.name === 'string' &&
        typeof node.x === 'number' &&
        typeof node.y === 'number',
    ) &&
    Array.isArray(model.flows) &&
    model.flows.every(
      (flow) => Boolean(flow) && typeof flow.source === 'string' && typeof flow.target === 'string',
    )
  )
}

function getMiniMapNodeColor(node: CanvasNode): string {
  return node.data.kind === 'service'
    ? '#d9813e'
    : node.data.kind === 'condition'
      ? '#8e7ab5'
      : '#7ca58e'
}

function WorkflowRouteEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  label,
  markerEnd,
  style,
}: EdgeProps<CanvasEdge>) {
  const points = data?.routePoints
  const className = data?.branch ? 'branch-' + data.branch : undefined
  if (points && points.length > 1) {
    const path = points
      .map((point, index) => (index === 0 ? 'M' : 'L') + ' ' + point.x + ' ' + point.y)
      .join(' ')
    const middlePoint = points[Math.floor(points.length / 2)]
    return (
      <BaseEdge
        id={id}
        path={path}
        label={label}
        labelX={middlePoint.x}
        labelY={middlePoint.y - 8}
        markerEnd={markerEnd}
        style={style}
        className={className}
      />
    )
  }

  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })
  return (
    <BaseEdge
      id={id}
      path={path}
      label={label}
      labelX={labelX}
      labelY={labelY}
      markerEnd={markerEnd}
      style={style}
      className={className}
    />
  )
}

function WorkflowNodeView({ data, selected, isConnectable }: NodeProps<CanvasNode>) {
  const meta = kindMeta[data.kind]
  const Icon = meta.icon
  return (
    <>
      {data.kind === 'condition' && (
        <NodeToolbar
          isVisible={selected}
          position={Position.Top}
          className={styles.conditionToolbar}
        >
          <span>结果路径</span>
          <span>选中画布连线配置通过 / 驳回</span>
        </NodeToolbar>
      )}
      <div className={styles.flowNode + (selected ? ' ' + styles.flowNodeSelected : '')}>
        {data.kind !== 'start' && (
          <Handle type="target" position={Position.Left} isConnectable={isConnectable} />
        )}
        <span className={styles.nodeIcon + ' ' + styles['nodeIcon' + meta.tone]}>
          <Icon aria-hidden="true" />
        </span>
        <span className={styles.nodeCopy}>
          <strong>{data.name}</strong>
          <small>
            {data.kind === 'service'
              ? data.serviceUrl?.trim()
                ? '固定服务地址'
                : '动态服务地址'
              : data.kind === 'countersign'
                ? data.approveMode === 'ANY'
                  ? '或签 · 任一人通过'
                  : data.approveMode === 'VOTE'
                    ? '比例会签 · 按通过比例判断'
                    : !data.approveMode || !configuredApproveModes.has(data.approveMode)
                      ? '模式未固化'
                      : '会签 · 所有人通过'
                : meta.label}
          </small>
        </span>
        {data.kind === 'condition' && <span className={styles.conditionMark}>◇</span>}
        {data.kind !== 'end' && (
          <Handle type="source" position={Position.Right} isConnectable={isConnectable} />
        )}
      </div>
    </>
  )
}

function DesignerUiPrototypeContent() {
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasNode>(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState<CanvasEdge>(initialEdges)
  const [selectedNodeId, setSelectedNodeId] = useState('check_stock')
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [processId, setProcessId] = useState('service-approval')
  const [processName, setProcessName] = useState('服务调用')
  const [jsonOpen, setJsonOpen] = useState(false)
  const [workflowJsonOpen, setWorkflowJsonOpen] = useState(false)
  const [workflowJsonInput, setWorkflowJsonInput] = useState('')
  const [xmlOpen, setXmlOpen] = useState(false)
  const [workflowXml, setWorkflowXml] = useState('')
  const [xmlCompiling, setXmlCompiling] = useState(false)
  const [xmlCopied, setXmlCopied] = useState(false)
  const [checkOpen, setCheckOpen] = useState(false)
  const [jsonCopied, setJsonCopied] = useState(false)
  const [checked, setChecked] = useState(false)
  const [layoutRunning, setLayoutRunning] = useState(false)
  const { screenToFlowPosition, getNodes, fitView } = useReactFlow<CanvasNode, CanvasEdge>()
  const nodesInitialized = useNodesInitialized()
  const initialLayoutStarted = useRef(false)

  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? nodes[0]
  const selectedEdge = edges.find((edge) => edge.id === selectedEdgeId)
  const edgeSource = selectedEdge
    ? nodes.find((node) => node.id === selectedEdge.source)
    : undefined
  const edgeTarget = selectedEdge
    ? nodes.find((node) => node.id === selectedEdge.target)
    : undefined
  const serviceData = selectedNode?.data.kind === 'service' ? selectedNode.data : undefined
  const dynamicService = Boolean(serviceData && !serviceData.serviceUrl?.trim())

  const updateNodeData = useCallback(
    (patch: Partial<WorkflowNodeData>) => {
      setNodes((current) =>
        current.map((node) =>
          node.id === selectedNodeId ? { ...node, data: { ...node.data, ...patch } } : node,
        ),
      )
      setChecked(false)
    },
    [selectedNodeId, setNodes],
  )

  const model = useMemo(
    () => toWorkflowModel(processId, processName, nodes, edges),
    [edges, nodes, processId, processName],
  )
  const json = JSON.stringify(model, null, 2)
  const issues = useMemo(() => validateWorkflowModel(model), [model])

  const runAutoLayout = useCallback(async () => {
    if (!nodes.length) return
    setLayoutRunning(true)
    try {
      const layouted = await layoutWorkflow(nodes, clearWorkflowEdgeRoutes(edges))
      setNodes([...layouted.nodes])
      setEdges([...layouted.edges])
      setChecked(false)
      window.requestAnimationFrame(() => fitView({ padding: 0.12, duration: 350, maxZoom: 1.05 }))
    } catch {
      message.error('自动排布失败，请稍后重试。')
    } finally {
      setLayoutRunning(false)
    }
  }, [edges, fitView, nodes, setEdges, setNodes])

  useEffect(() => {
    if (nodesInitialized && !initialLayoutStarted.current) {
      initialLayoutStarted.current = true
      void runAutoLayout()
    }
  }, [nodesInitialized, runAutoLayout])

  const addNode = useCallback(
    (kind: NodeKind, position?: { x: number; y: number }) => {
      if (
        (kind === 'start' || kind === 'end') &&
        getNodes().some((node) => node.data.kind === kind)
      ) {
        message.info(kind === 'start' ? '一个流程只能有一个开始节点' : '一个流程只能有一个结束节点')
        return
      }
      setSelectedEdgeId(null)
      const currentNodes = getNodes()
      const rightmost = currentNodes.reduce(
        (right, current) => Math.max(right, current.position.x + 154),
        100,
      )
      const selected = currentNodes.find((current) => current.id === selectedNodeId)
      const id = kind + '_' + Math.random().toString(36).slice(2, 7)
      const node: CanvasNode = {
        id,
        type: 'workflowNode',
        position: position ?? { x: rightmost + 110, y: selected?.position.y ?? 180 },
        data: {
          kind,
          name: kind === 'service' ? '新建服务' : kindMeta[kind].label,
          ...(kind === 'countersign' ? { approveMode: 'ALL' as const } : {}),
        },
      }
      setNodes((current) => [...current, node])
      setSelectedNodeId(id)
      setChecked(false)
    },
    [getNodes, selectedNodeId, setNodes],
  )

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((current) => {
        const source = nodes.find((node) => node.id === connection.source)
        const target = nodes.find((node) => node.id === connection.target)
        const sourceIsCondition = source?.data.kind === 'condition'
        const targetIsCondition = target?.data.kind === 'condition'
        const closesCycle = Boolean(
          source && target && wouldCreateOrdinaryCycle(current, source.id, target.id),
        )
        const outgoingBranches = sourceIsCondition
          ? new Set(
              current
                .filter((edge) => edge.source === connection.source)
                .map((edge) => edge.data?.branch)
                .filter((branch): branch is 'pass' | 'reject' => Boolean(branch)),
            )
          : new Set<'pass' | 'reject'>()
        const branch =
          closesCycle && source && supportsResultBranch(source.data.kind)
            ? 'reject'
            : sourceIsCondition && !targetIsCondition
              ? !outgoingBranches.has('pass')
                ? 'pass'
                : !outgoingBranches.has('reject')
                  ? 'reject'
                  : undefined
              : undefined
        const label = branch === 'pass' ? '通过' : branch === 'reject' ? '驳回' : undefined
        return addEdge(
          {
            ...connection,
            type: 'workflowRoute',
            ...(branch
              ? {
                  label,
                  className: branch === 'pass' ? 'branch-pass' : 'branch-reject',
                  data: { branch },
                }
              : {}),
            markerEnd: { type: MarkerType.ArrowClosed },
          },
          current,
        )
      })
      setChecked(false)
    },
    [nodes, setEdges],
  )

  const updateEdgeBranch = (branch: 'pass' | 'reject' | undefined) => {
    if (!selectedEdge) return
    const label = branch === 'pass' ? '通过' : branch === 'reject' ? '驳回' : undefined
    const sourceIsCondition =
      nodes.find((node) => node.id === selectedEdge.source)?.data.kind === 'condition'
    setEdges((current) => {
      return current.map((edge) => {
        if (edge.id === selectedEdge.id) {
          return {
            ...edge,
            label,
            className:
              branch === 'reject' ? 'branch-reject' : branch === 'pass' ? 'branch-pass' : '',
            data: {
              ...(branch ? { branch } : {}),
              ...(edge.data?.conditionExpression
                ? { conditionExpression: edge.data.conditionExpression }
                : {}),
            },
          }
        }
        if (
          sourceIsCondition &&
          branch &&
          edge.source === selectedEdge.source &&
          edge.data?.branch === branch
        ) {
          return {
            ...edge,
            data: edge.data?.conditionExpression
              ? { conditionExpression: edge.data.conditionExpression }
              : {},
            label: undefined,
            className: '',
          }
        }
        return edge
      })
    })
    setChecked(false)
  }

  const onPaletteDragStart = useCallback((event: DragEvent<HTMLButtonElement>, kind: NodeKind) => {
    event.dataTransfer.setData('application/x-workflow-node', kind)
    event.dataTransfer.effectAllowed = 'copy'
  }, [])

  const onReconnect = useCallback(
    (oldEdge: CanvasEdge, connection: Connection) => {
      if (!connection.source || !connection.target || connection.source === connection.target)
        return
      if (nodes.some((node) => node.id === connection.target && node.data.kind === 'start')) return
      if (nodes.some((node) => node.id === connection.source && node.data.kind === 'end')) return
      if (
        edges.some(
          (edge) =>
            edge.id !== oldEdge.id &&
            edge.source === connection.source &&
            edge.target === connection.target,
        )
      )
        return
      const source = nodes.find((node) => node.id === connection.source)
      const closesCycle = wouldCreateOrdinaryCycle(
        edges,
        connection.source,
        connection.target,
        oldEdge.id,
      )
      if (closesCycle && (!source || !supportsResultBranch(source.data.kind))) return
      setEdges((current) => {
        const reconnected = reconnectEdge(oldEdge, connection, current)
        return closesCycle
          ? reconnected.map((edge) =>
              edge.source === connection.source && edge.target === connection.target
                ? {
                    ...edge,
                    label: '驳回',
                    className: 'branch-reject',
                    data: { ...edge.data, branch: 'reject' },
                  }
                : edge,
            )
          : reconnected
      })
      setChecked(false)
    },
    [edges, nodes, setEdges],
  )

  const onCanvasDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      const kind = event.dataTransfer.getData('application/x-workflow-node') as NodeKind
      if (!['start', 'approval', 'countersign', 'service', 'condition', 'end'].includes(kind))
        return
      addNode(kind, screenToFlowPosition({ x: event.clientX, y: event.clientY }))
    },
    [addNode, screenToFlowPosition],
  )

  const copyJson = async () => {
    await navigator.clipboard?.writeText(json)
    setJsonCopied(true)
    window.setTimeout(() => setJsonCopied(false), 1500)
  }

  const convertModelToXml = async (workflowModel: WorkflowModel) => {
    setXmlCompiling(true)
    try {
      const result = await compileWorkflowModel(workflowModel)
      setWorkflowXml(result)
      setXmlCopied(false)
      setXmlOpen(true)
      return true
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'BPMN XML 转换失败，请重试。')
      return false
    } finally {
      setXmlCompiling(false)
    }
  }

  const compileXml = () => convertModelToXml(model)

  const compileJsonXml = async () => {
    let parsed: unknown
    try {
      parsed = JSON.parse(workflowJsonInput)
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'JSON 语法错误'
      message.error('业务 JSON 无法解析：' + detail)
      return
    }

    if (!isWorkflowModel(parsed)) {
      message.error(
        '业务 JSON 格式不正确：请提供 processId、processName、nodes 和 flows；节点需包含 id、type、name、x、y，连线需包含 source、target。',
      )
      return
    }

    if (await convertModelToXml(parsed)) setWorkflowJsonOpen(false)
  }

  const copyXml = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable')
      await navigator.clipboard.writeText(workflowXml)
      setXmlCopied(true)
      message.success('BPMN XML 已复制')
      window.setTimeout(() => setXmlCopied(false), 1500)
    } catch {
      message.error('复制失败，请在 XML 文本框中手动选择并复制。')
    }
  }

  const downloadJson = () => {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = (processId || 'workflow') + '.json'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const checkFlow = useCallback(() => {
    setChecked(true)
    setCheckOpen(true)
    if (issues.length)
      message.warning('流程检查发现 ' + issues.length + ' 项问题，请查看检查结果。')
    else message.success('流程检查通过')
  }, [issues.length])

  const updateProcessName = useCallback((value: string) => {
    setProcessName(value)
    setChecked(false)
  }, [])
  const updateProcessId = useCallback((value: string) => {
    setProcessId(value)
    setChecked(false)
  }, [])
  const handleCanvasChange = useCallback(() => setChecked(false), [])
  const handleNodesChange = useCallback(
    (changes: NodeChange<CanvasNode>[]) => {
      onNodesChange(changes)
      const removedNodeIds = new Set(
        changes.flatMap((change) => (change.type === 'remove' ? [change.id] : [])),
      )
      if (removedNodeIds.size) {
        setSelectedNodeId((current) =>
          removedNodeIds.has(current)
            ? (nodes.find((node) => !removedNodeIds.has(node.id))?.id ?? '')
            : current,
        )
        setEdges((current) =>
          current.filter(
            (edge) => !removedNodeIds.has(edge.source) && !removedNodeIds.has(edge.target),
          ),
        )
        setChecked(false)
      }
    },
    [nodes, onNodesChange, setEdges],
  )
  const clearEdgeRoutes = useCallback(() => {
    setEdges((current) => clearWorkflowEdgeRoutes(current))
  }, [setEdges])

  const isValidConnection = useCallback(
    (connection: { source: string; target: string }) => {
      if (!connection.source || !connection.target || connection.source === connection.target)
        return false
      if (
        edges.some((edge) => edge.source === connection.source && edge.target === connection.target)
      )
        return false
      const source = nodes.find((node) => node.id === connection.source)
      const target = nodes.find((node) => node.id === connection.target)
      if (!source || !target || source.data.kind === 'end' || target.data.kind === 'start')
        return false
      if (source.data.kind === 'condition' && target.data.kind === 'condition') return false
      return (
        supportsResultBranch(source.data.kind) ||
        !wouldCreateOrdinaryCycle(edges, connection.source, connection.target)
      )
    },
    [edges, nodes],
  )

  const locateIssue = useCallback(
    (issue: WorkflowValidationIssue) => {
      const edgeIndex = issue.edgeId ? Number(issue.edgeId.replace(/^flow_/, '')) : -1
      if (issue.nodeId) setSelectedNodeId(issue.nodeId)
      const edge = edgeIndex >= 0 ? edges[edgeIndex] : undefined
      if (edge) setSelectedEdgeId(edge.id)
      const targetNodes = issue.nodeId
        ? [{ id: issue.nodeId }]
        : edge
          ? [{ id: edge.source }, { id: edge.target }]
          : []
      if (targetNodes.length) void fitView({ nodes: targetNodes, padding: 0.5, duration: 250 })
    },
    [edges, fitView],
  )

  return (
    <section className={styles.prototype}>
      <header className={styles.pageHeading}>
        <div className={styles.titleGroup}>
          <div className={styles.crumb}>
            <span className={styles.crumbIcon}>
              <BranchesOutlined />
            </span>{' '}
            流程设计 <span className={styles.crumbSlash}>/</span> 新建业务流程
          </div>
          <div className={styles.titleLine}>
            <Input
              className={styles.processTitle}
              value={processName}
              onChange={(event) => updateProcessName(event.target.value)}
              aria-label="流程名称"
            />
            <Tag className={styles.draftTag}>
              <i /> 草稿
            </Tag>
          </div>
          <div className={styles.processCode}>
            <span>流程标识</span>
            <Input
              value={processId}
              onChange={(event) => updateProcessId(event.target.value)}
              aria-label="流程标识"
            />
          </div>
        </div>
        <div className={styles.topActions}>
          <span className={styles.saveHint}>
            <CheckCircleOutlined /> 修改保存在本页
          </span>
          <Button icon={<CodeOutlined />} onClick={() => setJsonOpen(true)}>
            查看业务 JSON
          </Button>
          <Button icon={<CodeOutlined />} onClick={() => setWorkflowJsonOpen(true)}>
            粘贴 JSON 转 XML
          </Button>
          <Button icon={<CodeOutlined />} loading={xmlCompiling} onClick={compileXml}>
            生成 BPMN XML
          </Button>
          <Button type="primary" icon={<CheckCircleOutlined />} onClick={checkFlow}>
            检查流程
          </Button>
        </div>
      </header>

      <div className={styles.statusLine}>
        <span className={styles.statusIndicator + (checked ? ' ' + styles.statusSuccess : '')} />
        <span>
          {checked
            ? '流程基础结构检查通过'
            : '从左侧添加步骤；连接节点右侧与左侧的圆点，设置业务路径'}
        </span>
        <span className={styles.statusRight}>
          {nodes.length} 个节点 <b>·</b> {edges.length} 条连线
        </span>
      </div>
      <div className={styles.workbench}>
        <aside className={styles.palette} aria-label="节点库">
          <div className={styles.panelHeading}>
            <div>
              <h2>节点库</h2>
              <p>拖入画布或点击添加</p>
            </div>
            <span className={styles.panelCount}>{paletteItems.length}</span>
          </div>
          <div className={styles.paletteGroup}>流程节点</div>
          <div className={styles.paletteList}>
            {paletteItems.map((item) => {
              const Icon = item.icon
              const singleton =
                (item.kind === 'start' || item.kind === 'end') &&
                nodes.some((node) => node.data.kind === item.kind)
              return (
                <button
                  className={styles.paletteItem}
                  disabled={singleton}
                  draggable={!singleton}
                  onDragStart={(event) => onPaletteDragStart(event, item.kind)}
                  onClick={() => addNode(item.kind)}
                  key={item.kind}
                  type="button"
                >
                  <span
                    className={
                      styles.paletteGlyph + ' ' + styles['glyph' + kindMeta[item.kind].tone]
                    }
                  >
                    <Icon aria-hidden="true" />
                  </span>
                  <span className={styles.paletteCopy}>
                    <strong>{item.title}</strong>
                    <small>{item.summary}</small>
                  </span>
                  {singleton ? (
                    <span className={styles.addedMark} aria-label="已添加">
                      ✓
                    </span>
                  ) : (
                    <PlusOutlined className={styles.palettePlus} aria-hidden="true" />
                  )}
                </button>
              )
            })}
          </div>
          <div className={styles.paletteGuide}>
            <span>
              <InfoCircleOutlined />
            </span>
            <p>点按可添加节点；从画布节点的连接点拖出路径。</p>
          </div>
          <div className={styles.paletteFooter}>
            <span className={styles.footerDot} /> 业务节点 · 不包含引擎配置
          </div>
        </aside>

        <main className={styles.canvasColumn}>
          <div className={styles.canvasHeading}>
            <div>
              <h2>流程画布</h2>
              <span>选择节点编辑属性，拖动可调整位置</span>
            </div>
            <div className={styles.canvasActions}>
              <Button
                size="small"
                icon={<ApartmentOutlined />}
                loading={layoutRunning}
                onClick={() => void runAutoLayout()}
              >
                自动排布
              </Button>
              <Button size="small" icon={<PlusOutlined />} onClick={() => addNode('service')}>
                添加服务
              </Button>
            </div>
          </div>
          <div
            className={styles.canvasWrap}
            onDragOver={(event) => event.preventDefault()}
            onDrop={onCanvasDrop}
          >
            <FlowCanvas
              nodes={nodes}
              edges={edges}
              onNodesChange={handleNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onReconnect={onReconnect}
              isValidConnection={isValidConnection}
              selectedEdgeId={selectedEdgeId}
              onNodeSelect={useCallback((id: string) => {
                setSelectedNodeId(id)
                setSelectedEdgeId(null)
              }, [])}
              onEdgeSelect={useCallback((id: string) => setSelectedEdgeId(id), [])}
              onPaneSelect={useCallback(() => setSelectedEdgeId(null), [])}
              onChange={handleCanvasChange}
              onNodeMove={clearEdgeRoutes}
            />
          </div>
          <div className={styles.canvasFooter}>
            <span>拖动节点整理流程布局</span>
            <span>
              <i /> 拒绝路径 <i className={styles.passKey} /> 通过路径
            </span>
          </div>
        </main>

        <aside className={styles.properties} aria-label="属性面板">
          {selectedEdge ? (
            <>
              <div className={styles.propertyHeader}>
                <div>
                  <h2>连线属性</h2>
                  <p>配置审批、会签、服务或条件路径的通过与驳回含义</p>
                </div>
                <Tag className={styles.kindTag}>流转路径</Tag>
              </div>
              <div className={styles.selectedSummary}>
                <span className={styles.edgeSummaryIcon}>
                  <BranchesOutlined />
                </span>
                <span>
                  <strong>
                    {edgeSource?.data.name ?? selectedEdge.source} →{' '}
                    {edgeTarget?.data.name ?? selectedEdge.target}
                  </strong>
                  <small>
                    连线业务标识 <code>{selectedEdge.id}</code>
                  </small>
                </span>
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  aria-label="删除当前连线"
                  title="删除连线"
                  onClick={() => {
                    setEdges((current) => current.filter((edge) => edge.id !== selectedEdge.id))
                    setSelectedEdgeId(null)
                    setChecked(false)
                  }}
                />
              </div>
              <Form layout="vertical" requiredMark={false} className={styles.propertyForm}>
                <section className={styles.formSection}>
                  <div className={styles.sectionHeading}>
                    <span>路径配置</span>
                    <i />
                  </div>
                  {edgeSource && supportsResultBranch(edgeSource.data.kind) ? (
                    <Form.Item label="路径结果" className={styles.formItem}>
                      <Select
                        value={selectedEdge.data?.branch}
                        placeholder="普通流转，不设置结果"
                        allowClear
                        options={[
                          { label: '通过', value: 'pass' },
                          { label: '驳回', value: 'reject' },
                        ]}
                        onChange={(value: 'pass' | 'reject' | undefined) => updateEdgeBranch(value)}
                      />
                    </Form.Item>
                  ) : (
                    <div className={styles.fieldFootnote}>此起点不支持通过或驳回结果标记。</div>
                  )}
                  <Form.Item label="条件表达式（可选）" className={styles.formItem}>
                    <Input
                      allowClear
                      value={selectedEdge.data?.conditionExpression ?? ''}
                      onChange={(event) => {
                        const value = event.target.value
                        setEdges((current) =>
                          current.map((edge) =>
                            edge.id === selectedEdge.id
                              ? {
                                  ...edge,
                                  data: { ...edge.data, conditionExpression: value || undefined },
                                }
                              : edge,
                          ),
                        )
                        setChecked(false)
                      }}
                      placeholder={'例如 ' + '$' + '{approved}；优先于路径结果'}
                    />
                  </Form.Item>
                  <div className={styles.edgeRoute}>
                    <span>起点</span>
                    <strong>{edgeSource?.data.name ?? selectedEdge.source}</strong>
                    <span>目标</span>
                    <strong>{edgeTarget?.data.name ?? selectedEdge.target}</strong>
                  </div>
                  <div className={styles.fieldFootnote}>
                    拒绝路径的回流目标由这条连线的终点决定。
                  </div>
                </section>
              </Form>
              <div className={styles.propertiesBottom}>
                <span>业务模型</span>
                <code>flows</code>
                <span className={styles.bottomDivider} />
                <span>分支</span>
                <code>{selectedEdge.data?.branch ?? '普通流转'}</code>
              </div>
            </>
          ) : selectedNode ? (
            <>
              <div className={styles.propertyHeader}>
                <div>
                  <h2>属性设置</h2>
                  <p>选中节点后编辑业务信息</p>
                </div>
                <Tag className={styles.kindTag}>
                  <span
                    className={
                      styles.kindDot + ' ' + styles['dot' + kindMeta[selectedNode.data.kind].tone]
                    }
                  />
                  {kindMeta[selectedNode.data.kind].label}
                </Tag>
              </div>
              <div className={styles.selectedSummary}>
                <span
                  className={
                    styles.summaryIcon +
                    ' ' +
                    styles['glyph' + kindMeta[selectedNode.data.kind].tone]
                  }
                >
                  {(() => {
                    const Icon = kindMeta[selectedNode.data.kind].icon
                    return <Icon aria-hidden="true" />
                  })()}
                </span>
                <span>
                  <strong>{selectedNode.data.name}</strong>
                  <small>
                    节点标识 <code>{selectedNode.id}</code>
                  </small>
                </span>
                {selectedNode.data.kind !== 'start' && selectedNode.data.kind !== 'end' && (
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    aria-label="删除当前节点"
                    title="删除节点"
                    onClick={() => {
                      setNodes((current) => current.filter((node) => node.id !== selectedNode.id))
                      setEdges((current) =>
                        current.filter(
                          (edge) =>
                            edge.source !== selectedNode.id && edge.target !== selectedNode.id,
                        ),
                      )
                      setSelectedEdgeId(null)
                      setSelectedNodeId('start')
                    }}
                  />
                )}
              </div>
              <Form layout="vertical" requiredMark={false} className={styles.propertyForm}>
                <section className={styles.formSection}>
                  <div className={styles.sectionHeading}>
                    <span>基本信息</span>
                    <i />
                  </div>
                  <Form.Item label="步骤名称" className={styles.formItem}>
                    <Input
                      value={selectedNode.data.name}
                      onChange={(event) => updateNodeData({ name: event.target.value })}
                      placeholder="输入步骤名称"
                      maxLength={40}
                    />
                  </Form.Item>
                  <div className={styles.fieldFootnote}>画布和业务模型 JSON 中均使用此名称。</div>
                  <Form.Item label="表单标识（form）" className={styles.formItem}>
                    <Input
                      allowClear
                      value={selectedNode.data.form ?? ''}
                      onChange={(event) =>
                        updateNodeData({ form: event.target.value || undefined })
                      }
                      placeholder="可选；留空时不生成"
                    />
                  </Form.Item>
                </section>

                {(selectedNode.data.kind === 'approval' ||
                  selectedNode.data.kind === 'countersign') && (
                  <section className={styles.formSection}>
                    <div className={styles.sectionHeading}>
                      <span>{selectedNode.data.kind === 'approval' ? '审批参数' : '节点参数'}</span>
                      <i />
                    </div>
                    {selectedNode.data.kind === 'countersign' && (
                      <Form.Item label="审批顺序" className={styles.formItem}>
                        <Select
                          value={selectedNode.data.sequential ? 'sequential' : 'parallel'}
                          options={[
                            { label: '并行处理', value: 'parallel' },
                            { label: '按顺序处理', value: 'sequential' },
                          ]}
                          onChange={(value: 'parallel' | 'sequential') =>
                            updateNodeData({ sequential: value === 'sequential' })
                          }
                        />
                      </Form.Item>
                    )}
                    <Form.Item label="超时提醒" className={styles.formItem}>
                      <Select
                        value={selectedNode.data.reminderEnabled ? 'enabled' : 'disabled'}
                        options={[
                          { label: '关闭提醒', value: 'disabled' },
                          { label: '启用提醒', value: 'enabled' },
                        ]}
                        onChange={(value: 'enabled' | 'disabled') =>
                          updateNodeData({ reminderEnabled: value === 'enabled' })
                        }
                      />
                    </Form.Item>
                    {selectedNode.data.reminderEnabled && (
                      <>
                        <Form.Item label="提醒时长" className={styles.formItem}>
                          <Input
                            allowClear
                            value={selectedNode.data.reminderDuration ?? ''}
                            onChange={(event) =>
                              updateNodeData({ reminderDuration: event.target.value || undefined })
                            }
                            placeholder="ISO-8601，例如 PT30M；留空时按节点 ID 发起可提供，默认 P1D"
                          />
                        </Form.Item>
                        <Form.Item label="提醒名称" className={styles.formItem}>
                          <Input
                            allowClear
                            value={selectedNode.data.reminderName ?? ''}
                            onChange={(event) =>
                              updateNodeData({ reminderName: event.target.value || undefined })
                            }
                            placeholder={'默认：' + selectedNode.data.name + '超时提醒'}
                          />
                        </Form.Item>
                      </>
                    )}
                  </section>
                )}

                {selectedNode.data.kind === 'countersign' && (
                  <section className={styles.formSection}>
                    <div className={styles.sectionHeading}>
                      <span>多人审批</span>
                      <i />
                    </div>
                    <Form.Item label="审批模式" className={styles.formItem}>
                      <Select
                        value={selectedNode.data.approveMode}
                        allowClear
                        placeholder="留空不固化，发起时可按节点 ID 提供"
                        options={[
                          { label: '会签 · 所有人通过（ALL）', value: 'ALL' },
                          { label: '或签 · 任意一人通过（ANY）', value: 'ANY' },
                          { label: '比例会签（VOTE）', value: 'VOTE' },
                        ]}
                        onChange={(value: string | undefined) =>
                          updateNodeData({
                            approveMode: value || undefined,
                            ...(value === 'VOTE' ? {} : { passRate: undefined }),
                          })
                        }
                      />
                    </Form.Item>
                    {selectedNode.data.approveMode === 'VOTE' && (
                      <Form.Item label="通过比例（passRate）" className={styles.formItem}>
                        <Input
                          inputMode="decimal"
                          value={selectedNode.data.passRate ?? ''}
                          onChange={(event) =>
                            updateNodeData({ passRate: event.target.value || undefined })
                          }
                          placeholder="范围 (0, 1]；未填写时可按节点 ID 在发起时提供"
                        />
                      </Form.Item>
                    )}
                    <div className={styles.fieldFootnote}>
                      模式填写在此会签节点的 approveMode 字段；只有留空时才按后端定义使用启动变量{' '}
                      {selectedNode.id}_approveMode。该值名由节点 ID 派生。比例仅在 VOTE
                      模式需要配置。
                    </div>
                    <Alert
                      className={styles.serviceAlert}
                      type="info"
                      showIcon
                      message="会签模式属于节点配置"
                      description="approveMode 作为 nodes[] 中会签节点的属性提交。当前后端支持 ALL、ANY、VOTE；留空时可按节点 ID 在发起时提供，默认 ALL。"
                    />
                  </section>
                )}

                {selectedNode.data.kind === 'service' && (
                  <section className={styles.formSection}>
                    <div className={styles.sectionHeading}>
                      <span>服务配置</span>
                      <i />
                    </div>
                    <Form.Item label="服务名称" className={styles.formItem}>
                      <Input
                        allowClear
                        value={serviceData?.serviceName ?? ''}
                        onChange={(event) => updateNodeData({ serviceName: event.target.value })}
                        placeholder="留空表示在发起时动态提供"
                        maxLength={60}
                      />
                    </Form.Item>
                    <div className={styles.fieldFootnote}>
                      留空时使用启动变量 {selectedNode.id}_serviceName；固定值写入流程定义。
                    </div>
                    <Form.Item label="服务地址" className={styles.formItem}>
                      <Input
                        allowClear
                        prefix={<LinkOutlined />}
                        value={serviceData?.serviceUrl ?? ''}
                        onChange={(event) => updateNodeData({ serviceUrl: event.target.value })}
                        placeholder="留空表示在发起时动态提供"
                      />
                    </Form.Item>
                    {dynamicService ? (
                      <Alert
                        className={styles.serviceAlert}
                        type="warning"
                        showIcon
                        icon={<InfoCircleOutlined />}
                        message="动态服务地址"
                        description={
                          '留空时由发起方通过启动变量 ' + selectedNode.id + '_serviceUrl 提供。'
                        }
                      />
                    ) : (
                      <div className={styles.addressMode}>
                        <span className={styles.modeDot} />
                        <span>
                          <strong>固定服务地址</strong>
                          <small>随流程业务模型提交并参与编译</small>
                        </span>
                      </div>
                    )}
                    <div className={styles.serviceFootnote}>
                      <InfoCircleOutlined /> 服务节点由后端流程引擎执行。
                    </div>
                  </section>
                )}

                {selectedNode.data.kind !== 'service' && selectedNode.data.kind !== 'condition' && (
                  <section className={styles.formSection}>
                    <div className={styles.sectionHeading}>
                      <span>节点说明</span>
                      <i />
                    </div>
                    <p className={styles.nodeDescription}>
                      {selectedNode.data.kind === 'start'
                        ? '流程从此处开始。每个流程只保留一个开始节点。'
                        : selectedNode.data.kind === 'end'
                          ? '流程到达此处后完成。每个流程只保留一个结束节点。'
                          : selectedNode.data.kind === 'countersign'
                            ? '流程到达此处后，多个审批人按照设定的会签或或签规则共同处理。'
                            : '流程到达此步骤后，由业务指定的审批人进行处理。'}
                    </p>
                  </section>
                )}
              </Form>
              <div className={styles.propertiesBottom}>
                <span>业务模型</span>
                <code>service</code>
                <span className={styles.bottomDivider} />
                <span>画布坐标</span>
                <code>
                  {Math.round(selectedNode.position.x)}, {Math.round(selectedNode.position.y)}
                </code>
              </div>
            </>
          ) : (
            <div className={styles.emptyProperties}>
              <div className={styles.emptyPropertiesIcon}>◇</div>
              <strong>画布为空</strong>
              <p>添加开始、审批或其他流程节点，继续设计业务流程。</p>
            </div>
          )}
        </aside>
      </div>

      <Modal
        title="业务模型 JSON"
        open={jsonOpen}
        onCancel={() => setJsonOpen(false)}
        footer={[
          <Button key="close" onClick={() => setJsonOpen(false)}>
            关闭
          </Button>,
          <Button key="copy" icon={<CopyOutlined />} onClick={copyJson}>
            {jsonCopied ? '已复制' : '复制 JSON'}
          </Button>,
          <Button key="download" type="primary" icon={<DownloadOutlined />} onClick={downloadJson}>
            下载 JSON
          </Button>,
        ]}
        width={680}
      >
        <p className={styles.jsonNote}>
          服务地址留空表示动态地址；这里展示并下载当前业务模型 JSON。
        </p>
        <Input.TextArea
          className={styles.jsonBox}
          value={json}
          readOnly
          autoSize={{ minRows: 18, maxRows: 28 }}
        />
      </Modal>
      <Modal
        title="输入业务 JSON"
        open={workflowJsonOpen}
        onCancel={() => setWorkflowJsonOpen(false)}
        footer={[
          <Button key="close" onClick={() => setWorkflowJsonOpen(false)}>
            取消
          </Button>,
          <Button
            key="compile"
            type="primary"
            icon={<CodeOutlined />}
            loading={xmlCompiling}
            onClick={compileJsonXml}
          >
            转换为 BPMN XML
          </Button>,
        ]}
        width={760}
      >
        <p className={styles.jsonNote}>
          粘贴包含流程标识、名称、节点和连线的业务模型 JSON。转换后可在 XML 窗口中复制结果。
        </p>
        <Input.TextArea
          className={styles.jsonBox}
          value={workflowJsonInput}
          onChange={(event) => setWorkflowJsonInput(event.target.value)}
          placeholder={
            '{\n  "processId": "my-workflow",\n  "processName": "示例流程",\n  "nodes": [],\n  "flows": []\n}'
          }
          aria-label="业务 JSON"
          autoSize={{ minRows: 16, maxRows: 26 }}
        />
      </Modal>
      <Modal
        title="BPMN XML"
        open={xmlOpen}
        onCancel={() => setXmlOpen(false)}
        footer={[
          <Button key="close" onClick={() => setXmlOpen(false)}>
            关闭
          </Button>,
          <Button key="copy" icon={<CopyOutlined />} onClick={copyXml}>
            {xmlCopied ? '已复制' : '复制 XML'}
          </Button>,
        ]}
        width={760}
      >
        <p className={styles.jsonNote}>
          XML 由当前业务模型生成；可复制到剪贴板，或在下方文本框中手动选择。
        </p>
        <Input.TextArea
          className={styles.jsonBox}
          value={workflowXml}
          readOnly
          autoSize={{ minRows: 18, maxRows: 28 }}
        />
      </Modal>
      <Modal
        title="流程检查"
        open={checkOpen}
        onCancel={() => setCheckOpen(false)}
        footer={<Button onClick={() => setCheckOpen(false)}>完成</Button>}
      >
        {issues.length ? (
          <div className={styles.issueList}>
            {issues.map((issue, index) => (
              <button
                key={(issue.nodeId || issue.edgeId || 'flow') + '-check-' + index}
                type="button"
                className={styles.issueItem}
                onClick={() => {
                  locateIssue(issue)
                  setCheckOpen(false)
                }}
              >
                <span>{issue.message}</span>
                <small>{issue.locationLabel || '流程'}</small>
              </button>
            ))}
          </div>
        ) : (
          <Alert
            type="success"
            showIcon
            message="流程检查通过"
            description="节点和路径均符合当前业务模型规则。"
          />
        )}
      </Modal>
    </section>
  )
}

function FlowCanvas(props: {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  onNodesChange: (changes: NodeChange<CanvasNode>[]) => void
  onEdgesChange: (changes: EdgeChange<CanvasEdge>[]) => void
  onConnect: (connection: Connection) => void
  onReconnect: (oldEdge: CanvasEdge, connection: Connection) => void
  isValidConnection: (connection: { source: string; target: string }) => boolean
  onNodeSelect: (id: string) => void
  selectedEdgeId: string | null
  onEdgeSelect: (id: string) => void
  onPaneSelect: () => void
  onChange: () => void
  onNodeMove: () => void
}) {
  const displayEdges = useMemo(
    () =>
      props.edges.map((edge) => {
        const source = props.nodes.find((node) => node.id === edge.source)
        const target = props.nodes.find((node) => node.id === edge.target)
        const feedback = isFeedbackRejectEdge(edge, props.edges)
        const routePoints =
          feedback && source && target
            ? getRejectRoutePoints(
                source.position.x + 154,
                source.position.y + 29,
                target.position.x,
                target.position.y + 29,
                props.nodes,
              )
            : edge.data?.routePoints
        return {
          ...edge,
          type: 'workflowRoute',
          data: { ...edge.data, feedback, routePoints },
          selected: edge.id === props.selectedEdgeId,
        }
      }),
    [props.edges, props.nodes, props.selectedEdgeId],
  )
  const applyNodeChanges = props.onNodesChange
  const applyEdgeChanges = props.onEdgesChange
  const connectNodes = props.onConnect
  const markChanged = props.onChange
  const invalidateRoutes = props.onNodeMove
  const selectNode = props.onNodeSelect
  const selectEdge = props.onEdgeSelect
  const handleNodesChange = useCallback(
    (changes: NodeChange<CanvasNode>[]) => {
      applyNodeChanges(changes)
      const moveFinished = changes.some(
        (change) => change.type === 'position' && change.dragging === false,
      )
      if (moveFinished) {
        invalidateRoutes()
        markChanged()
      }
    },
    [applyNodeChanges, invalidateRoutes, markChanged],
  )
  const handleEdgesChange = useCallback(
    (changes: EdgeChange<CanvasEdge>[]) => {
      applyEdgeChanges(changes)
      markChanged()
    },
    [applyEdgeChanges, markChanged],
  )
  const handleConnect = useCallback(
    (connection: Connection) => {
      connectNodes(connection)
      markChanged()
    },
    [connectNodes, markChanged],
  )
  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: CanvasNode) => {
      selectNode(node.id)
    },
    [selectNode],
  )
  const handleEdgeClick = useCallback(
    (_: React.MouseEvent, edge: CanvasEdge) => {
      selectEdge(edge.id)
    },
    [selectEdge],
  )

  return (
    <ReactFlow
      nodes={props.nodes}
      edges={displayEdges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={handleNodesChange}
      onEdgesChange={handleEdgesChange}
      onConnect={handleConnect}
      onNodeClick={handleNodeClick}
      onEdgeClick={handleEdgeClick}
      onPaneClick={props.onPaneSelect}
      onReconnect={props.onReconnect}
      isValidConnection={props.isValidConnection}
      reconnectRadius={28}
      fitView
      fitViewOptions={fitViewOptions}
      minZoom={0.35}
      maxZoom={1.6}
      defaultEdgeOptions={defaultEdgeOptions}
      deleteKeyCode={['Backspace', 'Delete']}
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1.1} color="#dce6df" />
      <MiniMap className={styles.miniMap} pannable zoomable nodeColor={getMiniMapNodeColor} />
      <Controls className={styles.flowControls} showInteractive={false} />
    </ReactFlow>
  )
}

export function DesignerUiPrototype() {
  return (
    <ReactFlowProvider>
      <DesignerUiPrototypeContent />
    </ReactFlowProvider>
  )
}
