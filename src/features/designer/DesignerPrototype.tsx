/**
 * Throwaway UI prototype for the business-first approval flow designer.
 * The existing /designer route mounts it only in development with ?variant=canvas.
 */
import { useCallback, useMemo, useRef, useState, type DragEvent } from 'react'
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
  type Edge,
  type Node,
  type Connection,
  type NodeProps,
} from '@xyflow/react'
import {
  ApartmentOutlined,
  CheckCircleFilled,
  CloseOutlined,
  DeleteOutlined,
  DownloadOutlined,
  DragOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
  InfoCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  UserOutlined,
  CloudUploadOutlined,
  CodeOutlined,
  FileSearchOutlined,
} from '@ant-design/icons'
import { Alert, Button, Input, Modal, Select, Tag, message } from 'antd'
import type { TaskTemplate } from '@/api/workflow'
import { businessWorkflowGateway } from '@/api/workflow'
import { compileProjectApprovalModel } from '@/api/bpmn'
import styles from './DesignerPrototype.module.less'
import {
  toProjectApprovalModel,
  inferApplicationNodeId,
  validateProjectApprovalFlow,
  type ProjectBranch,
  type ProjectNodeKind,
  type ProjectValidationIssue,
} from './projectApprovalModel'
import {
  assertDeploymentResult,
  getTemplateStartVariables,
  isDeploymentUncertain,
} from './templateDeployment'

