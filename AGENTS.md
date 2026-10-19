# AGENTS.md

## Commit 提交规范

- 遵循 Conventional Commits：`type(scope): subject`，scope 可省略。type 枚举以 [commitlint.config.js](commitlint.config.js) 为准（feat / fix / docs / style / refactor / perf / test / build / ci / chore / revert）。
- subject 用中文祈使句，小写开头，结尾无句号，50 字符以内，如 `feat(designer): support node drag`。
- 一次提交只做一件事，无关改动拆分为多个提交。
- husky 钩子自动校验（pre-commit 跑 lint-staged，commit-msg 跑 commitlint）；被拒时按报错修正后重新提交。
