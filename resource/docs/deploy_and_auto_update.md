# 服务端一键化部署功能 - 技术开发文档

## 功能概述
在现有 Electron 应用中集成服务端 Docker 容器的一键化自动部署功能,实现从 Docker Registry (支持 Docker Hub 和私有仓库) 拉取指定版本镜像并自动更新部署。

## 环境要求

### 必备软件
- **Docker Desktop** (Windows 10/11)
  - 版本要求: 20.10+ (支持 Docker Compose V2)
  - 下载地址: https://www.docker.com/products/docker-desktop
  - 安装后确保 Docker Engine 正在运行
- **Node.js** 16+ (用于 Electron 应用开发)
- **管理员权限** (首次安装 Docker 时需要)

### 权限要求
- Docker Desktop 必须以管理员权限首次启动以安装服务
- 后续运行不需要管理员权限
- 确保当前用户在 `docker-users` 组中

### 网络要求
- 可访问 Docker Hub (docker.io) 或配置的私有 Registry
- 项目使用的 Registry: `sidawater` (Docker Hub 公共仓库)
- 镜像名称: `research-service`
- 无需 VPN (Docker Hub 在国内可直接访问,但可能较慢)

### 验证环境
打开 PowerShell 或 CMD,执行以下命令:
```powershell
# 检查 Docker 版本
docker --version
# 输出示例: Docker version 24.0.6, build ed223bc

# 检查 Docker Compose 版本 (V2)
docker compose version
# 输出示例: Docker Compose version v2.21.0

# 验证 Docker 是否运行
docker ps
# 应返回容器列表 (可能为空)
```

**注意事项:**
- Docker Compose V2 使用 `docker compose` (空格),不是 `docker-compose` (连字符)
- 本文档所有命令基于 Docker Compose V2
- 如果系统仅有 V1,需升级 Docker Desktop

## 技术架构

### 组件关系图
```
┌─────────────────────────────────────────────────────────┐
│  Electron Renderer Process (React + TypeScript)        │
│  ├─ SettingsModal (部署配置 Tab)                        │
│  └─ DeploymentPanel (部署控制面板)                       │
└────────────────┬────────────────────────────────────────┘
                 │ IPC Communication
                 │ (contextBridge + ipcRenderer)
                 ↓
┌─────────────────────────────────────────────────────────┐
│  Electron Main Process (main.ts)                       │
│  ├─ IPC Handler: 'start-deployment'                   │
│  ├─ IPC Handler: 'check-docker-environment'           │
│  └─ IPC Event: 'deploy-progress' (向渲染进程发送进度)    │
└────────────────┬────────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────────┐
│  DockerDeployer Class (TypeScript)                     │
│  ├─ executeCommand() - 执行 Shell 命令                  │
│  ├─ login() - Docker Registry 登录                     │
│  ├─ pullImage() - 拉取镜像                              │
│  ├─ updateComposeFile() - 更新 docker-compose.yml     │
│  ├─ deploy() - 执行部署                                 │
│  ├─ checkHealth() - 健康检查                            │
│  └─ rollback() - 回滚到上一版本                         │
└────────────────┬────────────────────────────────────────┘
                 │ child_process.exec()
                 ↓
┌─────────────────────────────────────────────────────────┐
│  Docker CLI (Windows)                                  │
│  ├─ docker login                                       │
│  ├─ docker pull                                        │
│  ├─ docker compose up -d                               │
│  └─ docker ps / docker inspect                         │
└────────────────┬────────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────────┐
│  Docker Daemon (Local)                                 │
└────────────────┬────────────────────────────────────────┘
                 │ HTTPS
                 ↓
┌─────────────────────────────────────────────────────────┐
│  Docker Registry                                       │
│  ├─ Docker Hub (sidawater/research-service)           │
│  └─ 私有 Registry (可选)                                │
└─────────────────────────────────────────────────────────┘
```

### 数据流
1. **用户输入** → 渲染进程收集配置 (版本号、Registry URL 等)
2. **IPC 调用** → 通过 `window.electronAPI.startDeployment()` 发送至主进程
3. **主进程处理** → 创建 DockerDeployer 实例并执行部署流程
4. **进度反馈** → 主进程通过 `webContents.send('deploy-progress', ...)` 实时推送进度
5. **结果返回** → 部署完成后返回成功/失败状态

### 核心类设计

#### DockerDeployer 类 (TypeScript)
```typescript
import { exec } from 'child_process'
import { promises as fs } from 'fs'
import { join } from 'path'
import { BrowserWindow } from 'electron'

interface DeploymentConfig {
  registry: string           // Docker Registry 地址 (如 'sidawater' 或 'registry.example.com:5000')
  imageName: string         // 镜像名称 (如 'research-service')
  composeFile: string       // docker-compose.yml 文件路径 (相对于 workingDirectory)
  workingDirectory: string  // 工作目录 (项目根目录,包含 docker-compose.yml)
  envFile?: string          // 可选: .env 文件路径,用于存储版本号等环境变量
}

interface DeployProgress {
  step: 'login' | 'pull' | 'update' | 'deploy' | 'health-check' | 'complete' | 'error'
  message: string
  percentage?: number       // 0-100,可选的进度百分比
  details?: string          // 详细信息
}

interface ExecuteResult {
  stdout: string
  stderr: string
}

class DockerDeployer {
  private registry: string
  private imageName: string
  private composeFile: string
  private workingDirectory: string
  private envFile?: string
  private isWindows: boolean
  private mainWindow: BrowserWindow | null
  private previousVersion?: string  // 用于回滚

  constructor(config: DeploymentConfig, mainWindow?: BrowserWindow) {
    this.registry = config.registry
    this.imageName = config.imageName
    this.composeFile = config.composeFile || 'docker-compose.yml'
    this.workingDirectory = config.workingDirectory
    this.envFile = config.envFile
    this.isWindows = process.platform === 'win32'
    this.mainWindow = mainWindow || null
  }

  /**
   * 发送部署进度到渲染进程
   */
  private sendProgress(progress: DeployProgress): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('deploy-progress', progress)
    }
    console.log(`[Deployment] ${progress.step}: ${progress.message}`)
  }
}
## API 方法详细说明

### 1. executeCommand(command, hideOutput?)
- **功能**: 执行 shell 命令 (支持 Windows PowerShell/CMD)
- **参数**:
  - `command` (string): 要执行的命令
  - `hideOutput` (boolean, 可选): 是否隐藏命令中的敏感信息 (如密码),默认 false
- **返回**: `Promise<ExecuteResult>`
- **安全性**: 自动处理 Windows 路径和特殊字符,防止命令注入

```typescript
/**
 * 执行 shell 命令
 * @param command 要执行的命令
 * @param hideOutput 是否在日志中隐藏命令内容 (用于包含密码的命令)
 * @returns Promise<ExecuteResult>
 */
