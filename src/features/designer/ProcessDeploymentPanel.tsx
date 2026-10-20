import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Checkbox, Descriptions, Input, Space, Typography } from 'antd'
import { CloudUploadOutlined, SearchOutlined } from '@ant-design/icons'
import type { BpmnJSONRequest } from '@/api/bpmn'
import { businessWorkflowGateway, type TaskTemplate } from '@/api/workflow'
import { assertDeploymentResult, isDeploymentUncertain } from './templateDeployment'
import styles from './ProcessExportDrawer.module.less'

export function ProcessDeploymentPanel({
  definition,
  xml,
  disabled,
  onPendingChange,
  onPublished,
}: {
  definition: BpmnJSONRequest
  xml: string
  disabled: boolean
  onPendingChange: (pending: boolean) => void
  onPublished: (template: TaskTemplate, definition: BpmnJSONRequest) => void
}) {
  const [name, setName] = useState((definition.processName || definition.processId).slice(0, 120))
  const [pending, setPending] = useState(false)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')
  const [uncertain, setUncertain] = useState(false)
  const [checked, setChecked] = useState(false)
  const [result, setResult] = useState<TaskTemplate>()
  const [existing, setExisting] = useState<TaskTemplate>()
  const [lookupMessage, setLookupMessage] = useState('')
  const busyRef = useRef(false)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const submit = async () => {
    if (disabled || !xml || !name.trim() || busyRef.current || result || (uncertain && !checked))
      return
    busyRef.current = true
    setPending(true)
    onPendingChange(true)
    setError('')
    setExisting(undefined)
    setLookupMessage('')
    setUncertain(false)
    setChecked(false)
    try {
      const template = await businessWorkflowGateway.publishTemplate({
        xml,
        deploymentName: name.trim(),
        displayJson: { ...definition },
      })
      assertDeploymentResult(template)
      if (!mounted.current) return
      setResult(template)
      onPublished(template, definition)
    } catch (cause) {
      if (!mounted.current) return
      setError(cause instanceof Error ? cause.message : '部署失败，请稍后重试')
      setUncertain(isDeploymentUncertain(cause))
    } finally {
      busyRef.current = false
      if (mounted.current) {
        setPending(false)
        onPendingChange(false)
      }
    }
  }

  const check = async () => {
    if (busyRef.current) return
    busyRef.current = true
    setChecking(true)
    setLookupMessage('')
    try {
      const template = await businessWorkflowGateway.getTemplate(definition.processId)
      if (!mounted.current) return
      assertDeploymentResult(template)
      setExisting(template)
      setLookupMessage(
        '已查到当前模板。请核对部署 ID 和版本，确认是否属于本次发布；查询结果可能是此前的版本。',
      )
    } catch (cause) {
      if (mounted.current) {
        setLookupMessage(cause instanceof Error ? cause.message : '查询失败，请稍后重试')
      }
    } finally {
      busyRef.current = false
      if (mounted.current) setChecking(false)
    }
  }

  const template = result || existing

  return (
    <div className={styles.deployment}>
      <Alert
        showIcon
        type={result ? 'success' : 'info'}
        message={result ? '部署成功，任务模板已保存' : '将当前 XML 发布为任务模板'}
        description={
          result
            ? '后端已返回部署与流程定义信息。此结果验证了部署，运行时变量、表单和监听器仍需在启动流程后验证。'
            : '提交下方 XML，并保存对应的流程 JSON。同一租户下，相同流程标识会更新已有任务模板。'
        }
      />
      <Descriptions
        size="small"
        column={1}
        items={[
          {
            key: 'process',
            label: '流程标识',
            children: <Typography.Text code>{definition.processId}</Typography.Text>,
          },
          ...(template
            ? [
                {
                  key: 'key',
                  label: '任务模板',
                  children: template.taskName + ' / ' + template.taskKey,
                },
                { key: 'version', label: '模板版本', children: 'v' + template.version },
                {
                  key: 'deployment',
                  label: '部署 ID',
                  children: <Typography.Text copyable>{template.deploymentId}</Typography.Text>,
                },
                {
                  key: 'definition',
                  label: '流程定义 ID',
                  children: (
                    <Typography.Text copyable>{template.processDefinitionId}</Typography.Text>
                  ),
                },
                {
                  key: 'startable',
                  label: '可发起',
                  children: template.startable && !template.suspended ? '是' : '否',
                },
              ]
            : []),
        ]}
      />
      {!result && (
        <>
          <label className={styles.deploymentName}>
            <span>发布名称</span>
            <Input
              aria-label="发布名称"
              value={name}
              maxLength={120}
              showCount
              disabled={pending}
              onChange={(event) => setName(event.target.value)}
              onPressEnter={() => void submit()}
            />
          </label>
          {error && (
            <Alert
              showIcon
              type={uncertain ? 'warning' : 'error'}
              message={uncertain ? '部署结果尚未确认' : '部署失败'}
              description={error}
            />
          )}
          {uncertain && (
            <div className={styles.recovery}>
              <p>请求可能已被后端处理。请先核对当前模板，避免重试生成额外版本。</p>
              <Button icon={<SearchOutlined />} loading={checking} onClick={() => void check()}>
                核对部署结果
              </Button>
              {lookupMessage && <p role="status">{lookupMessage}</p>}
              <Checkbox
                checked={checked}
                disabled={checking || pending}
                onChange={(event) => setChecked(event.target.checked)}
              >
                已核对后端结果，仍需再次部署
              </Checkbox>
            </div>
          )}
          <Space wrap>
            <Button
              type="primary"
              icon={<CloudUploadOutlined />}
              loading={pending}
              disabled={disabled || !xml || !name.trim() || checking || (uncertain && !checked)}
              onClick={() => void submit()}
            >
              {pending ? '正在部署' : error ? '重试部署' : '确认部署'}
            </Button>
            {pending && <span role="status">正在等待后端部署结果，请保持面板打开…</span>}
          </Space>
        </>
      )}
    </div>
  )
}
