import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Alert, Button, Input, Select, Spin, Tag, message } from 'antd'
import { CheckCircleFilled, FileTextOutlined, UserOutlined } from '@ant-design/icons'
import { businessWorkflowGateway } from '@/api/workflow'
import type { BusinessTaskInstance, TaskTemplate, TaskTemplateVariable } from '@/api/workflow'
import styles from './ApprovalInstanceStart.module.less'
import { validateApprovalStart } from './approvalStart'

const DEFAULT_TEMPLATE_KEY = 'project-approval'
const { TextArea } = Input
const fixedApproveModes = new Set(['ALL', 'ANY', 'VOTE'])

function hasFixedApproveMode(value: unknown): value is string {
  return typeof value === 'string' && fixedApproveModes.has(value)
}

function hideSubmittedValues(error: unknown, values: Record<string, string>): string {
  let detail = error instanceof Error ? error.message : '发起实例失败，请检查填写内容后重试。'
  for (const value of Object.values(values)) {
    const trimmed = value.trim()
    if (trimmed.length < 8) continue
    detail = detail.split(trimmed).join('（已隐藏输入值）')
    try {
      const encoded = encodeURIComponent(trimmed)
      if (encoded !== trimmed) detail = detail.split(encoded).join('（已隐藏输入值）')
    } catch {
      // Ignore malformed values when sanitizing a backend error message.
    }
  }
  return detail
}

