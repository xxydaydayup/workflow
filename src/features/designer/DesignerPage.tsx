import { useCallback, useMemo } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
} from '@xyflow/react'
import {
  AppstoreAddOutlined,
  CheckOutlined,
  CloudUploadOutlined,
  PlusOutlined,
  SaveOutlined,
} from '@ant-design/icons'
import { Button, Dropdown, Input, Select, Tag, Tooltip } from 'antd'
import { useEditorStore } from './editorStore'
import styles from './DesignerPage.module.less'
import '@xyflow/react/dist/style.css'

const initialNodes: Node[] = [
  {
    id: 'start',
    type: 'input',
    position: { x: 80, y: 190 },
    data: { label: '提交申请' },
    style: { borderColor: '#68a98a', background: '#f0f8f3', color: '#315f53' },
  },
  {
    id: 'review',
    position: { x: 300, y: 190 },
    data: { label: '部门负责人审批' },
    style: { width: 164, borderColor: '#d8a85e', background: '#fffaf0', color: '#72552a' },
  },
  {
    id: 'finance',
    position: { x: 550, y: 95 },
    data: { label: '财务复核' },
    style: { width: 132, borderColor: '#86a6c1', background: '#f1f6fa', color: '#45657e' },
  },
  {
    id: 'end',
    type: 'output',
    position: { x: 770, y: 190 },
    data: { label: '完成' },
    style: { borderColor: '#68a98a', background: '#f0f8f3', color: '#315f53' },
  },
]

const initialEdges: Edge[] = [
  {
    id: 'e-start-review',
    source: 'start',
    target: 'review',
    animated: true,
    style: { stroke: '#83a99a', strokeWidth: 1.6 },
  },
  {
    id: 'e-review-finance',
    source: 'review',
    target: 'finance',
    label: '金额 ≥ 5,000',
    style: { stroke: '#9aaba4', strokeWidth: 1.4 },
  },
  {
    id: 'e-finance-end',
    source: 'finance',
    target: 'end',
    style: { stroke: '#9aaba4', strokeWidth: 1.4 },
  },
  {
    id: 'e-review-end',
    source: 'review',
    target: 'end',
    label: '金额 < 5,000',
    style: { stroke: '#9aaba4', strokeWidth: 1.4 },
  },
]