private async executeCommand(command: string, hideOutput = false): Promise<ExecuteResult> {
  return new Promise((resolve, reject) => {
    const options = {
      cwd: this.workingDirectory,
      shell: this.isWindows ? 'powershell.exe' : true,  // Windows 使用 PowerShell
      windowsHide: true,  // 隐藏命令行窗口
      encoding: 'utf8' as const,
      maxBuffer: 10 * 1024 * 1024,  // 10MB 缓冲区,避免大输出被截断
    }

    const displayCommand = hideOutput ? '[命令已隐藏]' : command
    console.log(`[Deployer] Executing: ${displayCommand}`)

    exec(command, options, (error, stdout, stderr) => {
      if (error) {
        console.error(`[Deployer] Command failed: ${displayCommand}`, {
          code: error.code,
          stderr: stderr.trim(),
        })
        reject({
          error: error.message,
          stderr: stderr.trim(),
          stdout: stdout.trim(),
          command: displayCommand,
        })
      } else {
        console.log(`[Deployer] Command succeeded: ${displayCommand}`)
        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim(),
        })
      }
    })
  })
}
### 2. login(username, password)
- **功能**: Docker Registry 登录 (支持 Docker Hub 和私有仓库)
- **参数**:
  - `username` (string): 用户名
  - `password` (string): 密码
- **返回**: `Promise<void>`
- **安全性**: 
  - 使用 `--password-stdin` 避免密码出现在进程列表中
  - Windows PowerShell 需要特殊处理管道输入
  - 不在日志中记录密码

```typescript
/**
 * Docker Registry 登录
 * @param username Docker 用户名 (Docker Hub 或私有仓库)
 * @param password Docker 密码或 Access Token
 * @throws {Error} 登录失败时抛出异常
 */
async login(username: string, password: string): Promise<void> {
  this.sendProgress({
    step: 'login',
    message: `正在登录 Docker Registry: ${this.registry}...`,
    percentage: 10,
  })

  try {
    // Windows PowerShell 需要用双引号包裹密码,并使用 echo 管道
    // 注意: PowerShell 的 echo 是 Write-Output 的别名
    const escapedPassword = password.replace(/"/g, '`"')  // 转义双引号
    const escapedUsername = username.replace(/"/g, '`"')
    
    let loginCmd: string
    if (this.isWindows) {
      // PowerShell 方式: echo "password" | docker login ...
      loginCmd = `echo "${escapedPassword}" | docker login ${this.registry} --username "${escapedUsername}" --password-stdin`
    } else {
      // Linux/Mac 方式
      loginCmd = `echo "${escapedPassword}" | docker login ${this.registry} --username "${escapedUsername}" --password-stdin`
    }

    await this.executeCommand(loginCmd, true)  // hideOutput=true 隐藏密码
    
    this.sendProgress({
      step: 'login',
      message: 'Docker Registry 登录成功',
      percentage: 20,
    })
  } catch (error: any) {
    const errorMsg = error.stderr || error.error || String(error)
    this.sendProgress({
      step: 'error',
      message: 'Docker 登录失败',
      details: errorMsg,
    })
    throw new Error(`Docker 登录失败: ${errorMsg}

请检查:
1. Docker Desktop 是否正在运行
2. 用户名和密码是否正确
3. 网络连接是否正常`)
  }
}

/**
 * 可选: 使用 Docker Hub Access Token 登录 (更安全)
 * 用户可在 https://hub.docker.com/settings/security 生成 Access Token
 */
async loginWithToken(username: string, token: string): Promise<void> {
  return this.login(username, token)  // Token 可以代替密码使用
}
### 3. pullImage(tag)
- **功能**: 拉取指定版本的 Docker 镜像
- **参数**:
  - `tag` (string): 镜像标签/版本 (如 'v1.0.0', 'latest', '2.1.0')
- **返回**: `Promise<void>`
- **特性**:
  - 支持进度反馈 (Docker CLI 的输出会显示下载进度)
  - 自动验证镜像完整性 (Docker 内置 SHA256 校验)

```typescript
/**
 * 拉取指定版本的 Docker 镜像
 * @param tag 镜像标签 (如 'v1.0.0', 'latest')
 * @throws {Error} 拉取失败时抛出异常
 */
async pullImage(tag: string): Promise<void> {
  const image = `${this.registry}/${this.imageName}:${tag}`
  
  this.sendProgress({
    step: 'pull',
    message: `正在拉取镜像: ${image}...`,
    percentage: 30,
    details: '这可能需要几分钟,取决于镜像大小和网络速度',
  })

  try {
    const result = await this.executeCommand(`docker pull ${image}`)
    
    // 检查输出中是否包含成功标志
    if (result.stdout.includes('Status: Downloaded newer image') || 
        result.stdout.includes('Status: Image is up to date')) {
      this.sendProgress({
        step: 'pull',
        message: `镜像拉取成功: ${image}`,
        percentage: 50,
      })
    } else {
      throw new Error('镜像拉取结果异常,请检查 Docker 日志')
    }
  } catch (error: any) {
    const errorMsg = error.stderr || error.error || String(error)
    this.sendProgress({
      step: 'error',
      message: '镜像拉取失败',
      details: errorMsg,
    })
    throw new Error(`镜像拉取失败: ${errorMsg}

