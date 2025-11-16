FROM python:3.11-slim

# 设置工作目录
WORKDIR /app

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    caddy \
    && rm -rf /var/lib/apt/lists/*

# 复制依赖文件
COPY requirements.txt .

# 安装Python依赖
RUN pip install --no-cache-dir -r requirements.txt

# 复制应用文件
COPY app.py .
COPY templates/ ./templates/
COPY static/ ./static/
COPY config/ ./config/
COPY caddyfile_parser.py .

# 创建Caddyfile目录
RUN mkdir -p /etc/caddy

# 复制 GENERAL_SETTINGS 文件到 /etc/caddy/（供 import 使用）
COPY GENERAL_SETTINGS /etc/caddy/GENERAL_SETTINGS

# 设置环境变量
ENV CADDYFILE_PATH=/etc/caddy/Caddyfile
ENV CADDY_BINARY=caddy
ENV PORT=5000
ENV HOST=0.0.0.0

# 暴露端口
EXPOSE 5000

# 启动应用
CMD ["python", "app.py"]

