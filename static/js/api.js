// API调用模块

// 全局变量：HTTP头配置
window.commonHeaders = [];

// Token管理
const TOKEN_STORAGE_KEY = 'caddyfile_auth_token';

// 获取保存的token
function getToken() {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
}

// 保存token
function saveToken(token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

// 清除token
function clearToken() {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
}

// 显示登录对话框
function showLoginModal() {
    const loginModal = new bootstrap.Modal(document.getElementById('loginModal'), {
        backdrop: 'static',
        keyboard: false
    });
    loginModal.show();
    // 清空输入框和错误信息
    document.getElementById('tokenInput').value = '';
    const errorEl = document.getElementById('loginError');
    errorEl.classList.add('d-none');
    errorEl.textContent = '';
    // 聚焦输入框
    setTimeout(() => {
        document.getElementById('tokenInput').focus();
    }, 300);
}

// 处理登录
async function handleLogin() {
    const tokenInput = document.getElementById('tokenInput');
    const token = tokenInput.value.trim();
    const errorEl = document.getElementById('loginError');
    
    if (!token) {
        errorEl.textContent = '请输入token';
        errorEl.classList.remove('d-none');
        return;
    }
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ token: token })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // 保存token
            saveToken(token);
            // 关闭登录对话框
            const loginModal = bootstrap.Modal.getInstance(document.getElementById('loginModal'));
            if (loginModal) {
                loginModal.hide();
            }
            // 重新加载页面或刷新数据
            if (typeof loadCaddyfile === 'function') {
                loadCaddyfile();
            }
        } else {
            errorEl.textContent = data.error || '登录失败';
            errorEl.classList.remove('d-none');
        }
    } catch (error) {
        errorEl.textContent = '登录失败: ' + error.message;
        errorEl.classList.remove('d-none');
    }
}

// 处理401错误，显示登录对话框
function handleUnauthorized() {
    clearToken();
    showLoginModal();
}

// 带认证的fetch包装函数（带超时）
async function fetchWithAuth(url, options = {}, timeout = 10000) {
    const token = getToken();
    
    // 设置请求头
    if (!options.headers) {
        options.headers = {};
    }
    
    // 如果有token，添加到请求头
    if (token) {
        options.headers['Authorization'] = `Bearer ${token}`;
    }
    
    // 添加超时控制
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        // 如果是401错误，显示登录对话框
        if (response.status === 401) {
            handleUnauthorized();
            throw new Error('未授权，请登录');
        }
        
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        // 如果是网络错误或其他错误，也检查是否需要登录
        if (error.name === 'AbortError') {
            throw new Error('请求超时，请检查网络连接或服务器状态');
        }
        if (error.message.includes('未授权')) {
            throw error;
        }
        throw error;
    }
}