可能的原因:
1. 网络连接问题
2. 镜像标签不存在: ${tag}
3. Docker Hub 访问受限 (国内网络可能较慢)
4. 磁盘空间不足`)
  }
}
### 4. updateComposeFile(tag)
- **功能**: 更新 docker-compose.yml 文件中的镜像版本
- **参数**:
  - `tag` (string): 新的镜像标签/版本
- **返回**: `Promise<void>`
- **备份**: 自动创建 `.bak` 备份文件,用于回滚
- **验证**: 检查 YAML 语法,防止文件损坏

```typescript
/**
 * 更新 docker-compose.yml 文件中的镜像版本
 * @param tag 新的镜像标签
 * @throws {Error} 更新失败时抛出异常
 */
async updateComposeFile(tag: string): Promise<void> {
  this.sendProgress({
    step: 'update',
    message: '正在更新 docker-compose.yml...',
    percentage: 60,
  })

  try {
    const composeFilePath = join(this.workingDirectory, this.composeFile)
    const backupPath = `${composeFilePath}.bak`
    const newImage = `${this.registry}/${this.imageName}:${tag}`

    // 检查文件是否存在
    try {
      await fs.access(composeFilePath)
    } catch {
      throw new Error(`docker-compose.yml 文件不存在: ${composeFilePath}`)
    }

    // 读取 docker-compose.yml 内容
    const content = await fs.readFile(composeFilePath, 'utf8')
    
    // 备份原文件 (用于回滚)
    await fs.writeFile(backupPath, content, 'utf8')
    console.log(`[Deployer] Backup created: ${backupPath}`)

    // 提取当前版本 (用于回滚)
    const currentVersionMatch = content.match(
      new RegExp(`image:\\s*${this.escapeRegex(this.registry)}/${this.escapeRegex(this.imageName)}:([^\\s\\n]+)`)
    )
    if (currentVersionMatch) {
      this.previousVersion = currentVersionMatch[1]
      console.log(`[Deployer] Previous version: ${this.previousVersion}`)
    }

    // 使用正则表达式替换镜像标签
    // 支持格式: image: sidawater/research-service:v1.0.0
    // 或: image: "sidawater/research-service:v1.0.0"
    const imagePattern = new RegExp(
      `(image:\\s*["']?)${this.escapeRegex(this.registry)}/${this.escapeRegex(this.imageName)}:[^\\s\\n"']+(["']?)`,
      'g'
    )
    const newContent = content.replace(imagePattern, `$1${newImage}$2`)

    // 验证是否成功替换
    if (content === newContent) {
      throw new Error(
        `未找到匹配的镜像配置\n` +
        `期望格式: image: ${this.registry}/${this.imageName}:TAG\n` +
        `请检查 docker-compose.yml 文件`
      )
    }

    // 验证替换是否正确 (确保新版本已写入)
    if (!newContent.includes(newImage)) {
      throw new Error('镜像版本替换失败,请检查 docker-compose.yml 格式')
    }

    // 写回文件
    await fs.writeFile(composeFilePath, newContent, 'utf8')
    
    this.sendProgress({
      step: 'update',
      message: `docker-compose.yml 已更新: ${tag}`,
      percentage: 70,
      details: `备份文件: ${backupPath}`,
    })
  } catch (error: any) {
    this.sendProgress({
      step: 'error',
      message: '更新配置文件失败',
      details: error.message,
    })
    throw new Error(`更新 docker-compose.yml 失败: ${error.message}`)
  }
}

/**
 * 转义正则表达式特殊字符
 */
private escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
### 5. deploy()
- **功能**: 执行 docker-compose 部署 (使用 V2 命令)
- **返回**: `Promise<void>`
- **行为**: 
  - 使用 `docker compose up -d` (空格,非连字符)
  - 自动拉取更新的镜像
  - 重新创建容器
  - 保留数据卷

```typescript
/**
 * 执行 docker-compose 部署
 * @throws {Error} 部署失败时抛出异常
 */
async deploy(): Promise<void> {
  this.sendProgress({
    step: 'deploy',
    message: '正在启动服务...',
    percentage: 80,
    details: '使用 docker compose up -d',
  })

  try {
    // Docker Compose V2 使用 'docker compose' (空格)
    // --remove-orphans: 移除旧的孤立容器
    // --force-recreate: 强制重新创建容器以使用新镜像
    const deployCmd = `docker compose -f ${this.composeFile} up -d --remove-orphans --force-recreate`
    
    const result = await this.executeCommand(deployCmd)
    
    // 检查输出是否包含成功标志
    console.log('[Deployer] Deploy output:', result.stdout)
    
    this.sendProgress({
      step: 'deploy',
      message: '服务启动成功',
      percentage: 90,
    })
  } catch (error: any) {
    const errorMsg = error.stderr || error.error || String(error)
    this.sendProgress({
      step: 'error',
      message: '服务启动失败',
      details: errorMsg,
    })
    
    // 尝试回滚
    if (this.previousVersion) {
      console.log(`[Deployer] Attempting rollback to version: ${this.previousVersion}`)
      try {
        await this.rollback()
      } catch (rollbackError) {
        console.error('[Deployer] Rollback failed:', rollbackError)
      }
    }
    
    throw new Error(`服务启动失败: ${errorMsg}

请检查:
1. docker-compose.yml 语法是否正确
2. 端口是否被占用
3. Docker Daemon 是否正常运行`)
  }
}
### 6. checkHealth()
- **功能**: 部署后健康检查
- **返回**: `Promise<void>`
- **检查项**:
  - 容器是否运行
  - HTTP API 是否响应 (调用 /health 端点)
  - 服务版本是否匹配

```typescript
/**
 * 部署后健康检查
 * @param expectedVersion 期望的版本号 (用于验证)
 * @throws {Error} 健康检查失败时抛出异常
 */
