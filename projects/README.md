# 建模项目目录

这个文件夹用于存放你与 AI 协作产出的 **Blockbench 建模项目文件**（`.bbmodel` / `.geo.json` / 贴图等）。

## 建议的协作方式

- 请 AI 通过 MCP 操作 Blockbench 建模时，让模型保存到本目录，例如：

  ```
  请把当前模型导出保存到 d:/BlockBenchAgent/projects/ 目录下，命名为 my_model.bbmodel
  ```

- 常用保存/导出 MCP 工具：
  - `save_project` / `save_project_as` — 保存 `.bbmodel` 工程
  - `export_model` — 按目标格式导出（Java `.json`、Bedrock `.geo.json`、OBJ 等）
  - `capture_screenshot` — 截图查看模型当前效果

- 约定：每个子文件夹或文件对应一个独立建模任务，建议命名清晰（如 `sword`, `character/walk_cycle`）。
