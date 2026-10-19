import { useMemo, useState } from 'react'
import { ClockCircleOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import { Button, Input, Select, Table, Tag, Tooltip, type TableColumnsType } from 'antd'
import styles from './MonitoringPage.module.less'

type InstanceStatus = '运行中' | '已完成' | '已驳回' | '异常'
interface InstanceRow {
  id: string
  name: string
  businessKey: string
  initiator: string
  currentNode: string
  status: InstanceStatus
  startedAt: string
  duration: string
}

const rows: InstanceRow[] = [
  {
    id: 'WF-20261019-0842',
    name: '费用报销流程',
    businessKey: 'BX-2026-10482',
    initiator: '陈思远',
    currentNode: '财务复核',
    status: '运行中',
    startedAt: '今天 14:18',
    duration: '18 分钟',
  },
  {
    id: 'WF-20261019-0839',
    name: '采购申请流程',
    businessKey: 'CG-2026-08317',
    initiator: '周雨晴',
    currentNode: '部门负责人审批',
    status: '运行中',
    startedAt: '今天 13:52',
    duration: '44 分钟',
  },
  {
    id: 'WF-20261019-0826',
    name: '用印申请流程',
    businessKey: 'YY-2026-02119',
    initiator: '林知远',
    currentNode: '已结束',
    status: '已完成',
    startedAt: '今天 12:40',
    duration: '1 小时 12 分',
  },
  {
    id: 'WF-20261019-0811',
    name: '费用报销流程',
    businessKey: 'BX-2026-10476',
    initiator: '许嘉宁',
    currentNode: '申请人修改',
    status: '已驳回',
    startedAt: '今天 11:26',
    duration: '36 分钟',
  },
  {
    id: 'WF-20261019-0798',
    name: '合同审批流程',
    businessKey: 'HT-2026-00542',
    initiator: '赵一鸣',
    currentNode: '法务审核',
    status: '运行中',
    startedAt: '今天 10:51',
    duration: '3 小时 11 分',
  },
  {
    id: 'WF-20261018-0762',
    name: '采购申请流程',
    businessKey: 'CG-2026-08302',
    initiator: '吴佳',
    currentNode: '服务任务重试',
    status: '异常',
    startedAt: '昨天 17:32',
    duration: '已超时',
  },
]

const statusColor: Record<InstanceStatus, string> = {
  运行中: 'processing',
  已完成: 'success',
  已驳回: 'default',
  异常: 'error',
}

export function MonitoringPage() {
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState<string>()
  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        const searchable = [row.id, row.name, row.businessKey, row.initiator]
          .join(' ')
          .toLowerCase()
        return (
          (!keyword || searchable.includes(keyword.toLowerCase())) &&
          (!status || row.status === status)
        )
      }),
    [keyword, status],
  )

  const columns: TableColumnsType<InstanceRow> = [
    {
      title: '流程实例',
      dataIndex: 'name',
      key: 'name',
      width: 210,
      render: (_, row) => (
        <div className={styles.processCell}>
          <strong>{row.name}</strong>
          <span>{row.id}</span>
        </div>
      ),
    },
    {
      title: '业务编号',
      dataIndex: 'businessKey',
      key: 'businessKey',
      width: 150,
      render: (value: string) => <span className={styles.code}>{value}</span>,
    },
    { title: '发起人', dataIndex: 'initiator', key: 'initiator', width: 100 },
    {
      title: '当前节点',
      dataIndex: 'currentNode',
      key: 'currentNode',
      width: 150,
      render: (value: string, row) => (
        <span className={row.status === '异常' ? styles.errorNode : styles.nodeName}>{value}</span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (value: InstanceStatus) => (
        <Tag color={statusColor[value]} className={styles.statusTag}>
          {value}
        </Tag>
      ),
    },
    { title: '发起时间', dataIndex: 'startedAt', key: 'startedAt', width: 125 },
    {
      title: '耗时',
      dataIndex: 'duration',
      key: 'duration',
      width: 110,
      render: (value: string, row) => (
        <span className={row.status === '异常' ? styles.errorNode : ''}>{value}</span>
      ),
    },
    {
      title: '',
      key: 'action',
      width: 70,
      align: 'right',
      render: () => (
        <Button type="link" className={styles.detailButton}>
          查看
        </Button>
      ),
    },
  ]

  return (
    <section className={styles.page}>
      <div className={styles.heading}>
        <div>
          <div className={styles.kicker}>OPERATIONS</div>
          <h1>运行监控</h1>
          <p>查看流程实例状态，快速定位待处理与异常任务。</p>
        </div>
        <Tooltip title="重置本地演示筛选">
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              setKeyword('')
              setStatus(undefined)
            }}
          >
            重置筛选
          </Button>
        </Tooltip>
      </div>
      <div className={styles.metrics}>
        <article className={styles.metric}>
          <span>今日发起</span>
          <strong>128</strong>
          <small>
            <i className={styles.up}>↑ 12.4%</i> 较昨日
          </small>
          <div className={styles.spark}>
            {Array.from({ length: 10 }, (_, index) => (
              <i key={index} />
            ))}
          </div>
        </article>
        <article className={styles.metric}>
          <span>正在运行</span>
          <strong>46</strong>
          <small>
            <i className={styles.neutral}>实时</i> 个流程实例
          </small>
          <div className={styles.spark + ' ' + styles.sparkGold}>
            {Array.from({ length: 10 }, (_, index) => (
              <i key={index} />
            ))}
          </div>
        </article>
        <article className={styles.metric}>
          <span>待处理任务</span>
          <strong>19</strong>
          <small>
            <i className={styles.warn}>7 项</i> 已等待超过 2 小时
          </small>
          <div className={styles.spark + ' ' + styles.sparkBlue}>
            {Array.from({ length: 10 }, (_, index) => (
              <i key={index} />
            ))}
          </div>
        </article>
        <article className={styles.metric}>
          <span>异常实例</span>
          <strong>3</strong>
          <small>
            <i className={styles.down}>需关注</i> 个实例等待处理
          </small>
          <div className={styles.spark + ' ' + styles.sparkRed}>
            {Array.from({ length: 10 }, (_, index) => (
              <i key={index} />
            ))}
          </div>
        </article>
      </div>
      <div className={styles.tableCard}>
        <div className={styles.tableHead}>
          <div>
            <h2>流程实例</h2>
            <span>共 {filteredRows.length} 条记录</span>
          </div>
          <div className={styles.filters}>
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="搜索编号、流程或发起人"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
            />
            <Select
              allowClear
              placeholder="全部状态"
              value={status}
              onChange={setStatus}
              options={['运行中', '已完成', '已驳回', '异常'].map((value) => ({
                value,
                label: value,
              }))}
            />
          </div>
        </div>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filteredRows}
          pagination={{
            pageSize: 6,
            showSizeChanger: false,
            showTotal: (total) => '共 ' + total + ' 条',
            size: 'small',
          }}
          size="middle"
        />
        <div className={styles.tableFoot}>
          <span>
            <i />
            数据为本地演示记录
          </span>
          <span>
            <ClockCircleOutlined /> 最近更新 今天 14:36:08
          </span>
        </div>
      </div>
    </section>
  )
}
