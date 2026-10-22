/**
 * Throwaway UI prototype: three structurally different layouts on /designer,
 * switchable via ?variant=canvas|steps|routes.
 */
import { useEffect, useState } from 'react'
import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  BranchesOutlined,
  CheckCircleFilled,
  CheckOutlined,
  FileTextOutlined,
  PlusOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Button, Input, Select, Tag } from 'antd'
import styles from './DesignerPrototype.module.less'

export type DesignerVariant = 'canvas' | 'steps' | 'routes'
type Kind = 'start' | 'apply' | 'approval' | 'countersign' | 'result' | 'condition' | 'end'
type Branch = 'pass' | 'reject' | 'default' | 'condition'
interface FlowNode {
  id: string
  kind: Kind
  name: string
  detail?: string
}
interface FlowEdge {
  id: string
  source: string
  target: string
  branch?: Branch
  label?: string
}

const labels: Record<Kind, string> = {
  start: '开始',
  apply: '申请填写',
  approval: '审批表决',
  countersign: '会签',
  result: '审批结果',
  condition: '表单条件',
  end: '结束',
}
const marks: Record<Kind, string> = {
  start: '始',
  apply: '表',
  approval: '审',
  countersign: '签',
  result: '分',
  condition: '◇',
  end: '终',
}
const names: Record<DesignerVariant, string> = {
  canvas: '自由画布',
  steps: '步骤清单',
  routes: '结果路径',
}
const initialNodes: FlowNode[] = [
  { id: 'start', kind: 'start', name: '发起' },
  { id: 'apply', kind: 'apply', name: '立项申请单', detail: '填写 / 修改' },
  { id: 'minister', kind: 'approval', name: '部长审批', detail: '审批人启动时指定' },
  { id: 'minister-result', kind: 'result', name: '审批结果', detail: '部长审批 · 通过 / 驳回' },
  { id: 'managers', kind: 'countersign', name: '各部门经理会签', detail: '全员同意 · ALL' },
  {
    id: 'manager-result',
    kind: 'result',
    name: '会签结果',
    detail: '各部门经理会签 · 通过 / 驳回',
  },
  { id: 'end', kind: 'end', name: '审批完成' },
]
const initialEdges: FlowEdge[] = [
  { id: 'e1', source: 'start', target: 'apply' },
  { id: 'e2', source: 'apply', target: 'minister' },
  { id: 'e3', source: 'minister', target: 'minister-result' },
  { id: 'e4', source: 'minister-result', target: 'managers', branch: 'pass', label: '通过' },
  { id: 'e5', source: 'minister-result', target: 'apply', branch: 'reject', label: '驳回' },
  { id: 'e6', source: 'managers', target: 'manager-result' },
  { id: 'e7', source: 'manager-result', target: 'end', branch: 'pass', label: '通过' },
  { id: 'e8', source: 'manager-result', target: 'apply', branch: 'reject', label: '驳回' },
]
const branchText = (value?: Branch) =>
  value === 'pass'
    ? '审批通过'
    : value === 'reject'
      ? '审批驳回'
      : value === 'default'
        ? '默认情况'
        : value === 'condition'
          ? '表单字段条件'
          : '继续流转'