// 加载HTTP头配置
async function loadHeadersConfig() {
    try {
        const response = await fetch('/api/headers');
        
        // 检查响应状态
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        // 检查响应类型
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            throw new Error('响应不是JSON格式');
        }
        
        const data = await response.json();
        
        if (data.success && data.headers) {
            window.commonHeaders = data.headers;
            // 添加自定义选项
            window.commonHeaders.push({ value: 'custom', label: '自定义HTTP头', description: '输入自定义的HTTP头' });
        }
    } catch (error) {
        console.error('加载HTTP头配置失败:', error);
        // 使用默认配置
        window.commonHeaders = [
            { value: '-Server', label: '隐藏服务器信息 (-Server)', description: '删除Server响应头，隐藏服务器信息' },
            { value: 'X-Frame-Options SAMEORIGIN', label: '防止点击劫持 (X-Frame-Options)', description: '防止页面被嵌入iframe' },
            { value: 'X-Frame-Options DENY', label: '禁止嵌入 (X-Frame-Options DENY)', description: '完全禁止页面被嵌入' },
            { value: 'X-Content-Type-Options nosniff', label: '防止MIME类型嗅探', description: '防止浏览器猜测内容类型' },
            { value: 'Strict-Transport-Security max-age=31536000', label: '强制HTTPS (HSTS)', description: '强制使用HTTPS连接' },
            { value: 'Content-Security-Policy default-src self', label: '内容安全策略 (CSP)', description: '限制资源加载来源' },
            { value: 'Access-Control-Allow-Origin *', label: '允许所有跨域', description: '允许所有来源的跨域请求' },
            { value: 'Access-Control-Allow-Origin {http.request.header.Origin}', label: '允许同源跨域', description: '允许同源跨域请求' },
            { value: 'Access-Control-Allow-Methods GET,POST,OPTIONS', label: '允许的HTTP方法', description: '指定允许的HTTP方法' },
            { value: 'Access-Control-Allow-Headers *', label: '允许所有请求头', description: '允许所有请求头' },
            { value: 'X-XSS-Protection 1; mode=block', label: 'XSS保护', description: '启用浏览器XSS过滤器' },
            { value: 'Referrer-Policy no-referrer', label: '不发送Referrer', description: '不发送Referrer信息' },
            { value: 'Referrer-Policy strict-origin-when-cross-origin', label: '跨域时发送Referrer', description: '跨域时发送Referrer信息' },
            { value: 'custom', label: '自定义HTTP头', description: '输入自定义的HTTP头' }
        ];
    }
}

// 注意：HTTP头配置现在直接从配置文件读取，不支持通过API添加/删除

// 辅助函数：获取HTTP头配置（用于查找索引）
function load_headers_config() {
    return (window.commonHeaders || []).filter(h => h.value !== 'custom');
}

