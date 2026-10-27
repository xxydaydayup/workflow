# AGENTS.md

## Commit 提交规范

- 遵循 Conventional Commits：`type(scope): subject`，scope 可省略。type 枚举以 [commitlint.config.js](commitlint.config.js) 为准（feat / fix / docs / style / refactor / perf / test / build / ci / chore / revert）。
- subject 用中文祈使句，小写开头，结尾无句号，50 字符以内，如 `feat(designer): support node drag`。
- 一次提交只做一件事，无关改动拆分为多个提交。
- husky 钩子自动校验（pre-commit 跑 lint-staged，commit-msg 跑 commitlint）；被拒时按报错修正后重新提交。

## 功能验证策略

- 开发任务默认通过实际功能验证确认完成：先明确本次改动涉及的用户路径和预期行为，完成后运行项目并操作相关功能，检查关键输入、输出和界面结果。项目已有的构建、类型检查或 lint 命令可作为辅助验证。
- 保留现有测试。已有测试能直接验证本次改动时，可以运行；不要为满足验证流程而新增测试。
- 只有用户在当前任务中明确要求编写或修改测试时，才创建或修改测试文件及测试代码；修复 bug、处理边界情况也不例外。
- 完成时说明实际进行的功能验证及结果；未执行的检查要明确说明。

## Agent 技能配置

### Issue 跟踪

本仓库使用 `.scratch/` 下的本地 Markdown 文件跟踪 issue。详见 `docs/agents/issue-tracker.md`。

### 分流标签

五种标准分流角色使用本仓库配置的中文标签。详见 `docs/agents/triage-labels.md`。

### 领域文档

本仓库采用单上下文布局。详见 `docs/agents/domain.md`。
涉及审批流业务语义时，同时以 `docs/examples/立项申请.bpmn` 作为业务基准示例。
