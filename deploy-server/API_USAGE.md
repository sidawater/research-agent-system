# Deploy Server API - 使用示例

## 快速启动

### 1. 本地开发运行
```bash
cd deploy-server
pip install -r requirements.txt
python run.py
```

### 2. Docker Compose 运行
```bash
# 在项目根目录
docker-compose up deploy-server
```

服务将在 `http://localhost:8001` 启动

---

## API 端点

### 1. 健康检查
```bash
GET http://localhost:8001/health
```

响应示例:
```json
{
  "status": "healthy",
  "version": "1.0.0"
}
```

---

### 2. 查询 Docker 镜像版本

**端点:** `GET /api/v1/docker/versions/{image_name}`

**示例:**
```bash
curl -X GET "http://localhost:8001/api/v1/docker/versions/research-service"
```

**响应:**
```json
{
  "image": "research-service",
  "versions": [
    "v2.0.1",
    "v2.0.0",
    "v1.9.5",
    "v1.9.4",
    "v1.9.3",
    "v1.9.2",
    "v1.9.1",
    "v1.9.0",
    "v1.8.0",
    "v1.7.0"
  ],
  "total": 10
}
```

**支持命名空间:**
```bash
curl -X GET "http://localhost:8001/api/v1/docker/versions/namespace/image-name"
```

---

### 3. 查询应用包版本

**端点:** `GET /api/v1/release/versions/{app_name}`

**示例:**
```bash
curl -X GET "http://localhost:8001/api/v1/release/versions/research-client"
```

**响应:**
```json
{
  "app": "research-client",
  "versions": [
    "1.2.3",
    "1.2.2",
    "1.2.1",
    "1.2.0",
    "1.1.0",
    "1.0.9",
    "1.0.8",
    "1.0.7",
    "1.0.6",
    "1.0.5"
  ],
  "total": 10
}
```

---

### 4. 下载应用包

**端点:** `POST /api/v1/release/download`

**请求体:**
```json
{
  "app_name": "research-client",
  "version": "1.2.3",
  "platform": "win-x64"
}
```

**示例 (curl):**
```bash
curl -X POST "http://localhost:8001/api/v1/release/download" \
  -H "Content-Type: application/json" \
  -d '{
    "app_name": "research-client",
    "version": "1.2.3",
    "platform": "win-x64"
  }' \
  --output research-client-1.2.3.zip
```

**示例 (Python):**
```python
import httpx

async def download_package():
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "http://localhost:8001/api/v1/release/download",
            json={
                "app_name": "research-client",
                "version": "1.2.3",
                "platform": "win-x64"
            }
        )
        
        with open("research-client-1.2.3.zip", "wb") as f:
            f.write(response.content)
```

**Platform 参数 (可选):**
- `win-x64` - Windows 64位
- `linux-x64` - Linux 64位
- `darwin-x64` - macOS Intel
- `darwin-arm64` - macOS Apple Silicon

如果不指定 platform，将返回找到的第一个包文件。

---

## 配置文件

配置文件位于 `config/deploy-server.toml`

```toml
[server]
host = "0.0.0.0"
port = 8001
debug = false

[docker_registry]
url = "https://docker-registry.sidawater.top"
username = "your-username"
password = "your-password"
verify_ssl = false
timeout = 30

[app_release]
storage_path = "/data/releases"
max_versions = 10
```

**重要配置项:**
- `docker_registry.url`: Docker Registry 地址
- `docker_registry.username`: Registry 用户名
- `docker_registry.password`: Registry 密码
- `app_release.storage_path`: 应用包存储路径

---

## 文件存储结构

应用包应按以下结构组织:

```
/data/releases/
├── research-client/
│   ├── 1.2.3/
│   │   ├── win-x64/
│   │   │   └── research-client-1.2.3-win-x64.zip
│   │   ├── linux-x64/
│   │   │   └── research-client-1.2.3-linux-x64.tar.gz
│   │   └── darwin-arm64/
│   │       └── research-client-1.2.3-darwin-arm64.zip
│   ├── 1.2.2/
│   │   └── ...
│   └── 1.2.1/
│       └── ...
└── other-app/
    └── ...
```

---

## Swagger 文档

启动服务后访问:
- **Swagger UI:** http://localhost:8001/docs
- **ReDoc:** http://localhost:8001/redoc

---

## 错误处理

所有错误响应格式:
```json
{
  "error": "错误消息",
  "detail": "详细错误信息 (可选)"
}
```

**常见错误码:**
- `400` - 请求参数无效
- `404` - 资源未找到 (镜像/应用/版本)
- `500` - 服务器内部错误

---

## 测试

运行基础测试:
```bash
cd deploy-server
python test/test_basic.py
```

---

## Docker Registry API 说明

服务通过以下 API 查询 Docker Registry:
```
GET https://docker-registry.sidawater.top/v2/<image_name>/tags/list
Authorization: Basic <base64(username:password)>
```

响应格式:
```json
{
  "name": "image-name",
  "tags": ["v1.0.0", "v1.0.1", "latest"]
}
```