// 加载常用HTTP头选项
async function loadCommonHeaders() {
    try {
        const response = await fetch('/api/config/headers');
        const data = await response.json();
        
        if (data.success && data.headers) {
            window.commonHeaders = data.headers;
            // 添加自定义选项
            window.commonHeaders.push({ value: 'custom', label: '自定义HTTP头', description: '输入自定义的HTTP头' });
        } else {
            // 如果加载失败，使用默认值
            window.commonHeaders = [
                { value: '-Server', label: '隐藏服务器信息 (-Server)', description: '删除Server响应头，隐藏服务器信息' },
                { value: 'X-Frame-Options SAMEORIGIN', label: '防止点击劫持 (X-Frame-Options)', description: '防止页面被嵌入iframe' },
                { value: 'X-Frame-Options DENY', label: '禁止嵌入 (X-Frame-Options DENY)', description: '完全禁止页面被嵌入' },
                { value: 'X-Content-Type-Options nosniff', label: '防止MIME类型嗅探', description: '防止浏览器猜测内容类型' },
                { value: 'Strict-Transport-Security max-age=31536000', label: '强制HTTPS (HSTS)', description: '强制使用HTTPS连接' },
                { value: 'Content-Security-Policy default-src self', label: '内容安全策略 (CSP)', description: '限制资源加载来源' },
                { value: 'Access-Control-Allow-Origin *', label: '允许所有跨域', description: '允许所有来源的跨域请求' },
                { value: 'Access-Control-Allow-Origin {http.request.header.Origin}', label: '允许同源跨域', description: '允许同源跨域请求' },
                { value: 'Access-Control-Allow-Methods GET,POST,OPTIONS', label: '允许的HTTP方法', description: '指定允许的HTTP方法' },
                { value: 'Access-Control-Allow-Headers *', label: '允许所有请求头', description: '允许所有请求头' },
                { value: 'X-XSS-Protection 1; mode=block', label: 'XSS保护', description: '启用浏览器XSS过滤器' },
                { value: 'Referrer-Policy no-referrer', label: '不发送Referrer', description: '不发送Referrer信息' },
                { value: 'Referrer-Policy strict-origin-when-cross-origin', label: '跨域时发送Referrer', description: '跨域时发送Referrer信息' },
                { value: 'custom', label: '自定义HTTP头', description: '输入自定义的HTTP头' }
            ];
        }
    } catch (error) {
        console.error('加载常用HTTP头选项失败:', error);
        // 使用默认值
        window.commonHeaders = [
            { value: '-Server', label: '隐藏服务器信息 (-Server)', description: '删除Server响应头，隐藏服务器信息' },
            { value: 'X-Frame-Options SAMEORIGIN', label: '防止点击劫持 (X-Frame-Options)', description: '防止页面被嵌入iframe' },
            { value: 'X-Frame-Options DENY', label: '禁止嵌入 (X-Frame-Options DENY)', description: '完全禁止页面被嵌入' },
            { value: 'X-Content-Type-Options nosniff', label: '防止MIME类型嗅探', description: '防止浏览器猜测内容类型' },
            { value: 'Strict-Transport-Security max-age=31536000', label: '强制HTTPS (HSTS)', description: '强制使用HTTPS连接' },
            { value: 'Content-Security-Policy default-src self', label: '内容安全策略 (CSP)', description: '限制资源加载来源' },
            { value: 'Access-Control-Allow-Origin *', label: '允许所有跨域', description: '允许所有来源的跨域请求' },
            { value: 'Access-Control-Allow-Origin {http.request.header.Origin}', label: '允许同源跨域', description: '允许同源跨域请求' },
            { value: 'Access-Control-Allow-Methods GET,POST,OPTIONS', label: '允许的HTTP方法', description: '指定允许的HTTP方法' },
            { value: 'Access-Control-Allow-Headers *', label: '允许所有请求头', description: '允许所有请求头' },
            { value: 'X-XSS-Protection 1; mode=block', label: 'XSS保护', description: '启用浏览器XSS过滤器' },
            { value: 'Referrer-Policy no-referrer', label: '不发送Referrer', description: '不发送Referrer信息' },
            { value: 'Referrer-Policy strict-origin-when-cross-origin', label: '跨域时发送Referrer', description: '跨域时发送Referrer信息' },
            { value: 'custom', label: '自定义HTTP头', description: '输入自定义的HTTP头' }
        ];
    }
}

// 添加常用HTTP头选项
async function addCommonHeader(header) {
    try {
        const response = await fetch('/api/config/headers/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(header)
        });
        
        const data = await response.json();
        
        if (data.success) {
            // 重新加载列表
            await loadCommonHeaders();
            return true;
        } else {
            showMessage(data.error || '添加失败', 'error');
            return false;
        }
    } catch (error) {
        showMessage('添加HTTP头选项失败: ' + error.message, 'error');
        return false;
    }
}

// 删除常用HTTP头选项
async function removeCommonHeader(value) {
    try {
        const response = await fetch('/api/config/headers/remove', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value: value })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // 重新加载列表
            await loadCommonHeaders();
            return true;
        } else {
            showMessage(data.error || '删除失败', 'error');
            return false;
        }
    } catch (error) {
        showMessage('删除HTTP头选项失败: ' + error.message, 'error');
        return false;
    }
}