export function DesignerPrototype({
  variant,
  onVariantChange,
}: {
  variant: DesignerVariant
  onVariantChange: (variant: DesignerVariant) => void
}) {
  const [nodes, setNodes] = useState(initialNodes)
  const [edges, setEdges] = useState(initialEdges)
  const [selectedId, setSelectedId] = useState('minister')
  const [selectedEdgeId, setSelectedEdgeId] = useState('')
  const [toast, setToast] = useState('')
  const selected = nodes.find((node) => node.id === selectedId)
  const selectedEdge = edges.find((edge) => edge.id === selectedEdgeId)
  const updateName = (name: string) =>
    selected &&
    setNodes((all) => all.map((node) => (node.id === selected.id ? { ...node, name } : node)))
  const selectNode = (id: string) => {
    setSelectedId(id)
    setSelectedEdgeId('')
  }
  const selectEdge = (id: string) => {
    setSelectedEdgeId(id)
    setSelectedId('')
  }
  const addNode = (kind: Kind) => {
    if ((kind === 'start' || kind === 'end') && nodes.some((node) => node.kind === kind)) {
      setToast('流程只需要一个' + labels[kind] + '节点。')
      return
    }
    const id = kind + '-' + Date.now()
    setNodes((all) => [
      ...all,
      {
        id,
        kind,
        name: kind === 'approval' ? '新审批步骤' : kind === 'apply' ? '新申请步骤' : labels[kind],
        detail: kind === 'countersign' ? '全员同意 · ALL' : undefined,
      },
    ])
    selectNode(id)
    setToast('已添加步骤，请连接并配置业务规则。')
  }
  const deleteSelected = () => {
    if (!selected || selected.kind === 'start' || selected.kind === 'end') {
      setToast('开始和结束节点不能删除。')
      return
    }
    setNodes((all) => all.filter((node) => node.id !== selected.id))
    setEdges((all) =>
      all.filter((edge) => edge.source !== selected.id && edge.target !== selected.id),
    )
    selectNode('apply')
    setToast('已删除步骤及相关路径。')
  }
  const updateBranch = (branch: Branch) =>
    selectedEdge &&
    setEdges((all) =>
      all.map((edge) =>
        edge.id === selectedEdge.id ? { ...edge, branch, label: branchText(branch) } : edge,
      ),
    )
  const deleteEdge = () => {
    if (!selectedEdge) return
    setEdges((all) => all.filter((edge) => edge.id !== selectedEdge.id))
    selectNode(selectedEdge.source)
    setToast('已删除路径。')
  }
  const addPath = () => {
    if (!selected) {
      setToast('先选择一个步骤，再添加后续路径。')
      return
    }
    const id = selected.id + '-path-' + Date.now()
    setEdges((all) => [
      ...all,
      {
        id,
        source: selected.id,
        target: 'end',
        branch: selected.kind === 'result' ? 'reject' : 'default',
        label: selected.kind === 'result' ? '审批驳回' : '默认情况',
      },
    ])
    selectEdge(id)
    setToast('已添加路径，请设置业务含义和去向。')
  }
  useEffect(() => {
    const keys: DesignerVariant[] = ['canvas', 'steps', 'routes']
    const onKey = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLElement &&
        event.target.closest('input, textarea, select, [contenteditable]')
      )
        return
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault()
        const index = keys.indexOf(variant)
        onVariantChange(keys[(index + (event.key === 'ArrowRight' ? 1 : 2)) % keys.length])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [variant, onVariantChange])

  const palette = <Palette onAdd={addNode} />
  const updateTarget = (target: string) =>
    selectedEdge &&
    setEdges((all) => all.map((edge) => (edge.id === selectedEdge.id ? { ...edge, target } : edge)))
  const inspector = (
    <Inspector
      selected={selected}
      selectedEdge={selectedEdge}
      nodes={nodes}
      edges={edges}
      onName={updateName}
      onBranch={updateBranch}
      onTarget={updateTarget}
      onAddPath={addPath}
      onDelete={deleteSelected}
      onDeleteEdge={deleteEdge}
      onSelectEdge={selectEdge}
    />
  )
  return (
    <div className={styles.prototype}>
      <header className={styles.header}>
        <div>
          <div className={styles.breadcrumb}>
            流程设计 <span>/</span> 立项审批 <i>原型方案 {variant.toUpperCase()}</i>
          </div>
          <h1>
            立项审批 <Tag>未发布</Tag>
          </h1>
          <p>
            {variant === 'canvas'
              ? '从空间关系理解整个流程，选中节点后在侧栏编辑业务属性。'
              : variant === 'steps'
                ? '沿业务步骤逐项配置，分支规则和节点属性在同一工作区内呈现。'
                : '先看清通过与驳回会发生什么，再调整每条路径上的处理步骤。'}
          </p>
        </div>
        <div className={styles.headerActions}>
          <span className={styles.unsaved}>
            <i /> 本页临时编辑
          </span>
          <Button
            icon={<FileTextOutlined />}
            onClick={() => setToast('原型：预览系统提供的立项申请表单')}
          >
            表单预览
          </Button>
          <Button onClick={() => setToast('原型：复制业务流程 JSON')}>导出 JSON</Button>
          <Button type="primary" onClick={() => setToast('原型：调用预留的业务模型 JSON 转换接口')}>
            转换流程
          </Button>
        </div>
      </header>
      <div className={styles.infoBar}>
        <div className={styles.infoGlyph}>
          <BranchesOutlined />
        </div>
        <div>
          <b>立项审批流程</b>
          <small>审批人由发起实例的调用方提供 · 流程变量由后端处理</small>
        </div>
        <div className={styles.stats}>
          <b>{nodes.length}</b> 个步骤 <i /> <b>{edges.length}</b> 条路径 <i />{' '}
          <span>
            <CheckCircleFilled /> 草稿只在当前页面
          </span>
        </div>
      </div>
      {toast && (
        <div className={styles.toast} onClick={() => setToast('')}>
          <CheckCircleFilled /> {toast} <span>×</span>
        </div>
      )}
      <main className={styles.workspace}>
        {variant === 'canvas' && (
          <>
            {palette}
            <Canvas
              nodes={nodes}
              edges={edges}
              selectedId={selectedId}
              selectedEdgeId={selectedEdgeId}
              onNode={selectNode}
              onEdge={selectEdge}
            />
            {inspector}
          </>
        )}
        {variant === 'steps' && (
          <>
            <StepRail
              nodes={nodes}
              selectedId={selectedId}
              onNode={selectNode}
              onEdge={selectEdge}
              onAdd={addNode}
            />
            <StepEditor
              selected={selected}
              selectedEdge={selectedEdge}
              nodes={nodes}
              edges={edges}
              onName={updateName}
              onEdge={selectEdge}
              onBranch={updateBranch}
              onTarget={updateTarget}
              onDelete={deleteSelected}
            />
            <Notes />
          </>
        )}
        {variant === 'routes' && (
          <>
            <Routes
              nodes={nodes}
              edges={edges}
              selectedId={selectedId}
              selectedEdgeId={selectedEdgeId}
              onNode={selectNode}
              onEdge={selectEdge}
              onAdd={addNode}
            />
            {inspector}
          </>
        )}
      </main>
      <PrototypeSwitcher current={variant} onChange={onVariantChange} />
    </div>
  )
}

