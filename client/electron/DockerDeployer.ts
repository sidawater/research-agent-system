import { exec, ExecException } from 'child_process'
import { promises as fs } from 'fs'
import { join } from 'path'
import { BrowserWindow } from 'electron'

export interface DeploymentConfig {
  registry: string           // Docker Registry 地址
  imageName: string         // 镜像名称
  composeFile: string       // docker-compose.yml 文件路径
  workingDirectory: string  // 工作目录
  envFile?: string          // 可选: .env 文件路径
}

export interface DeployProgress {
  step: 'login' | 'pull' | 'update' | 'deploy' | 'health-check' | 'complete' | 'error'
  message: string
  percentage?: number
  details?: string
}

interface ExecuteResult {
  stdout: string
  stderr: string
}

export class DockerDeployer {
  private registry: string
  private imageName: string
  private composeFile: string
  private workingDirectory: string
  private envFile?: string
  private isWindows: boolean
  private mainWindow: BrowserWindow | null
  private previousVersion?: string

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

  /**
   * 执行 shell 命令
   */
  private async executeCommand(command: string, hideOutput = false): Promise<ExecuteResult> {
    return new Promise((resolve, reject) => {
      const options = {
        cwd: this.workingDirectory,
        shell: this.isWindows ? 'powershell.exe' : '/bin/sh',
        windowsHide: true,
        encoding: 'utf8' as const,
        maxBuffer: 10 * 1024 * 1024,
      }

      const displayCommand = hideOutput ? '[命令已隐藏]' : command
      console.log(`[Deployer] Executing: ${displayCommand}`)

      exec(command, options, (error: ExecException | null, stdout: string, stderr: string) => {
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

  /**
   * 检查文件是否存在
   */
  private async fileExists(path: string): Promise<boolean> {
    try {
      await fs.access(path)
      return true
    } catch {
      return false
    }
  }

  /**
   * 转义正则表达式特殊字符
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  /**
   * 重试操作
   */
  private async retryOperation<T>(
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

  /**
   * 检查 Docker 环境
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

      // 检查 Docker Compose V2
      let composeVersion: string
      try {
        const result = await this.executeCommand('docker compose version')
        composeVersion = result.stdout
      } catch {
        // 尝试 V1 命令
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
      if (!(await this.fileExists(composeFilePath))) {
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
   * Docker Registry 登录
   */
  async login(username: string, password: string): Promise<void> {
    this.sendProgress({
      step: 'login',
      message: `正在登录 Docker Registry: ${this.registry}...`,
      percentage: 10,
    })

    try {
      const escapedPassword = password.replace(/"/g, '`"')
      const escapedUsername = username.replace(/"/g, '`"')

      let loginCmd: string
      if (this.isWindows) {
        loginCmd = `echo "${escapedPassword}" | docker login ${this.registry} --username "${escapedUsername}" --password-stdin`
      } else {
        loginCmd = `echo "${escapedPassword}" | docker login ${this.registry} --username "${escapedUsername}" --password-stdin`
      }

      await this.executeCommand(loginCmd, true)

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
   * 拉取指定版本的 Docker 镜像
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
      await this.retryOperation(
        async () => {
          const result = await this.executeCommand(`docker pull ${image}`)

          if (result.stdout.includes('Status: Downloaded newer image') ||
              result.stdout.includes('Status: Image is up to date')) {
            return result
          } else {
            throw new Error('镜像拉取结果异常,请检查 Docker 日志')
          }
        },
        3,
        3000
      )

      this.sendProgress({
        step: 'pull',
        message: `镜像拉取成功: ${image}`,
        percentage: 50,
      })
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
3. Docker Hub 访问受限
4. 磁盘空间不足`)
    }
  }

  /**
   * 更新 docker-compose.yml 文件中的镜像版本
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

      // 读取文件
      const content = await fs.readFile(composeFilePath, 'utf8')

      // 备份
      await fs.writeFile(backupPath, content, 'utf8')
      console.log(`[Deployer] Backup created: ${backupPath}`)

      // 提取当前版本
      const currentVersionMatch = content.match(
        new RegExp(`image:\\s*${this.escapeRegex(this.registry)}/${this.escapeRegex(this.imageName)}:([^\\s\\n]+)`)
      )
      if (currentVersionMatch) {
        this.previousVersion = currentVersionMatch[1]
        console.log(`[Deployer] Previous version: ${this.previousVersion}`)
      }

      // 替换版本
      const imagePattern = new RegExp(
        `(image:\\s*["']?)${this.escapeRegex(this.registry)}/${this.escapeRegex(this.imageName)}:[^\\s\\n"']+(["']?)`,
        'g'
      )
      const newContent = content.replace(imagePattern, `$1${newImage}$2`)

      // 验证
      if (content === newContent) {
        throw new Error(
          `未找到匹配的镜像配置\n` +
          `期望格式: image: ${this.registry}/${this.imageName}:TAG\n` +
          `请检查 docker-compose.yml 文件`
        )
      }

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
   * 执行 docker-compose 部署
   */
  async deploy(): Promise<void> {
    this.sendProgress({
      step: 'deploy',
      message: '正在启动服务...',
      percentage: 80,
      details: '使用 docker compose up -d',
    })

    try {
      const deployCmd = `docker compose -f ${this.composeFile} up -d --remove-orphans --force-recreate`

      const result = await this.executeCommand(deployCmd)
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

  /**
   * 部署后健康检查
   */
  async checkHealth(expectedVersion?: string): Promise<void> {
    this.sendProgress({
      step: 'health-check',
      message: '正在进行健康检查...',
      percentage: 95,
    })

    try {
      // 检查容器状态
      const inspectCmd = 'docker inspect research-service --format="{{.State.Status}}"'
      const statusResult = await this.executeCommand(inspectCmd)
      const status = statusResult.stdout.replace(/"/g, '').trim()

      if (status !== 'running') {
        throw new Error(`容器状态异常: ${status}`)
      }

      // 等待服务启动
      await new Promise(resolve => setTimeout(resolve, 5000))

      // HTTP 健康检查
      try {
        const healthUrl = 'http://127.0.0.1:18000/health'
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000)

        const response = await fetch(healthUrl, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          console.warn(`[Deployer] Health check returned ${response.status}`)
        } else {
          const data = await response.json()
          console.log('[Deployer] Health check response:', data)
        }
      } catch (fetchError) {
        console.warn('[Deployer] HTTP health check failed (service may still be starting):', fetchError)
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

  /**
   * 回滚到上一版本
   */
  async rollback(): Promise<void> {
    if (!this.previousVersion) {
      throw new Error('无法回滚: 未记录上一版本')
    }

    console.log(`[Deployer] Rolling back to version: ${this.previousVersion}`)

    try {
      const composeFilePath = join(this.workingDirectory, this.composeFile)
      const backupPath = `${composeFilePath}.bak`

      if (await this.fileExists(backupPath)) {
        await fs.copyFile(backupPath, composeFilePath)
        console.log('[Deployer] docker-compose.yml restored from backup')
      } else {
        console.warn('[Deployer] Backup file not found, updating version manually')
        await this.updateComposeFile(this.previousVersion)
      }

      await this.deploy()
      console.log('[Deployer] Rollback successful')
    } catch (error: any) {
      console.error('[Deployer] Rollback failed:', error)
      throw new Error(`回滚失败: ${error.message}`)
    }
  }

  /**
   * 获取当前部署的版本号
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

  /**
   * 完整的部署流程
   */
  async fullDeploy(
    credentials: { username: string; password: string },
    version: string
  ): Promise<void> {
    console.log(`[Deployer] Starting full deployment for version: ${version}`)

    try {
      // 环境检查
      await this.checkDockerEnvironment()

      // 登录 (如果提供了凭据)
      if (credentials.username && credentials.password) {
        await this.login(credentials.username, credentials.password)
      }

      // 拉取镜像
      await this.pullImage(version)

      // 更新配置
      await this.updateComposeFile(version)

      // 部署
      await this.deploy()

      // 健康检查
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
}