// 加载Caddyfile
async function loadCaddyfile() {
    try {
        showLoading('正在加载配置...');
        
        // 备用超时机制：即使请求失败，15秒后也强制关闭loading
        const forceCloseTimeout = setTimeout(() => {
            console.warn('强制关闭loading modal（超时保护）');
            if (typeof window.forceHideModal === 'function') {
                window.forceHideModal();
            } else {
                hideLoading();
            }
            if (typeof showMessage === 'function') {
                showMessage('加载超时，请检查网络连接或刷新页面', 'error');
            }
        }, 15000);
        
        try {
            const response = await fetchWithAuth('/api/caddyfile', {}, 10000);
            
            // 清除强制关闭定时器
            clearTimeout(forceCloseTimeout);
            
            // 检查响应状态
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}: ${response.statusText}` }));
                throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                // 保存数据
                window.sitesData = data.sites || [];
                window.unparsedData = data.unparsed || [];
                window.codeContent = data.content || '';
                
                // 更新文件路径
                if (data.path) {
                    window.filePath = data.path;
                }
                
                // 更新界面：同时显示Build模式和Code模式
                // 如果有站点，自动选择第一个
                if (window.sitesData.length > 0 && window.currentSiteIndex < 0) {
                    window.currentSiteIndex = 0;
                }
                if (typeof renderBuildMode === 'function') {
                    renderBuildMode();
                }
                
                // 更新CodeMirror或textarea
                if (window.codeMirror) {
                    // 先设置标志和状态，防止 change 事件误触发
                    window.isLoading = true;
                    window.isSaved = true; // 直接设置为已保存状态
                    // 先更新原始内容，这样 change 事件触发时比较会通过
                    window.originalContent = window.codeContent || '';
                    // 设置 CodeMirror 的值（这会触发 change 事件，但会被 isLoading 标志忽略）
                    window.codeMirror.setValue(window.codeContent || '');
                    // 立即更新文件信息显示为已保存
                    if (typeof updateFileInfo === 'function') {
                        updateFileInfo();
                    }
                    // 强制刷新语法高亮
                    setTimeout(() => {
                        if (window.codeMirror) {
                            window.codeMirror.refresh();
                            // 使用自定义 Caddyfile 模式
                            window.codeMirror.setOption('mode', 'caddyfile');
                        }
                        // 加载完成后，确保状态正确
                        window.isLoading = false;
                        // 再次更新 originalContent，确保与当前值一致
                        if (window.codeMirror) {
                            window.originalContent = window.codeMirror.getValue();
                        }
                        // 确保标记为已保存
                        window.isSaved = true;
                        if (typeof markAsSaved === 'function') {
                            markAsSaved();
                        }
                    }, 200); // 增加延迟，确保所有事件都处理完
                } else {
                    const editor = document.getElementById('caddyfileEditor');
                    if (editor) {
                        editor.value = window.codeContent || '';
                    }
                    // 标记为已保存（刚加载的文件）
                    if (typeof markAsSaved === 'function') {
                        markAsSaved();
                    }
                }
                if (typeof updateStats === 'function') {
                    updateStats();
                }
                
                // 配置信息已移除，站点数量现在显示在站点列表标题中
                
                hideLoading();
                if (typeof showMessage === 'function') {
                    showMessage('配置加载成功', 'success');
                }
            } else {
                hideLoading();
                if (typeof showMessage === 'function') {
                    showMessage(data.error || '加载失败', 'error');
                }
            }
        } catch (error) {
            clearTimeout(forceCloseTimeout);
            hideLoading();
            if (typeof showMessage === 'function') {
                showMessage(error.message || '加载配置失败', 'error');
            }
            console.error('加载配置失败:', error);
        }
    } catch (error) {
        // 如果showLoading失败，也要确保能关闭
        if (typeof window.forceHideModal === 'function') {
            window.forceHideModal();
        } else {
            hideLoading();
        }
        console.error('初始化加载失败:', error);
    }
}

// 保存Caddyfile
async function saveCaddyfile() {
    showLoading('正在保存配置...');
    
    try {
        // 先同步Build模式到Code模式，确保数据一致
        await syncToCode();
        
        // 过滤掉没有地址的站点（不保存空的站点配置）
        const validSites = window.sitesData.filter(site => {
            const address = (site.address || '').trim();
            return address.length > 0;
        });
        
        // 使用结构化数据保存（更可靠）
        const payload = {
            sites: validSites,
            unparsed: window.unparsedData
        };
        
        const response = await fetchWithAuth('/api/caddyfile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }, 10000);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}: ${response.statusText}` }));
            throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            // 更新codeContent
            if (data.content) {
                window.codeContent = data.content;
            }
            
            // 标记为已保存
            if (typeof markAsSaved === 'function') {
                markAsSaved();
            }
            
            hideLoading();
            showMessage(data.message || '配置保存成功', 'success');
        } else {
            hideLoading();
            // 如果有详细信息，显示详细信息
            let errorMessage = data.error || '保存失败';
            if (data.details) {
                errorMessage += '\n' + data.details;
            }
            showMessage(errorMessage, 'error');
        }
    } catch (error) {
        hideLoading();
        showMessage(error.message || '保存配置失败', 'error');
    }
}