function Palette({ onAdd }: { onAdd: (kind: Kind) => void }) {
  const entries: Array<[Kind, string, string]> = [
    ['apply', '申请填写', '发起人填写或修改'],
    ['approval', '审批', '单人表决'],
    ['countersign', '会签', '全员同意规则'],
    ['result', '审批结果', '通过 / 驳回'],
    ['condition', '表单条件', '按字段值判断'],
  ]
  return (
    <aside className={styles.palette}>
      <div className={styles.panelTitle}>
        <b>添加步骤</b>
        <small>用业务动作组成流程</small>
      </div>
      {entries.map(([kind, title, detail]) => (
        <button className={styles.paletteButton} key={kind} onClick={() => onAdd(kind)}>
          <span className={styles['mark' + kind]}>{marks[kind]}</span>
          <span>
            <b>{title}</b>
            <small>{detail}</small>
          </span>
          <PlusOutlined />
        </button>
      ))}
      <div className={styles.formPreview}>
        <div className={styles.panelTitle}>
          <b>立项申请表单</b>
          <small>由系统提供，只读</small>
        </div>
        <p>
          项目名称 <i>必填</i>
          <span>文本</span>
        </p>
        <p>
          项目类型 <i>必填</i>
          <span>单选</span>
        </p>
        <p>
          计划金额 <i>必填</i>
          <span>数字</span>
        </p>
        <button>
          预览发起表单 <ArrowRightOutlined />
        </button>
      </div>
    </aside>
  )
}

