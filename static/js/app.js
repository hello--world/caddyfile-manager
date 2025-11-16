// Caddyfile 编辑器主入口

// 全局状态
window.loadingModal = null;
window.codeMirror = null; // CodeMirror 实例
window.sitesData = []; // 站点数据
window.unparsedData = []; // 未解析内容
window.codeContent = ''; // Code模式的内容
window.currentSiteIndex = -1; // 当前选中的站点索引
window.syncInProgress = false; // 防止同步循环
window.filePath = ''; // 当前文件路径
window.isSaved = true; // 文件是否已保存
window.originalContent = ''; // 原始内容（用于比较是否修改）
window.isLoading = false; // 是否正在加载文件（用于忽略加载时的 change 事件）

// 显示/隐藏加载模态框
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

// 强制关闭modal（直接操作DOM）- 全局函数
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

// Split.js 实例
window.mainSplit = null;
window.editorSplit = null;

// 初始化 Split.js 可调整宽度面板
function initSplitPanes() {
    // 只在桌面端初始化Split.js
    if (window.innerWidth <= 768) {
        return;
    }
    
    // 初始化主分割（左侧站点列表和右侧编辑区）
    const sitesListColumn = document.getElementById('sitesListColumn');
    const editorColumn = document.getElementById('editorColumn');
    
    if (sitesListColumn && editorColumn && typeof Split !== 'undefined') {
        try {
            // 从localStorage读取保存的宽度比例
            const savedMainSizes = localStorage.getItem('caddyfile_main_split_sizes');
            const mainSizes = savedMainSizes ? JSON.parse(savedMainSizes) : [20, 80];
            
            window.mainSplit = Split([sitesListColumn, editorColumn], {
                sizes: mainSizes,
                minSize: [200, 400],
                gutterSize: 4,
                cursor: 'col-resize',
                direction: 'horizontal',
                onDragEnd: function(sizes) {
                    // 保存宽度比例到localStorage
                    localStorage.setItem('caddyfile_main_split_sizes', JSON.stringify(sizes));
                }
            });
        } catch (e) {
            console.error('初始化主分割面板失败:', e);
        }
    }
    
    // 初始化编辑器分割（可视化编辑和代码编辑）
    const buildModeColumn = document.getElementById('buildModeColumn');
    const codeModeColumn = document.getElementById('codeModeColumn');
    
    if (buildModeColumn && codeModeColumn && typeof Split !== 'undefined') {
        try {
            // 从localStorage读取保存的宽度比例
            const savedEditorSizes = localStorage.getItem('caddyfile_editor_split_sizes');
            const editorSizes = savedEditorSizes ? JSON.parse(savedEditorSizes) : [50, 50];
            
            window.editorSplit = Split([buildModeColumn, codeModeColumn], {
                sizes: editorSizes,
                minSize: [300, 300],
                gutterSize: 4,
                cursor: 'col-resize',
                direction: 'horizontal',
                onDragEnd: function(sizes) {
                    // 保存宽度比例到localStorage
                    localStorage.setItem('caddyfile_editor_split_sizes', JSON.stringify(sizes));
                    // 调整后刷新CodeMirror
                    if (window.codeMirror) {
                        setTimeout(() => {
                            window.codeMirror.refresh();
                        }, 100);
                    }
                }
            });
        } catch (e) {
            console.error('初始化编辑器分割面板失败:', e);
        }
    }
}

