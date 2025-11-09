@echo off
REM Caddyfile Manager 更新脚本 (Windows)

echo ==========================================
echo Caddyfile Manager 更新脚本
echo ==========================================
echo.

REM 检查Docker是否安装
where docker >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 错误: 未找到 Docker
    exit /b 1
)

REM 检测docker-compose命令
docker compose version >nul 2>&1
if %errorlevel% equ 0 (
    set DOCKER_COMPOSE=docker compose
) else (
    set DOCKER_COMPOSE=docker-compose
)

REM 检查docker-compose.prod.yml是否存在
if not exist "docker-compose.prod.yml" (
    echo ❌ 错误: 未找到 docker-compose.prod.yml 文件
    echo    请确保在项目根目录运行此脚本
    exit /b 1
)

REM 拉取最新镜像
echo 📥 拉取最新镜像...
%DOCKER_COMPOSE% -f docker-compose.prod.yml pull
if %errorlevel% neq 0 (
    echo ❌ 镜像拉取失败
    exit /b 1
)
echo ✅ 镜像拉取完成
echo.

REM 重新创建并启动容器
echo 🔄 更新容器...
%DOCKER_COMPOSE% -f docker-compose.prod.yml up -d
if %errorlevel% neq 0 (
    echo ❌ 容器更新失败
    exit /b 1
)
echo.

REM 检查容器状态
echo 📊 检查容器状态...
timeout /t 2 /nobreak >nul
%DOCKER_COMPOSE% -f docker-compose.prod.yml ps | findstr "Up" >nul
if %errorlevel% equ 0 (
    echo ✅ 更新完成！容器已重新启动
    echo.
    echo 访问地址: http://localhost:5000
    echo.
) else (
    echo ❌ 更新失败，请检查日志:
    echo    %DOCKER_COMPOSE% -f docker-compose.prod.yml logs
    exit /b 1
)

