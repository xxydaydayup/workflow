# 流程工作台

基于 React 的流程设计与监控管理台。当前初始化包含 React Flow 画布基础、静态页面路由和本地演示监控数据。监控数字、流程和人员均为演示内容，没有连接后端。

## 环境要求

- Node.js `>=20.19.0`
- pnpm `>=9`

## 开始开发

```bash
pnpm install
pnpm dev
```

## 常用命令

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

初始化约定和暂缓项见 [docs/initialization-plan.md](docs/initialization-plan.md)。

Git hooks 由 Husky 管理。若在当前工作区安装时看到无法写入 .git/config 的提示，请在有仓库配置权限的环境运行 pnpm exec husky，使本地 hooksPath 生效。
