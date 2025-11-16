#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Caddyfile 可视化编辑器 - Flask后端
"""

import os
import json
import subprocess
import yaml
from pathlib import Path
from typing import Optional
from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
from functools import wraps
from dotenv import load_dotenv, find_dotenv
from caddyfile_parser import parse_caddyfile, generate_caddyfile, format_caddyfile

# 尝试导入Redis（可选）
try:
    import redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False
    redis = None

load_dotenv(find_dotenv())

app = Flask(__name__)
CORS(app)

# 配置路径
CADDYFILE_PATH = os.getenv('CADDYFILE_PATH', '/etc/caddy/Caddyfile')
CADDY_BINARY = os.getenv('CADDY_BINARY', 'caddy')
CONFIG_FILE = os.getenv('CONFIG_FILE', 'config.yaml')
SYSTEM_DIRECTIVES_CONFIG_FILE = os.getenv('SYSTEM_DIRECTIVES_CONFIG_FILE', 'config/directives.yaml')  # 系统配置（会提交到git）
CUSTOM_DIRECTIVES_CONFIG_FILE = os.getenv('CUSTOM_DIRECTIVES_CONFIG_FILE', 'config/custom_directives.yaml')  # 用户配置（不提交到git）
# 注意：HTTP头配置现在从directives.yaml中的header指令读取，不再使用单独的headers.yaml文件

# 用户配置存储方式：'local' 或 'redis'
CUSTOM_CONFIG_STORAGE = os.getenv('CUSTOM_CONFIG_STORAGE', 'local')

# Redis配置（当使用Redis存储时）
REDIS_HOST = os.getenv('REDIS_HOST', 'localhost')
REDIS_PORT = int(os.getenv('REDIS_PORT', 6379))
REDIS_DB = int(os.getenv('REDIS_DB', 0))
REDIS_PASSWORD = os.getenv('REDIS_PASSWORD', None)
REDIS_KEY_PREFIX = os.getenv('REDIS_KEY_PREFIX', 'caddyfile:directives:')

# 认证配置
AUTH_TOKEN = os.getenv('AUTH_TOKEN', None)

# 备份配置
BACKUP_DIR = os.getenv('BACKUP_DIR', None)  # 如果未设置，使用 Caddyfile 所在目录的 backups 子目录
MAX_BACKUPS = int(os.getenv('MAX_BACKUPS', 30))  # 最多保留的备份数量

def load_config():
    """加载配置文件"""
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                return yaml.safe_load(f) or {}
        except Exception as e:
            print(f'加载配置文件失败: {e}')
            return {}
    return {}

def save_config(config):
    """保存配置文件"""
    try:
        with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
            yaml.dump(config, f, allow_unicode=True, default_flow_style=False, sort_keys=False)
        return True
    except Exception as e:
        print(f'保存配置文件失败: {e}')
        return False

def get_redis_client():
    """获取Redis客户端"""
    if not REDIS_AVAILABLE or CUSTOM_CONFIG_STORAGE != 'redis':
        return None
    try:
        return redis.Redis(
            host=REDIS_HOST,
            port=REDIS_PORT,
            db=REDIS_DB,
            password=REDIS_PASSWORD,
            decode_responses=True
        )
    except Exception as e:
        print(f'连接Redis失败: {e}')
        return None

def load_system_directives_config():
    """加载系统指令配置（从config/directives.yaml，会提交到git）"""
    # 确保目录存在
    config_dir = os.path.dirname(SYSTEM_DIRECTIVES_CONFIG_FILE)
    if config_dir and not os.path.exists(config_dir):
        os.makedirs(config_dir, exist_ok=True)
    
    if os.path.exists(SYSTEM_DIRECTIVES_CONFIG_FILE):
        try:
            with open(SYSTEM_DIRECTIVES_CONFIG_FILE, 'r', encoding='utf-8') as f:
                data = yaml.safe_load(f) or {}
                return data.get('directives', {})
        except Exception as e:
            print(f'加载系统指令配置失败: {e}')
            return {}
    else:
        # 如果文件不存在，返回空配置
        return {}

def load_custom_directives_config():
    """加载用户自定义指令配置"""
    if CUSTOM_CONFIG_STORAGE == 'redis':
        return load_custom_directives_from_redis()
    else:
        return load_custom_directives_from_local()

def load_custom_directives_from_local():
    """从本地文件加载用户配置"""
    if not os.path.exists(CUSTOM_DIRECTIVES_CONFIG_FILE):
        return {}
    
    try:
        with open(CUSTOM_DIRECTIVES_CONFIG_FILE, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f) or {}
            return data.get('directives', {})
    except Exception as e:
        print(f'加载用户指令配置失败: {e}')
        return {}

def load_custom_directives_from_redis():
    """从Redis加载用户配置"""
    client = get_redis_client()
    if not client:
        return {}
    
    try:
        key = f"{REDIS_KEY_PREFIX}custom"
        data = client.get(key)
        if data:
            return json.loads(data)
        return {}
    except Exception as e:
        print(f'从Redis加载用户指令配置失败: {e}')
        return {}

def save_custom_directives_config(custom_config):
    """保存用户自定义指令配置"""
    if CUSTOM_CONFIG_STORAGE == 'redis':
        return save_custom_directives_to_redis(custom_config)
    else:
        return save_custom_directives_to_local(custom_config)

def save_custom_directives_to_local(custom_config):
    """保存用户配置到本地文件"""
    try:
        # 确保目录存在
        config_dir = os.path.dirname(CUSTOM_DIRECTIVES_CONFIG_FILE)
        if config_dir and not os.path.exists(config_dir):
            os.makedirs(config_dir, exist_ok=True)
        
        config = {'directives': custom_config}
        with open(CUSTOM_DIRECTIVES_CONFIG_FILE, 'w', encoding='utf-8') as f:
            yaml.dump(config, f, allow_unicode=True, default_flow_style=False, sort_keys=False)
        return True
    except Exception as e:
        print(f'保存用户指令配置失败: {e}')
        return False

def save_custom_directives_to_redis(custom_config):
    """保存用户配置到Redis"""
    client = get_redis_client()
    if not client:
        return False
    
    try:
        key = f"{REDIS_KEY_PREFIX}custom"
        client.set(key, json.dumps(custom_config, ensure_ascii=False))
        return True
    except Exception as e:
        print(f'保存用户指令配置到Redis失败: {e}')
        return False

def load_merged_directives_config():
    """加载合并后的指令配置（系统配置 + 用户配置，用户配置可以覆盖系统配置）"""
    system_config = load_system_directives_config()
    custom_config = load_custom_directives_config()
    
    # 合并配置：用户配置覆盖系统配置
    merged = {}
    
    # 先添加系统配置
    for directive_name, directive_config in system_config.items():
        merged[directive_name] = {
            **directive_config,
            'isSystem': True  # 标记为系统配置
        }
    
    # 用户配置覆盖系统配置
    for directive_name, directive_config in custom_config.items():
        merged[directive_name] = {
            **directive_config,
            'isSystem': False  # 标记为用户配置
        }
    
    return merged

def get_merged_directive_config(directive_name):
    """获取指定指令的配置（合并后的）"""
    merged_config = load_merged_directives_config()
    return merged_config.get(directive_name, {})

def get_merged_directive_options(directive_name):
    """获取指定指令的选项列表（合并后的）"""
    directive_config = get_merged_directive_config(directive_name)
    options = directive_config.get('options', [])
    
    # 标记每个选项是否为系统配置
    system_config = load_system_directives_config()
    system_options = system_config.get(directive_name, {}).get('options', [])
    system_values = {opt.get('value') for opt in system_options if opt.get('value')}
    
    result = []
    for option in options:
        value = option.get('value', '')
        is_system = value in system_values
        result.append({
            **option,
            'isSystem': is_system
        })
    
    return result

def load_headers_config():
    """加载HTTP头配置（从directives.yaml中的header指令读取）"""
    try:
        # 从directives.yaml中读取header指令的配置
        system_config = load_system_directives_config()
        header_config = system_config.get('header', {})
        headers = header_config.get('options', [])
        return headers
    except Exception as e:
        print(f'加载HTTP头配置失败: {e}')
        return []

def require_auth(f):
    """Token认证装饰器"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # 如果未设置AUTH_TOKEN，则不启用认证
        if not AUTH_TOKEN:
            return f(*args, **kwargs)
        
        # 从请求头获取token
        token = request.headers.get('Authorization', '')
        # 支持 "Bearer <token>" 或直接 "<token>" 格式
        if token.startswith('Bearer '):
            token = token[7:]
        token = token.strip()
        
        # 验证token
        if not token or token != AUTH_TOKEN:
            return jsonify({
                'success': False,
                'error': '未授权：需要有效的认证token'
            }), 401
        
        return f(*args, **kwargs)
    return decorated_function

