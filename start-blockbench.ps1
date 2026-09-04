# 一键启动 Blockbench + MCP 插件环境
# 用法: 在 PowerShell 中运行  ./start-blockbench.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$bbDir = Join-Path $root 'blockbench'
$dataDir = Join-Path $root '.bbdata'
$mcpPlugin = Join-Path $root 'blockbench-mcp-plugin\dist\mcp.js'
$electron = Join-Path $bbDir 'node_modules\electron\dist\electron.exe'

if (-not (Test-Path $electron)) { throw "未找到 Electron: $electron，请先运行 npm install" }
if (-not (Test-Path $mcpPlugin)) { throw "未找到 MCP 插件产物: $mcpPlugin，请先构建插件" }

# 1) 准备独立的用户数据目录 + 预置 MCP 插件的网络权限(避免首次加载弹窗)
New-Item -ItemType Directory -Force $dataDir | Out-Null
$permFile = Join-Path $dataDir 'plugin_permissions.json'
if (-not (Test-Path $permFile)) {
  Set-Content -Path $permFile -Value '{"mcp":{"allowed":{"net":true}}}' -Encoding ascii
}

# 2) 寻找可用的 Node >= 22（用于跑辅助脚本，需要内置 WebSocket）
$node = $null
Get-ChildItem "$env:USERPROFILE\.workbuddy\binaries\node\versions" -Recurse -Filter 'node.exe' -File -ErrorAction SilentlyContinue | ForEach-Object {
  if (-not $node) {
    $v = (& $_.FullName --version 2>$null)
    if ($v -match 'v(\d+)\.' -and [int]$Matches[1] -ge 22) { $node = $_.FullName }
  }
}
if (-not $node) { throw '未找到 Node >= 22（~/.workbuddy/binaries/node/versions 下）。请先安装 Node 22 或修正 start 脚本。' }

# 3) 若 Blockbench 尚未运行则启动（后台）
$running = $false
try { $null = Invoke-WebRequest 'http://127.0.0.1:9223/json/version' -UseBasicParsing -TimeoutSec 2; $running = $true } catch {}
if ($running) {
  Write-Host '[1/3] Blockbench 已在运行（远程调试端口 9223 已开启）'
} else {
  Write-Host '[1/3] 启动 Blockbench ...'
  Start-Process -FilePath $electron -ArgumentList '.', "--userData=$dataDir", '--remote-debugging-port=9223' -WorkingDirectory $bbDir -RedirectStandardOutput "$dataDir\electron.out.log" -RedirectStandardError "$dataDir\electron.err.log"
}

# 4) 确保 MCP 插件已加载进 Blockbench（幂等）
Write-Host '[2/3] 确保 MCP 插件已加载 ...'
& $node "$root\tools\load-mcp-plugin.mjs"
if ($LASTEXITCODE -ne 0) { Write-Host '  插件加载失败，请查看上方错误信息'; exit 1 }

# 5) 验证 MCP 服务
Write-Host '[3/3] 验证 MCP 服务 ...'
Start-Sleep -Milliseconds 800
try {
  $body = '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"startup-check","version":"1.0"}}}'
  $r = Invoke-WebRequest -Uri 'http://localhost:3000/bb-mcp' -Method Post -Body $body -ContentType 'application/json' -Headers @{Accept = 'application/json, text/event-stream'} -UseBasicParsing -TimeoutSec 8
  Write-Host "  MCP Server 正常: $($r.Content)"
} catch {
  Write-Host "  MCP Server 暂不可达: $($_.Exception.Message)"
}
Write-Host ''
Write-Host '环境就绪：Blockbench 窗口应已打开，MCP 地址为 http://localhost:3000/bb-mcp'
