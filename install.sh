#!/bin/bash
# Caddyfile Manager 安装脚本

set -e

echo "=========================================="
echo "Caddyfile Manager 安装脚本"
echo "=========================================="
echo ""

# 检查Docker是否安装
if ! command -v docker &> /dev/null; then
    echo "❌ 错误: 未找到 Docker，请先安装 Docker"
    echo "   访问 https://docs.docker.com/get-docker/ 获取安装指南"
    exit 1
fi

# 检查docker-compose是否安装
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ 错误: 未找到 docker-compose，请先安装 docker-compose"
    echo "   访问 https://docs.docker.com/compose/install/ 获取安装指南"
    exit 1
fi

# 检测docker-compose命令
if docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
else
    DOCKER_COMPOSE="docker-compose"
fi

echo "✅ Docker 和 docker-compose 已安装"
echo ""

# 创建必要的目录
echo "📁 创建必要的目录..."
mkdir -p caddyfile
mkdir -p data
echo "✅ 目录创建完成"
echo ""

# 确保 GENERAL_SETTINGS 文件存在（供 Caddyfile import 使用）
if [ ! -f "caddyfile/GENERAL_SETTINGS" ]; then
    echo "📄 创建 GENERAL_SETTINGS 文件..."
    if [ -f "GENERAL_SETTINGS" ]; then
        # 如果当前目录有 GENERAL_SETTINGS，复制到 caddyfile 目录
        cp GENERAL_SETTINGS caddyfile/GENERAL_SETTINGS
        echo "✅ 已从当前目录复制 GENERAL_SETTINGS"
    else
        # 否则创建一个默认的空文件（或从 GitHub 下载）
        cat > caddyfile/GENERAL_SETTINGS << 'EOF'
# 通用设置
# 这个文件包含所有代理通用的配置

# 编码设置（如果需要）
# encode gzip

# 通用头部设置（如果需要）
# header_up X-Real-IP {http.request.remote.host}
# header_up X-Forwarded-For {http.request.remote.host}
# header_up X-Forwarded-Proto {http.request.scheme}

# 超时设置（如果需要）
# request_body_max_size 100MB

# 日志设置（如果需要）
# log {
#     output file /var/log/caddy/access.log
#     format json
# }

# 注意：如果不需要任何通用设置，这个文件可以为空
# 但必须存在，否则 Caddy 会报错
EOF
        echo "✅ 已创建默认的 GENERAL_SETTINGS 文件"
    fi
    echo ""
fi

# 检查docker-compose.prod.yml是否存在，如果不存在则从GitHub下载
if [ ! -f "docker-compose.prod.yml" ]; then
    echo "📥 从GitHub下载docker-compose.prod.yml配置文件..."
    if command -v curl &> /dev/null; then
        curl -o docker-compose.prod.yml https://raw.githubusercontent.com/hello--world/caddyfile-manager/main/docker-compose.prod.yml
    elif command -v wget &> /dev/null; then
        wget -O docker-compose.prod.yml https://raw.githubusercontent.com/hello--world/caddyfile-manager/main/docker-compose.prod.yml
    else
        echo "❌ 错误: 未找到 curl 或 wget，无法下载配置文件"
        echo "   请手动下载 docker-compose.prod.yml 文件"
        exit 1
    fi
    
    if [ -f "docker-compose.prod.yml" ]; then
        echo "✅ 配置文件下载完成"
    else
        echo "❌ 配置文件下载失败"
        exit 1
    fi
    echo ""
else
    echo "✅ 发现已存在的 docker-compose.prod.yml 配置文件"
    echo ""
fi

# 询问是否设置AUTH_TOKEN
echo "🔐 是否设置访问认证token？(y/n)"
read -r SET_TOKEN
if [ "$SET_TOKEN" = "y" ] || [ "$SET_TOKEN" = "Y" ]; then
    echo "请输入你的 AUTH_TOKEN:"
    read -r AUTH_TOKEN
    if [ -n "$AUTH_TOKEN" ]; then
        # 更新docker-compose.prod.yml中的AUTH_TOKEN
        if grep -q "# - AUTH_TOKEN" docker-compose.prod.yml; then
            sed -i.bak "s/# - AUTH_TOKEN=your-secret-token/- AUTH_TOKEN=$AUTH_TOKEN/" docker-compose.prod.yml
            rm -f docker-compose.prod.yml.bak
            echo "✅ AUTH_TOKEN 已设置"
        fi
    fi
fi
echo ""

# 拉取最新镜像
echo "📥 拉取最新镜像..."
$DOCKER_COMPOSE -f docker-compose.prod.yml pull
echo "✅ 镜像拉取完成"
echo ""

# 启动容器
echo "🚀 启动容器..."
$DOCKER_COMPOSE -f docker-compose.prod.yml up -d
echo ""

# 检查容器状态
echo "📊 检查容器状态..."
sleep 2
if $DOCKER_COMPOSE -f docker-compose.prod.yml ps | grep -q "Up"; then
    echo "✅ 容器启动成功！"
    echo ""
    echo "=========================================="
    echo "安装完成！"
    echo "=========================================="
    echo ""
    echo "访问地址: http://localhost:5000"
    echo ""
    echo "常用命令:"
    echo "  查看日志: $DOCKER_COMPOSE -f docker-compose.prod.yml logs -f"
    echo "  停止服务: $DOCKER_COMPOSE -f docker-compose.prod.yml down"
    echo "  更新镜像: ./update.sh"
    echo ""
else
    echo "❌ 容器启动失败，请检查日志:"
    echo "   $DOCKER_COMPOSE -f docker-compose.prod.yml logs"
    exit 1
fi

