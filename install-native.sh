#!/bin/bash
# Caddyfile Manager 一键安装脚本（非Docker版本）
# 包括：创建虚拟环境、安装依赖、配置systemd服务

set -e

echo "=========================================="
echo "Caddyfile Manager 一键安装脚本"
echo "=========================================="
echo ""

# 检查是否为root用户
if [ "$EUID" -ne 0 ]; then 
    echo "❌ 错误: 请使用root权限运行此脚本"
    echo "   使用: sudo ./install-native.sh"
    exit 1
fi

# 检查Python3是否安装
if ! command -v python3 &> /dev/null; then
    echo "❌ 错误: 未找到Python3，请先安装Python3"
    echo "   Ubuntu/Debian: sudo apt-get install python3 python3-pip python3-venv"
    echo "   CentOS/RHEL: sudo yum install python3 python3-pip"
    exit 1
fi

# 检查pip3是否安装
if ! command -v pip3 &> /dev/null; then
    echo "❌ 错误: 未找到pip3，请先安装pip3"
    exit 1
fi

echo "✅ Python3 和 pip3 已安装"
echo ""

# 检查git是否安装
GIT_AVAILABLE=false
if command -v git &> /dev/null; then
    GIT_AVAILABLE=true
    echo "✅ Git 已安装"
else
    echo "⚠️  未找到Git，将使用当前目录的文件"
fi
echo ""

# Git仓库地址
GIT_REPO="https://github.com/hello--world/caddyfile-manager.git"
GIT_BRANCH="main"

# 询问是否从Git克隆代码
USE_GIT=false
if [ "$GIT_AVAILABLE" = true ]; then
    echo "📥 是否从Git仓库克隆最新代码？(y/n)"
    echo "   如果选择 'n'，将使用当前目录的文件"
    read -r USE_GIT_INPUT
    if [ "$USE_GIT_INPUT" = "y" ] || [ "$USE_GIT_INPUT" = "Y" ]; then
        USE_GIT=true
    fi
fi
echo ""

# 检查Caddy是否安装（可选，但建议安装以便使用reload功能）
if ! command -v caddy &> /dev/null; then
    echo "⚠️  警告: 未找到Caddy，reload功能将不可用"
    echo "   建议安装Caddy以使用配置重载功能"
    echo "   安装方法: https://caddyserver.com/docs/install"
    echo ""
    read -p "是否继续安装？(y/n): " CONTINUE_WITHOUT_CADDY
    if [ "$CONTINUE_WITHOUT_CADDY" != "y" ] && [ "$CONTINUE_WITHOUT_CADDY" != "Y" ]; then
        echo "安装已取消"
        exit 0
    fi
else
    echo "✅ Caddy 已安装"
fi
echo ""

# 设置安装目录
INSTALL_DIR="/opt/caddyfile-manager"
SERVICE_NAME="caddyfile-manager"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

# 获取当前脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "📁 准备安装目录..."
# 创建临时目录用于克隆（如果需要）
TEMP_CLONE_DIR="/tmp/caddyfile-manager-clone-$$"

if [ "$USE_GIT" = true ]; then
    # 从Git克隆代码
    echo "📥 从Git仓库克隆代码..."
    echo "   仓库: $GIT_REPO"
    echo "   分支: $GIT_BRANCH"
    if [ -d "$TEMP_CLONE_DIR" ]; then
        rm -rf "$TEMP_CLONE_DIR"
    fi
    
    if git clone -b "$GIT_BRANCH" "$GIT_REPO" "$TEMP_CLONE_DIR"; then
        echo "✅ 代码克隆完成"
        SOURCE_DIR="$TEMP_CLONE_DIR"
    else
        echo "⚠️  Git克隆失败，将使用当前目录的文件"
        echo "   如果当前目录没有代码文件，安装可能会失败"
        USE_GIT=false
        SOURCE_DIR="$SCRIPT_DIR"
    fi
else
    # 使用当前目录的文件
    echo "📋 使用当前目录的文件"
    SOURCE_DIR="$SCRIPT_DIR"
fi
echo ""

# 创建安装目录
mkdir -p "$INSTALL_DIR"
echo "✅ 安装目录: $INSTALL_DIR"
echo ""

# 复制文件到安装目录
echo "📋 复制文件到安装目录..."
# 复制主要文件
cp -f "$SOURCE_DIR/app.py" "$INSTALL_DIR/" 2>/dev/null || {
    echo "❌ 错误: 未找到 app.py 文件"
    if [ "$USE_GIT" = true ]; then
        rm -rf "$TEMP_CLONE_DIR"
    fi
    exit 1
}

if [ -f "$SOURCE_DIR/caddyfile_parser.py" ]; then
    cp -f "$SOURCE_DIR/caddyfile_parser.py" "$INSTALL_DIR/" 2>/dev/null || true
fi
if [ -f "$SOURCE_DIR/requirements.txt" ]; then
    cp -f "$SOURCE_DIR/requirements.txt" "$INSTALL_DIR/" 2>/dev/null || true
fi
# 复制templates目录
if [ -d "$SOURCE_DIR/templates" ]; then
    cp -r "$SOURCE_DIR/templates" "$INSTALL_DIR/" 2>/dev/null || true