function NodeButton({
  node,
  selected,
  onClick,
}: {
  node: FlowNode
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      className={
        styles.nodeButton +
        ' ' +
        styles['node' + node.kind] +
        (selected ? ' ' + styles.nodeSelected : '')
      }
      onClick={onClick}
    >
      <span className={styles.nodeMark}>{marks[node.kind]}</span>
      <span>
        <b>{node.name}</b>
        {node.detail && <small>{node.detail}</small>}
      </span>
      {node.kind === 'countersign' && <i className={styles.all}>ALL</i>}
    </button>
  )
}

function Canvas({
  nodes,
  edges,
  selectedId,
  selectedEdgeId,
  onNode,
  onEdge,
}: {
  nodes: FlowNode[]
  edges: FlowEdge[]
  selectedId: string
  selectedEdgeId: string
  onNode: (id: string) => void
  onEdge: (id: string) => void
}) {
  return (
    <section className={styles.canvas}>
      <div className={styles.canvasHead}>
        <div>
          <b>流程画布</b>
          <small>选择步骤或路径，在属性面板中编辑</small>
        </div>
        <div>
          <button>−</button> 100% <button>＋</button>
        </div>
      </div>
      <div className={styles.canvasArea}>
        <div className={styles.flowRow}>
          {nodes.map((node) => (
            <NodeButton
              key={node.id}
              node={node}
              selected={node.id === selectedId}
              onClick={() => onNode(node.id)}
            />
          ))}
        </div>
        <div className={styles.canvasPaths}>
          <div className={styles.panelTitle}>
            <div>
              <b>流程路径</b>
              <small>按连接关系表达通过、驳回与后续步骤</small>
            </div>
            <span>{edges.length} 条</span>
          </div>
          {edges.map((edge) => (
            <button
              key={edge.id}
              className={
                styles.pathRow + (edge.id === selectedEdgeId ? ' ' + styles.activePath : '')
              }
              onClick={() => onEdge(edge.id)}
            >
              <span className={edge.branch === 'reject' ? styles.pathReject : styles.pathDot} />
              <b>{nodes.find((node) => node.id === edge.source)?.name || '未命名'}</b>
              <span className={styles.pathMeaning}>{edge.label || branchText(edge.branch)}</span>
              <ArrowRightOutlined />
              <b>{nodes.find((node) => node.id === edge.target)?.name || '未命名'}</b>
            </button>
          ))}
        </div>
        <div className={styles.canvasFooter}>
          <span>
            <CheckCircleFilled /> 图形表达业务去向，技术变量由后端生成
          </span>
          <span>后端负责发布前最终校验</span>
        </div>
      </div>
    </section>
  )
}

