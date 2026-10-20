# Issue 跟踪：本地 Markdown

本仓库的 issue 和规格说明以 Markdown 文件形式保存在 `.scratch/` 目录中。

## 约定

- 每个功能使用一个目录：`.scratch/<功能名称>/`
- 功能规格说明保存在 `.scratch/<功能名称>/spec.md`
- 实现任务每项使用一个独立文件，保存在 `.scratch/<功能名称>/issues/<序号>-<任务名称>.md`；序号从 `01` 开始。不要把多个任务合并到同一个文件中
- 在每个任务文件靠前的位置用 `Status:` 行记录分流状态；具体角色字符串见 `triage-labels.md`
- 评论和对话记录追加到文件末尾的 `## Comments` 标题下

## 技能要求“发布到 issue 跟踪系统”时

在 `.scratch/<功能名称>/` 下新建文件；如果目录不存在，则先创建目录。

## 技能要求“读取相关任务”时

读取指定路径对应的文件。通常由用户直接提供文件路径或任务编号。

## Wayfinding 操作

`/wayfinder` 使用以下约定。**地图**文件包含任务信息，每项任务各自保存在一个**子文件**中。

- **地图**：`.scratch/<工作主题>/map.md`，记录 Notes、Decisions-so-far 和 Fog。
- **子任务**：`.scratch/<工作主题>/issues/<序号>-<任务名称>.md`，序号从 `01` 开始，问题写在正文中。用 `Type:` 行记录任务类型（`research`、`prototype`、`grilling` 或 `task`），用 `Status:` 行记录 `claimed` 或 `resolved`。
- **阻塞关系**：在文件靠前的位置用 `Blocked by: <序号>, <序号>` 行记录依赖。只有所列文件的状态全部为 `resolved`，该任务才算解除阻塞。
- **可领取任务**：检查 `.scratch/<工作主题>/issues/` 中尚未解决、没有阻塞且尚未领取的任务，优先选择序号最小的任务。
- **领取任务**：开始处理前，先将 `Status:` 改为 `claimed` 并保存。
- **完成任务**：在 `## Answer` 标题下追加答案，将 `Status:` 改为 `resolved`，然后把上下文链接（gist + 链接）追加到 `map.md` 的 Decisions-so-far 部分。