fi
# 复制static目录（如果存在）
if [ -d "$SOURCE_DIR/static" ]; then
    cp -r "$SOURCE_DIR/static" "$INSTALL_DIR/" 2>/dev/null || true
fi
# 复制config目录（如果存在）
if [ -d "$SOURCE_DIR/config" ]; then
    cp -r "$SOURCE_DIR/config" "$INSTALL_DIR/" 2>/dev/null || true
fi
echo "✅ 文件复制完成"

# 清理临时克隆目录
if [ "$USE_GIT" = true ] && [ -d "$TEMP_CLONE_DIR" ]; then
    rm -rf "$TEMP_CLONE_DIR"
    echo "🧹 临时文件已清理"
fi
echo ""

# 创建虚拟环境
echo "🐍 创建Python虚拟环境..."
cd "$INSTALL_DIR"
if [ -d "venv" ]; then
    echo "⚠️  虚拟环境已存在，将重新创建..."
    rm -rf venv
fi
python3 -m venv venv
echo "✅ 虚拟环境创建完成"
echo ""

# 激活虚拟环境并安装依赖
echo "📦 安装Python依赖..."
source venv/bin/activate
pip install --upgrade pip
if [ -f "requirements.txt" ]; then
    pip install -r requirements.txt
else
    echo "⚠️  未找到requirements.txt，安装基础依赖..."
    pip install Flask==3.0.0 flask-cors==4.0.0 python-dotenv==1.0.0 PyYAML==6.0.1 redis==5.0.1
fi
deactivate
echo "✅ 依赖安装完成"
echo ""

# 创建必要的目录
echo "📁 创建必要的目录..."
mkdir -p "$INSTALL_DIR/config"
mkdir -p /etc/caddy
chmod 755 /etc/caddy
echo "✅ 目录创建完成"
echo ""

# 设置文件权限
echo "🔐 设置文件权限..."
chown -R root:root "$INSTALL_DIR"
chmod +x "$INSTALL_DIR/app.py"
if [ -f "$INSTALL_DIR/caddyfile_parser.py" ]; then
    chmod +x "$INSTALL_DIR/caddyfile_parser.py"
fi
echo "✅ 权限设置完成"
echo ""

# 询问是否设置AUTH_TOKEN
echo "🔐 是否设置访问认证token？(y/n)"
read -r SET_TOKEN
AUTH_TOKEN_ENV=""
if [ "$SET_TOKEN" = "y" ] || [ "$SET_TOKEN" = "Y" ]; then
    echo "请输入你的 AUTH_TOKEN:"
    read -r AUTH_TOKEN
    if [ -n "$AUTH_TOKEN" ]; then
        AUTH_TOKEN_ENV="Environment=\"AUTH_TOKEN=$AUTH_TOKEN\""
        echo "✅ AUTH_TOKEN 已设置"
    fi
fi
echo ""

# 创建systemd服务文件
echo "⚙️  配置systemd服务..."
VENV_PYTHON="$INSTALL_DIR/venv/bin/python3"

cat > "$SERVICE_FILE" << EOF
[Unit]
Description=Caddyfile可视化编辑器服务
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR
Environment="PATH=$INSTALL_DIR/venv/bin:/usr/local/bin:/usr/bin:/bin"
Environment="CADDYFILE_PATH=/etc/caddy/Caddyfile"
Environment="CADDY_BINARY=caddy"
Environment="PORT=5000"
Environment="HOST=0.0.0.0"
$AUTH_TOKEN_ENV
ExecStart=$VENV_PYTHON $INSTALL_DIR/app.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

echo "✅ systemd服务文件已创建: $SERVICE_FILE"
echo ""

# 重新加载systemd配置
echo "🔄 重新加载systemd配置..."
systemctl daemon-reload
echo "✅ systemd配置已重新加载"
echo ""

# 启用并启动服务
echo "🚀 启动服务..."
systemctl enable "$SERVICE_NAME"
systemctl start "$SERVICE_NAME"
echo "✅ 服务已启动"
echo ""

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 3

# 检查服务状态
echo "📊 检查服务状态..."
if systemctl is-active --quiet "$SERVICE_NAME"; then
    echo "✅ 服务运行正常！"
    echo ""
    echo "=========================================="
    echo "安装完成！"
    echo "=========================================="
    echo ""
    echo "访问地址: http://localhost:5000"
    echo ""
    echo "常用命令:"
    echo "  查看状态: systemctl status $SERVICE_NAME"
    echo "  查看日志: journalctl -u $SERVICE_NAME -f"
    echo "  停止服务: systemctl stop $SERVICE_NAME"
    echo "  启动服务: systemctl start $SERVICE_NAME"
    echo "  重启服务: systemctl restart $SERVICE_NAME"
    echo "  卸载服务: systemctl stop $SERVICE_NAME && systemctl disable $SERVICE_NAME && rm $SERVICE_FILE && systemctl daemon-reload"
    echo ""
else
    echo "❌ 服务启动失败，请检查日志:"
    echo "   journalctl -u $SERVICE_NAME -n 50"
    exit 1
fi