function Inspector({
  selected,
  selectedEdge,
  nodes,
  edges,
  onName,
  onBranch,
  onTarget,
  onAddPath,
  onDelete,
  onDeleteEdge,
  onSelectEdge,
}: {
  selected?: FlowNode
  selectedEdge?: FlowEdge
  nodes: FlowNode[]
  edges: FlowEdge[]
  onName: (name: string) => void
  onBranch: (branch: Branch) => void
  onTarget: (target: string) => void
  onAddPath: () => void
  onDelete: () => void
  onDeleteEdge: () => void
  onSelectEdge: (id: string) => void
}) {
  const outgoing = edges.filter((edge) => edge.source === selected?.id)
  return (
    <aside className={styles.inspector}>
      <div className={styles.inspectorTitle}>
        <div>
          <small>{selectedEdge ? '路径属性' : '步骤属性'}</small>
          <h2>{selectedEdge ? '设置流转规则' : selected?.name || '选择步骤或路径'}</h2>
        </div>
        <span>···</span>
      </div>
      {selected ? (
        <>
          <div className={styles.kindLine}>
            <i className={styles['mark' + selected.kind]}>{marks[selected.kind]}</i>
            {labels[selected.kind]}
            {selected.kind === 'countersign' && <Tag color="purple">ALL</Tag>}
          </div>
          <label>步骤名称</label>
          <Input value={selected.name} onChange={(event) => onName(event.target.value)} />
          {selected.kind === 'approval' && (
            <div className={styles.hintBox}>
              <UserOutlined />
              <span>
                <b>审批人启动时指定</b>
                <small>设计流程时不选人，调用方启动实例时按后端字段说明提交。</small>
              </span>
            </div>
          )}
          {selected.kind === 'countersign' && (
            <div className={styles.hintBox}>
              <CheckCircleFilled />
              <span>
                <b>会签 · ALL</b>
                <small>所有人同意才通过；任一人驳回即结束会签。</small>
              </span>
            </div>
          )}
          {selected.kind === 'apply' && (
            <div className={styles.hintBox}>
              <FileTextOutlined />
              <span>
                <b>发起人填写 / 修改</b>
                <small>驳回后回到此步骤，重新提交后继续流转。</small>
              </span>
            </div>
          )}
          {selected.kind === 'result' && (
            <div className={styles.hintBox}>
              <BranchesOutlined />
              <span>
                <b>结果由连线表达</b>
                <small>后端按节点结构识别审批来源。</small>
              </span>
            </div>
          )}
          <div className={styles.outgoing}>
            <div className={styles.panelTitle}>
              <b>
                {selected.kind === 'result' || selected.kind === 'condition'
                  ? '分支路径'
                  : '后续路径'}
              </b>
              <Button size="small" icon={<PlusOutlined />} onClick={onAddPath}>
                添加路径
              </Button>
            </div>
            {outgoing.map((edge) => (
              <button key={edge.id} onClick={() => onSelectEdge(edge.id)}>
                <i />
                {edge.label || branchText(edge.branch)}
                <span>→ {nodes.find((node) => node.id === edge.target)?.name}</span>
                <ArrowRightOutlined />
              </button>
            ))}
            {!outgoing.length && <p>还没有路径，可以从当前步骤添加一个。</p>}
          </div>
          <div className={styles.deleteRow}>
            <button onClick={onDelete}>删除步骤</button>
            <small>未发布修改只在本页保留</small>
          </div>
        </>
      ) : selectedEdge ? (
        <>
          <div className={styles.edgeNames}>
            {nodes.find((node) => node.id === selectedEdge.source)?.name} <ArrowRightOutlined />{' '}
            {nodes.find((node) => node.id === selectedEdge.target)?.name}
          </div>
          <label>业务路径</label>
          <Select
            value={selectedEdge.branch || 'condition'}
            options={[
              { value: 'pass', label: '审批通过' },
              { value: 'reject', label: '审批驳回' },
              { value: 'default', label: '默认情况' },
              { value: 'condition', label: '表单字段条件' },
            ]}
            onChange={onBranch}
          />
          <label>流转到</label>
          <Select
            value={selectedEdge.target}
            options={nodes
              .filter((node) => node.id !== selectedEdge.source && node.kind !== 'start')
              .map((node) => ({ value: node.id, label: node.name }))}
            onChange={onTarget}
          />
          <div className={styles.hintBox}>
            <BranchesOutlined />
            <span>
              <b>连接关系表达业务去向</b>
              <small>不配置 Camunda 网关、EL 或变量名。</small>
            </span>
          </div>
          <button className={styles.deletePath} onClick={onDeleteEdge}>
            删除此路径
          </button>
        </>
      ) : (
        <div className={styles.empty}>
          选择一个步骤或连线
          <br />
          这里会显示业务属性
        </div>
      )}
    </aside>
  )
}