export function DesignerPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId)
  const setSelectedNodeId = useEditorStore((state) => state.setSelectedNodeId)
  const selectedNode = nodes.find((node) => node.id === selectedNodeId)
  const onConnect = useCallback(
    (connection: Connection) => setEdges((current) => addEdge(connection, current)),
    [setEdges],
  )
  const addNode = useCallback(
    (kind: '审批节点' | '抄送节点' | '服务任务') => {
      setNodes((current) => [
        ...current,
        {
          id: 'node-' + Date.now(),
          position: {
            x: 340 + (current.length % 3) * 46,
            y: 310 + Math.floor(current.length / 3) * 36,
          },
          data: { label: kind },
          style: { width: 140, borderColor: '#cbd8d2', background: '#fff', color: '#43534d' },
        },
      ])
    },
    [setNodes],
  )
  const nodeItems = useMemo(
    () => [
      { key: 'approval', label: '审批节点', onClick: () => addNode('审批节点') },
      { key: 'cc', label: '抄送节点', onClick: () => addNode('抄送节点') },
      { key: 'service', label: '服务任务', onClick: () => addNode('服务任务') },
    ],
    [addNode],
  )

  return (
    <section className={styles.page}>
      <div className={styles.pageHead}>
        <div>
          <div className={styles.eyebrow}>
            流程定义 <span>/</span> 编辑器
          </div>
          <div className={styles.titleRow}>
            <h1>费用报销流程</h1>
            <Tag className={styles.draftTag}>草稿</Tag>
            <span className={styles.saved}>
              <CheckOutlined /> 已保存至本地
            </span>
          </div>
          <p className={styles.subtitle}>设计审批路径、配置节点规则，并发布给团队使用。</p>
        </div>
        <div className={styles.headActions}>
          <Button icon={<SaveOutlined />}>保存草稿</Button>
          <Button type="primary" icon={<CloudUploadOutlined />}>
            发布流程
          </Button>
        </div>
      </div>

      <div className={styles.editor}>
        <div className={styles.toolbar}>
          <div className={styles.toolbarLeft}>
            <span className={styles.flowIcon}>
              <AppstoreAddOutlined />
            </span>
            <strong>流程画布</strong>
            <span className={styles.separator} />
            <span className={styles.meta}>
              节点 <b>{nodes.length}</b>
            </span>
            <span className={styles.meta}>
              连线 <b>{edges.length}</b>
            </span>
          </div>
          <div className={styles.toolbarRight}>
            <Tooltip title="添加流程节点">
              <Dropdown menu={{ items: nodeItems }} trigger={['click']}>
                <Button size="small" icon={<PlusOutlined />}>
                  添加节点
                </Button>
              </Dropdown>
            </Tooltip>
            <span className={styles.zoomHint}>拖动画布 · 滚轮缩放</span>
          </div>
        </div>

        <div className={styles.editorBody}>
          <div className={styles.canvas}>
            <div className={styles.canvasLabel}>
              <span className={styles.liveDot} />
              编辑中 <span>·</span> 本地示例
            </div>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={(_, node) => setSelectedNodeId(node.id)}
              onPaneClick={() => setSelectedNodeId(null)}
              fitView
              fitViewOptions={{ padding: 0.24 }}
              minZoom={0.35}
              maxZoom={1.6}
              proOptions={{ hideAttribution: true }}
            >
              <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="#dce3e0" />
              <Controls position="bottom-left" showInteractive={false} />
              <MiniMap
                position="bottom-right"
                pannable
                zoomable
                nodeColor="#a9c5b8"
                maskColor="rgba(245, 247, 248, 0.72)"
              />
            </ReactFlow>
            <div className={styles.canvasLegend}>
              <span>
                <i className={styles.greenKey} />
                开始 / 结束
              </span>
              <span>
                <i className={styles.amberKey} />
                人工审批
              </span>
              <span>
                <i className={styles.blueKey} />
                自动任务
              </span>
            </div>
          </div>

          <aside className={styles.properties}>
            <div className={styles.panelHead}>
              <div>
                <strong>流程属性</strong>
                <span>定义基本信息与版本</span>
              </div>
              <button aria-label="更多设置">···</button>
            </div>
            <div className={styles.panelSection}>
              <label>
                流程名称 <em>*</em>
              </label>
              <Input defaultValue="费用报销流程" />
              <label>
                流程标识 <em>*</em>
              </label>
              <Input defaultValue="expense_claim" />
              <label>流程分类</label>
              <Select
                defaultValue="finance"
                options={[
                  { value: 'finance', label: '财务管理' },
                  { value: 'hr', label: '人事管理' },
                  { value: 'general', label: '通用流程' },
                ]}
              />
              <label>流程说明</label>
              <Input.TextArea defaultValue="员工费用报销审批，按金额自动匹配审批路径。" rows={3} />
            </div>
            <div className={styles.panelDivider} />
            <div className={styles.panelSection}>
              <div className={styles.panelSubhead}>
                <strong>{selectedNode ? '节点属性' : '节点配置'}</strong>
                <span>{selectedNode ? '已选中 1 个节点' : '选择画布节点以编辑'}</span>
              </div>
              <div className={styles.nodeConfig}>
                <span className={styles.nodeType}>
                  <i />
                  {selectedNode?.data.label?.toString() ?? '部门负责人审批'}
                </span>
                <span className={styles.nodeArrow}>›</span>
              </div>
              <div className={styles.configNote}>选择审批人、配置审批规则和表单字段。</div>
              <Button type="link" className={styles.configureButton}>
                配置审批节点 <span>→</span>
              </Button>
            </div>
            <div className={styles.panelFooter}>
              <span>版本</span>
              <strong>v1.0 草稿</strong>
            </div>
          </aside>
        </div>
      </div>
    </section>
  )
}
