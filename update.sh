#!/bin/bash
# Caddyfile Manager 更新脚本

set -e

echo "=========================================="
echo "Caddyfile Manager 更新脚本"
echo "=========================================="
echo ""

# 检查Docker是否安装
if ! command -v docker &> /dev/null; then
    echo "❌ 错误: 未找到 Docker"
    exit 1
fi

# 检测docker-compose命令
if docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
else
    DOCKER_COMPOSE="docker-compose"
fi

# 检查docker-compose.prod.yml是否存在
if [ ! -f "docker-compose.prod.yml" ]; then
    echo "❌ 错误: 未找到 docker-compose.prod.yml 文件"
    echo "   请确保在项目根目录运行此脚本"
    exit 1
fi

# 拉取最新镜像
echo "📥 拉取最新镜像..."
$DOCKER_COMPOSE -f docker-compose.prod.yml pull
echo "✅ 镜像拉取完成"
echo ""

# 重新创建并启动容器
echo "🔄 更新容器..."
$DOCKER_COMPOSE -f docker-compose.prod.yml up -d
echo ""

# 检查容器状态
echo "📊 检查容器状态..."
sleep 2
if $DOCKER_COMPOSE -f docker-compose.prod.yml ps | grep -q "Up"; then
    echo "✅ 更新完成！容器已重新启动"
    echo ""
    echo "访问地址: http://localhost:5000"
    echo ""
else
    echo "❌ 更新失败，请检查日志:"
    echo "   $DOCKER_COMPOSE -f docker-compose.prod.yml logs"
    exit 1
fi