function StepRail({
  nodes,
  selectedId,
  onNode,
  onEdge,
  onAdd,
}: {
  nodes: FlowNode[]
  selectedId: string
  onNode: (id: string) => void
  onEdge: (id: string) => void
  onAdd: (kind: Kind) => void
}) {
  const order = [
    'start',
    'apply',
    'minister',
    'minister-result',
    'managers',
    'manager-result',
    'end',
  ]
  return (
    <aside className={styles.stepRail}>
      <div className={styles.panelTitle}>
        <div>
          <b>流程步骤</b>
          <small>按办理顺序查看</small>
        </div>
        <Button size="small" icon={<PlusOutlined />} onClick={() => onAdd('approval')}>
          添加
        </Button>
      </div>
      {order.map((id, index) => {
        const node = nodes.find((item) => item.id === id)
        if (!node) return null
        return (
          <div className={styles.stepSlot} key={id}>
            <button
              className={styles.stepItem + (selectedId === id ? ' ' + styles.activeStep : '')}
              onClick={() => onNode(id)}
            >
              <span>{String(index + 1).padStart(2, '0')}</span>
              <i className={styles['mark' + node.kind]}>{marks[node.kind]}</i>
              <b>{node.name}</b>
              <small>{node.detail || labels[node.kind]}</small>
            </button>
            {id === 'minister-result' && (
              <div className={styles.stepBranches}>
                <button onClick={() => onEdge('e4')}>✓ 通过 → 各部门经理会签</button>
                <button onClick={() => onEdge('e5')}>↶ 驳回 → 立项申请单</button>
              </div>
            )}
          </div>
        )
      })}
      <button className={styles.addStep} onClick={() => onAdd('apply')}>
        <PlusOutlined /> 添加申请步骤
      </button>
      <div className={styles.returnNote}>
        <b>驳回后返回申请人</b>
        <small>重新提交后仍经过部长审批</small>
      </div>
    </aside>
  )
}

