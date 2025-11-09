# Caddyfile 可视化编辑器

一个基于Web的Caddyfile可视化编辑器，支持通过GUI界面编辑、验证和重新加载Caddy配置。

## 功能特性

- 🎨 可视化GUI界面编辑Caddyfile
- 💾 保存和加载配置文件
- ✅ 配置验证功能
- 🔄 一键重新加载Caddy配置
- 📝 内置多种配置模板
- 🐳 支持Docker容器部署
- 🔧 支持systemd服务部署

## 快速开始

### 方式一：直接运行（开发模式）

1. 安装依赖：
```bash
pip install -r requirements.txt
```

2. 运行应用：
```bash
python app.py
```

3. 访问：http://localhost:5000

### 方式二：Docker部署

#### 快速安装（推荐）

**一行命令安装：**

```bash
# 下载安装脚本并执行（自动从GitHub下载配置文件）
curl -o install.sh https://raw.githubusercontent.com/hello--world/caddyfile-manager/main/install.sh && chmod +x install.sh && ./install.sh
```

**或者使用wget：**

```bash
wget -O install.sh https://raw.githubusercontent.com/hello--world/caddyfile-manager/main/install.sh && chmod +x install.sh && ./install.sh
```

**说明：**
- 自动从GitHub下载install.sh脚本
- 自动检测Docker和docker-compose是否安装
- 自动创建必要的目录（caddyfile、data）
- 自动从GitHub下载docker-compose.prod.yml配置文件（如果不存在）
- 可选设置AUTH_TOKEN
- 自动检测并使用 `docker-compose` 或 `docker compose` 命令
- 拉取最新镜像并启动容器
- 访问地址：http://localhost:5000

**Linux/Mac:**
```bash
chmod +x install.sh && ./install.sh
```

**Windows:**
```bash
install.bat
```

安装脚本会自动：
- 检查Docker和docker-compose是否安装
- 创建必要的目录（caddyfile、data）
- 询问是否设置AUTH_TOKEN（可选）
- 从GitHub拉取最新镜像
- 启动容器

**更新到最新版本：**
```bash
# 一行命令更新
(docker-compose -f docker-compose.prod.yml pull && docker-compose -f docker-compose.prod.yml up -d || docker compose -f docker-compose.prod.yml pull && docker compose -f docker-compose.prod.yml up -d)

# 或使用更新脚本
# Linux/Mac: ./update.sh
# Windows: update.bat
```

#### 使用 GitHub Actions 构建镜像

项目已配置 GitHub Actions 工作流，自动构建并推送 Docker 镜像到 GitHub Container Registry (ghcr.io)。

1. 推送代码到 GitHub 后，工作流会自动触发构建
2. 镜像地址：`ghcr.io/hello--world/caddyfile-manager:latest`
3. 拉取镜像：
```bash
docker pull ghcr.io/hello--world/caddyfile-manager:latest
```

#### 本地构建镜像

1. 构建镜像：
```bash
docker build -t ghcr.io/hello--world/caddyfile-manager:latest .
```

2. 运行容器（**重要：需要挂载外部 Caddyfile**）：
```bash
docker run -d \
  --name caddyfile-editor \
  -p 5000:5000 \
  -v $(pwd)/caddyfile:/etc/caddy \
  -e AUTH_TOKEN=your-secret-token \
  ghcr.io/hello--world/caddyfile-manager:latest
```

**注意**：容器名称建议使用 `caddyfile-editor`，而不是镜像名称，便于后续管理。

或者使用docker-compose（使用docker-compose.prod.yml，已配置GitHub镜像）：
```bash
# 使用生产环境配置（从GitHub拉取镜像）
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d

# 编辑 docker-compose.prod.yml，取消注释 AUTH_TOKEN 行并设置你的token
```

**注意**：
- 镜像中不包含 Caddyfile，必须通过卷挂载的方式从外部提供 Caddyfile 文件
- 设置 `AUTH_TOKEN` 环境变量可启用访问认证，首次访问时会要求输入token

#### 更新镜像

使用 `latest` 标签时，需要定期拉取最新版本并重启容器：

**使用 docker run 方式：**
```bash
# 1. 停止并删除旧容器
docker stop caddyfile-editor
docker rm caddyfile-editor

# 2. 拉取最新镜像
docker pull ghcr.io/hello--world/caddyfile-manager:latest

# 3. 重新运行容器（使用相同的参数）
docker run -d \
  --name caddyfile-editor \
  -p 5000:5000 \
  -v $(pwd)/caddyfile:/etc/caddy \
  -e AUTH_TOKEN=your-secret-token \
  ghcr.io/hello--world/caddyfile-manager:latest
```

**使用 docker-compose 方式：**
```bash
# 1. 拉取最新镜像
docker-compose pull

# 2. 重新创建并启动容器
docker-compose up -d
```

### 方式三：systemd服务部署

1. 将项目复制到系统目录：
```bash
sudo cp -r . /opt/caddyfile-manager
sudo chown -R www-data:www-data /opt/caddyfile-manager
```

2. 安装Python依赖：
```bash
sudo pip3 install -r /opt/caddyfile-manager/requirements.txt
```

3. 安装systemd服务：
```bash
sudo cp caddyfile-manager.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable caddyfile-manager
sudo systemctl start caddyfile-manager
```

4. 查看服务状态：
```bash
sudo systemctl status caddyfile-manager
```

## 配置说明

### 环境变量

- `CADDYFILE_PATH`: Caddyfile文件路径（默认：`/etc/caddy/Caddyfile`）
- `CADDY_BINARY`: Caddy可执行文件路径（默认：`caddy`）
- `PORT`: Web服务端口（默认：`5000`）
- `HOST`: Web服务监听地址（默认：`0.0.0.0`）
- `DEBUG`: 调试模式（默认：`False`）
- `AUTH_TOKEN`: 访问认证token（可选，设置后首次访问需要输入token）

### 使用说明

1. **加载配置**：点击"加载配置"按钮从文件系统读取当前Caddyfile
2. **编辑配置**：在编辑器中直接编辑配置内容
3. **保存配置**：点击"保存配置"按钮将更改保存到文件
4. **验证配置**：点击"验证配置"按钮检查配置语法是否正确
5. **重新加载**：点击"重新加载"按钮使Caddy重新加载配置（需要先保存）
6. **使用模板**：从下拉菜单中选择模板，点击"应用模板"快速生成配置

## API接口

- `GET /api/caddyfile` - 获取Caddyfile内容
- `POST /api/caddyfile` - 保存Caddyfile内容
- `POST /api/validate` - 验证Caddyfile配置
- `POST /api/reload` - 重新加载Caddy配置
- `GET /api/templates` - 获取配置模板列表

## 注意事项

1. 确保Caddy已安装并可在PATH中找到
2. 确保有权限读取和写入Caddyfile文件
3. 重新加载功能需要Caddy正在运行
4. 在生产环境中建议使用HTTPS和身份验证

## 许可证

MIT License

