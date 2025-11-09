// 工具函数模块

// 显示消息（使用Bootstrap）
function showMessage(message, type = 'info') {
    const messageArea = document.getElementById('messageArea');
    if (!messageArea) return;
    
    const alertClass = {
        'success': 'alert-success',
        'error': 'alert-danger',
        'warning': 'alert-warning',
        'info': 'alert-info'
    }[type] || 'alert-info';
    
    const alert = document.createElement('div');
    alert.className = `alert ${alertClass} alert-dismissible fade show pointer-events-auto`;
    alert.style.maxWidth = '500px';
    alert.style.margin = '0 auto 10px';
    alert.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    messageArea.innerHTML = '';
    messageArea.appendChild(alert);
    
    // 3秒后自动关闭
    setTimeout(() => {
        if (alert.parentNode) {
            const bsAlert = bootstrap.Alert.getOrCreateInstance(alert);
            bsAlert.close();
        }
    }, 3000);
}

// 显示加载提示（使用Bootstrap）
function showLoading(text = '处理中...') {
    const modalElement = document.getElementById('loadingModal');
    const textEl = document.getElementById('loadingText');
    if (textEl) {
        textEl.textContent = text;
    }
    if (modalElement) {
        // 确保 Bootstrap 已加载
        if (typeof bootstrap !== 'undefined') {
            if (!window.loadingModal) {
                try {
                    window.loadingModal = new bootstrap.Modal(modalElement);
                } catch (e) {
                    console.error('初始化Modal失败:', e);
                    // 如果初始化失败，直接显示
                    modalElement.style.display = 'block';
                    modalElement.classList.add('show');
                    return;
                }
            }
            window.loadingModal.show();
        } else {
            // Bootstrap 未加载，直接显示
            console.warn('Bootstrap未加载，直接显示modal');
            modalElement.style.display = 'block';
            modalElement.classList.add('show');
        }
    }
}

// 隐藏加载提示（使用Bootstrap）
function hideLoading() {
    const modalElement = document.getElementById('loadingModal');
    if (!modalElement) return;
    
    // 确保 Bootstrap 已加载
    if (typeof bootstrap !== 'undefined') {
        if (window.loadingModal) {
            try {
                window.loadingModal.hide();
                // 等待一下，如果还没关闭，强制关闭
                setTimeout(() => {
                    if (modalElement.classList.contains('show')) {
                        if (typeof window.forceHideModal === 'function') {
                            window.forceHideModal();
                        }
                    }
                }, 200);
            } catch (e) {
                console.error('隐藏Modal失败:', e);
                if (typeof window.forceHideModal === 'function') {
                    window.forceHideModal();
                }
            }
        } else {
            const modal = bootstrap.Modal.getInstance(modalElement);
            if (modal) {
                try {
                    modal.hide();
                    setTimeout(() => {
                        if (modalElement.classList.contains('show')) {
                            if (typeof window.forceHideModal === 'function') {
                                window.forceHideModal();
                            }
                        }
                    }, 200);
                } catch (e) {
                    if (typeof window.forceHideModal === 'function') {
                        window.forceHideModal();
                    }
                }
            } else {
                if (typeof window.forceHideModal === 'function') {
                    window.forceHideModal();
                }
            }
        }
    } else {
        if (typeof window.forceHideModal === 'function') {
            window.forceHideModal();
        }
    }
}

// 强制关闭modal（直接操作DOM）- 全局函数（如果app.js中已定义则使用那个）
if (typeof window.forceHideModal === 'undefined') {
    window.forceHideModal = function() {
        const modalElement = document.getElementById('loadingModal');
        if (modalElement) {
            modalElement.style.display = 'none';
            modalElement.classList.remove('show');
            modalElement.setAttribute('aria-hidden', 'true');
            modalElement.removeAttribute('aria-modal');
            modalElement.removeAttribute('role');
        }
        
        // 移除backdrop
        const backdrops = document.querySelectorAll('.modal-backdrop');
        backdrops.forEach(backdrop => backdrop.remove());
        
        // 恢复body样式
        document.body.classList.remove('modal-open');
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
    };
}

// 带超时的fetch请求
async function fetchWithTimeout(url, options = {}, timeout = 10000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error('请求超时，请检查网络连接或服务器状态');
        }
        throw error;
    }
}

// 更新统计信息（使用CodeMirror或textarea）
function updateStats() {
    let content = '';
    if (window.codeMirror) {
        content = window.codeMirror.getValue();
    } else {
        const editor = document.getElementById('caddyfileEditor');
        if (editor) {
            content = editor.value;
        }
    }
    
    const lines = content.split('\n').length;
    const chars = content.length;
    
    const lineCountEl = document.getElementById('lineCount');
    const charCountEl = document.getElementById('charCount');
    
    if (lineCountEl) lineCountEl.textContent = `行数: ${lines}`;
    if (charCountEl) charCountEl.textContent = `字符: ${chars}`;
}