// 页面加载完成后初始化
function init() {
    // 初始化 Split.js 可调整宽度面板
    if (typeof Split !== 'undefined') {
        // 等待DOM完全加载后再初始化
        setTimeout(() => {
            initSplitPanes();
        }, 100);
    }
    
    // 初始化 CodeMirror
    const container = document.getElementById('codeMirrorContainer');
    const textarea = document.getElementById('caddyfileEditor');
    if (container && typeof CodeMirror !== 'undefined') {
        // 等待容器尺寸稳定后再初始化
        setTimeout(() => {
            // 定义自定义 Caddyfile 模式
            CodeMirror.defineMode("caddyfile", function() {
                return {
                    token: function(stream, state) {
                        // 处理注释（以 # 开头）
                        if (stream.match(/^#.*/)) {
                            return "comment";
                        }
                        
                        // 处理指令名（行首的非空白字符）
                        if (stream.sol() && stream.match(/^\s*\S+/)) {
                            return "keyword";
                        }
                        
                        // 处理字符串（引号内的内容）
                        if (stream.match(/^["'][^"']*["']/)) {
                            return "string";
                        }
                        
                        // 处理路径（包含 / 的字符串）
                        if (stream.match(/^\/[^\s]*/)) {
                            return "string";
                        }
                        
                        // 处理 IP 地址和端口
                        if (stream.match(/^\d+\.\d+\.\d+\.\d+(:\d+)?/)) {
                            return "number";
                        }
                        
                        // 处理 URL
                        if (stream.match(/^https?:\/\/[^\s]+/)) {
                            return "string";
                        }
                        
                        // 跳过空白
                        if (stream.eatSpace()) {
                            return null;
                        }
                        
                        // 默认情况
                        stream.next();
                        return null;
                    },
                    startState: function() {
                        return {};
                    }
                };
            });
            
            window.codeMirror = CodeMirror(container, {
                value: textarea ? textarea.value : '',
                mode: 'caddyfile', // 使用自定义 Caddyfile 模式
                theme: 'monokai',
                lineNumbers: true,
                lineWrapping: true,
                indentUnit: 4,
                tabSize: 4,
                indentWithTabs: false,
                autofocus: false,
                placeholder: '在此输入或编辑Caddyfile配置...'
            });
            
            // 监听编辑器内容变化，实时同步到Build模式
            let syncTimeout = null;
            window.codeMirror.on('change', function() {
                // 如果正在加载，忽略这次 change 事件
                if (window.isLoading) {
                    return;
                }
                
                // 检查内容是否真的改变了（与原始内容比较）
                const currentContent = window.codeMirror.getValue();
                if (currentContent === window.originalContent) {
                    // 内容没有改变，不标记为未保存
                    return;
                }
                
                updateStats();
                // 标记为未保存
                markAsUnsaved();
                // 防抖：延迟500ms后同步
                clearTimeout(syncTimeout);
                syncTimeout = setTimeout(() => {
                    if (!window.syncInProgress) {
                        syncFromCode();
                    }
                }, 500);
            });
            
            // 同步到隐藏的textarea（用于表单提交等）
            if (textarea) {
                window.codeMirror.on('change', function() {
                    textarea.value = window.codeMirror.getValue();
                });
            }
            
            // 确保 CodeMirror 尺寸正确
            setTimeout(() => {
                if (window.codeMirror) {
                    window.codeMirror.refresh();
                }
            }, 100);
        }, 200);
    }
    
    // 初始化 SimpleBar（如果已加载）
    if (typeof SimpleBar !== 'undefined') {
        // 初始化所有带有 data-simplebar 属性的元素
        const simplebarElements = document.querySelectorAll('[data-simplebar]');
        simplebarElements.forEach(element => {
            try {
                // 如果已经初始化，先销毁
                if (element.SimpleBar) {
                    element.SimpleBar.unMount();
                }
                // 重新初始化
                new SimpleBar(element);
            } catch (e) {
                console.warn('SimpleBar初始化失败:', e);
            }
        });
    }
    
    // 监听窗口大小变化，重新初始化Split.js
    let resizeTimeout = null;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            // 如果窗口大小变化，重新初始化Split.js
            if (window.innerWidth > 768) {
                // 销毁旧的Split实例
                if (window.mainSplit) {
                    try {
                        window.mainSplit.destroy();
                    } catch (e) {
                        // 忽略错误
                    }
                    window.mainSplit = null;
                }
                if (window.editorSplit) {
                    try {
                        window.editorSplit.destroy();
                    } catch (e) {
                        // 忽略错误
                    }
                    window.editorSplit = null;
                }
                // 重新初始化
                initSplitPanes();
                // 刷新CodeMirror
                if (window.codeMirror) {
                    setTimeout(() => {
                        window.codeMirror.refresh();
                    }, 100);
                }
            }
        }, 300);
    });
    
    // 移动端：确保站点列表默认折叠
    if (window.innerWidth < 768 && typeof bootstrap !== 'undefined') {
        const sitesListContent = document.getElementById('sitesListContent');
        if (sitesListContent) {
            const collapse = new bootstrap.Collapse(sitesListContent, {
                toggle: false
            });
            collapse.hide();
        }
    }
    
    // 监听Bootstrap Collapse事件来更新图标（移动端）
    const sitesListContent = document.getElementById('sitesListContent');
    const toggleIcon = document.getElementById('sitesListToggleIcon');
    
    if (sitesListContent && toggleIcon && typeof bootstrap !== 'undefined') {
        sitesListContent.addEventListener('shown.bs.collapse', function() {
            toggleIcon.classList.remove('bi-chevron-down');
            toggleIcon.classList.add('bi-chevron-up');
            // 确保站点列表在展开后可见
            const sitesList = document.getElementById('sitesList');
            if (sitesList) {
                sitesList.style.display = 'block';
                sitesList.style.visibility = 'visible';
                sitesList.style.opacity = '1';
            }
            // 重新渲染站点列表以确保内容可见
            if (typeof renderSitesList === 'function') {
                setTimeout(() => {
                    renderSitesList();
                }, 100);
            }
        });
        
        sitesListContent.addEventListener('hidden.bs.collapse', function() {
            toggleIcon.classList.remove('bi-chevron-up');
            toggleIcon.classList.add('bi-chevron-down');
        });
    }
    
    // 加载Caddyfile
    loadCaddyfile();
    
    // 加载模板列表
    if (typeof loadTemplates === 'function') {
        loadTemplates();
    }
    
    // 加载HTTP头配置
    if (typeof loadHeadersConfig === 'function') {
        loadHeadersConfig();
    }
    
    updateStats();
    updateFileInfo();
}

