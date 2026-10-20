import { useCallback, useEffect, useRef, useState } from 'react'
import {
  CloudUploadOutlined,
  CodeOutlined,
  CopyOutlined,
  DownloadOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { Alert, Button, Drawer, Empty, Input, Space, Spin, Tabs, message } from 'antd'
import { convertBpmnToXml, type BpmnJSONRequest } from '@/api/bpmn'
import type { TaskTemplate } from '@/api/workflow'
import { copyText } from '@/utils/clipboard'
import { ProcessDeploymentPanel } from './ProcessDeploymentPanel'
import styles from './ProcessExportDrawer.module.less'

export type ExportFormat = 'json' | 'xml' | 'deploy'

export function ProcessExportDrawer({
  definition,
  initialFormat,
  issues,
  close,
  onPublished,
}: {
  definition: BpmnJSONRequest
  initialFormat: ExportFormat
  issues: string[]
  close: () => void
  onPublished: (template: TaskTemplate, definition: BpmnJSONRequest) => void
}) {
  // 导出面板使用打开时的流程快照，确保 JSON 和 XML 始终对应同一版本。
  const [snapshot] = useState(definition)
  const [format, setFormat] = useState<ExportFormat>(initialFormat)
  const [xml, setXml] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [copying, setCopying] = useState(false)
  const [deploymentOpened, setDeploymentOpened] = useState(initialFormat === 'deploy')
  const [deploying, setDeploying] = useState(false)
  const [deploymentStarted, setDeploymentStarted] = useState(false)
  const requestRef = useRef<AbortController | null>(null)
  const hasIssues = issues.length > 0
  const json = JSON.stringify(snapshot, null, 2)
  const content = format === 'json' ? json : xml

  const convert = useCallback(async () => {
    if (hasIssues) return
    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    setLoading(true)
    setError('')
    setXml('')
    try {
      const result = await convertBpmnToXml(snapshot, controller.signal)
      if (!controller.signal.aborted) setXml(result)
    } catch (cause) {
      if (!controller.signal.aborted) {
        setError(cause instanceof Error ? cause.message : '转换失败，请稍后重试')
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [snapshot, hasIssues])

  useEffect(() => {
    if (initialFormat !== 'json') void convert()
    return () => requestRef.current?.abort()
  }, [initialFormat, convert])

  const selectFormat = (value: string) => {
    if (deploying) return
    setFormat(value as ExportFormat)
    if (value === 'deploy') setDeploymentOpened(true)
    if (value !== 'json' && !xml && !loading && !error) void convert()
  }

  const copy = async () => {
    if (!content) return
    setCopying(true)
    try {
      await copyText(content)
      message.success(format === 'json' ? '请求 JSON 已复制' : 'BPMN XML 已复制')
    } catch (cause) {
      message.error(cause instanceof Error ? cause.message : '复制失败，请选中内容后手动复制')
    } finally {
      setCopying(false)
    }
  }

  const download = () => {
    if (!xml) return
    const url = URL.createObjectURL(new Blob([xml], { type: 'application/xml;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = snapshot.processId + '.bpmn'
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <Drawer
      open
      title={
        <span>
          <CodeOutlined /> 流程定义与部署
        </span>
      }
      width="min(760px, 100vw)"
      onClose={() => {
        if (!deploying) close()
      }}
      closable={!deploying}
      maskClosable={!deploying}
      keyboard={!deploying}
      className={styles.drawer}
      footer={
        <div className={styles.footer}>
          <span>
            {snapshot.nodes.length} 个节点 · {snapshot.flows.length} 条连线
          </span>
          <Space wrap>
            {format !== 'json' && (
              <>
                <Button
                  icon={<ReloadOutlined />}
                  onClick={() => void convert()}
                  loading={loading}
                  disabled={hasIssues || deploying || deploymentStarted}
                >
                  {error ? '重试转换' : xml ? '重新转换' : '转为 XML'}
                </Button>
                <Button
                  icon={<DownloadOutlined />}
                  onClick={download}
                  disabled={!xml || loading || deploying}
                >
                  下载 .bpmn
                </Button>
                {format === 'xml' && (
                  <Button
                    icon={<CloudUploadOutlined />}
                    onClick={() => selectFormat('deploy')}
                    disabled={!xml || loading || hasIssues}
                  >
                    部署任务模板
                  </Button>
                )}
              </>
            )}
            <Button
              type="primary"
              icon={<CopyOutlined />}
              onClick={() => void copy()}
              loading={copying}
              disabled={!content || (format !== 'json' && loading) || deploying}
            >
              {format === 'json' ? '复制 JSON' : '复制 XML'}
            </Button>
          </Space>
        </div>
      }
    >
      <Tabs
        activeKey={format}
        onChange={selectFormat}
        items={[
          { key: 'json', label: '请求 JSON', disabled: deploying },
          { key: 'xml', label: 'BPMN XML', disabled: deploying },
          { key: 'deploy', label: '部署验证' },
        ]}
      />
      {hasIssues && (
        <Alert
          type="warning"
          showIcon
          message="请先修正流程配置，再转换 XML"
          description={
            <ul className={styles.issues}>
              {issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          }
        />
      )}
      {format !== 'json' && error && (
        <Alert type="error" showIcon message="XML 转换失败" description={error} />
      )}
      {deploymentOpened && (
        <div hidden={format !== 'deploy'}>
          <ProcessDeploymentPanel
            definition={snapshot}
            xml={xml}
            disabled={hasIssues || loading}
            onPendingChange={(pending) => {
              setDeploying(pending)
              if (pending) setDeploymentStarted(true)
            }}
            onPublished={onPublished}
          />
        </div>
      )}
      <p className={styles.description}>
        {format === 'json'
          ? '查看当前流程的节点、连线及任务配置，可复制用于接口调试。'
          : xml
            ? format === 'deploy'
              ? '待部署 XML：与下方预览、复制和下载的内容一致。'
              : 'XML 已生成，可复制、下载或部署为任务模板。'
            : '将当前流程转换为 BPMN 2.0 XML，用于在其他系统验证部署条件。'}
      </p>
      {format !== 'json' && loading ? (
        <div className={styles.placeholder} role="status">
          <Spin />
          <span>正在生成 BPMN XML…</span>
        </div>
      ) : content ? (
        <Input.TextArea
          className={styles.code}
          aria-label={format === 'json' ? '流程请求 JSON' : 'BPMN XML 内容'}
          value={content}
          readOnly
          spellCheck={false}
          wrap="off"
        />
      ) : (
        <div className={styles.placeholder}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              error
                ? '转换失败，请重试或检查流程配置'
                : hasIssues
                  ? '修正流程配置后即可生成 XML'
                  : '还没有生成 XML'
            }
          />
        </div>
      )}
    </Drawer>
  )
}