function StepEditor({
  selected,
  selectedEdge,
  nodes,
  edges,
  onName,
  onEdge,
  onBranch,
  onTarget,
  onDelete,
}: {
  selected?: FlowNode
  selectedEdge?: FlowEdge
  nodes: FlowNode[]
  edges: FlowEdge[]
  onName: (name: string) => void
  onEdge: (id: string) => void
  onBranch: (branch: Branch) => void
  onTarget: (target: string) => void
  onDelete: () => void
}) {
  const outgoing = edges.filter((edge) => edge.source === selected?.id)
  return (
    <section className={styles.stepEditor}>
      <div className={styles.stepEditorHead}>
        <small>步骤清单 / 属性编辑</small>
        <b>业务设置</b>
      </div>
      {selectedEdge ? (
        <>
          <h2>设置流转规则</h2>
          <p className={styles.edgeNames}>
            {nodes.find((node) => node.id === selectedEdge.source)?.name} →{' '}
            {nodes.find((node) => node.id === selectedEdge.target)?.name}
          </p>
          <label>业务路径</label>
          <Select
            value={selectedEdge.branch || 'condition'}
            options={[
              { value: 'pass', label: '审批通过' },
              { value: 'reject', label: '审批驳回' },
              { value: 'default', label: '默认情况' },
              { value: 'condition', label: '表单字段条件' },
            ]}
            onChange={onBranch}
          />
          <label>流转到</label>
          <Select
            value={selectedEdge.target}
            options={nodes
              .filter((node) => node.id !== selectedEdge.source && node.kind !== 'start')
              .map((node) => ({ value: node.id, label: node.name }))}
            onChange={onTarget}
          />
          <div className={styles.largeHint}>
            <b>连线表达业务去向</b>
            <p>驳回回路需回到申请填写节点；发布时由后端校验完整流程。</p>
          </div>
        </>
      ) : selected ? (
        <>
          <div className={styles.selectedStepHero}>
            <i className={styles['mark' + selected.kind]}>{marks[selected.kind]}</i>
            <div>
              <small>{labels[selected.kind]}</small>
              <h2>{selected.name}</h2>
            </div>
            {selected.kind === 'countersign' && <Tag color="purple">ALL</Tag>}
          </div>
          <label>步骤名称</label>
          <Input value={selected.name} onChange={(event) => onName(event.target.value)} />
          <div className={styles.largeHint}>
            <b>
              {selected.kind === 'approval'
                ? '审批人稍后指定'
                : selected.kind === 'apply'
                  ? '发起人填写 / 修改'
                  : selected.kind === 'result'
                    ? '通过 / 驳回由流程连接表达'
                    : selected.kind === 'countersign'
                      ? '全员同意规则固定'
                      : labels[selected.kind]}
            </b>
            <p>
              {selected.kind === 'approval'
                ? '流程设计不配置人员。启动实例时，调用方按后端返回的字段描述提交审批人标识。'
                : selected.kind === 'apply'
                  ? '首次启动填写申请；被驳回后回到这里修改并重新提交。'
                  : selected.kind === 'countersign'
                    ? '任一人驳回即结束会签并取消剩余任务。'
                    : '业务模型转换后由后端识别并执行。'}
            </p>
          </div>
          <div className={styles.editorPaths}>
            <div className={styles.panelTitle}>
              <b>后续路径</b>
              <small>选中路径可修改业务含义</small>
            </div>
            {outgoing.length ? (
              outgoing.map((edge) => (
                <button key={edge.id} onClick={() => onEdge(edge.id)}>
                  {edge.label || '继续'} <span>→</span>
                </button>
              ))
            ) : (
              <p>还没有后续路径。</p>
            )}
          </div>
          <button className={styles.removeStep} onClick={onDelete}>
            删除此步骤
          </button>
        </>
      ) : (
        <div className={styles.empty}>选择左侧步骤以编辑属性</div>
      )}
    </section>
  )
}

function Notes() {
  return (
    <aside className={styles.notes}>
      <div className={styles.noteCard}>
        <UserOutlined />
        <b>审批人启动时指定</b>
        <p>后端根据发布流程返回字段描述，调用方提交人员标识。</p>
      </div>
      <div className={styles.noteCard}>
        <BranchesOutlined />
        <b>结果分支自动识别</b>
        <p>审批节点连接通过 / 驳回结果后，后端识别其表决含义。</p>
      </div>
      <div className={styles.noteCard}>
        <CheckCircleFilled />
        <b>发布前检查</b>
        <p>前端即时提示，后端发布校验是最终依据。</p>
      </div>
    </aside>
  )
}

