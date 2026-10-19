# 流程管理项目初始化方案

## 项目定位

React 后台管理项目，主要覆盖流程设计与流程监控。初始化先提供可运行骨架和清晰的扩展位置，不预先实现完整业务。

## 工程基础

- React 18 + TypeScript + Vite；保留严格类型检查、路径别名、环境变量和明确的开发、构建、检查命令。
- Ant Design 5、React Router 6 与 Zustand 4 保持和旧 React 项目相近的主版本，静态路由配置先行。
- 流程设计器使用 `@xyflow/react`，不使用 `bpmn-js`。
- Zustand 管理需要跨组件共享的前端交互状态；服务端数据缓存后续按需求确定。
- Less Modules 和 styled-components 两套样式都保留，支持迁移老 React 项目的封装组件。
- 沿用 ESLint、Prettier、基础测试和类型检查。
- API 使用 POC 风格的轻量 Axios 请求入口；暂不建立统一业务 API 分层。

## 目录方向

```text
src/
  app/                    # 应用入口、静态路由、后台布局和 Provider
  features/
    designer/             # React Flow 画布和编辑器状态
    monitoring/           # 流程实例监控
  api/                    # 后续迁入 POC 的 workflow、camunda 接口
  components/             # 可复用 UI 与旧项目迁移组件
  hooks/
  stores/
  styles/less/
  types/
  utils/
```

目录按真实代码增长，不为预想扩展创建空模块。

## API 迁移约定

以 `C:/Users/ht/Desktop/work/软件工厂/software_product/poc/bpmn/src/api` 为接口合同和实现参考。保留轻量 Axios 请求入口（POC 的 `src/utils/request.ts`），按需迁入 POC 的 `workflow` 与 `camunda` 请求和类型。POC 的 `api/demo.ts` 是演示数据，不属于后端接口迁移范围。

React Flow 图数据不能直接替代 POC Camunda 部署接口使用的 BPMN XML。后续接通部署接口时，需要确认后端是否接受 React Flow 数据，或另行实现并验证转换器；这不属于本次初始化。

## 状态与权限

- 路由先静态写在前端配置中，不接动态菜单、登录鉴权服务或后端权限接口。
- 编辑草稿、选中节点、画布交互等本地状态放在 Zustand；筛选和分页优先放在 URL。
- 设计器编辑态与后端流程定义/运行实例分开建模，通过明确的转换逻辑连接。

## 暂缓项

- 后端登录、动态菜单和真实权限接口；当前用静态路由。
- 微前端接入与 KeepAlive 页面缓存。
- Sentry、压缩/图片优化、构建分析、自动导入等额外构建插件。
- 多 API 域名客户端、复杂统一业务错误码处理、自动刷新令牌；先以 POC 请求约定为准。
- WebSocket、SSE 或轮询等实时刷新方式；待确认后端能力与刷新需求。
- 生产部署流水线、私有 CI 引用、企业内网镜像和环境地址。
- 超出当前功能需要的图表、自动布局和设计器插件。

## 后续需要确定

- 新项目 API base URL、环境名称与认证方式。
- React Flow 图数据到 BPMN XML 的适配方式。
- 部署目标与对应 CI 配置。
