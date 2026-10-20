import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  ApartmentOutlined,
  BellOutlined,
  DeploymentUnitOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import { Badge, Input, Tooltip } from 'antd'
import styles from './WorkflowLayout.module.less'

const pageTitles: Record<string, string> = {
  '/designer': '流程设计',
  '/monitoring': '运行监控',
}

export function WorkflowLayout() {
  const location = useLocation()
  const [query, setQuery] = useState('')

  return (
    <div className={styles.workspace}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <div className={styles.brandMark}>
            <DeploymentUnitOutlined />
          </div>
          <div>
            <strong>Flowdesk</strong>
            <span>PROCESS WORKSPACE</span>
          </div>
        </div>
        <div className={styles.navLabel}>工作空间</div>
        <nav className={styles.navigation} aria-label="主导航">
          <NavLink
            to="/designer"
            className={({ isActive }) => (isActive ? styles.activeLink : styles.navLink)}
          >
            <ApartmentOutlined />
            <span>流程设计</span>
            <kbd>⌘ 1</kbd>
          </NavLink>
          <NavLink
            to="/monitoring"
            className={({ isActive }) => (isActive ? styles.activeLink : styles.navLink)}
          >
            <span className={styles.monitorIcon}>
              <i />
            </span>
            <span>运行监控</span>
            <kbd>⌘ 2</kbd>
          </NavLink>
        </nav>
        <div className={styles.sidebarBottom}>
          <div className={styles.environment}>
            <span />
            <div>
              <strong>本地演示</strong>
              <small>设计器支持转换与部署 · 监控为演示</small>
            </div>
            <span className={styles.chevron}>⌄</span>
          </div>
          <div className={styles.user}>
            <div className={styles.avatar}>林</div>
            <div>
              <strong>林知远</strong>
              <small>流程管理员</small>
            </div>
            <span className={styles.more}>···</span>
          </div>
        </div>
      </aside>

      <main className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.breadcrumb}>
            <span>工作空间</span>
            <b>/</b>
            <strong>{pageTitles[location.pathname] ?? '流程工作台'}</strong>
          </div>
          <div className={styles.topActions}>
            <Input
              className={styles.search}
              prefix={<SearchOutlined />}
              placeholder="搜索流程、实例或任务"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              allowClear
            />
            <Tooltip title="通知">
              <button className={styles.iconButton} aria-label="通知">
                <Badge dot>
                  <BellOutlined />
                </Badge>
              </button>
            </Tooltip>
            <div className={styles.topAvatar}>林</div>
          </div>
        </header>
        <div className={styles.content}>
          <Outlet />
        </div>
      </main>
    </div>
  )
}