function Routes({
  nodes,
  edges,
  selectedId,
  selectedEdgeId,
  onNode,
  onEdge,
  onAdd,
}: {
  nodes: FlowNode[]
  edges: FlowEdge[]
  selectedId: string
  selectedEdgeId: string
  onNode: (id: string) => void
  onEdge: (id: string) => void
  onAdd: (kind: Kind) => void
}) {
  const node = (id: string) => nodes.find((item) => item.id === id)!
  const extraApprovals = nodes.filter((item) => item.kind === 'approval' && item.id !== 'minister')
  const targetName = (edgeId: string) =>
    nodes.find((item) => item.id === edges.find((edge) => edge.id === edgeId)?.target)?.name ||
    '未设置去向'
  return (
    <section className={styles.routes}>
      <div className={styles.routesIntro}>
        <div>
          <small>流程结构 / 结果路径</small>
          <h2>先定义结论，再安排后续步骤</h2>
          <p>审批结论由流程连线表示。驳回回到申请人修改，重新提交后再次经过部长审批。</p>
        </div>
        <Button icon={<PlusOutlined />} onClick={() => onAdd('approval')}>
          添加审批步骤
        </Button>
      </div>
      <div className={styles.routeStart}>
        <span className={styles.stepNumber}>01</span>
        <NodeButton
          node={node('start')}
          selected={selectedId === 'start'}
          onClick={() => onNode('start')}
        />
        <span className={styles.routeArrow} />
        <span className={styles.stepNumber}>02</span>
        <NodeButton
          node={node('apply')}
          selected={selectedId === 'apply'}
          onClick={() => onNode('apply')}
        />
        <span className={styles.routeArrow} />
        <span className={styles.stepNumber}>03</span>
        <NodeButton
          node={node('minister')}
          selected={selectedId === 'minister'}
          onClick={() => onNode('minister')}
        />
        <span className={styles.forkLabel}>
          <BranchesOutlined /> 部长审批结果
        </span>
      </div>
      <div className={styles.outcomes}>
        <section className={styles.passOutcome}>
          <button className={styles.outcomeTitle} onClick={() => onEdge('e4')}>
            <CheckOutlined />
            <span>
              <b>通过</b>
              <small>继续下一审批步骤</small>
            </span>
            <i>{selectedEdgeId === 'e4' ? '编辑中' : '编辑路径'} →</i>
          </button>
          <div className={styles.outcomeContent}>
            <span className={styles.stepNumber}>04</span>
            <NodeButton
              node={node('managers')}
              selected={selectedId === 'managers'}
              onClick={() => onNode('managers')}
            />
            {extraApprovals
              .filter((item) => item.id !== 'managers')
              .map((item) => (
                <NodeButton
                  key={item.id}
                  node={item}
                  selected={selectedId === item.id}
                  onClick={() => onNode(item.id)}
                />
              ))}
            <div className={styles.secondFork}>会签结果</div>
            <div className={styles.subOutcome}>
              <button onClick={() => onEdge('e7')}>✓ 通过 → {targetName('e7')}</button>
              <button onClick={() => onEdge('e8')}>↶ 驳回 → {targetName('e8')}</button>
            </div>
            <NodeButton
              node={node('end')}
              selected={selectedId === 'end'}
              onClick={() => onNode('end')}
            />
          </div>
        </section>
        <section className={styles.rejectOutcome}>
          <button className={styles.outcomeTitle} onClick={() => onEdge('e5')}>
            <ArrowLeftOutlined />
            <span>
              <b>驳回</b>
              <small>返回申请人修改</small>
            </span>
            <i>{selectedEdgeId === 'e5' ? '编辑中' : '编辑路径'} →</i>
          </button>
          <div className={styles.rejectContent}>
            <div>
              <b>{targetName('e5')}</b>
              <small>重新提交后再次经过部长审批</small>
            </div>
            <span className={styles.returnArrow}>↶</span>
          </div>
        </section>
      </div>
      <div className={styles.routesNote}>
        <CheckCircleFilled /> 会签规则固定为 ALL：任一人驳回即结束会签并取消剩余待办
      </div>
    </section>
  )
}

function PrototypeSwitcher({
  current,
  onChange,
}: {
  current: DesignerVariant
  onChange: (variant: DesignerVariant) => void
}) {
  const options: DesignerVariant[] = ['canvas', 'steps', 'routes']
  const index = options.indexOf(current)
  return (
    <nav className={styles.switcher}>
      <button aria-label="上一方案" onClick={() => onChange(options[(index + 2) % 3])}>
        <ArrowLeftOutlined />
      </button>
      <span>
        <b>{String.fromCharCode(65 + index)}</b>
        <i />
        {names[current]}
      </span>
      <button aria-label="下一方案" onClick={() => onChange(options[(index + 1) % 3])}>
        <ArrowRightOutlined />
      </button>
    </nav>
  )
}