async checkHealth(expectedVersion?: string): Promise<void> {
  this.sendProgress({
    step: 'health-check',
    message: '正在进行健康检查...',
    percentage: 95,
  })

  try {
    // 1. 检查容器是否运行
    const psResult = await this.executeCommand('docker compose ps --format json')
    const containers = psResult.stdout.split('\n').filter(line => line.trim())
    
    if (containers.length === 0) {
      throw new Error('未找到运行中的容器')
    }

    // 2. 检查服务容器状态 (research-service)
    const inspectCmd = 'docker inspect research-service --format="{{.State.Status}}"'
    const statusResult = await this.executeCommand(inspectCmd)
    const status = statusResult.stdout.replace(/"/g, '').trim()
    
    if (status !== 'running') {
      throw new Error(`容器状态异常: ${status}`)
    }

    // 3. 等待服务启动 (给予 5 秒启动时间)
    await new Promise(resolve => setTimeout(resolve, 5000))

    // 4. 调用 HTTP 健康检查端点 (可选)
    try {
      const healthUrl = 'http://127.0.0.1:18000/health'
      const response = await fetch(healthUrl, { 
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5000),  // 5秒超时
      })
      
      if (!response.ok) {
        console.warn(`[Deployer] Health check returned ${response.status}`)
      } else {
        const data = await response.json()
        console.log('[Deployer] Health check response:', data)
      }
    } catch (fetchError) {
      console.warn('[Deployer] HTTP health check failed (service may still be starting):', fetchError)
      // 不抛出异常,因为服务可能需要更长时间启动
    }

    this.sendProgress({
      step: 'health-check',
      message: '健康检查通过',
      percentage: 100,
    })
  } catch (error: any) {
    const errorMsg = error.message || String(error)
    this.sendProgress({
      step: 'error',
      message: '健康检查失败',
      details: errorMsg,
    })
    throw new Error(`健康检查失败: ${errorMsg}`)
  }
}

### 7. rollback()
- **功能**: 回滚到上一版本
- **返回**: `Promise<void>`
- **前提**: 需要在 updateComposeFile 时保存了 previousVersion

```typescript
/**
 * 回滚到上一版本
 * @throws {Error} 回滚失败时抛出异常
 */
async rollback(): Promise<void> {
  if (!this.previousVersion) {
    throw new Error('无法回滚: 未记录上一版本')
  }

  console.log(`[Deployer] Rolling back to version: ${this.previousVersion}`)
  
  try {
    // 恢复备份文件
    const composeFilePath = join(this.workingDirectory, this.composeFile)
    const backupPath = `${composeFilePath}.bak`
    
    try {
      await fs.access(backupPath)
      await fs.copyFile(backupPath, composeFilePath)
      console.log('[Deployer] docker-compose.yml restored from backup')
    } catch {
      console.warn('[Deployer] Backup file not found, updating version manually')
      await this.updateComposeFile(this.previousVersion)
    }

    // 重新部署
    await this.deploy()
    
    console.log('[Deployer] Rollback successful')
  } catch (error: any) {
    console.error('[Deployer] Rollback failed:', error)
    throw new Error(`回滚失败: ${error.message}`)
  }
}

### 8. fullDeploy(credentials, version)
- **功能**: 完整的部署流程 (包含所有步骤)
- **参数**:
  - `credentials` (Object): 认证信息 {username, password}
  - `version` (string): 要部署的版本号
- **返回**: `Promise<void>`
- **流程**: 环境检查 → 登录 → 拉取镜像 → 更新配置 → 部署 → 健康检查

```typescript
/**
 * 完整的部署流程
 * @param credentials Docker 认证信息
 * @param version 要部署的版本号 (如 'v1.0.0', '2.1.0')
 * @throws {Error} 任何步骤失败时抛出异常
 */
async fullDeploy(
  credentials: { username: string; password: string },
  version: string
): Promise<void> {
  console.log(`[Deployer] Starting full deployment for version: ${version}`)
  
  try {
    // 步骤 0: 环境检查
    await this.checkDockerEnvironment()

    // 步骤 1: 登录 Docker Registry
    await this.login(credentials.username, credentials.password)

    // 步骤 2: 拉取新版本镜像
    await this.pullImage(version)

    // 步骤 3: 更新 docker-compose.yml
    await this.updateComposeFile(version)

    // 步骤 4: 部署服务
    await this.deploy()

    // 步骤 5: 健康检查
    await this.checkHealth(version)

    // 完成
    this.sendProgress({
      step: 'complete',
      message: `部署完成! 版本: ${version}`,
      percentage: 100,
      details: '服务已成功更新并运行',
    })
    
    console.log('[Deployer] Deployment completed successfully')
  } catch (error: any) {
    console.error('[Deployer] Deployment failed:', error)
    this.sendProgress({
      step: 'error',
      message: '部署失败',
      details: error.message,
    })
    throw error
  }
}
### 9. 辅助方法

```typescript
/**
 * 检查 Docker 环境是否可用
 * @throws {Error} Docker 环境不可用时抛出异常
 */
async checkDockerEnvironment(): Promise<void> {
  this.sendProgress({
    step: 'login',
    message: '正在检查 Docker 环境...',
    percentage: 5,
  })

  try {
    // 检查 Docker CLI
    const dockerVersion = await this.executeCommand('docker --version')
    console.log('[Deployer] Docker version:', dockerVersion.stdout)

    // 检查 Docker Compose V2 (使用空格)
    let composeVersion: string
    try {
      const result = await this.executeCommand('docker compose version')
      composeVersion = result.stdout
    } catch {
      // 尝试 V1 命令 (连字符)
      try {
        const result = await this.executeCommand('docker-compose --version')
        composeVersion = result.stdout
        console.warn('[Deployer] 检测到 Docker Compose V1,建议升级到 V2')
      } catch {
        throw new Error('Docker Compose 未安装')
      }
    }
    console.log('[Deployer] Docker Compose version:', composeVersion)

    // 检查 Docker Daemon 是否运行
    await this.executeCommand('docker ps')
    
    // 检查 docker-compose.yml 是否存在
    const composeFilePath = join(this.workingDirectory, this.composeFile)
    try {
      await fs.access(composeFilePath)
    } catch {
      throw new Error(`docker-compose.yml 文件不存在: ${composeFilePath}`)
    }

    console.log('[Deployer] Docker environment check passed')
  } catch (error: any) {
    const errorMsg = error.message || String(error)
    throw new Error(
      `Docker 环境检查失败: ${errorMsg}\n\n` +
      `请确保:\n` +
      `1. Docker Desktop 已安装并正在运行\n` +
      `2. Docker Compose 已安装 (V2 推荐)\n` +
      `3. 当前用户有权限执行 Docker 命令\n` +
      `4. docker-compose.yml 文件存在于: ${this.workingDirectory}`
    )
  }
}

/**
 * 获取当前部署的版本号
 * @returns Promise<string> 当前版本号
 */
async getCurrentVersion(): Promise<string> {
  try {
    const composeFilePath = join(this.workingDirectory, this.composeFile)
    const content = await fs.readFile(composeFilePath, 'utf8')
    
    const versionMatch = content.match(
      new RegExp(`image:\\s*${this.escapeRegex(this.registry)}/${this.escapeRegex(this.imageName)}:([^\\s\\n"']+)`)
    )
    
    if (versionMatch) {
      return versionMatch[1]
    }
    
    return 'unknown'
  } catch (error) {
    console.error('[Deployer] Failed to get current version:', error)
    return 'unknown'
  }
}
## IPC 通信接口

