@echo off
REM Caddyfile编辑器启动脚本 (Windows)

REM 检查Python是否安装
python --version >nul 2>&1
if errorlevel 1 (
    echo 错误: 未找到Python，请先安装Python
    pause
    exit /b 1
)

REM 检查依赖是否安装
python -c "import flask" >nul 2>&1
if errorlevel 1 (
    echo 正在安装依赖...
    pip install -r requirements.txt
)

REM 启动应用
echo 启动Caddyfile编辑器...
python app.py

