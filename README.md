# BlockBenchAgent

用 **Blockbench MCP Server** 让 AI（或任何 MCP 客户端）能够直接操作 Blockbench，进行 3D / 低多边形建模的工作区。

```text
AI (MCP Client)  <--streamable HTTP-->  Blockbench (内置 blockbench-mcp-plugin)  ---->  当前打开的 .bbmodel
```

## 目录结构

| 路径 | 说明 |
|---|---|
| `blockbench/` | Blockbench 官方源码（submodule：https://github.com/JannisX11/blockbench） |
| `blockbench-mcp-plugin/` | MCP 插件源码（submodule：https://github.com/jasonjgardner/blockbench-mcp-plugin） |
| `tools/bb-mcp.mjs` | 轻量命令行 MCP 客户端（无需安装任何 npm 包） |
| `tools/load-mcp-plugin.mjs` | 把插件构建/加载进 Blockbench 的辅助脚本 |
| `tools/verify-mcp.mjs` | MCP 服务连通性检查 |
| `Start-Blockbench.bat` | Windows 一键启动（双击即可） |
| `start-blockbench.ps1` | 上面的 PowerShell 实现 |
| `projects/` | 建模工程与素材（**本地私有，不入库**，见 .gitignore） |
| `.bbdata/` | 运行时数据：MCP 会话、工具 schema 缓存、自动截图等（**不入库**） |

## 环境要求

- Windows（脚本按 Windows 编写）
- Node.js ≥ 18（自带 `fetch`）
- Blockbench（源码模式），建议 Electron 构建可用
- 若需重新构建 MCP 插件：需要 `bun`（见 blockbench-mcp-plugin/README）

## 克隆注意

两个上游项目以 **git submodule** 形式引入，克隆时请使用：

```bash
git clone --recurse-submodules https://github.com/Mobius-Bron/BlockBenchAgent.git
```

或在已克隆的仓库中补拉：

```bash
git submodule update --init --recursive
```

## 快速启动

双击 `Start-Blockbench.bat`。脚本依次完成：

1. 启动 Blockbench（源码模式）
2. 等待渲染进程就绪，并把 `blockbench-mcp-plugin` 构建产物作为插件注入
3. 校验 MCP 服务是否可访问

看到如下输出即表示就绪：

```text
MCP Server 正常: { ... "serverInfo":{"name":"Blockbench MCP", ... } }
```

MCP 服务地址：`http://localhost:3000/bb-mcp`

## MCP 使用说明

### 1. 概念

- Blockbench 启动并注入插件后，会在 `http://localhost:3000/bb-mcp` 暴露 **MCP over Streamable HTTP**。
- 任何 MCP 客户端都可以接入：CodeBuddy / Claude / Cursor 等 AI 工具，或本仓库自带的命令行客户端。
- AI 操作的是 **Blockbench 当前打开的工程**：新建工程、创建骨骼（Group）、放方块/网格、上色、摆姿势、导出，全部通过工具调用完成。

### 2. 命令行客户端 `tools/bb-mcp.mjs`

无需 `npm install`，直接运行：

```bash
node tools/bb-mcp.mjs <command> [参数]
```

常用命令：

| 命令 | 说明 |
|---|---|
| `init` | 初始化 MCP 会话并打印服务信息 |
| `tools` | 列出当前插件提供的全部工具（94 个左右） |
| `toolinfo <name>` | 查看某个工具的 JSON Schema（参数结构） |
| `call <name> <args>` | 调用单个工具 |
| `batch <plan.json>` | 顺序执行批量建模蓝图 |
| `resources` | 列出 MCP 资源 |
| `prompts` | 列出 MCP 提示词 |
| `reset` | 清空会话（服务重启后建议先 reset） |

### 3. 工具调用的三种参数写法