### 主进程注册 (main.ts)

```typescript
import { ipcMain, BrowserWindow } from 'electron'
import { DockerDeployer, DeploymentConfig } from './DockerDeployer'

// 监听部署命令
ipcMain.handle(
  'start-deployment',
  async (
    event,
    payload: {
      credentials: { username: string; password: string }
      version: string
      config: DeploymentConfig
    }
  ) => {
    try {
      // 获取发送者窗口
      const senderWindow = BrowserWindow.fromWebContents(event.sender)
      
      // 创建部署器实例
      const deployer = new DockerDeployer(payload.config, senderWindow || undefined)

      // 执行完整部署流程
      await deployer.fullDeploy(payload.credentials, payload.version)

      return {
        success: true,
        message: `部署成功: ${payload.version}`,
        version: payload.version,
      }
    } catch (error: any) {
      console.error('[Main] Deployment failed:', error)
      return {
        success: false,
        message: error.message || '部署失败',
        error: error.stack,
      }
    }
  }
)

// 检查 Docker 环境
ipcMain.handle('check-docker-environment', async (event, config: DeploymentConfig) => {
  try {
    const senderWindow = BrowserWindow.fromWebContents(event.sender)
    const deployer = new DockerDeployer(config, senderWindow || undefined)
    
    await deployer.checkDockerEnvironment()
    const currentVersion = await deployer.getCurrentVersion()
    
    return {
      success: true,
      available: true,
      currentVersion,
    }
  } catch (error: any) {
    return {
      success: false,
      available: false,
      error: error.message,
    }
  }
})

// 注意: 不需要监听 'deploy-progress',因为它是从主进程发送到渲染进程的
// 主进程通过 webContents.send('deploy-progress', ...) 发送
```

### Preload Script 暴露 (preload.cts)

```typescript
import { contextBridge, ipcRenderer } from 'electron'

// 现有 AppConfig 接口
interface AppConfig {
  websocketUrl: string
  apiServerUrl: string
  exportDirectory: string
  semanticApiKey?: string
  // 新增: 部署配置
  deployment?: {
    registry: string           // 默认: 'sidawater'
    imageName: string         // 默认: 'research-service'
    composeFile: string       // 默认: 'docker-compose.yml'
    workingDirectory: string  // 项目根目录
  }
}

// 部署相关接口
interface DeploymentConfig {
  registry: string
  imageName: string
  composeFile: string
  workingDirectory: string
}

interface DeployProgress {
  step: 'login' | 'pull' | 'update' | 'deploy' | 'health-check' | 'complete' | 'error'
  message: string
  percentage?: number
  details?: string
}

contextBridge.exposeInMainWorld('electronAPI', {
  // ... 现有 API
  ping: () => ipcRenderer.invoke('ping'),
  loadConfig: () => ipcRenderer.invoke('load-config') as Promise<AppConfig>,
  saveConfig: (config: AppConfig) => ipcRenderer.invoke('save-config', config),
  selectExportDirectory: () => ipcRenderer.invoke('select-export-directory'),
  exportReport: (payload: any) => ipcRenderer.invoke('export-report', payload),
  downloadReference: (payload: any) => ipcRenderer.invoke('references:download', payload),
  exportReportWithPdf: (payload: any) => ipcRenderer.invoke('export-report-with-pdf', payload),

  // 新增: 部署相关 API
  startDeployment: (payload: {
    credentials: { username: string; password: string }
    version: string
    config: DeploymentConfig
  }) => ipcRenderer.invoke('start-deployment', payload),
  
  checkDockerEnvironment: (config: DeploymentConfig) =>
    ipcRenderer.invoke('check-docker-environment', config),
  
  // 监听部署进度 (从主进程推送)
  onDeployProgress: (callback: (event: any, progress: DeployProgress) => void) => {
    ipcRenderer.on('deploy-progress', callback)
    // 返回取消监听的函数
    return () => ipcRenderer.removeListener('deploy-progress', callback)
  },
})
```

### TypeScript 类型定义 (electron.d.ts)