// 验证Caddyfile
async function validateCaddyfile() {
    showLoading('正在验证配置...');
    
    try {
        let payload;
        
        if (window.currentMode === 'build') {
            // 确保基础认证的args已正确编码
            window.sitesData.forEach((site, siteIndex) => {
                if (site.directives) {
                    site.directives.forEach((directive, dirIndex) => {
                        if (directive.name === 'basicauth' && directive.basicauthData) {
                            if (typeof updateBasicauthArgs === 'function') {
                                updateBasicauthArgs(siteIndex, dirIndex);
                            }
                        }
                    });
                }
            });
            
            payload = {
                sites: window.sitesData,
                unparsed: window.unparsedData
            };
        } else {
            // 从CodeMirror或textarea获取内容
            let content = '';
            if (window.codeMirror) {
                content = window.codeMirror.getValue();
            } else {
                const editor = document.getElementById('caddyfileEditor');
                if (editor) {
                    content = editor.value;
                }
            }
            payload = {
                content: content
            };
        }
        
        const response = await fetchWithTimeout('/api/validate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }, 10000);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}: ${response.statusText}` }));
            throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        hideLoading();
        
        if (data.success) {
            showMessage('配置验证通过', 'success');
        } else {
            showMessage(data.error || '配置验证失败', 'error');
        }
    } catch (error) {
        hideLoading();
        showMessage(error.message || '验证配置失败', 'error');
    }
}

// 重新加载Caddy
async function reloadCaddy() {
    showLoading('正在重新加载Caddy...');
    
    try {
        const response = await fetchWithAuth('/api/reload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, 10000);
        
        if (!response.ok) {
            // 检查响应类型
            const contentType = response.headers.get('content-type');
            let errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
            
            if (contentType && contentType.includes('application/json')) {
                try {
                    errorData = await response.json();
                } catch (e) {
                    // 如果解析失败，使用默认错误信息
                }
            }
            
            throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }
        
        // 检查响应类型
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            throw new Error('响应不是JSON格式');
        }
        
        const data = await response.json();
        
        hideLoading();
        
        if (data.success) {
            showMessage('Caddy重新加载成功', 'success');
        } else {
            showMessage(data.error || '重新加载失败', 'error');
        }
    } catch (error) {
        hideLoading();
        showMessage(error.message || '重新加载Caddy失败', 'error');
    }
}

// 全局变量：模板列表
window.templatesList = {};

// 加载模板列表
async function loadTemplates() {
    try {
        const response = await fetchWithTimeout('/api/templates', {}, 5000);
        if (!response.ok) return;
        
        const data = await response.json();
        if (data.templates) {
            window.templatesList = data.templates;
        }
    } catch (error) {
        console.error('加载模板列表失败:', error);
    }
}

// 显示模板选择模态框
window.showTemplateModal = function(siteIndex) {
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.id = 'templateModal';
    modal.tabIndex = -1;
    
    const templates = window.templatesList || {};
    const templateKeys = Object.keys(templates);
    
    if (templateKeys.length === 0) {
        showMessage('暂无可用模板', 'warning');
        return;
    }
    
    modal.innerHTML = `
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title"><i class="bi bi-file-earmark-text"></i> 选择模板</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <p class="text-muted">选择一个模板应用到当前站点</p>
                    <div class="list-group">
                        ${templateKeys.map(key => {
                            const template = templates[key];
                            return `
                                <button type="button" class="list-group-item list-group-item-action" onclick="applyTemplateToSite('${key}', ${siteIndex})">
                                    <div class="fw-bold">${template.name || key}</div>
                                    ${template.description ? `<small class="text-muted">${template.description}</small>` : ''}
                                </button>
                            `;
                        }).join('')}
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
    
    modal.addEventListener('hidden.bs.modal', () => {
        modal.remove();
    });
};

// 应用模板到指定站点
window.applyTemplateToSite = async function(templateKey, siteIndex) {
    const templates = window.templatesList || {};
    const template = templates[templateKey];
    
    if (!template) {
        showMessage('模板不存在', 'error');
        return;
    }
    
    showLoading('正在应用模板...');
    
    try {
        // 如果模板有结构化数据，应用到当前站点
        if (template.sites && template.sites.length > 0) {
            const templateSite = template.sites[0];
            if (siteIndex >= 0 && siteIndex < window.sitesData.length) {
                // 应用到指定站点
                window.sitesData[siteIndex].address = templateSite.address || '';
                window.sitesData[siteIndex].directives = JSON.parse(JSON.stringify(templateSite.directives || []));
                
                // 处理基础认证指令
                window.sitesData[siteIndex].directives.forEach(directive => {
                    if (directive.name === 'basicauth' && directive.args && directive.args.length >= 2) {
                        try {
                            const decoded = atob(directive.args[1]);
                            const parts = decoded.split(':');
                            if (parts.length >= 2) {
                                directive.basicauthData = {
                                    username: parts[0],
                                    password: parts.slice(1).join(':')
                                };
                            }
                        } catch (e) {
                            directive.basicauthData = {
                                username: directive.args[0] || '',
                                password: directive.args[1] || ''
                            };
                        }
                    }
                });
                
                renderBuildMode();
                // 同步到Code模式
                if (typeof syncToCode === 'function') {
                    await syncToCode();
                }
            }
        } else if (template.content) {
            // 如果只有内容，解析后应用到当前站点
            const response = await fetch('/api/parse', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: template.content })
            });
            
            const data = await response.json();
            if (data.success && data.sites && data.sites.length > 0) {
                const templateSite = data.sites[0];
                if (siteIndex >= 0 && siteIndex < window.sitesData.length) {
                    window.sitesData[siteIndex].address = templateSite.address || '';
                    window.sitesData[siteIndex].directives = JSON.parse(JSON.stringify(templateSite.directives || []));
                    
                    // 处理基础认证指令
                    window.sitesData[siteIndex].directives.forEach(directive => {
                        if (directive.name === 'basicauth' && directive.args && directive.args.length >= 2) {
                            try {
                                const decoded = atob(directive.args[1]);
                                const parts = decoded.split(':');
                                if (parts.length >= 2) {
                                    directive.basicauthData = {
                                        username: parts[0],
                                        password: parts.slice(1).join(':')
                                    };
                                }
                            } catch (e) {
                                directive.basicauthData = {
                                    username: directive.args[0] || '',
                                    password: directive.args[1] || ''
                                };
                            }
                        }
                    });
                    
                    renderBuildMode();
                    // 同步到Code模式
                    if (typeof syncToCode === 'function') {
                        await syncToCode();
                    }
                }
            }
        }
        
        // 关闭模态框
        const modal = bootstrap.Modal.getInstance(document.getElementById('templateModal'));
        if (modal) {
            modal.hide();
        }
        
        hideLoading();
        showMessage('模板应用成功', 'success');
    } catch (error) {
        hideLoading();
        showMessage(error.message || '应用模板失败', 'error');
    }
};

// 从Code模式同步到Build模式
window.syncFromCode = async function() {
    if (window.syncInProgress) return;
    
    // 从CodeMirror或textarea获取内容
    let content = '';
    if (window.codeMirror) {
        content = window.codeMirror.getValue();
    } else {
        const editor = document.getElementById('caddyfileEditor');
        if (editor) {
            content = editor.value;
        }
    }
    
    if (!content) return;
    
    window.codeContent = content;
    
    // 解析内容
    if (content.trim()) {
        try {
            window.syncInProgress = true;
            // 使用解析API
            const response = await fetch('/api/parse', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: content })
            });
            
            const data = await response.json();
            
            if (data.success) {
                window.sitesData = data.sites || [];
                window.unparsedData = data.unparsed || [];
                
                // 确保每个站点都有notes字段
                window.sitesData.forEach(site => {
                    if (!site.hasOwnProperty('notes')) {
                        site.notes = '';
                    }
                });
                
                // 处理基础认证指令：尝试解码base64
                window.sitesData.forEach(site => {
                    if (site.directives) {
                        site.directives.forEach(directive => {
                            if (directive.name === 'basicauth' && directive.args && directive.args.length >= 2) {
                                try {
                                    // 尝试解码base64
                                    const decoded = atob(directive.args[1]);
                                    const parts = decoded.split(':');
                                    if (parts.length >= 2) {
                                        // 保存原始用户名和密码
                                        directive.basicauthData = {
                                            username: parts[0],
                                            password: parts.slice(1).join(':')
                                        };
                                    }
                                } catch (e) {
                                    // 如果解码失败，可能是原始格式，保留args
                                    directive.basicauthData = {
                                        username: directive.args[0] || '',
                                        password: directive.args[1] || ''
                                    };
                                }
                            }
                        });
                    }
                });
                
                // 更新Build模式显示
                if (typeof renderBuildMode === 'function') {
                    renderBuildMode();
                }
            }
        } catch (err) {
            console.error('同步失败:', err);
        } finally {
            window.syncInProgress = false;
        }
    } else {
        window.sitesData = [];
        window.unparsedData = [];
        if (typeof renderBuildMode === 'function') {
            renderBuildMode();
        }
    }
};

// 从Build模式同步到Code模式
window.syncToCode = async function() {
    if (window.syncInProgress) return;
    
    // 确保基础认证的args已正确编码
    window.sitesData.forEach((site, siteIndex) => {
        if (site.directives) {
            site.directives.forEach((directive, dirIndex) => {
                if (directive.name === 'basicauth' && directive.basicauthData) {
                    // 确保args已编码
                    if (typeof updateBasicauthArgs === 'function') {
                        updateBasicauthArgs(siteIndex, dirIndex);
                    }
                }
            });
        }
    });
    
    // 调用后端API生成配置内容
    try {
        window.syncInProgress = true;
        const payload = {
            sites: window.sitesData,
            unparsed: window.unparsedData
        };
        
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        
        if (data.success && data.content) {
            // 更新CodeMirror或textarea
            let currentContent = '';
            if (window.codeMirror) {
                currentContent = window.codeMirror.getValue();
                if (currentContent !== data.content) {
                    window.codeMirror.setValue(data.content);
                    window.codeContent = data.content;
                    // 强制刷新语法高亮
                    setTimeout(() => {
                        if (window.codeMirror) {
                            window.codeMirror.refresh();
                            // 使用自定义 Caddyfile 模式
                            window.codeMirror.setOption('mode', 'caddyfile');
                        }
                    }, 100);
                    updateStats();
                }
            } else {
                const editor = document.getElementById('caddyfileEditor');
                if (editor && editor.value !== data.content) {
                    editor.value = data.content;
                    window.codeContent = data.content;
                    updateStats();
                }
            }
        } else {
            console.error('生成配置失败:', data.error);
        }
    } catch (err) {
        console.error('同步失败:', err);
    } finally {
        window.syncInProgress = false;
    }
};

