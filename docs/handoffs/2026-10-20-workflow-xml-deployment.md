# 流程 XML 转换与任务模板部署交接

## 当前目标与状态

用户先要求完善 Swagger API 并支持 JSON → XML，随后要求参考
`~/Desktop/work/软件工厂/software_product/poc/bpmn` 的“发布任务模板”，验证转换 XML 可部署。
前端功能已完成；真实后端部署被 XML 解析错误阻塞，详见下方 issue。

## 继续前先读

- 使用、接口、环境与验证限制：[README](../../README.md)。
- 后端阻塞复现与预期：[后端部署增强导致 XML 解析失败](../../.scratch/template-deployment/issues/01-后端部署增强导致XML解析失败.md)。
- 界面：[DesignerPage.tsx](../../src/features/designer/DesignerPage.tsx)、[ProcessExportDrawer.tsx](../../src/features/designer/ProcessExportDrawer.tsx)、[ProcessDeploymentPanel.tsx](../../src/features/designer/ProcessDeploymentPanel.tsx)。
- 部署结果判断：[templateDeployment.ts](../../src/features/designer/templateDeployment.ts)。
- API：[bpmn.ts](../../src/api/bpmn.ts)、[workflow](../../src/api/workflow/index.ts)。

## 本地运行与授权

本项目现有 Vite 服务为 `http://localhost:5174`，参考项目为 `http://localhost:5173`。
后端 Swagger：`http://192.168.124.202:9000/swagger/index.html`，规范为同站点 `/swagger/doc.json`。
`.env.local` 已配置代理和 Basic Auth，Git 忽略；不要输出认证值或放入 `VITE_` 变量。
用户已授权实现和真实验证转换及部署。实际请求均使用独立验证标识，返回 HTTP 400；
未启动任务实例，未提交 Git、推送或修改参考项目与后端。

## 已完成验证

- `pnpm typecheck`、`pnpm lint`、`pnpm test`（4 文件共 23 项）、`pnpm build`、`git diff --check` 均通过。构建有大包警告。
- 真实转换与真实部署错误展示已验证；成功响应、已有模板查询、断网、延迟响应用浏览器模拟验证。
- 验证了部署中关闭/切换受限、修改后状态更新、配置非法时禁止转换/部署及 390px 窄屏。
- XML 提交原文与预览语义一致；原文 CRLF 会被浏览器 textarea 显示为 LF，未改变提交内容。
- `workflow-deploy` 浏览器会话已关闭，模拟仅存在于该会话，没有写入产品 API。

## 工作区注意事项

当前所有改动均未提交，包含之前完成的 API/XML 功能。用户原有 `AGENTS.md`、
设计器高级配置、`docs/agents/`、`pelican-bicycle.html` 应保留。
`tem.json` 在本次工作期间出现，本代理未创建或修改，视为用户文件。
仓库没有 `.codegraph/`。不要重做已通过的实现或重置工作区。

## 后续

若用户要求继续解决真实部署，先核对上述 issue 与后端部署增强代码的具体位置。
后端修复后，在独立流程标识上重新跑 JSON → XML → 发布 → 模板查询；不要把模拟成功当成真实部署结果。

## Suggested skills

- `agent-browser`：继续验证设计器与发布交互，先加载 CLI 的 core 用法。
- `diagnosing-bugs`：若继续追踪后端 XML 增强/解析错误。
- `handoff`：再次交接时更新为新文档，引用已有规格和 issue。