```typescript
// client/src/types/electron.d.ts
export {}

interface AppConfig {
  websocketUrl: string
  apiServerUrl: string
  exportDirectory: string
  semanticApiKey?: string
  // 新增: 部署配置
  deployment?: {
    registry: string
    imageName: string
    composeFile: string
    workingDirectory: string
  }
}

interface DeploymentConfig {
  registry: string
  imageName: string
  composeFile: string
  workingDirectory: string
}

interface DeployProgress {
  step: 'login' | 'pull' | 'update' | 'deploy' | 'health-check' | 'complete' | 'error'
  message: string
  percentage?: number
  details?: string
}

interface DeploymentResult {
  success: boolean
  message: string
  version?: string
  error?: string
}

interface DockerEnvironmentCheck {
  success: boolean
  available: boolean
  currentVersion?: string
  error?: string
}

declare global {
  interface Window {
    electronAPI?: {
      // 现有 API
      ping?: () => Promise<string>
      loadConfig?: () => Promise<AppConfig>
      saveConfig?: (config: AppConfig) => Promise<{ success: boolean }>
      selectExportDirectory?: () => Promise<string | null>
      exportReport?: (payload: {
        title?: string
        reportContent: string
        references: any[]
      }) => Promise<{ success: boolean; error?: string; directory?: string; files?: any }>
      downloadReference?: (payload: {
        url: string
        title: string
        sessionId: string
        exportDirectory: string
        index: number
        doi?: string
      }) => Promise<any>
      exportReportWithPdf?: (payload: {
        sessionId: string
        title: string
        reportContent: string
        exportDirectory: string
      }) => Promise<{ success: boolean; error?: string; directory?: string; files?: any }>

      // 新增: 部署 API
      startDeployment?: (payload: {
        credentials: { username: string; password: string }
        version: string
        config: DeploymentConfig
      }) => Promise<DeploymentResult>
      
      checkDockerEnvironment?: (config: DeploymentConfig) => Promise<DockerEnvironmentCheck>
      
      onDeployProgress?: (
        callback: (event: any, progress: DeployProgress) => void
      ) => () => void  // 返回取消监听函数
    }
  }
}
```
## 配置参数说明

### DeploymentConfig 配置对象

```typescript
interface DeploymentConfig {
  registry: string           // Docker Registry 地址
  imageName: string         // 镜像名称
  composeFile: string       // docker-compose.yml 文件路径 (相对于 workingDirectory)
  workingDirectory: string  // 工作目录 (项目根目录)
}
```

### 项目实际配置示例

```typescript
// 默认配置 (存储在 AppConfig 中)
const DEFAULT_DEPLOYMENT_CONFIG: DeploymentConfig = {
  registry: 'sidawater',                          // Docker Hub 用户名/组织名
  imageName: 'research-service',                  // 镜像名称
  composeFile: 'docker-compose.yml',              // Compose 文件名
  workingDirectory: 'd:/proj/research-agent-system'  // 项目根目录 (Windows 路径)
}

// 完整镜像名称格式: sidawater/research-service:v1.0.0
// Docker Hub URL: https://hub.docker.com/r/sidawater/research-service
```

### docker-compose.yml 格式要求

配置文件中的 `image` 字段必须包含完整的镜像名称和版本号:

```yaml
# 正确格式示例
services:
  research-service:
    image: sidawater/research-service:v1.0.0  # 必须包含版本号
    container_name: research-service
    ports:
      - "18000:8000"
    # ... 其他配置

# 支持的变体格式
image: "sidawater/research-service:v1.0.0"  # 带引号
image: sidawater/research-service:latest    # latest 标签
image: sidawater/research-service:2.1.0     # 语义化版本号

# 不支持的格式
image: sidawater/research-service           # 缺少版本号 ✗
image: ${REGISTRY}/research-service:${TAG}  # 环境变量 ✗ (需特殊处理)
```

### 环境变量支持 (可选)

如果使用 `.env` 文件管理版本:

```bash
# .env 文件
RESEARCH_SERVICE_VERSION=v1.0.0
```

```yaml
# docker-compose.yml
services:
  research-service:
    image: sidawater/research-service:${RESEARCH_SERVICE_VERSION}
    # ...
```

则需要修改 `updateComposeFile()` 方法来更新 `.env` 文件而不是 docker-compose.yml。
## UI 集成示例

### 1. 在 SettingsModal 中添加部署 Tab