// 切换站点列表显示/隐藏（移动端）
window.toggleSitesList = function(event) {
    // 阻止事件冒泡
    if (event) {
        event.stopPropagation();
    }
    
    // 只在移动端生效
    if (window.innerWidth >= 768) {
        return;
    }
    
    const sitesListContent = document.getElementById('sitesListContent');
    if (sitesListContent && typeof bootstrap !== 'undefined') {
        // 获取或创建Collapse实例
        let collapse = bootstrap.Collapse.getInstance(sitesListContent);
        if (!collapse) {
            collapse = new bootstrap.Collapse(sitesListContent, {
                toggle: true
            });
        } else {
            collapse.toggle();
        }
    }
};

// 更新文件信息显示
function updateFileInfo() {
    const filePathElement = document.getElementById('filePath');
    const fileStatusElement = document.getElementById('fileStatus');
    
    if (filePathElement) {
        if (window.filePath) {
            filePathElement.textContent = `配置文件：${window.filePath}`;
        } else {
            filePathElement.textContent = '配置文件：未加载';
        }
    }
    
    if (fileStatusElement) {
        if (window.isSaved) {
            fileStatusElement.textContent = '已保存';
            fileStatusElement.className = 'badge bg-success';
        } else {
            fileStatusElement.textContent = '未保存';
            fileStatusElement.className = 'badge bg-warning';
        }
    }
}

// 标记为未保存
function markAsUnsaved() {
    window.isSaved = false;
    updateFileInfo();
}

// 标记为已保存
function markAsSaved() {
    window.isSaved = true;
    // 更新原始内容
    if (window.currentMode === 'code') {
        if (window.codeMirror) {
            window.originalContent = window.codeMirror.getValue();
        } else {
            const editor = document.getElementById('caddyfileEditor');
            if (editor) {
                window.originalContent = editor.value;
            }
        }
    } else {
        // 从Build模式生成内容作为原始内容
        window.originalContent = JSON.stringify(window.sitesData);
    }
    updateFileInfo();
}

// 更新统计信息
function updateStats() {
    const lineCountEl = document.getElementById('lineCount');
    const charCountEl = document.getElementById('charCount');
    
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
    
    if (lineCountEl) lineCountEl.textContent = `行数: ${lines}`;
    if (charCountEl) charCountEl.textContent = `字符: ${chars}`;
}

// 设置编辑器内容
function setEditorContent(content) {
    if (window.codeMirror) {
        window.codeMirror.setValue(content || '');
        // 强制刷新语法高亮
        setTimeout(() => {
            if (window.codeMirror) {
                window.codeMirror.refresh();
                // 使用自定义 Caddyfile 模式
                window.codeMirror.setOption('mode', 'caddyfile');
            }
        }, 100);
    } else {
        const editor = document.getElementById('caddyfileEditor');
        if (editor) {
            editor.value = content || '';
        }
    }
    updateStats();
}

// 获取编辑器内容
function getEditorContent() {
    if (window.codeMirror) {
        return window.codeMirror.getValue();
    } else {
        const editor = document.getElementById('caddyfileEditor');
        return editor ? editor.value : '';
    }
}

// DOM加载完成后初始化
function startInit() {
    // 确保 Bootstrap 已加载
    if (typeof bootstrap === 'undefined') {
        console.warn('Bootstrap未加载，等待...');
        setTimeout(startInit, 100);
        return;
    }
    
    // 确保 CodeMirror 已加载（可选）
    if (typeof CodeMirror === 'undefined') {
        console.warn('CodeMirror未加载，继续初始化...');
    }
    
    init();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startInit);
} else {
    // DOM已经加载完成，直接执行初始化
    startInit();
}
