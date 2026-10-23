import { useEffect, useState } from 'react'
import { Alert, Button, Input, Spin, Tag, message } from 'antd'
import { CheckCircleFilled, FileTextOutlined, UserOutlined } from '@ant-design/icons'
import { businessWorkflowGateway } from '@/api/workflow'
import type { BusinessTaskInstance, TaskTemplate, TaskTemplateVariable } from '@/api/workflow'
import styles from './DesignerPrototype.module.less'
import { validateApprovalStart } from './approvalStart'

const PROJECT_APPROVAL_TASK_KEY = 'project-approval'
const { TextArea } = Input

export function ApprovalInstanceStart() {
  const [template, setTemplate] = useState<TaskTemplate | null>(null)
  const [loadingTemplate, setLoadingTemplate] = useState(true)
  const [starting, setStarting] = useState(false)
  const [templateError, setTemplateError] = useState<string | null>(null)
  const [startError, setStartError] = useState<string | null>(null)
  const [businessForm, setBusinessForm] = useState('{}')
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})
  const [instance, setInstance] = useState<BusinessTaskInstance | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setLoadingTemplate(true)
    setTemplateError(null)
    void businessWorkflowGateway
      .getTemplate(PROJECT_APPROVAL_TASK_KEY, controller.signal)
      .then(setTemplate)
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setTemplateError(error instanceof Error ? error.message : '读取已发布流程失败。')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingTemplate(false)
      })
    return () => controller.abort()
  }, [])

  const startVariables = (template?.globalVariables || []).filter(
    (variable) => !variable.source || variable.source === 'start',
  )

  const submit = async () => {
    if (!template) return
    const validation = validateApprovalStart(startVariables, fieldValues, businessForm)
    if (validation.errors.length > 0) {
      setStartError(validation.errors.join(' '))
      return
    }

    setStarting(true)
    setStartError(null)
    try {
      const businessKey = 'project-approval-' + crypto.randomUUID()
      const result = await businessWorkflowGateway.startTaskInstance({
        taskKey: template.taskKey,
        businessKey,
        variables: validation.variables,
      })
      setInstance(result)
      message.success('立项审批实例已发起。')
    } catch (error) {
      const text = error instanceof Error ? error.message : '发起实例失败，请检查填写内容后重试。'
      setStartError(text)
      message.error(text)
    } finally {
      setStarting(false)
    }
  }

  return (
    <section className={styles.startPage} aria-labelledby="approval-start-title">
      <header className={styles.startHeader}>
        <div>
          <div className={styles.startEyebrow}>流程实例 / 新建</div>
          <h1 id="approval-start-title">发起立项审批</h1>
          <p>业务申请内容由业务系统提供，审批人员按已发布流程的字段说明填写。</p>
        </div>
        <Tag color="green">运行时验收</Tag>
      </header>

      {loadingTemplate ? (
        <div className={styles.startLoading}>
          <Spin tip="读取已发布流程说明" />
        </div>
      ) : templateError ? (
        <Alert
          type="error"
          showIcon
          message="无法读取已发布流程"
          description={templateError}
          action={<Button onClick={() => window.location.reload()}>重试</Button>}
        />
      ) : !template ? null : (
        <>
          <div className={styles.startTemplateCard}>
            <span className={styles.startTemplateIcon}>
              <FileTextOutlined />
            </span>
            <div>
              <b>{template.taskName}</b>
              <small>
                模板 {template.taskKey} · v{template.version} · 流程定义{' '}
                {template.processDefinitionId}
              </small>
            </div>
            <span className={styles.startTemplateStatus}>
              <CheckCircleFilled />{' '}
              {template.startable && !template.suspended ? '可发起' : '当前不可发起'}
            </span>
          </div>

          {!template.startable || template.suspended ? (
            <Alert type="warning" showIcon message="该流程当前不可发起，请联系流程管理员。" />
          ) : instance ? (
            <div className={styles.instanceResult}>
              <div className={styles.instanceResultIcon}>
                <CheckCircleFilled />
              </div>
              <div>
                <h2>审批实例已发起</h2>
                <p>实例正在等待流程中的申请填写步骤。</p>
              </div>
              <dl>
                <div>
                  <dt>运行状态</dt>
                  <dd>{instance.status}</dd>
                </div>
                <div>
                  <dt>业务编号</dt>
                  <dd>{instance.businessKey}</dd>
                </div>
                <div>
                  <dt>实例标识</dt>
                  <dd>{instance.processInstanceId}</dd>
                </div>
                <div>
                  <dt>流程定义</dt>
                  <dd>{instance.processDefinitionId}</dd>
                </div>
              </dl>
              <Alert
                type="info"
                showIcon
                message="业务申请表单由业务系统提供"
                description="流程发起入口只收集该版本要求的审批人员标识。审批办理页面需使用业务系统的立项申请表单。"
              />
              <Button onClick={() => setInstance(null)}>再发起一项</Button>
            </div>
          ) : (
            <div className={styles.startGrid}>
              <div className={styles.startForm}>
                <div className={styles.startSectionHeading}>
                  <span>
                    <FileTextOutlined />
                  </span>
                  <div>
                    <h2>立项申请内容</h2>
                    <small>业务系统提供的表单值以 JSON 对象传入</small>
                  </div>
                </div>
                <label htmlFor="business-form-values">业务表单数据 JSON</label>
                <TextArea
                  id="business-form-values"
                  rows={9}
                  spellCheck={false}
                  value={businessForm}
                  onChange={(event) => setBusinessForm(event.target.value)}
                  placeholder={
                    '例如：{\n  "projectName": "示例项目",\n  "description": "项目说明"\n}'
                  }
                />
                <p className={styles.startHelp}>
                  此处为业务系统集成输入口；流程设计不定义表单字段。
                </p>

                <div className={styles.startSectionHeading}>
                  <span>
                    <UserOutlined />
                  </span>
                  <div>
                    <h2>审批人员</h2>
                    <small>按当前模板的启动字段动态生成</small>
                  </div>
                </div>
                {startVariables.length === 0 ? (
                  <Alert type="info" showIcon message="后端未返回需要填写的启动人员字段。" />
                ) : (
                  <div className={styles.startVariableFields}>
                    {startVariables.map((variable) => (
                      <StartupVariableField
                        key={variable.name}
                        variable={variable}
                        value={fieldValues[variable.name] || ''}
                        onChange={(value) =>
                          setFieldValues((current) => ({ ...current, [variable.name]: value }))
                        }
                      />
                    ))}
                  </div>
                )}
                {startError && (
                  <Alert className={styles.startError} type="error" showIcon message={startError} />
                )}
                <Button
                  type="primary"
                  size="large"
                  loading={starting}
                  disabled={!template.startable || template.suspended}
                  onClick={() => void submit()}
                >
                  发起审批
                </Button>
              </div>
              <aside className={styles.startAside}>
                <div className={styles.startAsideMark}>说</div>
                <h3>启动字段来自流程版本</h3>
                <p>单人审批人传一个人员标识；Array 字段每行填写一个人员标识，会以集合传给后端。</p>
                <div className={styles.startMetadata}>
                  <b>字段来源规则</b>
                  <span>
                    <i className={styles.sourceStart} /> start：本次发起时提交
                  </span>
                  <span>
                    <i className={styles.sourceComplete} /> complete：办理任务时提交
                  </span>
                  <span>
                    <i className={styles.sourceEngine} /> engine：后端生成，不在此填写
                  </span>
                  <small>旧模板未提供来源标记的变量按 start 处理。</small>
                </div>
              </aside>
            </div>
          )}
        </>
      )}
    </section>
  )
}

function StartupVariableField({
  variable,
  value,
  onChange,
}: {
  variable: TaskTemplateVariable
  value: string
  onChange: (value: string) => void
}) {
  const type = variable.type.toLowerCase()
  const collection = ['array', 'list', 'collection'].includes(type) || type.endsWith('[]')
  const normalizedDescription = variable.description?.replace(/^【([^】]+)】/, '$1：')
  const fieldLabel = normalizedDescription || variable.name
  return (
    <div className={styles.startField}>
      <label htmlFor={'startup-' + variable.name}>
        {fieldLabel}
        {variable.required && <span>必填</span>}
      </label>
      {collection ? (
        <TextArea
          id={'startup-' + variable.name}
          rows={3}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="每行填写一个人员标识"
        />
      ) : (
        <Input
          id={'startup-' + variable.name}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="填写后端认可的人员标识"
        />
      )}
      <small>
        <code>{variable.name}</code> · {collection ? '人员集合' : variable.type}
      </small>
    </div>
  )
}