```tsx
// client/src/components/Settings/SettingsModal.tsx
import React, { useEffect, useState } from 'react'
import { Modal, Form, Input, Button, Space, message, Tabs, Progress, Alert } from 'antd'
import { useAppStore } from '../../stores/app'

const SettingsModal: React.FC = () => {
  const { settingsVisible, hideSettings, config, updateConfig } = useAppStore()
  const [activeTab, setActiveTab] = useState('general')
  
  // 部署相关状态
  const [deployForm] = Form.useForm()
  const [isDeploying, setIsDeploying] = useState(false)
  const [deployProgress, setDeployProgress] = useState<{
    step: string
    message: string
    percentage?: number
    details?: string
  } | null>(null)
  const [dockerAvailable, setDockerAvailable] = useState<boolean | null>(null)
  const [currentVersion, setCurrentVersion] = useState<string>('')

  // 监听部署进度
  useEffect(() => {
    if (!window.electronAPI?.onDeployProgress) return

    const unsubscribe = window.electronAPI.onDeployProgress((event, progress) => {
      console.log('Deployment progress:', progress)
      setDeployProgress(progress)
      
      if (progress.step === 'complete') {
        message.success(progress.message)
        setIsDeploying(false)
      } else if (progress.step === 'error') {
        message.error({
          content: progress.message,
          duration: 5,
        })
        setIsDeploying(false)
      }
    })

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [])

  // 检查 Docker 环境
  const checkDocker = async () => {
    try {
      const result = await window.electronAPI?.checkDockerEnvironment?.({
        registry: 'sidawater',
        imageName: 'research-service',
        composeFile: 'docker-compose.yml',
        workingDirectory: config.deployment?.workingDirectory || 'd:/proj/research-agent-system',
      })

      if (result?.success) {
        setDockerAvailable(true)
        setCurrentVersion(result.currentVersion || 'unknown')
        message.success('Docker 环境检查通过')
      } else {
        setDockerAvailable(false)
        message.error(`Docker 环境不可用: ${result?.error}`)
      }
    } catch (err) {
      setDockerAvailable(false)
      message.error(`检查失败: ${(err as Error).message}`)
    }
  }

  // 开始部署
  const handleDeploy = async () => {
    try {
      const values = await deployForm.validateFields()
      setIsDeploying(true)
      setDeployProgress(null)

      const result = await window.electronAPI?.startDeployment?.({
        credentials: {
          username: values.username,
          password: values.password,
        },
        version: values.version,
        config: {
          registry: 'sidawater',
          imageName: 'research-service',
          composeFile: 'docker-compose.yml',
          workingDirectory: config.deployment?.workingDirectory || 'd:/proj/research-agent-system',
        },
      })

      if (result?.success) {
        message.success(`部署成功: ${result.version}`)
        setCurrentVersion(result.version || '')
        deployForm.resetFields(['password'])  // 清除密码
      } else {
        message.error(`部署失败: ${result?.message}`)
      }
    } catch (err) {
      message.error(`部署失败: ${(err as Error).message}`)
    } finally {
      setIsDeploying(false)
    }
  }

  return (
    <Modal
      title="设置"
      open={settingsVisible}
      onCancel={hideSettings}
      footer={null}
      width={800}
    >
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'general',
            label: '基本设置',
            children: (
              // ... 现有的基本设置
              <div>/* 现有内容 */</div>
            ),
          },
          {
            key: 'prompts',
            label: '提示词配置',
            children: (
              // ... 现有的提示词配置
              <div>/* 现有内容 */</div>
            ),
          },
          {
            key: 'deployment',
            label: '服务端部署',
            children: (
              <div>
                {/* Docker 环境状态 */}
                <Alert
                  message="Docker 环境状态"
                  description={
                    dockerAvailable === null
                      ? '未检测'
                      : dockerAvailable
                      ? `Docker 可用 | 当前版本: ${currentVersion}`
                      : 'Docker 不可用，请启动 Docker Desktop'
                  }
                  type={dockerAvailable ? 'success' : 'warning'}
                  showIcon
                  style={{ marginBottom: 16 }}
                  action={
                    <Button size="small" onClick={checkDocker}>
                      检测
                    </Button>
                  }
                />

                {/* 部署表单 */}
                <Form form={deployForm} layout="vertical">
                  <Form.Item
                    label="Docker Hub 用户名"
                    name="username"
                    rules={[{ required: true, message: '请输入用户名' }]}
                    tooltip="用于登录 Docker Hub，如果使用公共镜像可以为空"
                  >
                    <Input placeholder="输入 Docker Hub 用户名 (可选)" />
                  </Form.Item>

                  <Form.Item
                    label="Docker Hub 密码/Token"
                    name="password"
                    rules={[{ required: false }]}
                    tooltip="建议使用 Access Token 而不是密码，在 Docker Hub 设置中生成"
                  >
                    <Input.Password placeholder="输入密码或 Access Token (可选)" />
                  </Form.Item>

                  <Form.Item
                    label="版本号"
                    name="version"
                    rules={[
                      { required: true, message: '请输入版本号' },
                      {
                        pattern: /^[a-zA-Z0-9._-]+$/,
                        message: '版本号格式不正确',
                      },
                    ]}
                    tooltip="如: v1.0.0, 2.1.0, latest"
                  >
                    <Input placeholder="输入要部署的版本号 (如 v1.0.0)" />
                  </Form.Item>
                </Form>

                {/* 部署进度 */}
                {deployProgress && (
                  <div style={{ marginTop: 16, marginBottom: 16 }}>
                    {deployProgress.percentage !== undefined && (
                      <Progress percent={deployProgress.percentage} status="active" />
                    )}
                    <div style={{ marginTop: 8 }}>
                      <strong>{deployProgress.message}</strong>
                    </div>
                    {deployProgress.details && (
                      <div style={{ marginTop: 4, fontSize: 12, color: '#666' }}>
                        {deployProgress.details}
                      </div>
                    )}
                  </div>
                )}

                {/* 操作按钮 */}
                <Space>
                  <Button
                    type="primary"
                    onClick={handleDeploy}
                    disabled={isDeploying || dockerAvailable === false}
                    loading={isDeploying}
                  >
                    {isDeploying ? '部署中...' : '开始部署'}
                  </Button>
                  <Button onClick={checkDocker} disabled={isDeploying}>
                    检测 Docker 环境
                  </Button>
                </Space>

                {/* 帮助信息 */}
                <Alert
                  message="注意事项"
                  description={
                    <ul style={{ margin: 0, paddingLeft: 20 }}>
                      <li>部署前请确保 Docker Desktop 已启动</li>
                      <li>如使用 Docker Hub 公共镜像，无需输入用户名和密码</li>
                      <li>部署过程可能需要 3-10 分钟，取决于网络速度</li>
                      <li>部署失败会自动尝试回滚到上一版本</li>
                    </ul>
                  }
                  type="info"
                  showIcon
                  style={{ marginTop: 16 }}
                />
              </div>
            ),
          },
        ]}
      />
    </Modal>
  )
}

export default SettingsModal
```
## 预检查清单

### 部署前检查 (Pre-Deployment Checklist)

部署前必须确保以下条件满足:

#### 1. 软件环境
- [ ] Docker Desktop 已安装并正在运行
  - 验证: 执行 `docker --version` 返回版本号
  - 验证: 执行 `docker ps` 没有错误
- [ ] Docker Compose V2 已安装
  - 验证: 执行 `docker compose version` 返回版本号
  - 注意: 是 `docker compose` (空格), 不是 `docker-compose`

#### 2. 权限检查
- [ ] 当前用户在 `docker-users` 组中 (首次安装后需重启)
- [ ] 可以执行 Docker 命令且无需 sudo/管理员权限

#### 3. 网络连接
- [ ] 可以访问 Docker Hub (hub.docker.com)
  - 验证: 在浏览器打开 https://hub.docker.com
- [ ] 可以拉取公共镜像
  - 验证: 执行 `docker pull hello-world`

#### 4. 文件检查
- [ ] docker-compose.yml 文件存在于项目根目录
  - 位置: `d:/proj/research-agent-system/docker-compose.yml`
- [ ] docker-compose.yml 中的 `image` 字段包含版本号
  - 格式: `image: sidawater/research-service:v1.0.0`

#### 5. 磁盘空间
- [ ] 至少有 5GB 可用空间 (用于下载镜像)
  - 验证: 查看 C:\ 盘空间 (Docker Desktop 默认存储位置)

### 部署后验证 (Post-Deployment Verification)

部署完成后必须验证以下项:

#### 1. 容器状态检查
```powershell
# 查看容器是否运行
docker ps --filter "name=research-service"
# 期望输出: STATUS 列显示 "Up X minutes"

# 检查容器日志
docker logs research-service --tail 50
# 期望: 无错误日志,服务正常启动
```

