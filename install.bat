@echo off
REM Caddyfile Manager 安装脚本 (Windows)

echo ==========================================
echo Caddyfile Manager 安装脚本
echo ==========================================
echo.

REM 检查Docker是否安装
where docker >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 错误: 未找到 Docker，请先安装 Docker
    echo    访问 https://docs.docker.com/get-docker/ 获取安装指南
    exit /b 1
)

REM 检查docker-compose是否安装
docker compose version >nul 2>&1
if %errorlevel% equ 0 (
    set DOCKER_COMPOSE=docker compose
) else (
    where docker-compose >nul 2>&1
    if %errorlevel% neq 0 (
        echo ❌ 错误: 未找到 docker-compose，请先安装 docker-compose
        echo    访问 https://docs.docker.com/compose/install/ 获取安装指南
        exit /b 1
    )
    set DOCKER_COMPOSE=docker-compose
)

echo ✅ Docker 和 docker-compose 已安装
echo.

REM 创建必要的目录
echo 📁 创建必要的目录...
if not exist "caddyfile" mkdir caddyfile
if not exist "data" mkdir data
echo ✅ 目录创建完成
echo.

REM 检查docker-compose.prod.yml是否存在
if not exist "docker-compose.prod.yml" (
    echo ❌ 错误: 未找到 docker-compose.prod.yml 文件
    echo    请确保在项目根目录运行此脚本
    exit /b 1
)

REM 询问是否设置AUTH_TOKEN
echo 🔐 是否设置访问认证token？(y/n)
set /p SET_TOKEN=
if /i "%SET_TOKEN%"=="y" (
    echo 请输入你的 AUTH_TOKEN:
    set /p AUTH_TOKEN=
    if defined AUTH_TOKEN (
        REM 更新docker-compose.prod.yml中的AUTH_TOKEN
        powershell -Command "(Get-Content docker-compose.prod.yml) -replace '# - AUTH_TOKEN=your-secret-token', '- AUTH_TOKEN=%AUTH_TOKEN%' | Set-Content docker-compose.prod.yml"
        echo ✅ AUTH_TOKEN 已设置
    )
)
echo.

REM 拉取最新镜像
echo 📥 拉取最新镜像...
%DOCKER_COMPOSE% -f docker-compose.prod.yml pull
if %errorlevel% neq 0 (
    echo ❌ 镜像拉取失败
    exit /b 1
)
echo ✅ 镜像拉取完成
echo.

REM 启动容器
echo 🚀 启动容器...
%DOCKER_COMPOSE% -f docker-compose.prod.yml up -d
if %errorlevel% neq 0 (
    echo ❌ 容器启动失败
    exit /b 1
)
echo.

REM 检查容器状态
echo 📊 检查容器状态...
timeout /t 2 /nobreak >nul
%DOCKER_COMPOSE% -f docker-compose.prod.yml ps | findstr "Up" >nul
if %errorlevel% equ 0 (
    echo ✅ 容器启动成功！
    echo.
    echo ==========================================
    echo 安装完成！
    echo ==========================================
    echo.
    echo 访问地址: http://localhost:5000
    echo.
    echo 常用命令:
    echo   查看日志: %DOCKER_COMPOSE% -f docker-compose.prod.yml logs -f
    echo   停止服务: %DOCKER_COMPOSE% -f docker-compose.prod.yml down
    echo   更新镜像: update.bat
    echo.
) else (
    echo ❌ 容器启动失败，请检查日志:
    echo    %DOCKER_COMPOSE% -f docker-compose.prod.yml logs
    exit /b 1
)