@app.route('/')
def index():
    """主页面"""
    return render_template('index.html')

@app.route('/api/login', methods=['POST'])
def login():
    """登录接口，验证token"""
    try:
        # 如果未设置AUTH_TOKEN，则不需要登录
        if not AUTH_TOKEN:
            return jsonify({
                'success': True,
                'message': '未启用认证'
            })
        
        data = request.get_json()
        token = data.get('token', '').strip()
        
        # 验证token
        if not token or token != AUTH_TOKEN:
            return jsonify({
                'success': False,
                'error': '无效的token'
            }), 401
        
        return jsonify({
            'success': True,
            'message': '登录成功'
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/caddyfile', methods=['GET'])
@require_auth
def get_caddyfile():
    """获取当前Caddyfile内容"""
    try:
        format_mode = request.args.get('format', 'false').lower() == 'true'
        
        if os.path.exists(CADDYFILE_PATH):
            with open(CADDYFILE_PATH, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # 如果请求格式化版本，解析后重新生成
            if format_mode:
                try:
                    content = format_caddyfile(content)
                except Exception as e:
                    # 如果解析失败，返回原始内容
                    pass
            
            # 解析为结构化数据
            try:
                result = parse_caddyfile(content, preserve_unparsed=True)
                sites = result.get("sites", [])
                unparsed = result.get("unparsed", [])
            except Exception as e:
                sites = []
                unparsed = []
            
            return jsonify({
                'success': True,
                'content': content,
                'sites': sites,
                'unparsed': unparsed,
                'path': CADDYFILE_PATH,
                'formatted': format_mode
            })
        else:
            return jsonify({
                'success': True,
                'content': '',
                'sites': [],
                'unparsed': [],
                'path': CADDYFILE_PATH,
                'message': 'Caddyfile不存在，将创建新文件'
            })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

def check_duplicate_addresses(sites):
    """检查是否有重复的站点地址"""
    address_count = {}
    duplicates = []
    
    for i, site in enumerate(sites):
        address = (site.get('address') or '').strip()
        if not address:
            continue
        
        if address not in address_count:
            address_count[address] = []
        address_count[address].append(i)
    
    # 找出重复的地址
    for address, indices in address_count.items():
        if len(indices) > 1:
            duplicates.append({
                'address': address,
                'indices': indices,
                'count': len(indices)
            })
    
    return duplicates

def create_backup(source_path: str) -> Optional[str]:
    """
    创建 Caddyfile 备份
    
    Args:
        source_path: 源文件路径
        
    Returns:
        备份文件路径，如果失败返回 None
    """
    try:
        # 如果源文件不存在，不需要备份
        if not os.path.exists(source_path):
            return None
        
        # 确定备份目录
        if BACKUP_DIR:
            backup_dir = BACKUP_DIR
        else:
            # 使用源文件所在目录的 backups 子目录
            source_dir = os.path.dirname(source_path)
            backup_dir = os.path.join(source_dir, 'backups')
        
        # 创建备份目录
        os.makedirs(backup_dir, exist_ok=True)
        
        # 生成备份文件名（使用时间戳）
        from datetime import datetime
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        source_filename = os.path.basename(source_path)
        backup_filename = f"{source_filename}.{timestamp}.bak"
        backup_path = os.path.join(backup_dir, backup_filename)
        
        # 复制文件
        import shutil
        shutil.copy2(source_path, backup_path)
        
        # 清理旧备份，只保留最近 MAX_BACKUPS 个
        cleanup_old_backups(backup_dir, source_filename, MAX_BACKUPS)
        
        return backup_path
    except Exception as e:
        print(f'创建备份失败: {e}')
        return None

def cleanup_old_backups(backup_dir: str, source_filename: str, max_backups: int):
    """
    清理旧的备份文件，只保留最近 max_backups 个
    
    Args:
        backup_dir: 备份目录
        source_filename: 源文件名（用于匹配备份文件）
        max_backups: 最多保留的备份数量
    """
    try:
        # 获取所有匹配的备份文件
        backup_pattern = f"{source_filename}.*.bak"
        import glob
        backup_files = glob.glob(os.path.join(backup_dir, backup_pattern))
        
        # 按修改时间排序（最新的在前）
        backup_files.sort(key=lambda x: os.path.getmtime(x), reverse=True)
        
        # 删除超出数量的旧备份
        if len(backup_files) > max_backups:
            for old_backup in backup_files[max_backups:]:
                try:
                    os.remove(old_backup)
                    print(f'已删除旧备份: {old_backup}')
                except Exception as e:
                    print(f'删除旧备份失败 {old_backup}: {e}')
    except Exception as e:
        print(f'清理旧备份失败: {e}')

@app.route('/api/caddyfile', methods=['POST'])
@require_auth
def save_caddyfile():
    """保存Caddyfile"""
    try:
        data = request.get_json()
        
        # 支持两种保存方式：
        # 1. 直接保存文本内容（content字段）
        # 2. 从结构化数据生成（sites字段）
        if 'sites' in data:
            # 从结构化数据生成
            sites = data.get('sites', [])
            unparsed = data.get('unparsed', [])
            
            # 检查重复的站点地址
            duplicates = check_duplicate_addresses(sites)
            if duplicates:
                duplicate_info = []
                for dup in duplicates:
                    duplicate_info.append(f"地址 '{dup['address']}' 出现了 {dup['count']} 次（位置: {', '.join(map(str, [idx+1 for idx in dup['indices']]))}）")
                
                return jsonify({
                    'success': False,
                    'error': '检测到重复的站点地址，无法保存',
                    'details': '\n'.join(duplicate_info),
                    'duplicates': duplicates
                }), 400
            
            content = generate_caddyfile(sites, unparsed)
        elif 'content' in data:
            # 直接使用文本内容，但会格式化
            content = data.get('content', '')
            # 解析并重新生成，确保格式统一
            try:
                content = format_caddyfile(content)
                # 解析后检查重复地址
                parsed = parse_caddyfile(content, preserve_unparsed=True)
                sites = parsed.get('sites', [])
                duplicates = check_duplicate_addresses(sites)
                if duplicates:
                    duplicate_info = []
                    for dup in duplicates:
                        duplicate_info.append(f"地址 '{dup['address']}' 出现了 {dup['count']} 次")
                    
                    return jsonify({
                        'success': False,
                        'error': '检测到重复的站点地址，无法保存',
                        'details': '\n'.join(duplicate_info),
                        'duplicates': duplicates
                    }), 400
            except Exception as e:
                # 如果解析失败，使用原始内容
                pass
        else:
            return jsonify({
                'success': False,
                'error': '缺少content或sites字段'
            }), 400
        
        # 确保目录存在
        caddyfile_dir = os.path.dirname(CADDYFILE_PATH)
        if caddyfile_dir and not os.path.exists(caddyfile_dir):
            os.makedirs(caddyfile_dir, exist_ok=True)
        
        # 在保存之前创建备份
        backup_path = create_backup(CADDYFILE_PATH)
        backup_info = ''
        if backup_path:
            backup_info = f'（已创建备份）'
        
        # 保存文件（统一格式，全量覆盖）
        with open(CADDYFILE_PATH, 'w', encoding='utf-8') as f:
            f.write(content)
        
        return jsonify({
            'success': True,
            'message': f'Caddyfile已保存（已格式化）{backup_info}',
            'content': content,
            'backup_path': backup_path
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/validate', methods=['POST'])
def validate_caddyfile():
    """验证Caddyfile配置"""
    try:
        data = request.get_json() or {}
        
        # 如果没有提供内容，直接验证已保存的 Caddyfile 文件
        if 'sites' not in data and 'content' not in data:
            if os.path.exists(CADDYFILE_PATH):
                # 直接验证实际文件
                result = subprocess.run(
                    [CADDY_BINARY, 'validate', '--config', CADDYFILE_PATH],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    universal_newlines=True,
                    timeout=10
                )
                
                if result.returncode == 0:
                    return jsonify({
                        'success': True,
                        'valid': True,
                        'message': '配置验证通过'
                    })
                else:
                    error_output = (result.stderr or '') + (result.stdout or '')
                    if not error_output.strip():
                        error_output = '配置验证失败（未知错误）'
                    
                    return jsonify({
                        'success': True,
                        'valid': False,
                        'message': error_output.strip()
                    })
            else:
                return jsonify({
                    'success': False,
                    'error': 'Caddyfile 文件不存在'
                }), 400
        
        # 支持两种验证方式
        if 'sites' in data:
            # 从结构化数据生成
            sites = data.get('sites', [])
            unparsed = data.get('unparsed', [])
            
            # 检查重复的站点地址
            duplicates = check_duplicate_addresses(sites)
            if duplicates:
                duplicate_info = []
                for dup in duplicates:
                    duplicate_info.append(f"地址 '{dup['address']}' 出现了 {dup['count']} 次（位置: {', '.join(map(str, [idx+1 for idx in dup['indices']]))}）")
                
                return jsonify({
                    'success': True,
                    'valid': False,
                    'message': '检测到重复的站点地址\n' + '\n'.join(duplicate_info),
                    'duplicates': duplicates
                })
            
            content = generate_caddyfile(sites, unparsed)
        elif 'content' in data:
            content = data.get('content', '')
            # 格式化后再验证
            try:
                content = format_caddyfile(content)
                # 解析后检查重复地址
                parsed = parse_caddyfile(content, preserve_unparsed=True)
                sites = parsed.get('sites', [])
                duplicates = check_duplicate_addresses(sites)
                if duplicates:
                    duplicate_info = []
                    for dup in duplicates:
                        duplicate_info.append(f"地址 '{dup['address']}' 出现了 {dup['count']} 次")
                    
                    return jsonify({
                        'success': True,
                        'valid': False,
                        'message': '检测到重复的站点地址\n' + '\n'.join(duplicate_info),
                        'duplicates': duplicates
                    })
            except Exception as e:
                pass
        else:
            return jsonify({
                'success': False,
                'error': '缺少content或sites字段'
            }), 400
        
        # 使用固定文件路径进行验证（在 Caddyfile 所在目录）
        # 重要：验证文件必须创建在与 Caddyfile 相同的目录中，这样 import 路径才能正确解析
        caddyfile_dir = os.path.dirname(CADDYFILE_PATH)
        if not caddyfile_dir:
            caddyfile_dir = os.getcwd()
        
        # 确保目录存在
        os.makedirs(caddyfile_dir, exist_ok=True)
        
        # 使用固定的验证文件路径
        validate_file_path = os.path.join(caddyfile_dir, '.Caddyfile.validate')
        
        try:
            # 写入内容到固定文件
            with open(validate_file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            
            # 使用caddy validate命令验证（使用与 Caddyfile 相同的目录，确保 import 路径正确）
            result = subprocess.run(
                [CADDY_BINARY, 'validate', '--config', validate_file_path],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                universal_newlines=True,
                timeout=10,
                cwd=caddyfile_dir  # 设置工作目录，确保相对路径正确
            )
            
            if result.returncode == 0:
                return jsonify({
                    'success': True,
                    'valid': True,
                    'message': '配置验证通过'
                })
            else:
                # 合并 stdout 和 stderr，Caddy 的错误信息可能在 stderr 中
                error_output = (result.stderr or '') + (result.stdout or '')
                if not error_output.strip():
                    error_output = '配置验证失败（未知错误）'
                
                return jsonify({
                    'success': True,
                    'valid': False,
                    'message': error_output.strip()
                })
        finally:
            # 验证完成后可以选择保留或删除验证文件
            # 这里保留文件，方便调试（如果需要可以删除）
            pass
                
    except subprocess.TimeoutExpired:
        return jsonify({
            'success': False,
            'error': '验证超时'
        }), 500
    except FileNotFoundError:
        return jsonify({
            'success': True,
            'valid': False,
            'message': '未找到caddy命令，跳过验证'
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/backups', methods=['GET'])
@require_auth
def list_backups():
    """获取备份列表"""
    try:
        # 确定备份目录
        if BACKUP_DIR:
            backup_dir = BACKUP_DIR
        else:
            source_dir = os.path.dirname(CADDYFILE_PATH)
            backup_dir = os.path.join(source_dir, 'backups')
        
        if not os.path.exists(backup_dir):
            return jsonify({
                'success': True,
                'backups': []
            })
        
        # 获取所有备份文件
        source_filename = os.path.basename(CADDYFILE_PATH)
        backup_pattern = f"{source_filename}.*.bak"
        import glob
        backup_files = glob.glob(os.path.join(backup_dir, backup_pattern))
        
        # 按修改时间排序（最新的在前）
        backup_files.sort(key=lambda x: os.path.getmtime(x), reverse=True)
        
        # 构建备份信息列表
        backups = []
        for backup_path in backup_files:
            backup_filename = os.path.basename(backup_path)
            mtime = os.path.getmtime(backup_path)
            from datetime import datetime
            backup_time = datetime.fromtimestamp(mtime)
            
            # 从文件名提取时间戳
            # 格式：Caddyfile.YYYYMMDD_HHMMSS.bak
            timestamp_str = backup_filename.replace(f"{source_filename}.", "").replace(".bak", "")
            
            backups.append({
                'filename': backup_filename,
                'path': backup_path,
                'timestamp': timestamp_str,
                'time': backup_time.strftime('%Y-%m-%d %H:%M:%S'),
                'size': os.path.getsize(backup_path)
            })
        
        return jsonify({
            'success': True,
            'backups': backups,
            'count': len(backups)
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/backups/restore', methods=['POST'])
@require_auth
def restore_backup():
    """恢复备份"""
    try:
        data = request.get_json()
        backup_path = data.get('backup_path') or data.get('path')
        
        if not backup_path:
            return jsonify({
                'success': False,
                'error': '缺少 backup_path 参数'
            }), 400
        
        # 检查备份文件是否存在
        if not os.path.exists(backup_path):
            return jsonify({
                'success': False,
                'error': f'备份文件不存在: {backup_path}'
            }), 404
        
        # 在恢复之前创建当前文件的备份
        current_backup = create_backup(CADDYFILE_PATH)
        
        # 复制备份文件到 Caddyfile
        import shutil
        shutil.copy2(backup_path, CADDYFILE_PATH)
        
        return jsonify({
            'success': True,
            'message': '备份已恢复',
            'backup_path': backup_path,
            'current_backup': current_backup  # 恢复前创建的备份
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/reload', methods=['POST'])
@require_auth
def reload_caddy():
    """重新加载Caddy配置"""
    try:
        # 检查Caddyfile是否存在
        if not os.path.exists(CADDYFILE_PATH):
            return jsonify({
                'success': False,
                'error': f'Caddyfile不存在: {CADDYFILE_PATH}'
            }), 400
        
        # 使用caddy reload命令
        # 注意：在Windows上，caddy reload可能不可用，需要先检查
        try:
            result = subprocess.run(
                [CADDY_BINARY, 'reload', '--config', CADDYFILE_PATH],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                universal_newlines=True,
                timeout=10
            )
            
            if result.returncode == 0:
                return jsonify({
                    'success': True,
                    'message': '配置已重新加载'
                })
            else:
                error_msg = result.stderr or result.stdout or '未知错误'
                # 提供更友好的错误信息
                if 'not found' in error_msg.lower() or 'command not found' in error_msg.lower():
                    return jsonify({
                        'success': False,
                        'error': f'未找到caddy命令。请确保已安装Caddy并配置了CADDY_BINARY环境变量。当前值: {CADDY_BINARY}'
                    }), 500
                else:
                    return jsonify({
                        'success': False,
                        'error': f'重新加载失败: {error_msg}'
                    }), 500
        except FileNotFoundError:
            return jsonify({
                'success': False,
                'error': f'未找到caddy命令: {CADDY_BINARY}。请确保已安装Caddy并配置了CADDY_BINARY环境变量。'
            }), 500
            
    except subprocess.TimeoutExpired:
        return jsonify({
            'success': False,
            'error': '重新加载超时（超过10秒）'
        }), 500
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'重新加载时发生错误: {str(e)}'
        }), 500

@app.route('/api/parse', methods=['POST'])
def parse_caddyfile_api():
    """解析Caddyfile内容为结构化数据"""
    try:
        data = request.get_json()
        content = data.get('content', '')
        
        # 解析内容
        result = parse_caddyfile(content, preserve_unparsed=True)
        
        return jsonify({
            'success': True,
            'sites': result.get('sites', []),
            'unparsed': result.get('unparsed', [])
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/generate', methods=['POST'])
def generate_caddyfile_api():
    """从结构化数据生成Caddyfile内容"""
    try:
        data = request.get_json()
        sites = data.get('sites', [])
        unparsed = data.get('unparsed', [])
        
        # 生成配置内容
        content = generate_caddyfile(sites, unparsed)
        
        return jsonify({
            'success': True,
            'content': content
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/templates', methods=['GET'])
def get_templates():
    """获取配置模板"""
    templates = {
        'basic': {
            'name': '基础配置',
            'content': ':80\nrespond "Hello, world!"',
            'sites': [
                {
                    'address': ':80',
                    'directives': [
                        {'name': 'respond', 'args': ['Hello, world!']}
                    ]
                }
            ]
        },
        'reverse_proxy': {
            'name': '反向代理',
            'content': 'example.com {\n    reverse_proxy localhost:8080\n}',
            'sites': [
                {
                    'address': 'example.com',
                    'directives': [
                        {'name': 'reverse_proxy', 'args': ['localhost:8080']}
                    ]
                }
            ]
        },
        'static': {
            'name': '静态文件服务',
            'content': 'example.com {\n    root * /var/www\n    file_server\n}',
            'sites': [
                {
                    'address': 'example.com',
                    'directives': [
                        {'name': 'root', 'args': ['*', '/var/www']},
                        {'name': 'file_server', 'args': []}
                    ]
                }
            ]
        },
        'tls': {
            'name': 'HTTPS配置',
            'content': 'example.com {\n    tls email@example.com\n    reverse_proxy localhost:8080\n}',
            'sites': [
                {
                    'address': 'example.com',
                    'directives': [
                        {'name': 'tls', 'args': ['email@example.com']},
                        {'name': 'reverse_proxy', 'args': ['localhost:8080']}
                    ]
                }
            ]
        },
        'multiple_sites': {
            'name': '多站点配置',
            'content': 'site1.com {\n    reverse_proxy localhost:8080\n}\n\nsite2.com {\n    reverse_proxy localhost:8081\n}',
            'sites': [
                {
                    'address': 'site1.com',
                    'directives': [
                        {'name': 'reverse_proxy', 'args': ['localhost:8080']}
                    ]
                },
                {
                    'address': 'site2.com',
                    'directives': [
                        {'name': 'reverse_proxy', 'args': ['localhost:8081']}
                    ]
                }
            ]
        }
    }
    return jsonify({
        'success': True,
        'templates': templates
    })

@app.route('/api/directives', methods=['GET'])
def get_directives_config():
    """获取所有指令配置（合并后的）"""
    try:
        merged_config = load_merged_directives_config()
        system_config = load_system_directives_config()
        custom_config = load_custom_directives_config()
        
        return jsonify({
            'success': True,
            'directives': merged_config,
            'system_directives': system_config,
            'custom_directives': custom_config,
            'storage_type': CUSTOM_CONFIG_STORAGE
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/directives/<directive_name>', methods=['GET'])
def get_directive_config_api(directive_name):
    """获取指定指令的配置"""
    try:
        directive_config = get_merged_directive_config(directive_name)
        system_config = load_system_directives_config()
        custom_config = load_custom_directives_config()
        
        system_directive = system_config.get(directive_name, {})
        custom_directive = custom_config.get(directive_name, {})
        
        return jsonify({
            'success': True,
            'directive': directive_config,
            'system_directive': system_directive,
            'custom_directive': custom_directive,
            'storage_type': CUSTOM_CONFIG_STORAGE
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/directives/<directive_name>/options', methods=['GET'])
def get_directive_options_api(directive_name):
    """获取指定指令的选项列表"""
    try:
        options = get_merged_directive_options(directive_name)
        system_config = load_system_directives_config()
        custom_config = load_custom_directives_config()
        
        system_options = system_config.get(directive_name, {}).get('options', [])
        custom_options = custom_config.get(directive_name, {}).get('options', [])
        
        return jsonify({
            'success': True,
            'options': options,
            'system_options': system_options,
            'custom_options': custom_options,
            'storage_type': CUSTOM_CONFIG_STORAGE
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/directives/<directive_name>/options/custom', methods=['POST'])
def add_custom_directive_option(directive_name):
    """添加用户自定义指令选项"""
    try:
        data = request.get_json()
        value = data.get('value', '').strip()
        label = data.get('label', '').strip()
        description = data.get('description', '').strip()
        
        if not value:
            return jsonify({
                'success': False,
                'error': '选项值不能为空'
            }), 400
        
        if not label:
            label = value
        
        # 加载现有用户配置
        custom_config = load_custom_directives_config()
        
        # 获取或创建指令配置
        if directive_name not in custom_config:
            custom_config[directive_name] = {'options': []}
        
        directive_config = custom_config[directive_name]
        if 'options' not in directive_config:
            directive_config['options'] = []
        
        # 检查是否已存在
        if any(opt.get('value') == value for opt in directive_config['options']):
            return jsonify({
                'success': False,
                'error': '该选项已存在'
            }), 400
        
        # 添加新选项
        new_option = {
            'value': value,
            'label': label,
            'description': description
        }
        directive_config['options'].append(new_option)
        
        # 保存用户配置
        if save_custom_directives_config(custom_config):
            return jsonify({
                'success': True,
                'message': '选项已添加',
                'custom_directives': custom_config
            })
        else:
            return jsonify({
                'success': False,
                'error': '保存配置失败'
            }), 500
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/directives/<directive_name>/options/custom/<value>', methods=['DELETE'])
def delete_custom_directive_option(directive_name, value):
    """删除用户自定义指令选项"""
    try:
        # 加载现有用户配置
        custom_config = load_custom_directives_config()
        
        if directive_name not in custom_config:
            return jsonify({
                'success': False,
                'error': '未找到该指令配置'
            }), 404
        
        directive_config = custom_config[directive_name]
        if 'options' not in directive_config:
            return jsonify({
                'success': False,
                'error': '未找到选项列表'
            }), 404
        
        # 查找并删除
        original_count = len(directive_config['options'])
        directive_config['options'] = [opt for opt in directive_config['options'] if opt.get('value') != value]
        
        if len(directive_config['options']) == original_count:
            return jsonify({
                'success': False,
                'error': '未找到该选项'
            }), 404
        
        # 如果选项列表为空，可以删除整个指令配置
        if not directive_config['options']:
            del custom_config[directive_name]
        
        # 保存用户配置
        if save_custom_directives_config(custom_config):
            return jsonify({
                'success': True,
                'message': '选项已删除',
                'custom_directives': custom_config
            })
        else:
            return jsonify({
                'success': False,
                'error': '保存配置失败'
            }), 500
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/headers', methods=['GET'])
def get_headers_config():
    """获取HTTP头配置（从配置文件读取）"""
    try:
        headers = load_headers_config()
        return jsonify({
            'success': True,
            'headers': headers
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    host = os.getenv('HOST', '0.0.0.0')
    app.run(host=host, port=port, debug=os.getenv('DEBUG', 'False').lower() == 'true')