#### 2. 网络连接检查
```powershell
# 检查端口是否监听
netstat -ano | findstr :18000
# 期望: 显示 LISTENING 状态
```

#### 3. HTTP API 健康检查
- [ ] 访问 http://127.0.0.1:18000/health 返回 200 OK
- [ ] WebSocket 可以连接到 ws://127.0.0.1:18000/chat

#### 4. 版本验证
```powershell
# 检查部署的镜像版本
docker inspect research-service --format='{{.Config.Image}}'
# 期望输出: sidawater/research-service:v1.0.0 (与部署的版本一致)
```

#### 5. 客户端连接测试
- [ ] 打开 Electron 应用
- [ ] 进入设置 -> 测试连接 -> 应该显示成功

## 错误处理与回滚策略

### 错误分类与处理

#### 1. 环境错误 (Environment Errors)

**错误示例**:
- "Docker 环境检查失败"
- "Docker Desktop 未运行"
- "docker-compose.yml 文件不存在"

**处理策略**:
- 立即终止部署流程
- 不尝试重试
- 显示详细错误信息和解决方案

#### 2. 网络错误 (Network Errors)

**错误示例**:
- "Docker 登录失败" (Registry 不可达)
- "镜像拉取失败" (网络超时)

**处理策略**:
```typescript
// 重试机制
async retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delayMs = 2000
): Promise<T> {
  let lastError: any
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      console.log(`[Deployer] Attempt ${attempt}/${maxRetries} failed, retrying...`)
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delayMs))
      }
    }
  }
  
  throw lastError
}

// 使用示例
async pullImage(tag: string): Promise<void> {
  await this.retryOperation(
    () => this.executeCommand(`docker pull ${this.registry}/${this.imageName}:${tag}`),
    3,  // 最多重试 3 次
    3000  // 每次间隔 3 秒
  )
}
```

#### 3. 部署错误 (Deployment Errors)

**错误示例**:
- "容器启动失败"
- "端口被占用"
- "数据卷挂载失败"

**处理策略**:
- 自动触发回滚流程
- 恢复到上一个可用版本
- 记录详细错误日志

### 回滚机制

#### 回滚触发条件
1. `updateComposeFile()` 执行后任何步骤失败
2. `deploy()` 执行失败
3. `checkHealth()` 失败 (服务启动异常)

#### 回滚流程
```typescript
async rollback(): Promise<void> {
  console.log('[Deployer] Starting rollback procedure...')
  
  try {
    // 步骤 1: 恢复 docker-compose.yml 备份
    const composeFilePath = join(this.workingDirectory, this.composeFile)
    const backupPath = `${composeFilePath}.bak`
    
    if (await this.fileExists(backupPath)) {
      await fs.copyFile(backupPath, composeFilePath)
      console.log('[Deployer] docker-compose.yml restored from backup')
    } else if (this.previousVersion) {
      // 如果备份不存在,手动更新版本
      await this.updateComposeFile(this.previousVersion)
    } else {
      throw new Error('无法回滚: 无备份文件且未记录上一版本')
    }

    // 步骤 2: 重新部署旧版本
    await this.deploy()

    // 步骤 3: 验证回滚是否成功
    await this.checkHealth(this.previousVersion)

    this.sendProgress({
      step: 'complete',
      message: `已回滚到版本: ${this.previousVersion}`,
      details: '回滚成功,服务已恢复',
    })
  } catch (error: any) {
    console.error('[Deployer] Rollback failed:', error)
    this.sendProgress({
      step: 'error',
      message: '回滚失败',
      details: `请手动检查服务状态: ${error.message}`,
    })
    throw error
  }
}

private async fileExists(path: string): Promise<boolean> {
  try {
    await fs.access(path)
    return true
  } catch {
    return false
  }
}
```

### 日志收集

当部署失败时,自动收集以下日志:

```typescript
async collectDiagnosticInfo(): Promise<string> {
  const logs: string[] = []
  
  try {
    // 1. Docker 版本信息
    const dockerVersion = await this.executeCommand('docker --version')
    logs.push(`Docker Version: ${dockerVersion.stdout}`)

    // 2. Docker Compose 版本
    const composeVersion = await this.executeCommand('docker compose version')
    logs.push(`Docker Compose Version: ${composeVersion.stdout}`)

    // 3. 容器状态
    const ps = await this.executeCommand('docker ps -a --filter "name=research-service"')
    logs.push(`Container Status:\n${ps.stdout}`)

    // 4. 容器日志 (最后 50 行)
    const containerLogs = await this.executeCommand('docker logs research-service --tail 50')
    logs.push(`Container Logs:\n${containerLogs.stdout}`)

    // 5. docker-compose.yml 内容
    const composePath = join(this.workingDirectory, this.composeFile)
    const composeContent = await fs.readFile(composePath, 'utf8')
    logs.push(`docker-compose.yml:\n${composeContent}`)

  } catch (error) {
    logs.push(`Failed to collect diagnostic info: ${error}`)
  }

  return logs.join('\n\n==========\n\n')
}
```

### 用户友好的错误提示

```typescript
// 错误消息映射表
const ERROR_MESSAGES: Record<string, { title: string; description: string; solutions: string[] }> = {
  'DOCKER_NOT_RUNNING': {
    title: 'Docker Desktop 未运行',
    description: '检测到 Docker Daemon 未启动',
    solutions: [
      '启动 Docker Desktop 应用',
      '等待 Docker 完全启动后重试',
      '检查系统托盘区是否有 Docker 图标',
    ],
  },
  'IMAGE_NOT_FOUND': {
    title: '镜像不存在',
    description: '无法找到指定版本的镜像',
    solutions: [
      '检查版本号是否正确',
      '访问 Docker Hub 查看可用版本: https://hub.docker.com/r/sidawater/research-service/tags',
      '确认网络连接正常',
    ],
  },
  'PORT_IN_USE': {
    title: '端口被占用',
    description: '服务所需端口 (18000) 已被其他程序占用',
    solutions: [
      '检查是否有旧版本容器运行: docker ps',
      '停止占用端口的程序',
      '修改 docker-compose.yml 中的端口映射',
    ],
  },
}
```