type NodeKind = ProjectNodeKind
type Branch = ProjectBranch
type NodeData = { kind: NodeKind; name: string; isApplication?: boolean }
type EdgeData = { branch: Branch }
type PalettePurpose = 'application' | 'review'
type PaletteEntry = {
  kind: NodeKind
  title: string
  detail: string
  icon: string
  purpose?: PalettePurpose
}
type BusinessNode = Node<NodeData, 'business'>
type BusinessEdge = Edge<EdgeData>
type ValidationIssue = ProjectValidationIssue

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
    data: { kind: 'approval', name: '立项申请单' },
  },
  {
    id: 'minister',
    type: 'business',
    position: { x: 250, y: 238 },
    data: { kind: 'approval', name: '部长审批' },
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
  node.data.kind === 'approval' && node.data.isApplication
    ? purposeLabels.application
    : nodeLabels[node.data.kind]
const displayNodeDescription = (node: BusinessNode) =>
  node.data.kind === 'approval' && node.data.isApplication
    ? purposeDescriptions.application
    : nodeDescriptions[node.data.kind]

function BusinessFlowNode({ data, id, selected }: NodeProps<BusinessNode>) {
  const icon = paletteNodes.find(
    (item) =>
      item.kind === data.kind &&
      (data.kind !== 'approval' ||
        item.purpose === (data.isApplication ? 'application' : 'review')),
  )?.icon
  const isApplication = data.kind === 'approval' && data.isApplication === true
  return (
    <div
      className={
        styles.flowNode +
        ' ' +
        styles['node-' + data.kind] +
        (isApplication ? ' ' + styles['purpose-application'] : '') +
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
            : displayNodeDescription({ id, type: 'business', position: { x: 0, y: 0 }, data })}
        </small>
      </span>
      {data.kind === 'approval' && !isApplication && (
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
  const [modelOpen, setModelOpen] = useState(false)
  const [publishOpen, setPublishOpen] = useState(false)
  const [xmlOpen, setXmlOpen] = useState(false)
  const [compileLoading, setCompileLoading] = useState(false)
  const [publishLoading, setPublishLoading] = useState(false)
  const [compiledXml, setCompiledXml] = useState<string | null>(null)
  const [workflowError, setWorkflowError] = useState<string | null>(null)
  const [workflowErrorStage, setWorkflowErrorStage] = useState<'compile' | 'publish'>('compile')
  const [publishUncertain, setPublishUncertain] = useState(false)
  const [publishRetryApproved, setPublishRetryApproved] = useState(false)
  const [publishedTemplate, setPublishedTemplate] = useState<TaskTemplate | null>(null)
  const revisionRef = useRef(0)
  const [hasChecked, setHasChecked] = useState(false)
  const { screenToFlowPosition, fitView } = useReactFlow<BusinessNode, BusinessEdge>()
  const issues = useMemo(() => validateProjectApprovalFlow(nodes, edges), [nodes, edges])
  const projectApprovalModel = useMemo(() => toProjectApprovalModel(nodes, edges), [nodes, edges])
  const projectApprovalJson = useMemo(
    () => JSON.stringify(projectApprovalModel, null, 2),
    [projectApprovalModel],
  )
  const applicationNodeId = useMemo(() => inferApplicationNodeId(nodes, edges), [nodes, edges])
  const selectedNode = nodes.find((node) => node.id === selectedNodeId)
  const selectedNodeForView = selectedNode
    ? {
        ...selectedNode,
        data: {
          ...selectedNode.data,
          isApplication:
            selectedNode.data.kind === 'approval' && selectedNode.id === applicationNodeId,
        },
      }
    : undefined
  const canvasNodes = useMemo(
    () =>
      nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          isApplication: node.data.kind === 'approval' && node.id === applicationNodeId,
        },
      })),
    [applicationNodeId, nodes],
  )
  const selectedEdge = edges.find((edge) => edge.id === selectedEdgeId)
  const invalidateCompilation = useCallback(() => {
    revisionRef.current += 1
    setCompiledXml(null)
    setWorkflowError(null)
    setWorkflowErrorStage('compile')
    setPublishOpen(false)
    setPublishedTemplate(null)
    setPublishUncertain(false)
    setPublishRetryApproved(false)
  }, [])
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
    invalidateCompilation()
    setHasChecked(false)
    setNodes((current) =>
      current.map((node) =>
        node.id === selectedNodeId ? { ...node, data: { ...node.data, name } } : node,
      ),
    )
  }
  const addNode = useCallback(
    (kind: NodeKind, position?: { x: number; y: number }, purpose?: PalettePurpose) => {
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
        },
      }
      setNodes((current) => [...current, node])
      invalidateCompilation()
      setHasChecked(false)
      selectNode(id)
    },
    [invalidateCompilation, nodes, setNodes],
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
      invalidateCompilation()
      setSelectedEdgeId(edge.id)
      setSelectedNodeId(null)
      setCheckOpen(false)
      setHasChecked(false)
    },
    [edges, invalidateCompilation, nodes, setEdges],
  )
  const onReconnect = useCallback(
    (oldEdge: BusinessEdge, connection: Connection) => {
      if (!connection.source || !connection.target) return
      const nextSource = nodes.find((node) => node.id === connection.source)
      const nextBranch =
        nextSource?.data.kind === 'condition'
          ? oldEdge.data?.branch === 'reject'
            ? 'reject'
            : 'pass'
          : 'continue'
      setEdges((current) =>
        reconnectEdge(oldEdge, connection, current).map((edge) =>
          edge.id === oldEdge.id ? makeEdge(edge.id, edge.source, edge.target, nextBranch) : edge,
        ),
      )
      invalidateCompilation()
      setHasChecked(false)
    },
    [invalidateCompilation, nodes, setEdges],
  )
  const updateEdgeBranch = (branch: Branch) => {
    if (!selectedEdgeId) return
    if (branch !== 'continue') {
      const selected = edges.find((edge) => edge.id === selectedEdgeId)
      const source = nodes.find((node) => node.id === selected?.source)
      if (source?.data.kind !== 'condition') return
    }
    setHasChecked(false)
    setEdges((current) =>
      current.map((edge) =>
        edge.id === selectedEdgeId ? makeEdge(edge.id, edge.source, edge.target, branch) : edge,
      ),
    )
    invalidateCompilation()
    setPublishedTemplate(null)
  }
  const deleteNode = () => {
    if (!selectedNode || selectedNode.data.kind === 'start' || selectedNode.data.kind === 'end')
      return
    setNodes((current) => current.filter((node) => node.id !== selectedNode.id))
    invalidateCompilation()
    setPublishedTemplate(null)
    setEdges((current) =>
      current.filter((edge) => edge.source !== selectedNode.id && edge.target !== selectedNode.id),
    )
    clearSelection()
    setHasChecked(false)
  }
  const deleteEdge = () => {
    if (!selectedEdgeId) return
    setEdges((current) => current.filter((edge) => edge.id !== selectedEdgeId))
    invalidateCompilation()
    setPublishedTemplate(null)
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
    if (publishLoading) return
    setNodes(initialNodes)
    setEdges(initialEdges)
    clearSelection()
    setCheckOpen(false)
    setHasChecked(false)
    invalidateCompilation()
    setPublishedTemplate(null)
  }
  const openCheck = () => {
    setHasChecked(true)
    setCheckOpen(true)
    clearSelection()
  }
  const compileModel = async () => {
    if (issues.length > 0) {
      openCheck()
      message.warning('请先修复流程检查中列出的问题，再编译业务模型。')
      return
    }
    setCompileLoading(true)
    setWorkflowError(null)
    setWorkflowErrorStage('compile')
    setCompiledXml(null)
    const compileRevision = revisionRef.current
    try {
      const xml = await compileProjectApprovalModel(projectApprovalModel)
      if (revisionRef.current !== compileRevision) return
      setCompiledXml(xml)
      message.success('业务模型编译成功，可以发布流程。')
    } catch (error) {
      if (revisionRef.current !== compileRevision) return
      const text = error instanceof Error ? error.message : '业务模型编译失败，请稍后重试。'
      setWorkflowError(text)
      message.error(text)
    } finally {
      setCompileLoading(false)
    }
  }
  const publishModel = async () => {
    if (!compiledXml || (publishUncertain && !publishRetryApproved)) return
    setPublishLoading(true)
    setWorkflowError(null)
    setWorkflowErrorStage('publish')
    setPublishUncertain(false)
    setPublishRetryApproved(false)
    try {
      const template = await businessWorkflowGateway.publishTemplate({
        xml: compiledXml,
        deploymentName: projectApprovalModel.processName,
        taskKey: projectApprovalModel.processId,
        taskName: projectApprovalModel.processName,
        displayJson: projectApprovalModel as unknown as Record<string, unknown>,
      })
      assertDeploymentResult(template)
      setPublishedTemplate(template)
      setPublishOpen(true)
      message.success('流程发布成功。')
    } catch (error) {
      const text = error instanceof Error ? error.message : '流程发布失败，请稍后重试。'
      const uncertain = isDeploymentUncertain(error)
      setPublishUncertain(uncertain)
      const displayText = uncertain
        ? text + ' 当前模板版本可能已更新，请先核对模板状态，再决定是否重试发布。'
        : text
      setWorkflowError(displayText)
      setPublishRetryApproved(false)
      message.error(displayText)
    } finally {
      setPublishLoading(false)
    }
  }
  const locateIssue = (issue: ValidationIssue) => {
    if (issue.edgeId) {
      const edge = edges.find((candidate) => candidate.id === issue.edgeId)
      if (edge) selectEdge(edge.id)
      else if (issue.nodeId) selectNode(issue.nodeId)
      void fitView({
        nodes: [
          ...(edge ? [{ id: edge.source }, { id: edge.target }] : []),
          ...(issue.nodeId ? [{ id: issue.nodeId }] : []),
        ],
        padding: 0.55,
        duration: 300,
      })
      return
    }
    if (issue.nodeId) {
      selectNode(issue.nodeId)
      void fitView({ nodes: [{ id: issue.nodeId }], padding: 0.55, duration: 300 })
    }
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
          <Button icon={<ReloadOutlined />} disabled={publishLoading} onClick={reset}>
            恢复示例
          </Button>
          <Button icon={<DownloadOutlined />} onClick={() => setModelOpen(true)}>
            业务模型 JSON
          </Button>
          <Button
            type="primary"
            icon={<CheckCircleFilled />}
            disabled={compileLoading || publishLoading}
            onClick={openCheck}
          >
            检查流程
          </Button>
          <Button
            icon={<CodeOutlined />}
            loading={compileLoading}
            disabled={publishLoading || issues.length > 0}
            onClick={() => void compileModel()}
          >
            编译业务模型
          </Button>
          <Button
            disabled={!compiledXml || compileLoading || publishLoading}
            icon={<FileSearchOutlined />}
            onClick={() => setXmlOpen(true)}
          >
            查看编译结果
          </Button>
          <Button
            type="primary"
            icon={<CloudUploadOutlined />}
            disabled={
              !compiledXml ||
              publishLoading ||
              compileLoading ||
              (publishUncertain && !publishRetryApproved)
            }
            onClick={() => void publishModel()}
          >
            发布流程
          </Button>
        </div>
      </header>
      {workflowError && (
        <Alert
          type="error"
          showIcon
          closable
          message={workflowErrorStage === 'publish' ? '流程发布失败' : '业务模型编译失败'}
          description={workflowError}
          onClose={() => setWorkflowError(null)}
        />
      )}
      {workflowErrorStage === 'publish' && publishUncertain && (
        <Alert
          type="warning"
          showIcon
          message="无法确认刚才的发布是否已完成"
          description="部署请求超时或服务端报错时，后端可能已经创建新版本。请先核对任务模板与流程定义，再明确选择是否重试。"
          action={
            <Button
              size="small"
              onClick={() =>
                Modal.confirm({
                  title: '确认重试发布？',
                  content: '只有在已核对当前任务模板和流程定义后，才继续使用同一 taskKey 发布。',
                  okText: '继续发布',
                  cancelText: '暂不重试',
                  onOk: () => setPublishRetryApproved(true),
                })
              }
            >
              已核对，允许重试
            </Button>
          }
        />
      )}
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
        {publishedTemplate && (
          <span className={styles.publishedBadge}>
            <CheckCircleFilled /> 已发布 v{publishedTemplate.version}
          </span>
        )}
      </div>
      <main
        className={
          styles.workspace + (compileLoading || publishLoading ? ' ' + styles.workspaceBusy : '')
        }
        aria-busy={compileLoading || publishLoading}
      >
        <aside className={styles.palette}>
          <div className={styles.panelHeading}>
            <b>节点库</b>
            <small>拖到画布中添加</small>
          </div>
          <div className={styles.paletteGroupLabel}>流程步骤</div>
          <div className={styles.paletteList}>
            {paletteNodes.map((entry) => {
              const singletonUsed =
                ((entry.kind === 'start' || entry.kind === 'end') &&
                  nodes.some((node) => node.data.kind === entry.kind)) ||
                (entry.purpose === 'application' && applicationNodeId !== undefined)
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
                      (entry.purpose === 'application' ? ' ' + styles['purpose-application'] : '')
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
            <div className={styles.formFoot}>
              <InfoCircleOutlined /> 字段与表单值由业务系统提供；流程设计不配置字段结构
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
              nodes={canvasNodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={(changes) => {
                onNodesChange(changes)
                if (
                  changes.some((change) => change.type === 'position' || change.type === 'remove')
                )
                  setHasChecked(false)
                if (
                  changes.some((change) => change.type === 'position' || change.type === 'remove')
                ) {
                  invalidateCompilation()
                }
              }}
              onEdgesChange={(changes) => {
                onEdgesChange(changes)
                if (changes.some((change) => change.type === 'remove')) {
                  setHasChecked(false)
                  invalidateCompilation()
                }
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
                    ? displayNodeLabel(selectedNodeForView || selectedNode) + '节点'
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
          {selectedNodeForView ? (
            <NodeProperties
              node={selectedNodeForView}
              onName={updateNodeName}
              onDelete={deleteNode}
            />
          ) : selectedEdge ? (
            <EdgeProperties
              edge={selectedEdge}
              source={nodes.find((node) => node.id === selectedEdge.source)}
              target={nodes.find((node) => node.id === selectedEdge.target)}
              onBranch={updateEdgeBranch}
              onDelete={deleteEdge}
            />
          ) : checkOpen ? (
            <CheckResults issues={issues} onSelect={locateIssue} />
          ) : (
            <FlowProperties onCheck={openCheck} />
          )}
        </aside>
      </main>
      <Modal
        open={modelOpen}
        title="立项审批业务模型 JSON"
        width={720}
        onCancel={() => setModelOpen(false)}
        footer={[
          <Button key="close" onClick={() => setModelOpen(false)}>
            关闭
          </Button>,
          <Button
            key="download"
            type="primary"
            icon={<DownloadOutlined />}
            onClick={() => {
              const file = new Blob([projectApprovalJson], { type: 'application/json' })
              const url = URL.createObjectURL(file)
              const anchor = document.createElement('a')
              anchor.href = url
              anchor.download = 'project_approval_json.json'
              anchor.click()
              URL.revokeObjectURL(url)
            }}
          >
            下载 JSON
          </Button>,
        ]}
      >
        <p className={styles.modelCaption}>
          当前画布生成的业务模型；编译时通过既有接口交由后端转换为 BPMN XML。
        </p>
        <pre className={styles.modelPreview}>{projectApprovalJson}</pre>
      </Modal>
      <Modal
        open={xmlOpen}
        title="后端编译结果 · BPMN XML"
        width={760}
        onCancel={() => setXmlOpen(false)}
        footer={[
          <Button key="close" onClick={() => setXmlOpen(false)}>
            关闭
          </Button>,
          <Button
            key="download"
            type="primary"
            icon={<DownloadOutlined />}
            onClick={() => {
              if (!compiledXml) return
              const file = new Blob([compiledXml], { type: 'application/xml' })
              const url = URL.createObjectURL(file)
              const anchor = document.createElement('a')
              anchor.href = url
              anchor.download = 'project-approval.bpmn'
              anchor.click()
              URL.revokeObjectURL(url)
            }}
          >
            下载 XML
          </Button>,
        ]}
      >
        <p className={styles.modelCaption}>
          XML 来自后端编译结果，仅供检查与下载；修改流程后需要重新编译。
        </p>
        <pre className={styles.modelPreview}>{compiledXml}</pre>
      </Modal>
      <Modal
        open={publishOpen}
        title="流程已发布"
        width={620}
        footer={
          <Button type="primary" onClick={() => setPublishOpen(false)}>
            完成
          </Button>
        }
        onCancel={() => setPublishOpen(false)}
      >
        {publishedTemplate && (
          <div className={styles.publishResult}>
            <div className={styles.publishSuccess}>
              <CheckCircleFilled /> 新版本已部署
            </div>
            <div className={styles.publishMeta}>
              <span>任务模板</span>
              <code>{publishedTemplate.taskKey}</code>
            </div>
            <div className={styles.publishMeta}>
              <span>版本</span>
              <b>{publishedTemplate.version}</b>
            </div>
            <div className={styles.publishMeta}>
              <span>部署标识</span>
              <code>{publishedTemplate.deploymentId}</code>
            </div>
            <div className={styles.publishMeta}>
              <span>流程定义</span>
              <code>{publishedTemplate.processDefinitionId}</code>
            </div>
            <div className={styles.publishVariables}>
              <b>启动时需要的字段</b>
              {getTemplateStartVariables(publishedTemplate).length ? (
                getTemplateStartVariables(publishedTemplate).map((variable) => (
                  <div className={styles.startVariable} key={variable.name}>
                    <code>{variable.name}</code>
                    <span>{variable.description || variable.type}</span>
                    {variable.required && <Tag color="red">必填</Tag>}
                  </div>
                ))
              ) : (
                <small>后端未返回启动字段说明。</small>
              )}
            </div>
            <Alert
              type="info"
              showIcon
              message="运行中的实例绑定其流程定义版本。再次发布会创建新部署；后端模板记录按 taskKey 更新。"
            />
          </div>
        )}
      </Modal>
      <footer className={styles.footer}>
        <span>
          <InfoCircleOutlined /> 业务流程原型 · 不保存草稿；审批人员不在设计期配置
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
          (node.data.isApplication ? ' ' + styles['purpose-application'] : '')
        }
      >
        <span>
          {
            paletteNodes.find(
              (item) =>
                item.kind === kind &&
                (kind !== 'approval' ||
                  item.purpose === (node.data.isApplication ? 'application' : 'review')),
            )?.icon
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
      {kind === 'approval' && !node.data.isApplication && (
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
      {node.data.isApplication && (
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
            className={styles.issueItem}
            onClick={() => onSelect(issue)}
          >
            <ExclamationCircleOutlined />
            <span>{issue.message}</span>
            <i>
              {issue.locationLabel
                ? issue.locationLabel + ' · 查看'
                : issue.nodeId || issue.edgeId
                  ? '画布中查看'
                  : '流程检查'}
            </i>
          </button>
        ))}
      </div>
    </div>
  )
}
