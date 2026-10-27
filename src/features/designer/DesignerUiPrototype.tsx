/**
 * Throwaway UI exploration: three structurally different workflow designer layouts
 * on /designer?variant=prototype-a|prototype-b|prototype-c.
 */
import { useEffect, useMemo, useRef, useState, type DragEvent, type PointerEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button, Input, Modal } from 'antd'
import {
  ApartmentOutlined,
  ArrowDownOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  CheckOutlined,
  CodeOutlined,
  CopyOutlined,
  DownloadOutlined,
  PlusOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import styles from './DesignerUiPrototype.module.less'

type NodeKind = 'start' | 'approval' | 'service' | 'condition' | 'end'
type FlowNode = {
  id: string
  type: NodeKind
  name: string
  x: number
  y: number
  jsonX?: number
  jsonY?: number
}
type Layout = 'prototype-a' | 'prototype-b' | 'prototype-c'

const variants: { key: Layout; letter: string; title: string; note: string }[] = [
  { key: 'prototype-a', letter: 'A', title: '三栏属性面板', note: '节点库、画布、属性同时可见' },
  { key: 'prototype-b', letter: 'B', title: '画布优先', note: '宽画布，配置从右侧展开' },
  { key: 'prototype-c', letter: 'C', title: '底部属性舱', note: '流程全景与编辑区上下分层' },
]

const initialNodes: FlowNode[] = [
  { id: 'start', type: 'start', name: '发起', x: 12, y: 43, jsonX: 100, jsonY: 165 },
  { id: 'apply', type: 'approval', name: '出库申请', x: 31, y: 43, jsonX: 180, jsonY: 145 },
  { id: 'check_stock', type: 'service', name: '库存校验', x: 50, y: 43, jsonX: 340, jsonY: 145 },
  {
    id: 'gwMinister',
    type: 'condition',
    name: '库存校验结果',
    x: 69,
    y: 43,
    jsonX: 500,
    jsonY: 160,
  },
  { id: 'end', type: 'end', name: '结束', x: 88, y: 43, jsonX: 860, jsonY: 165 },
]

const nodeCopy: Record<NodeKind, { label: string; short: string; color: string }> = {
  start: { label: '开始', short: '始', color: 'mint' },
  approval: { label: '审批', short: '审', color: 'blue' },
  service: { label: '服务调用', short: '服', color: 'orange' },
  condition: { label: '条件分支', short: '◇', color: 'violet' },
  end: { label: '结束', short: '终', color: 'slate' },
}

export function DesignerUiPrototype() {
  const [searchParams, setSearchParams] = useSearchParams()
  const layout = (
    variants.some((variant) => variant.key === searchParams.get('variant'))
      ? searchParams.get('variant')
      : 'prototype-a'
  ) as Layout
  const [nodes, setNodes] = useState(initialNodes)
  const [selectedId, setSelectedId] = useState('check_stock')
  const [processId, setProcessId] = useState('service-approval')
  const [processName, setProcessName] = useState('服务调用')
  const [serviceName, setServiceName] = useState('库存服务')
  const [serviceUrl, setServiceUrl] = useState('http://127.0.0.1:8080/api/stock/check')
  const [jsonOpen, setJsonOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [dragging, setDragging] = useState<string | null>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [boardWidth, setBoardWidth] = useState(640)
  const [notice, setNotice] = useState('所有步骤都连接到流程中')
  const boardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const board = boardRef.current
    if (!board) return
    const observer = new ResizeObserver(([entry]) => setBoardWidth(entry.contentRect.width || 640))
    observer.observe(board)
    return () => observer.disconnect()
  }, [layout])

  const selected = nodes.find((node) => node.id === selectedId) || nodes[2]
  const model = useMemo(
    () => ({
      processId,
      processName,
      nodes: nodes.map((node) => {
        const base = {
          id: node.id,
          type: node.type,
          name: node.name,
          x: node.jsonX ?? Math.round((node.x / 100) * 940),
          y: node.jsonY ?? Math.round((node.y / 100) * 510),
        }
        if (node.type === 'service' && serviceUrl.trim()) {
          return {
            ...base,
            serviceName: serviceName.trim() || '业务服务',
            serviceUrl: serviceUrl.trim(),
          }
        }
        return base
      }),
      flows: [
        { source: 'start', target: 'apply' },
        { source: 'apply', target: 'check_stock' },
        { source: 'check_stock', target: 'gwMinister' },
        { source: 'gwMinister', target: 'end', branch: 'pass' },
        { source: 'gwMinister', target: 'apply', branch: 'reject' },
      ],
    }),
    [nodes, processId, processName, serviceName, serviceUrl],
  )
  const json = JSON.stringify(model, null, 2)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && /INPUT|TEXTAREA|BUTTON/.test(event.target.tagName))
        return
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      const index = variants.findIndex((variant) => variant.key === layout)
      const next =
        variants[(index + (event.key === 'ArrowRight' ? 1 : variants.length - 1)) % variants.length]
      setSearchParams({ variant: next.key })
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [layout, setSearchParams])

  const changeLayout = (key: Layout) => setSearchParams({ variant: key })
  const addNode = (type: NodeKind, position?: Partial<FlowNode>) => {
    if ((type === 'start' || type === 'end') && nodes.some((node) => node.type === type)) {
      setNotice('开始和结束节点在一个流程中各保留一个')
      return
    }
    const id = type + '_' + Math.random().toString(36).slice(2, 6)
    const node: FlowNode = {
      id,
      type,
      name: type === 'service' ? '新建服务' : nodeCopy[type].label,
      x: 54,
      y: 72,
      ...position,
    }
    setNodes((current) => [...current, node])
    setSelectedId(id)
    setNotice('已添加“' + node.name + '”，可拖动到合适位置')
  }
  const updateSelected = (patch: Partial<FlowNode>) => {
    setNodes((current) =>
      current.map((node) => (node.id === selectedId ? { ...node, ...patch } : node)),
    )
  }
  const onNodePointerDown = (event: PointerEvent<HTMLDivElement>, id: string) => {
    if ((event.target as HTMLElement).closest('button')) return
    event.preventDefault()
    setSelectedId(id)
    setDragging(id)
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const onNodePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging || !boardRef.current) return
    const rect = boardRef.current.getBoundingClientRect()
    const x = Math.max(5, Math.min(94, ((event.clientX - rect.left) / rect.width) * 100))
    const y = Math.max(12, Math.min(84, ((event.clientY - rect.top) / rect.height) * 100))
    setNodes((current) =>
      current.map((node) =>
        node.id === dragging
          ? {
              ...node,
              x,
              y,
              jsonX: Math.round(100 + ((x - 9) / 80) * 760),
              jsonY: Math.round(145 + ((y - 43) / 5) * 25),
            }
          : node,
      ),
    )
  }
  const onPaletteDragStart = (event: DragEvent<HTMLButtonElement>, type: NodeKind) => {
    event.dataTransfer.setData('application/x-workflow-node', type)
    event.dataTransfer.effectAllowed = 'copy'
  }
  const onBoardDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    const type = event.dataTransfer.getData('application/x-workflow-node') as NodeKind
    if (!['start', 'approval', 'service', 'condition', 'end'].includes(type) || !boardRef.current)
      return
    const rect = boardRef.current.getBoundingClientRect()
    const x = Math.max(9, Math.min(89, ((event.clientX - rect.left) / rect.width) * 100))
    const y = Math.max(14, Math.min(82, ((event.clientY - rect.top) / rect.height) * 100))
    addNode(type, {
      x,
      y,
      jsonX: Math.round(100 + ((x - 9) / 80) * 760),
      jsonY: Math.round(145 + ((y - 43) / 5) * 25),
    })
  }
  const copyJson = async () => {
    await navigator.clipboard?.writeText(json)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }
  const downloadJson = () => {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = processId + '.json'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const palette = (compact = false) => (
    <aside className={styles.palette + (compact ? ' ' + styles.paletteCompact : '')}>
      <div className={styles.panelTitle}>
        <span>节点库</span>
        <small>拖放或点选添加</small>
      </div>
      {(['start', 'approval', 'service', 'condition', 'end'] as NodeKind[]).map((type) => (
        <button
          className={styles.paletteItem}
          draggable
          onDragStart={(event) => onPaletteDragStart(event, type)}
          key={type}
          onClick={() => addNode(type)}
          type="button"
        >
          <span className={styles['icon' + nodeCopy[type].color]}>{nodeCopy[type].short}</span>
          <span>
            <b>{nodeCopy[type].label}</b>
            <small>
              {type === 'service'
                ? '调用业务系统'
                : type === 'approval'
                  ? '人工处理步骤'
                  : type === 'condition'
                    ? '按结果选择路径'
                    : type === 'start'
                      ? '流程入口'
                      : '流程出口'}
            </small>
          </span>
          <PlusOutlined />
        </button>
      ))}
      <div className={styles.paletteTip}>
        <ArrowDownOutlined /> 拖动画布节点可以调整位置
      </div>
    </aside>
  )

  const properties = (compact = false) => (
    <aside className={styles.properties + (compact ? ' ' + styles.propertiesCompact : '')}>
      <div className={styles.panelTitle}>
        <span>步骤属性</span>
        <small>{nodeCopy[selected.type].label}</small>
      </div>
      <label className={styles.fieldLabel}>步骤名称</label>
      <Input
        value={selected.name}
        onChange={(event) => updateSelected({ name: event.target.value })}
      />
      {selected.type === 'service' ? (
        <>
          <div className={styles.fieldLabel}>服务地址</div>
          <Input
            value={serviceUrl}
            onChange={(event) => setServiceUrl(event.target.value)}
            placeholder="留空：发起流程时动态提供"
            aria-label="服务地址"
          />
          {serviceUrl.trim() ? (
            <>
              <label className={styles.fieldLabel}>服务名称</label>
              <Input
                value={serviceName}
                onChange={(event) => setServiceName(event.target.value)}
                placeholder="例如：库存服务"
              />
              <div className={styles.modeFixed}>
                <span /> 固定服务地址 <small>随流程定义编译</small>
              </div>
            </>
          ) : (
            <div className={styles.modeDynamic}>
              <span /> 动态服务地址 <small>在发起流程时填写</small>
            </div>
          )}
          <div className={styles.helper}>
            服务由流程引擎运行时调用。地址配置只影响服务节点，不会改变通过和驳回路径。
          </div>
        </>
      ) : (
        <div className={styles.helper}>
          节点名称会写入业务模型。画布上的连接关系决定流程的实际走向。
        </div>
      )}
      <div className={styles.nodeMeta}>
        <span>节点标识</span>
        <code>{selected.id}</code>
      </div>
      {selected.type !== 'start' && selected.type !== 'end' && (
        <button
          className={styles.deleteNode}
          onClick={() => {
            setNodes((current) => current.filter((node) => node.id !== selectedId))
            setSelectedId('check_stock')
          }}
          type="button"
        >
          移除此步骤
        </button>
      )}
    </aside>
  )

  const board = (wide = false, bottom = false) => (
    <div
      className={
        styles.board +
        (wide ? ' ' + styles.boardWide : '') +
        (bottom ? ' ' + styles.boardBottom : '')
      }
      ref={boardRef}
      onPointerMove={onNodePointerMove}
      onPointerUp={() => setDragging(null)}
      onPointerCancel={() => setDragging(null)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onBoardDrop}
    >
      <svg
        className={styles.wires}
        viewBox="0 0 1000 560"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <marker id="proto-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 z" fill="#93a79c" />
          </marker>
        </defs>
        {nodes
          .filter((node) => ['start', 'apply', 'check_stock'].includes(node.id))
          .map((node) => {
            const nextId =
              node.id === 'start' ? 'apply' : node.id === 'apply' ? 'check_stock' : 'gwMinister'
            const next = nodes.find((item) => item.id === nextId)
            if (!next) return null
            const gap = Math.min(92, 5200 / boardWidth)
            const sourceX = layout === 'prototype-b' ? node.x * 0.65 + 5 : node.x
            const targetX = layout === 'prototype-b' ? next.x * 0.65 + 5 : next.x
            return (
              <path
                key={node.id}
                d={
                  'M ' +
                  (sourceX * 10 + gap) +
                  ' ' +
                  node.y * 5.6 +
                  ' L ' +
                  (targetX * 10 - gap) +
                  ' ' +
                  next.y * 5.6
                }
                markerEnd="url(#proto-arrow)"
              />
            )
          })}
        {nodes.some((node) => node.id === 'gwMinister') &&
          nodes.some((node) => node.id === 'end') && (
            <path
              d={
                'M ' +
                (nodes.find((node) => node.id === 'gwMinister')!.x * 10 + 55) +
                ' 240 C 780 240 820 240 ' +
                (nodes.find((node) => node.id === 'end')!.x * 10 - 55) +
                ' 240'
              }
              markerEnd="url(#proto-arrow)"
            />
          )}
        {nodes.some((node) => node.id === 'gwMinister') &&
          nodes.some((node) => node.id === 'apply') && (
            <path
              className={styles.rejectWire}
              d={
                'M ' +
                nodes.find((node) => node.id === 'gwMinister')!.x * 10 +
                ' 270 C 690 500 300 500 ' +
                nodes.find((node) => node.id === 'apply')!.x * 10 +
                ' 270'
              }
              markerEnd="url(#proto-arrow)"
            />
          )}
      </svg>
      <div className={styles.branchTag} style={{ left: '78%', top: '36%' }}>
        通过
      </div>
      <div className={styles.rejectTag} style={{ left: '52%', top: '81%' }}>
        驳回 · 返回申请
      </div>
      {nodes.map((node) => (
        <div
          aria-label={node.name}
          className={styles.flowNode + (selectedId === node.id ? ' ' + styles.nodeSelected : '')}
          key={node.id}
          onPointerDown={(event) => onNodePointerDown(event, node.id)}
          onPointerUp={() => setDragging(null)}
          style={{
            left: (layout === 'prototype-b' ? node.x * 0.65 + 5 : node.x) + '%',
            top: node.y + '%',
          }}
          role="button"
          tabIndex={0}
          onClick={() => setSelectedId(node.id)}
        >
          <span className={styles['nodeIcon' + nodeCopy[node.type].color]}>
            {nodeCopy[node.type].short}
          </span>
          <span className={styles.nodeText}>
            <b>{node.name}</b>
            <small>
              {node.type === 'service'
                ? serviceUrl.trim()
                  ? '固定地址'
                  : '动态地址'
                : nodeCopy[node.type].label}
            </small>
          </span>
          <span className={styles.nodePort} />
        </div>
      ))}
      <div className={styles.zoomControls}>
        <button type="button" aria-label="缩小">
          −
        </button>
        <span>100%</span>
        <button type="button" aria-label="放大">
          ＋
        </button>
        <i />
        <button type="button" aria-label="适应画布">
          ⌗
        </button>
      </div>
      <div className={styles.mapHint}>点选步骤查看属性 · 拖动步骤调整位置</div>
    </div>
  )

  const currentVariant = variants.find((variant) => variant.key === layout)!
  return (
    <section className={styles.prototype}>
      <div className={styles.pageHeading}>
        <div className={styles.titleGroup}>
          <div className={styles.crumb}>
            <ApartmentOutlined /> 流程设计 <span>/</span> 新建业务流程
          </div>
          <div className={styles.titleLine}>
            <Input
              className={styles.processTitle}
              value={processName}
              onChange={(event) => setProcessName(event.target.value)}
              aria-label="流程名称"
            />
            <span className={styles.draftPill}>
              <i /> 草稿
            </span>
          </div>
          <div className={styles.processCode}>
            流程标识{' '}
            <Input
              value={processId}
              onChange={(event) => setProcessId(event.target.value)}
              aria-label="流程标识"
            />
          </div>
        </div>
        <div className={styles.topActions}>
          <span className={styles.savedNote}>
            <CheckOutlined /> 所有更改仅保存在本页
          </span>
          <Button icon={<CodeOutlined />} onClick={() => setJsonOpen(true)}>
            查看业务 JSON
          </Button>
          <Button
            type="primary"
            icon={<CheckOutlined />}
            onClick={() => setNotice('流程结构可继续送后端编译')}
          >
            检查流程
          </Button>
        </div>
      </div>
      <div className={styles.statusLine}>
        <span className={styles.statusDot} /> {notice}
        <span className={styles.statusRight}>
          5 个步骤 <b>·</b> 5 条路径
        </span>
      </div>

      {layout === 'prototype-a' && (
        <div className={styles.workbenchA}>
          {palette()}
          <div className={styles.canvasColumn}>
            <div className={styles.canvasHeading}>
              <b>流程画布</b>
              <span>选择节点并连出业务路径</span>
              <button
                type="button"
                onClick={() => setNotice('流程从左向右执行，拒绝路径以虚线显示')}
              >
                路径说明
              </button>
            </div>
            {board()}
          </div>
          {properties()}
        </div>
      )}
      {layout === 'prototype-b' && (
        <div className={styles.workbenchB}>
          <div className={styles.canvasHeading}>
            <b>流程画布</b>
            <span>画布优先 · 选中步骤后从右侧编辑</span>
            <div className={styles.addMenu}>
              <Button
                size="small"
                icon={<PlusOutlined />}
                onClick={() => setPaletteOpen((open) => !open)}
              >
                添加步骤
              </Button>
              {paletteOpen && palette(true)}
            </div>
          </div>
          {board(true)}
          <div className={styles.propertiesDrawer}>{properties()}</div>
        </div>
      )}
      {layout === 'prototype-c' && (
        <div className={styles.workbenchC}>
          <div className={styles.mapToolbar}>
            <div>
              <b>流程地图</b>
              <span>全景布局 · 点击步骤在下方编辑</span>
            </div>
            <div className={styles.mapTools}>
              <button type="button" onClick={() => addNode('service')}>
                <PlusOutlined /> 加服务步骤
              </button>
              <button type="button">
                <SettingOutlined />
              </button>
            </div>
          </div>
          <div className={styles.mapStage}>
            <div className={styles.paletteRail}>
              {(['start', 'approval', 'service', 'condition', 'end'] as NodeKind[]).map((type) => (
                <button
                  aria-label={'添加' + nodeCopy[type].label}
                  key={type}
                  onClick={() => addNode(type)}
                  type="button"
                >
                  <span className={styles['icon' + nodeCopy[type].color]}>
                    {nodeCopy[type].short}
                  </span>
                </button>
              ))}
            </div>
            <div className={styles.mapCanvas}>{board(true, true)}</div>
          </div>
          <div className={styles.bottomInspector}>{properties(true)}</div>
        </div>
      )}

      <div className={styles.prototypeDock} aria-label="设计稿切换">
        <button
          aria-label="上一稿"
          onClick={() =>
            changeLayout(
              variants[(variants.findIndex((variant) => variant.key === layout) + 2) % 3].key,
            )
          }
          type="button"
        >
          <ArrowLeftOutlined />
        </button>
        <div className={styles.dockLabel}>
          <b>{currentVariant.letter}</b>
          <span>
            {currentVariant.title}
            <small>{currentVariant.note}</small>
          </span>
        </div>
        <div className={styles.dockChoices}>
          {variants.map((variant) => (
            <button
              aria-label={variant.title}
              aria-pressed={layout === variant.key}
              className={layout === variant.key ? styles.dockActive : ''}
              key={variant.key}
              onClick={() => changeLayout(variant.key)}
              type="button"
            >
              {variant.letter}
            </button>
          ))}
        </div>
        <button
          aria-label="下一稿"
          onClick={() =>
            changeLayout(
              variants[(variants.findIndex((variant) => variant.key === layout) + 1) % 3].key,
            )
          }
          type="button"
        >
          <ArrowRightOutlined />
        </button>
      </div>

      <Modal
        title="业务模型 JSON"
        open={jsonOpen}
        onCancel={() => setJsonOpen(false)}
        footer={[
          <Button key="close" onClick={() => setJsonOpen(false)}>
            关闭
          </Button>,
          <Button
            key="copy"
            icon={copied ? <CheckOutlined /> : <CopyOutlined />}
            onClick={copyJson}
          >
            {copied ? '已复制' : '复制 JSON'}
          </Button>,
          <Button key="download" type="primary" icon={<DownloadOutlined />} onClick={downloadJson}>
            下载 JSON
          </Button>,
        ]}
        width={680}
      >
        <div className={styles.jsonNote}>
          此 JSON 仅用于设计稿体验，服务地址为空时将采用动态模式。
        </div>
        <Input.TextArea
          value={json}
          readOnly
          autoSize={{ minRows: 18, maxRows: 27 }}
          className={styles.jsonBox}
        />
      </Modal>
    </section>
  )
}