```bash
# a) 内联 JSON
node tools/bb-mcp.mjs call create_project '{"name":"demo","format":"generic"}'

# b) 标准输入（适合超长参数 / 避免转义问题）
echo '{"code":"(async()=>1)()"}' | node tools/bb-mcp.mjs call risky_eval -

# c) 参数文件（推荐用于大参数）
node tools/bb-mcp.mjs call place_cube @.bbdata/args/my_args.json
```

### 4. 常用工具速览（实际以 `tools` 输出为准）

| 工具 | 用途 |
|---|---|
| `create_project` | 新建工程（model_format 可指定 generic/java_block 等） |
| `create_texture` | 创建纹理（支持纯色填充或从图片/DataURL 载入） |
| `add_group` | 创建骨骼 / Group（含 origin 枢轴与 rotation，用于 rig） |
| `place_cube` | 放置立方体（支持批量、rotation、per-face UV） |
| `create_cylinder` / `create_sphere` | 生成网格圆柱 / 球 |
| `modify_cube` | 修改已有方块坐标 |
| `list_outline` / `get_project_info` | 查看工程结构与元素树 |
| `list_textures` | 查看纹理列表 |
| `set_camera_angle` | 设置视口相机（position/target/projection） |
| `capture_screenshot` / `capture_app_screenshot` | 截图：可作 AI 的“眼睛”校验模型 |
| `export_model` | 导出工程/模型 |
| `risky_eval` | 在 Blockbench 渲染进程执行任意 JS（高级能力，谨慎使用） |

### 5. 批量建模蓝图 `batch`

把一系列调用写成 JSON 文件，交给 `batch` 顺序执行，适合“一次搭好骨架 / 一次铺满几何”：

```json
{
  "calls": [
    { "tool": "create_texture", "args": { "name": "white", "width": 32, "height": 32, "fill_color": "#FFFFFF", "layer_name": "base" } },
    { "tool": "add_group", "args": { "name": "root", "origin": [0, 0, 0], "rotation": [0, 0, 0] } },
    { "tool": "place_cube", "args": { "texture": "white", "group": "root", "faces": true, "elements": [ { "name": "cube1", "from": [-1, 0, -1], "to": [1, 2, 1] } ] } }
  ]
}
```

执行：

```bash
node tools/bb-mcp.mjs batch .bbdata/plans/my_plan.json
```

### 6. 截图输出

截图类工具会返回 `image` 内容，客户端自动保存为：

```text
.bbdata/shots/<toolName>-<timestamp>.png
```

AI 建模流程建议：**每步操作后截图**，用它校验形状，再继续迭代。

### 7. 会话与故障处理

- 服务端是 Blockbench 进程；**关闭 Blockbench 后服务消失**，需重新运行 `Start-Blockbench.bat`。
- Blockbench / 插件重启后，旧会话失效，先执行：
  ```bash
  node tools/bb-mcp.mjs reset
  ```
- 默认服务地址可用环境变量覆盖：
  ```bash
  export BB_MCP_URL=http://127.0.0.1:3000/bb-mcp
  ```

### 8. AI 协同建模工作流建议

1. `create_project` 新建工程（尽量与目标格式一致）
2. 先建 **骨骼/Group 层级**（add_group，枢轴放关节，命名规范）
3. 用 `place_cube` / `create_cylinder` 分部件铺几何，**每批后截图**
4. 上色：创建纹理并挂到部件
5. 需要高精度曲面时使用网格工具（`place_mesh` / `create_cylinder` 等），或用 `risky_eval` 直接调用 Blockbench 原生 Mesh API
6. 对形状不满 → `modify_cube` / 删除重建，截图迭代
7. 完成 → `export_model` 导出 `.bbmodel`

## 数据与隐私

- `projects/`（本地建模素材/工程）和 `.bbdata/`（运行时缓存/截图/会话）均已加入 `.gitignore`，**不会被提交到 GitHub**。
- 如需让其他人拿到模型，请复制 `.bbmodel` 文件单独分享。

## License

本仓库仅承载工作区与使用文档；`blockbench` 与 `blockbench-mcp-plugin` 为各自上游仓库的 submodule，版权归上游所有。