export function ApprovalInstanceStart() {
  const [searchParams] = useSearchParams()
  const templateKey =
    searchParams.get('templateKey')?.trim() ||
    searchParams.get('taskKey')?.trim() ||
    DEFAULT_TEMPLATE_KEY
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
      .getTemplate(templateKey, controller.signal)
      .then(setTemplate)
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setTemplateError(error instanceof Error ? error.message : '读取已发布流程失败。')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingTemplate(false)
      })
    return () => controller.abort()
  }, [templateKey])

  const startVariables = (template?.globalVariables || []).filter(
    (variable) => !variable.source || variable.source === 'start',
  )
  const workflowNodes = useMemo(
    () =>
      (Array.isArray(template?.displayJson?.nodes) ? template.displayJson.nodes : []).filter(
        (node): node is Record<string, unknown> => Boolean(node && typeof node === 'object'),
      ),
    [template],
  )
  const countersignNodes = workflowNodes.filter((node) => node.type === 'countersign')
  const serviceNodes = workflowNodes.filter((node) => node.type === 'service')
  const countersignVariableNames = useMemo(
    () =>
      new Set(
        countersignNodes.flatMap((node) =>
          typeof node.id === 'string'
            ? [node.id + '_approveMode', node.id + '_passRate'].filter((name) =>
                startVariables.some((variable) => variable.name === name),
              )
            : [],
        ),
      ),
    [countersignNodes, startVariables],
  )
  const serviceVariableNames = useMemo(
    () =>
      new Set(
        serviceNodes.flatMap((node) =>
          typeof node.id === 'string'
            ? [node.id + '_serviceName', node.id + '_serviceUrl'].filter((name) =>
                startVariables.some((variable) => variable.name === name),
              )
            : [],
        ),
      ),
    [serviceNodes, startVariables],
  )
  const dynamicServices = useMemo(
    () =>
      serviceNodes.flatMap((node) => {
        if (typeof node.id !== 'string') return []
        const serviceName = node.id + '_serviceName'
        const serviceUrl = node.id + '_serviceUrl'
        const serviceNameVariable = !String(node.serviceName || '').trim()
          ? startVariables.find((variable) => variable.name === serviceName)
          : undefined
        const serviceUrlVariable = !String(node.serviceUrl || '').trim()
          ? startVariables.find((variable) => variable.name === serviceUrl)
          : undefined
        const templateServiceNameVariable =
          serviceNameVariable && !serviceNameVariable.type.toLowerCase().includes('[]')
            ? serviceNameVariable
            : undefined
        const templateServiceUrlVariable =
          serviceUrlVariable &&
          ['url', 'uri', 'string'].includes(serviceUrlVariable.type.toLowerCase())
            ? serviceUrlVariable
            : undefined
        const missingVariables = [
          ...(!String(node.serviceName || '').trim() && !templateServiceNameVariable
            ? [serviceName]
            : []),
          ...(!String(node.serviceUrl || '').trim() && !templateServiceUrlVariable
            ? [serviceUrl]
            : []),
        ]
        const dynamic =
          !String(node.serviceName || '').trim() || !String(node.serviceUrl || '').trim()
        return dynamic
          ? [
              {
                nodeId: node.id,
                label: typeof node.name === 'string' ? node.name : node.id,
                missingVariables,
                ...(templateServiceNameVariable
                  ? { serviceName: templateServiceNameVariable }
                  : {}),
                ...(templateServiceUrlVariable ? { serviceUrl: templateServiceUrlVariable } : {}),
              },
            ]
          : []
      }),
    [serviceNodes, startVariables],
  )
  const dynamicCountersignValues = useMemo(() => {
    const result = new Map<
      string,
      {
        nodeId: string
        mode?: string
        modeVariable?: TaskTemplateVariable
        rate?: string
        rateVariable?: TaskTemplateVariable
      }
    >()
    for (const node of countersignNodes) {
      if (typeof node.id !== 'string') continue
      const mode = node.id + '_approveMode'
      const rate = node.id + '_passRate'
      const modeVariable = startVariables.find((variable) => variable.name === mode)
      const rateVariable = startVariables.find((variable) => variable.name === rate)
      const dynamicMode = !hasFixedApproveMode(node.approveMode)
      const dynamicRate = !node.passRate
      if (dynamicMode || dynamicRate) {
        result.set(node.id, {
          nodeId: node.id,
          ...(dynamicMode ? { mode, modeVariable } : {}),
          ...(dynamicRate ? { rate, rateVariable } : {}),
        })
      }
    }
    return result
  }, [countersignNodes, startVariables])
  const displayVariables = startVariables.filter(
    (variable) =>
      !countersignVariableNames.has(variable.name) && !serviceVariableNames.has(variable.name),
  )

  const submit = async () => {
    if (!template) return
    const validation = validateApprovalStart(
      startVariables.filter(
        (variable) =>
          !countersignVariableNames.has(variable.name) && !serviceVariableNames.has(variable.name),
      ),
      fieldValues,
      businessForm,
    )
    const dynamicVariables: Record<string, unknown> = {}
    const countersignErrors: string[] = []
    const serviceVariables = dynamicServices.flatMap(({ serviceName, serviceUrl }) =>
      [serviceName, serviceUrl].filter((variable): variable is TaskTemplateVariable =>
        Boolean(variable),
      ),
    )
    const serviceValidation = validateApprovalStart(serviceVariables, fieldValues, '{}')
    const serviceErrors = [...serviceValidation.errors]
    for (const node of countersignNodes) {
      if (typeof node.id !== 'string') continue
      const id = node.id
      const modeName = id + '_approveMode'
      const rateName = id + '_passRate'
      const dynamicFields = dynamicCountersignValues.get(id)
      const modeVariable = dynamicFields?.modeVariable
      const rawMode = dynamicFields?.mode ? fieldValues[modeName]?.trim() : ''
      const effectiveMode =
        rawMode || (hasFixedApproveMode(node.approveMode) ? node.approveMode : 'ALL')
      if (rawMode && modeVariable?.allowed?.length && !modeVariable.allowed.includes(rawMode)) {
        validation.errors.push('“' + modeName + '”不在模板允许范围内。')
      } else if (rawMode && !modeVariable) {
        validation.errors.push('流程模板未公开动态会签启动字段“' + modeName + '”，请重新发布模板。')
      } else if (rawMode) {
        dynamicVariables[modeName] = rawMode
      }
      const rawRate = dynamicFields?.rate ? fieldValues[rateName]?.trim() : ''
      if (effectiveMode === 'VOTE' && !node.passRate && !rawRate && dynamicFields?.rate) {
        countersignErrors.push('VOTE 模式需要填写“' + rateName + '”。')
      } else if (effectiveMode === 'VOTE' && !node.passRate && !rawRate) {
        countersignErrors.push(
          '流程模板未公开 VOTE 必需的启动字段“' + rateName + '”，请重新发布模板。',
        )
      }
      if (rawRate) {
        const value = Number(rawRate)
        if (!Number.isFinite(value) || value <= 0 || value > 1) {
          countersignErrors.push('“' + rateName + '”必须大于 0 且不超过 1。')
        } else if (!dynamicFields?.rateVariable) {
          countersignErrors.push(
            '流程模板未公开动态会签启动字段“' + rateName + '”，请重新发布模板。',
          )
        } else {
          const variableType = dynamicFields.rateVariable.type.toLowerCase()
          dynamicVariables[rateName] = ['integer', 'long', 'double', 'number'].includes(
            variableType,
          )
            ? value
            : rawRate
        }
      }
    }
    for (const service of dynamicServices) {
      if (service.missingVariables.length) {
        serviceErrors.push(
          '流程模板缺少动态服务启动字段：' +
            service.missingVariables.join('、') +
            '。请重新发布模板或联系流程管理员。',
        )
      }
      for (const variable of [service.serviceName, service.serviceUrl]) {
        if (variable?.required && !fieldValues[variable.name]?.trim()) {
          serviceErrors.push(
            '动态服务节点需要填写“' + (variable.description || variable.name) + '”。',
          )
        }
      }
      if (service.serviceUrl) {
        const value = fieldValues[service.serviceUrl.name]?.trim() || ''
        if (value) {
          try {
            const url = new URL(value)
            if (!['http:', 'https:'].includes(url.protocol)) throw new Error('scheme')
          } catch {
            serviceErrors.push(
              '“' +
                (service.serviceUrl.description || service.serviceUrl.name) +
                '”必须是有效的 HTTP 或 HTTPS 地址。',
            )
          }
        }
      }
    }
    for (const name of [...countersignVariableNames, ...serviceVariableNames]) {
      if (Object.hasOwn(validation.variables || {}, name)) {
        validation.errors.push('业务表单数据与会签启动字段“' + name + '”重复，无法安全提交。')
      }
    }
    validation.errors.push(...countersignErrors)
    validation.errors.push(...serviceErrors)
    if (validation.errors.length > 0) {
      setStartError(validation.errors.join(' '))
      return
    }

    setStarting(true)
    setStartError(null)
    try {
      const businessKey = templateKey + '-' + crypto.randomUUID()
      const result = await businessWorkflowGateway.startTaskInstance({
        templateKey: template.templateKey,
        businessKey,
        variables: {
          ...(validation.variables || {}),
          ...(serviceValidation.variables || {}),
          ...dynamicVariables,
        },
      })
      setInstance(result)
      message.success('流程实例已发起。')
    } catch (error) {
      const text = hideSubmittedValues(error, fieldValues)
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
          <h1 id="approval-start-title">发起 {template?.templateName || '流程'}</h1>
          <p>启动字段按已发布模板的说明生成，业务数据由发起方提交。</p>
        </div>
        <Tag color="green">模板启动</Tag>
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
              <b>{template.templateName}</b>
              <small>
                模板 {template.templateKey} · v{template.version} · 流程定义{' '}
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
                <h2>流程实例已发起</h2>
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
                message="流程实例已创建"
                description="本入口仅提交启动字段；业务表单和后续任务由接入系统处理。"
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
                    <h2>业务数据</h2>
                    <small>
                      业务系统提供的表单值以 JSON 对象传入；没有额外业务数据时可留空对象
                    </small>
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
                    <h2>流程启动字段</h2>
                    <small>按当前模板的启动字段动态生成</small>
                  </div>
                </div>
                {displayVariables.length === 0 &&
                countersignNodes.length === 0 &&
                dynamicServices.length === 0 ? (
                  <Alert type="info" showIcon message="后端未返回需要填写的启动字段。" />
                ) : (
                  <div className={styles.startVariableFields}>
                    {displayVariables.map((variable) => (
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
                {dynamicCountersignValues.size > 0 && (
                  <div className={styles.startVariableFields}>
                    {Array.from(dynamicCountersignValues.values()).map(
                      ({ nodeId, mode, modeVariable, rate, rateVariable }) => {
                        const node = countersignNodes.find((candidate) => candidate.id === nodeId)
                        const label = typeof node?.name === 'string' ? node.name : nodeId
                        const missingVariables = [
                          ...(!hasFixedApproveMode(node?.approveMode) && !modeVariable
                            ? [nodeId + '_approveMode']
                            : []),
                          ...(!node?.passRate && !rateVariable ? [nodeId + '_passRate'] : []),
                        ]
                        return (
                          <section className={styles.startField} key={nodeId + '-dynamic-values'}>
                            <label>{label} · 会签参数</label>
                            {mode &&
                              (modeVariable?.allowed?.length ? (
                                <Select
                                  allowClear
                                  value={fieldValues[mode] || undefined}
                                  placeholder="未填写时默认为 ALL"
                                  options={modeVariable.allowed.map((value) => ({
                                    label: value,
                                    value,
                                  }))}
                                  onChange={(value) =>
                                    setFieldValues((current) => ({
                                      ...current,
                                      [mode]: value || '',
                                    }))
                                  }
                                />
                              ) : (
                                <Input
                                  value={fieldValues[mode] || ''}
                                  placeholder="填写后端支持的模式；留空时按后端缺省规则处理"
                                  onChange={(event) =>
                                    setFieldValues((current) => ({
                                      ...current,
                                      [mode]: event.target.value,
                                    }))
                                  }
                                />
                              ))}
                            {rate && (
                              <Input
                                className={styles.countersignRate}
                                inputMode="decimal"
                                value={fieldValues[rate] || ''}
                                placeholder="通过比例 (0, 1]；VOTE 必填"
                                onChange={(event) =>
                                  setFieldValues((current) => ({
                                    ...current,
                                    [rate]: event.target.value,
                                  }))
                                }
                              />
                            )}
                            <small>启动变量：{[mode, rate].filter(Boolean).join('、')}</small>
                            {missingVariables.length > 0 && (
                              <Alert
                                type="error"
                                showIcon
                                message="模板未公开动态会签字段"
                                description={missingVariables.join('、')}
                              />
                            )}
                          </section>
                        )
                      },
                    )}
                  </div>
                )}
                {dynamicServices.length > 0 && (
                  <div className={styles.startVariableFields}>
                    {dynamicServices.map((service) => (
                      <section
                        className={styles.startField}
                        key={service.nodeId + '-service-values'}
                      >
                        <label>{service.label} · 服务配置</label>
                        {service.serviceName && (
                          <Input
                            value={fieldValues[service.serviceName.name] || ''}
                            placeholder={
                              service.serviceName.description || service.serviceName.name
                            }
                            onChange={(event) =>
                              setFieldValues((current) => ({
                                ...current,
                                [service.serviceName!.name]: event.target.value,
                              }))
                            }
                          />
                        )}
                        {service.serviceUrl && (
                          <Input
                            type="url"
                            inputMode="url"
                            value={fieldValues[service.serviceUrl.name] || ''}
                            placeholder={
                              service.serviceUrl.description || '填写 HTTP 或 HTTPS 服务地址'
                            }
                            onChange={(event) =>
                              setFieldValues((current) => ({
                                ...current,
                                [service.serviceUrl!.name]: event.target.value,
                              }))
                            }
                          />
                        )}
                        <small>
                          启动变量：
                          {[service.serviceName?.name, service.serviceUrl?.name]
                            .filter(Boolean)
                            .join('、')}
                        </small>
                        {service.missingVariables.length > 0 && (
                          <Alert
                            type="error"
                            showIcon
                            message="模板未公开动态服务字段"
                            description={service.missingVariables.join('、')}
                          />
                        )}
                      </section>
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
                <p>
                  模板声明的启动变量按字段类型提交；人员集合每行填写一个标识，会以集合传给后端。
                </p>
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
  const urlField = type === 'url'
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
      ) : variable.allowed?.length ? (
        <Select
          id={'startup-' + variable.name}
          allowClear
          value={value || undefined}
          placeholder={variable.name.endsWith('_approveMode') ? '未填写时默认为 ALL' : '选择一个值'}
          options={variable.allowed.map((allowed) => ({ label: allowed, value: allowed }))}
          onChange={(nextValue) => onChange(nextValue || '')}
        />
      ) : (
        <Input
          id={'startup-' + variable.name}
          type={urlField ? 'url' : 'text'}
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
