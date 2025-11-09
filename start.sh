#!/bin/bash
# Caddyfile编辑器启动脚本

# 检查Python是否安装
if ! command -v python3 &> /dev/null; then
    echo "错误: 未找到Python3，请先安装Python3"
    exit 1
fi

# 检查依赖是否安装
if ! python3 -c "import flask" &> /dev/null; then
    echo "正在安装依赖..."
    pip3 install -r requirements.txt
fi

# 启动应用
echo "启动Caddyfile编辑器..."
python3 app.py

