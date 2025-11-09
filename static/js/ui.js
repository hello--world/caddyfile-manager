// UI渲染模块

// 全局变量：保存当前可见的第一个站点索引（用于恢复滚动位置）
let savedFirstVisibleSiteIndex = null;

// 渲染Build模式
function renderBuildMode() {
    renderSitesList();
    renderCurrentSite();
    
    // 如果有保存的可见站点索引，恢复滚动位置
    if (savedFirstVisibleSiteIndex !== null) {
        const sitesList = document.getElementById('sitesList');
        if (sitesList) {
            // 找到对应站点索引的列表项
            const targetItem = sitesList.querySelector(`.list-group-item[data-site-index="${savedFirstVisibleSiteIndex}"]`);
            
            if (targetItem) {
                // 使用 requestAnimationFrame 确保 DOM 完全更新后再滚动
                requestAnimationFrame(() => {
                    targetItem.scrollIntoView({ behavior: 'auto', block: 'start' });
                    savedFirstVisibleSiteIndex = null; // 清除保存的索引
                });
            } else {
                savedFirstVisibleSiteIndex = null;
            }
        }
    }
    
    // 显示未解析内容
    const unparsedContainer = document.getElementById('unparsedContainer');
    const unparsedContent = document.getElementById('unparsedContent');
    if (window.unparsedData && window.unparsedData.length > 0) {
        if (unparsedContainer) unparsedContainer.style.display = 'block';
        if (unparsedContent) unparsedContent.textContent = window.unparsedData.join('\n');
    } else {
        if (unparsedContainer) unparsedContainer.style.display = 'none';
    }
}

// 全局变量：搜索关键词
window.siteSearchKeyword = '';

// Split.js布局下不需要折叠逻辑

// 渲染站点列表
function renderSitesList() {
    const sitesList = document.getElementById('sitesList');
    if (!sitesList) return;
    
    // 更新站点列表标题，显示站点数量
    const sitesListTitle = document.getElementById('sitesListTitle');
    const sitesListTitleMobile = document.getElementById('sitesListTitleMobile');
    const siteCount = window.sitesData.length;
    if (sitesListTitle) {
        sitesListTitle.textContent = `站点【${siteCount}】`;
    }
    if (sitesListTitleMobile) {
        sitesListTitleMobile.textContent = `站点【${siteCount}】`;
    }
    
    // 保存当前可见的第一个站点索引（用于恢复滚动位置）
    const scrollContainer = sitesList.parentElement;
    if (scrollContainer && savedFirstVisibleSiteIndex === null) {
        const listItems = sitesList.querySelectorAll('.list-group-item');
        if (listItems.length > 0) {
            const containerTop = scrollContainer.scrollTop;
            const containerHeight = scrollContainer.clientHeight;
            
            // 找到第一个可见的列表项，并提取其站点索引
            for (let i = 0; i < listItems.length; i++) {
                const item = listItems[i];
                const itemTop = item.offsetTop;
                const itemBottom = itemTop + item.offsetHeight;
                
                // 如果列表项在可见区域内
                if (itemBottom > containerTop && itemTop < containerTop + containerHeight) {
                    // 从 data-site-index 属性中获取站点索引
                    const siteIndex = item.getAttribute('data-site-index');
                    if (siteIndex !== null) {
                        savedFirstVisibleSiteIndex = parseInt(siteIndex);
                        break;
                    }
                }
            }
        }
    }
    
    sitesList.innerHTML = '';
    
    if (window.sitesData.length === 0) {
        sitesList.innerHTML = `
            <div class="text-center p-3 text-muted">
                <small>暂无站点</small>
            </div>
        `;
        return;
    }
    
    // 过滤站点（根据搜索关键词，按优先级排序）
    const keyword = window.siteSearchKeyword.toLowerCase().trim();
    
    if (!keyword) {
        // 没有关键词时，显示所有站点
        var filteredSites = window.sitesData.map((site, index) => ({ site, index, priority: 0 }));
    } else {
        // 有关键词时，计算每个站点的优先级并过滤
        var filteredSites = window.sitesData.map((site, index) => {
            let priority = 0;
            let matched = false;
            
            // 优先级1：搜索站点地址（域名）- 最高优先级
            const address = (site.address || '').toLowerCase();
            if (address.includes(keyword)) {
                priority = 1000; // 最高优先级
                matched = true;
            }
            
            // 优先级2：搜索备注
            if (!matched) {
                const notes = (site.notes || '').toLowerCase();
                if (notes.includes(keyword)) {
                    priority = 500; // 中等优先级
                    matched = true;
                }
            }
            
            // 优先级3：搜索指令名称和参数
            if (!matched && site.directives && site.directives.length > 0) {
                for (const directive of site.directives) {
                    const name = (directive.name || '').toLowerCase();
                    if (name.includes(keyword)) {
                        priority = 100; // 较低优先级
                        matched = true;
                        break;
                    }
                    
                    if (directive.args && directive.args.length > 0) {
                        const argsText = directive.args.join(' ').toLowerCase();
                        if (argsText.includes(keyword)) {
                            priority = 50; // 最低优先级
                            matched = true;
                            break;
                        }
                    }
                }
            }
            
            // 只返回匹配的站点
            if (matched) {
                return { site, index, priority };
            }
            return null;
        }).filter(item => item !== null);
        
        // 按优先级降序排序（优先级高的在前）
        filteredSites.sort((a, b) => b.priority - a.priority);
    }
    
    if (filteredSites.length === 0 && keyword) {
        sitesList.innerHTML = `
            <div class="text-center p-3 text-muted">
                <small>未找到匹配的站点</small>
            </div>
        `;
        return;
    }
    
    // 高亮搜索关键词
    const highlightText = (text, keyword) => {
        if (!keyword || !text) return text;
        const regex = new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    };
    
    filteredSites.forEach(({ site, index }) => {
        const listItem = document.createElement('a');
        listItem.href = '#';
        listItem.className = `list-group-item list-group-item-action ${window.currentSiteIndex === index ? 'active' : ''}`;
        listItem.setAttribute('data-site-index', index);
        listItem.onclick = (e) => {
            e.preventDefault();
            selectSite(index);
        };
        
        const address = site.address || '未命名站点';
        const directiveCount = (site.directives || []).length;
        const notes = site.notes || '';
        
        listItem.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <div class="flex-grow-1">
                    <div class="fw-bold">${highlightText(address, keyword)}</div>
                    ${notes ? `<small class="text-muted d-block">${highlightText(notes, keyword)}</small>` : ''}
                    <small class="text-muted">${directiveCount} 个指令</small>
                </div>
                <button class="btn btn-sm btn-outline-danger ms-2" onclick="event.stopPropagation(); removeSite(${index})" title="删除站点">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        `;
        
        sitesList.appendChild(listItem);
    });
    
    // 如果没有保存的滚动位置，确保列表容器滚动位置在顶部
    if (savedFirstVisibleSiteIndex === null) {
        const scrollContainer = sitesList.parentElement;
        if (scrollContainer) {
            // 使用 requestAnimationFrame 确保 DOM 更新后再滚动
            requestAnimationFrame(() => {
                scrollContainer.scrollTop = 0;
            });
        }
    }
}

// 过滤站点（搜索）
window.filterSites = function() {
    const searchInput = document.getElementById('siteSearchInput');
    if (searchInput) {
        window.siteSearchKeyword = searchInput.value;
        renderSitesList();
    }
};

// 清除搜索
window.clearSearch = function() {
    const searchInput = document.getElementById('siteSearchInput');
    if (searchInput) {
        searchInput.value = '';
        window.siteSearchKeyword = '';
        renderSitesList();
    }
};

// 渲染当前选中的站点
function renderCurrentSite() {
    const container = document.getElementById('sitesContainer');
    
    if (!container) return;
    
    // 保存未解析内容容器
    const unparsedContainer = document.getElementById('unparsedContainer');
    let unparsedHTML = '';
    if (unparsedContainer) {
        unparsedHTML = unparsedContainer.outerHTML;
    }
    
    container.innerHTML = '';
    
    if (window.currentSiteIndex < 0 || window.currentSiteIndex >= window.sitesData.length) {
        container.innerHTML = `
            <div class="empty-state" style="padding: 40px; text-align: center; color: #6c757d;">
                <i class="bi bi-inbox" style="font-size: 3em; margin-bottom: 15px; display: block;"></i>
                <p style="margin: 0;">请从左侧列表选择一个站点进行编辑</p>
            </div>
        `;
        // 恢复未解析内容容器
        if (unparsedHTML) {
            container.insertAdjacentHTML('beforeend', unparsedHTML);
        }
        // 隐藏添加指令和模板按钮
        const addDirectiveBtn = document.getElementById('addDirectiveBtn');
        const templateBtn = document.getElementById('templateBtn');
        if (addDirectiveBtn) {
            addDirectiveBtn.style.display = 'none';
        }
        if (templateBtn) {
            templateBtn.style.display = 'none';
        }
        return;
    }
    
    const site = window.sitesData[window.currentSiteIndex];
    const siteCard = createSiteCard(site, window.currentSiteIndex);
    container.appendChild(siteCard);
    
    // 恢复未解析内容容器
    if (unparsedHTML) {
        container.insertAdjacentHTML('beforeend', unparsedHTML);
    }
    
    // 显示添加指令和模板按钮
    const addDirectiveBtn = document.getElementById('addDirectiveBtn');
    const templateBtn = document.getElementById('templateBtn');
    if (addDirectiveBtn) {
        addDirectiveBtn.style.display = 'inline-block';
    }
    if (templateBtn) {
        templateBtn.style.display = 'inline-block';
    }
    
    // 确保滚动功能正常（使用绝对定位）
    setTimeout(() => {
        // 确保父容器有相对定位
        const cardBody = container.parentElement;
        if (cardBody) {
            cardBody.style.position = 'relative';
            cardBody.style.overflow = 'hidden';
        }
        // 确保容器使用绝对定位并可以滚动
        container.style.position = 'absolute';
        container.style.top = '0';
        container.style.left = '0';
        container.style.right = '0';
        container.style.bottom = '0';
        container.style.overflowY = 'auto';
        container.style.overflowX = 'hidden';
    }, 100);
}

// 选择站点
function selectSite(index) {
    if (index < 0 || index >= window.sitesData.length) return;
    window.currentSiteIndex = index;
    renderBuildMode();
    
    // 滚动代码编辑器到对应行号，并显示在顶部
    const site = window.sitesData[index];
    if (site && site.line_number && window.codeMirror) {
        // 行号从1开始，CodeMirror的行号也是从0开始，所以需要减1
        const lineNumber = site.line_number - 1;
        if (lineNumber >= 0) {
            // 使用 requestAnimationFrame 确保 DOM 更新后再滚动
            requestAnimationFrame(() => {
                // 设置光标位置
                window.codeMirror.setCursor(lineNumber, 0);
                // 滚动到指定行，让该行显示在编辑器可视区域的顶部
                // 使用 scrollTo 方法，将行滚动到顶部
                const coords = window.codeMirror.charCoords({ line: lineNumber, ch: 0 }, 'local');
                window.codeMirror.scrollTo(null, coords.top);
                // 高亮显示当前行
                window.codeMirror.addLineClass(lineNumber, 'background', 'highlight-line');
                // 2秒后移除高亮
                setTimeout(() => {
                    window.codeMirror.removeLineClass(lineNumber, 'background', 'highlight-line');
                }, 2000);
            });
        }
    }
    
    // 移动端：选择站点后自动折叠站点列表
    if (window.innerWidth < 768) {
        const sitesListContent = document.getElementById('sitesListContent');
        if (sitesListContent && typeof bootstrap !== 'undefined') {
            // 延迟折叠，让用户看到选中的效果
            setTimeout(() => {
                const collapse = bootstrap.Collapse.getInstance(sitesListContent);
                if (collapse) {
                    collapse.hide();
                } else {
                    const newCollapse = new bootstrap.Collapse(sitesListContent, {
                        toggle: false
                    });
                    newCollapse.hide();
                }
            }, 300);
        }
    }
    
    // 滚动到选中的站点列表项
    setTimeout(() => {
        const sitesList = document.getElementById('sitesList');
        if (sitesList) {
            const activeItem = sitesList.querySelector('.list-group-item.active');
            if (activeItem) {
                activeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    }, 50);
}

// 添加站点并选中
window.addSite = function() {
    window.sitesData.push({
        address: '',
        directives: [],
        notes: ''
    });
    window.currentSiteIndex = window.sitesData.length - 1;
    
    // 标记为未保存
    if (typeof markAsUnsaved === 'function') {
        markAsUnsaved();
    }
    
    renderBuildMode();
    
    // 同步到Code模式
    if (typeof syncToCode === 'function') {
        syncToCode();
    }
    
    // 滚动到新添加的站点列表项
    setTimeout(() => {
        const sitesList = document.getElementById('sitesList');
        if (sitesList) {
            const activeItem = sitesList.querySelector('.list-group-item.active');
            if (activeItem) {
                activeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
        
        // 聚焦到地址输入框
        const addressInput = document.querySelector('#sitesContainer .site-card-header input');
        if (addressInput) {
            addressInput.focus();
            addressInput.select();
        }
    }, 100);
    
    // 移动端：添加站点后自动折叠站点列表
    if (window.innerWidth < 768) {
        const sitesListContent = document.getElementById('sitesListContent');
        if (sitesListContent && typeof bootstrap !== 'undefined') {
            // 延迟折叠，让用户看到添加的效果
            setTimeout(() => {
                const collapse = bootstrap.Collapse.getInstance(sitesListContent);
                if (collapse) {
                    collapse.hide();
                } else {
                    const newCollapse = new bootstrap.Collapse(sitesListContent, {
                        toggle: false
                    });
                    newCollapse.hide();
                }
            }, 400);
        }
    }
};

// 删除站点
window.removeSite = function(index) {
    if (confirm('确定要删除这个站点吗？')) {
        window.sitesData.splice(index, 1);
        
        // 标记为未保存
        if (typeof markAsUnsaved === 'function') {
            markAsUnsaved();
        }
        
        // 如果删除的是当前选中的站点，选择前一个或第一个
        if (window.currentSiteIndex === index) {
            if (window.sitesData.length > 0) {
                window.currentSiteIndex = Math.min(index, window.sitesData.length - 1);
            } else {
                window.currentSiteIndex = -1;
            }
        } else if (window.currentSiteIndex > index) {
            window.currentSiteIndex--;
        }
        renderBuildMode();
        
        // 同步到Code模式
        if (typeof syncToCode === 'function') {
            syncToCode();
        }
    }
};

// 创建站点卡片
function createSiteCard(site, index) {
    const card = document.createElement('div');
    card.className = 'site-card';
    card.dataset.index = index;
    
    const header = document.createElement('div');
    header.className = 'site-card-header';
    
    // 站点地址（site address）- 放在顶部
    const addressContainer = document.createElement('div');
    addressContainer.className = 'mb-2';
    addressContainer.style.width = '100%';
    
    const addressLabel = document.createElement('label');
    addressLabel.className = 'form-label small text-muted';
    addressLabel.htmlFor = `site-address-${index}`;
    addressLabel.textContent = '站点地址';
    addressLabel.style.marginBottom = '4px';
    
    const addressInput = document.createElement('textarea');
    addressInput.className = 'form-control form-control-sm';
    addressInput.id = `site-address-${index}`;
    addressInput.name = `site-address-${index}`;
    addressInput.setAttribute('aria-label', '站点地址');
    addressInput.rows = 2;
    addressInput.value = site.address || '';
    addressInput.placeholder = '站点地址 (如: example.com 或 example.com www.example.com 或 :80)';
    addressInput.style.width = '100%';
    addressInput.style.resize = 'vertical';
    addressInput.oninput = () => {
        window.sitesData[index].address = addressInput.value;
        // 标记为未保存
        if (typeof markAsUnsaved === 'function') {
            markAsUnsaved();
        }
        // 更新站点列表显示
        renderSitesList();
        // 同步到Code模式
        if (typeof syncToCode === 'function') {
            syncToCode();
        }
    };
    
    addressContainer.appendChild(addressLabel);
    addressContainer.appendChild(addressInput);
    
    // 备注输入框
    const notesContainer = document.createElement('div');
    notesContainer.className = 'mb-2';
    notesContainer.style.width = '100%';
    
    const notesLabel = document.createElement('label');
    notesLabel.className = 'form-label small text-muted';
    notesLabel.htmlFor = `site-notes-${index}`;
    notesLabel.textContent = '备注';
    notesLabel.style.marginBottom = '4px';
    
    const notesInput = document.createElement('textarea');
    notesInput.className = 'form-control form-control-sm';
    notesInput.id = `site-notes-${index}`;
    notesInput.name = `site-notes-${index}`;
    notesInput.rows = 2;
    notesInput.value = site.notes || '';
    notesInput.placeholder = '输入站点说明或备注...';
    notesInput.style.resize = 'vertical';
    notesInput.oninput = () => {
        window.sitesData[index].notes = notesInput.value;
        // 标记为未保存
        if (typeof markAsUnsaved === 'function') {
            markAsUnsaved();
        }
        // 更新站点列表显示（可能包含备注）
        renderSitesList();
        // 同步到Code模式
        if (typeof syncToCode === 'function') {
            syncToCode();
        }
    };
    
    notesContainer.appendChild(notesLabel);
    notesContainer.appendChild(notesInput);
    
    // 先添加站点地址（顶部），再添加备注
    header.appendChild(addressContainer);
    header.appendChild(notesContainer);
    
    const body = document.createElement('div');
    body.className = 'site-card-body';
    
    const directives = site.directives || [];
    if (directives.length === 0) {
        body.innerHTML = `
            <div class="empty-state" style="padding: 20px;">
                <i class="bi bi-list"></i>
                <p>暂无指令</p>
                <button class="btn btn-sm btn-primary" onclick="addDirective(${index})">
                    <i class="bi bi-plus-circle"></i> 添加第一个指令
                </button>
            </div>
        `;
    } else {
        directives.forEach((directive, dirIndex) => {
            const directiveItem = createDirectiveItem(site, index, directive, dirIndex);
            body.appendChild(directiveItem);
        });
    }
    
    card.appendChild(header);
    card.appendChild(body);
    
    return card;
}

// 常用Caddy指令列表
const caddyDirectives = [
    { value: '', label: '-- 选择指令 --', placeholder: '请先选择指令类型' },
    { value: 'reverse_proxy', label: '反向代理', placeholder: '目标地址 (如: localhost:8080)', description: '将请求转发到后端服务器' },
    { value: 'file_server', label: '静态文件服务', placeholder: '留空或填写路径', description: '提供静态文件服务' },
    { value: 'root', label: '网站根目录', placeholder: '路径 (如: * /var/www)', description: '设置网站文件根目录' },
    { value: 'tls', label: 'HTTPS证书', placeholder: '邮箱 (如: admin@example.com)', description: '自动申请SSL证书' },
    { value: 'respond', label: '响应内容', placeholder: '内容 (如: "Hello, World!")', description: '直接返回响应内容' },
    { value: 'rewrite', label: 'URL重写', placeholder: '规则 (如: /api/* /api/v1/*)', description: '重写请求URL' },
    { value: 'header', label: 'HTTP头', placeholder: '规则 (如: -Server)', description: '设置或删除HTTP头', specialInput: 'header' },
    { value: 'encode', label: '内容编码', placeholder: '编码类型 (如: gzip zstd)', description: '压缩响应内容' },
    { value: 'basicauth', label: '基础认证', placeholder: '用户名 密码', description: '添加HTTP基础认证（只需输入用户名和密码）', specialInput: 'basicauth' },
    { value: 'redir', label: '重定向', placeholder: '目标URL (如: https://example.com)', description: '重定向到其他地址' },
    { value: 'log', label: '日志', placeholder: '日志名称', description: '配置访问日志' },
    { value: 'cors', label: '跨域', placeholder: '留空或配置选项', description: '启用CORS跨域支持' },
    { value: 'cache', label: '缓存', placeholder: '缓存配置', description: '配置HTTP缓存' },
    { value: 'custom', label: '自定义指令', placeholder: '指令名 参数', description: '使用自定义指令' }
];

// 创建指令项
function createDirectiveItem(site, siteIndex, directive, dirIndex) {
    const item = document.createElement('div');
    item.className = 'directive-item';
    
    // 指令名选择框
    const nameLabel = document.createElement('label');
    nameLabel.className = 'form-label small visually-hidden';
    nameLabel.htmlFor = `directive-name-${siteIndex}-${dirIndex}`;
    nameLabel.textContent = '指令名称';
    
    const nameSelect = document.createElement('select');
    nameSelect.className = 'form-select form-select-sm directive-name';
    nameSelect.id = `directive-name-${siteIndex}-${dirIndex}`;
    nameSelect.name = `directive-name-${siteIndex}-${dirIndex}`;
    nameSelect.setAttribute('aria-label', '指令名称');
    nameSelect.value = directive.name || '';
    
    // 填充选项
    caddyDirectives.forEach(dir => {
        const option = document.createElement('option');
        option.value = dir.value;
        option.textContent = dir.label;
        if (dir.value === directive.name) {
            option.selected = true;
        }
        nameSelect.appendChild(option);
    });
    
    // 如果指令名不在列表中，添加自定义选项
    if (directive.name && !caddyDirectives.find(d => d.value === directive.name)) {
        const customOption = document.createElement('option');
        customOption.value = directive.name;
        customOption.textContent = `自定义: ${directive.name}`;
        customOption.selected = true;
        nameSelect.insertBefore(customOption, nameSelect.firstChild.nextSibling);
    }
    
    // 根据选择的指令设置占位符
    const selectedDir = caddyDirectives.find(d => d.value === directive.name);
    
    // 参数输入容器
    const argsContainer = document.createElement('div');
    argsContainer.className = 'directive-args';
    
    // 常用HTTP头选项（从服务端加载）
    // 如果还没有加载，使用默认值
    if (!window.commonHeaders || window.commonHeaders.length === 0) {
        if (typeof loadHeadersConfig === 'function') {
            loadHeadersConfig();
        }
    }
    
    // 检查是否需要特殊输入方式
    if (selectedDir && selectedDir.specialInput === 'basicauth') {
        // 基础认证：提供用户名和密码两个输入框
        const basicauthData = directive.basicauthData || { username: '', password: '' };
        
        // 尝试从args解析（如果是base64编码的）
        if (directive.args && directive.args.length >= 2) {
            try {
                // 尝试解码base64
                const decoded = atob(directive.args[1]);
                const parts = decoded.split(':');
                if (parts.length >= 2) {
                    basicauthData.username = parts[0];
                    basicauthData.password = parts.slice(1).join(':');
                }
            } catch (e) {
                // 如果解码失败，可能是原始格式
                basicauthData.username = directive.args[0] || '';
                basicauthData.password = directive.args[1] || '';
            }
        }
        
        const usernameLabel = document.createElement('label');
        usernameLabel.className = 'form-label small';
        usernameLabel.htmlFor = `basicauth-username-${siteIndex}-${dirIndex}`;
        usernameLabel.textContent = '用户名';
        usernameLabel.style.marginBottom = '2px';
        
        const usernameInput = document.createElement('input');
        usernameInput.type = 'text';
        usernameInput.className = 'form-control form-control-sm';
        usernameInput.id = `basicauth-username-${siteIndex}-${dirIndex}`;
        usernameInput.name = `basicauth-username-${siteIndex}-${dirIndex}`;
        usernameInput.placeholder = '用户名';
        usernameInput.value = basicauthData.username || '';
        usernameInput.style.marginBottom = '5px';
        usernameInput.oninput = () => {
            if (!directive.basicauthData) {
                directive.basicauthData = {};
            }
            directive.basicauthData.username = usernameInput.value;
            // 标记为未保存
            if (typeof markAsUnsaved === 'function') {
                markAsUnsaved();
            }
            // 更新args（生成时会自动编码）
            updateBasicauthArgs(siteIndex, dirIndex);
            // 同步到Code模式
            if (typeof syncToCode === 'function') {
                syncToCode();
            }
        };
        
        const passwordLabel = document.createElement('label');
        passwordLabel.className = 'form-label small';
        passwordLabel.htmlFor = `basicauth-password-${siteIndex}-${dirIndex}`;
        passwordLabel.textContent = '密码';
        passwordLabel.style.marginBottom = '2px';
        
        const passwordInput = document.createElement('input');
        passwordInput.type = 'password';
        passwordInput.className = 'form-control form-control-sm';
        passwordInput.id = `basicauth-password-${siteIndex}-${dirIndex}`;
        passwordInput.name = `basicauth-password-${siteIndex}-${dirIndex}`;
        passwordInput.placeholder = '密码';
        passwordInput.value = basicauthData.password || '';
        passwordInput.oninput = () => {
            if (!directive.basicauthData) {
                directive.basicauthData = {};
            }
            directive.basicauthData.password = passwordInput.value;
            // 标记为未保存
            if (typeof markAsUnsaved === 'function') {
                markAsUnsaved();
            }
            // 更新args（生成时会自动编码）
            updateBasicauthArgs(siteIndex, dirIndex);
            // 同步到Code模式
            if (typeof syncToCode === 'function') {
                syncToCode();
            }
        };
        
        argsContainer.appendChild(usernameLabel);
        argsContainer.appendChild(usernameInput);
        argsContainer.appendChild(passwordLabel);
        argsContainer.appendChild(passwordInput);
    } else if (selectedDir && selectedDir.specialInput === 'header') {
        // HTTP头：提供常用选项选择
        const currentValue = (directive.args || []).join(' ');
        
        const headerLabel = document.createElement('label');
        headerLabel.className = 'form-label small';
        headerLabel.htmlFor = `header-select-${siteIndex}-${dirIndex}`;
        headerLabel.textContent = 'HTTP头';
        headerLabel.style.marginBottom = '2px';
        
        const headerSelect = document.createElement('select');
        headerSelect.className = 'form-select form-select-sm';
        headerSelect.id = `header-select-${siteIndex}-${dirIndex}`;
        headerSelect.name = `header-select-${siteIndex}-${dirIndex}`;
        headerSelect.style.marginBottom = '5px';
        
        // 添加选项
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = '-- 选择常用HTTP头 --';
        headerSelect.appendChild(defaultOption);
        
        // 使用全局的commonHeaders
        const commonHeaders = window.commonHeaders || [];
        commonHeaders.forEach(header => {
            if (header.value === 'custom') return; // 跳过自定义选项，后面单独处理
            const option = document.createElement('option');
            option.value = header.value;
            option.textContent = header.label;
            if (header.value === currentValue || (header.value !== 'custom' && currentValue.startsWith(header.value.split(' ')[0]))) {
                option.selected = true;
            }
            headerSelect.appendChild(option);
        });
        
        // 添加自定义选项
        const customOption = document.createElement('option');
        customOption.value = 'custom';
        customOption.textContent = '自定义HTTP头';
        headerSelect.appendChild(customOption);
        
        // 添加"管理选项"按钮
        const manageBtn = document.createElement('button');
        manageBtn.type = 'button';
        manageBtn.className = 'btn btn-sm btn-outline-secondary';
        manageBtn.innerHTML = '<i class="bi bi-gear"></i>';
        manageBtn.title = '管理HTTP头选项';
        manageBtn.style.marginLeft = '5px';
        manageBtn.onclick = () => showHeaderManageModal();
        
        // 自定义输入框
        const customInputLabel = document.createElement('label');
        customInputLabel.className = 'form-label small';
        customInputLabel.htmlFor = `header-custom-${siteIndex}-${dirIndex}`;
        customInputLabel.textContent = '自定义HTTP头';
        customInputLabel.style.marginBottom = '2px';
        customInputLabel.style.display = 'none';
        
        const customInput = document.createElement('input');
        customInput.type = 'text';
        customInput.className = 'form-control form-control-sm';
        customInput.id = `header-custom-${siteIndex}-${dirIndex}`;
        customInput.name = `header-custom-${siteIndex}-${dirIndex}`;
        customInput.placeholder = '或输入自定义HTTP头 (如: -Server 或 X-Custom-Header value)';
        customInput.value = currentValue;
        customInput.style.display = 'none';
        
        // 检查当前值是否在常用选项中
        const isInCommonList = commonHeaders.some(h => h.value === currentValue);
        if (!isInCommonList && currentValue) {
            customInput.style.display = 'block';
            customInputLabel.style.display = 'block';
            customOption.selected = true;
        }
        
               headerSelect.onchange = () => {
                   const selectedValue = headerSelect.value;
                   if (selectedValue === 'custom' || selectedValue === '') {
                       customInput.style.display = 'block';
                       customInputLabel.style.display = 'block';
                       if (selectedValue === '') {
                           customInput.value = '';
                       }
                   } else {
                       customInput.style.display = 'none';
                       customInputLabel.style.display = 'none';
                       customInput.value = selectedValue;
                       // 更新args
                       const args = selectedValue.split(/\s+/).filter(a => a.trim());
                       window.sitesData[siteIndex].directives[dirIndex].args = args;
                   }
                   // 标记为未保存
                   if (typeof markAsUnsaved === 'function') {
                       markAsUnsaved();
                   }
                   // 同步到Code模式
                   if (typeof syncToCode === 'function') {
                       syncToCode();
                   }
               };
        
               customInput.oninput = () => {
                   const args = customInput.value.split(/\s+/).filter(a => a.trim());
                   window.sitesData[siteIndex].directives[dirIndex].args = args;
                   // 标记为未保存
                   if (typeof markAsUnsaved === 'function') {
                       markAsUnsaved();
                   }
                   // 如果输入的值在常用列表中，更新选择框
                   const matchingHeader = commonHeaders.find(h => h.value === customInput.value);
                   if (matchingHeader) {
                       headerSelect.value = matchingHeader.value;
                       customInput.style.display = 'none';
                   } else if (customInput.value) {
                       headerSelect.value = 'custom';
                   }
                   // 同步到Code模式
                   if (typeof syncToCode === 'function') {
                       syncToCode();
                   }
               };
        
        const headerSelectContainer = document.createElement('div');
        headerSelectContainer.className = 'd-flex align-items-center';
        headerSelectContainer.style.width = '100%';
        headerSelectContainer.appendChild(headerSelect);
        headerSelectContainer.appendChild(manageBtn);
        
        argsContainer.appendChild(headerLabel);
        argsContainer.appendChild(headerSelectContainer);
        argsContainer.appendChild(customInputLabel);
        argsContainer.appendChild(customInput);
    } else {
        // 普通指令：单个输入框
        const argsLabel = document.createElement('label');
        argsLabel.className = 'form-label small';
        argsLabel.htmlFor = `directive-args-${siteIndex}-${dirIndex}`;
        argsLabel.textContent = '参数';
        argsLabel.style.marginBottom = '2px';
        
        const argsInput = document.createElement('input');
        argsInput.type = 'text';
        argsInput.className = 'form-control form-control-sm';
        argsInput.id = `directive-args-${siteIndex}-${dirIndex}`;
        argsInput.name = `directive-args-${siteIndex}-${dirIndex}`;
        argsInput.value = (directive.args || []).join(' ');
        
        if (selectedDir) {
            argsInput.placeholder = selectedDir.placeholder || '输入参数';
        } else {
            argsInput.placeholder = '输入参数 (空格分隔)';
        }
        
        argsInput.oninput = () => {
            const args = argsInput.value.split(/\s+/).filter(a => a.trim());
            window.sitesData[siteIndex].directives[dirIndex].args = args;
            // 标记为未保存
            if (typeof markAsUnsaved === 'function') {
                markAsUnsaved();
            }
            // 同步到Code模式
            if (typeof syncToCode === 'function') {
                syncToCode();
            }
        };
        
        argsContainer.appendChild(argsLabel);
        argsContainer.appendChild(argsInput);
    }
    
    // 选择指令时更新
    nameSelect.onchange = () => {
        const selectedValue = nameSelect.value;
        if (selectedValue === 'custom') {
            // 如果是自定义，弹出输入框
            const customName = prompt('请输入自定义指令名:', directive.name || '');
            if (customName) {
                window.sitesData[siteIndex].directives[dirIndex].name = customName;
                // 标记为未保存
                if (typeof markAsUnsaved === 'function') {
                    markAsUnsaved();
                }
                // 重新渲染以更新选择框
                renderBuildMode();
                // 同步到Code模式
                if (typeof syncToCode === 'function') {
                    syncToCode();
                }
            } else {
                nameSelect.value = directive.name || '';
            }
        } else {
            window.sitesData[siteIndex].directives[dirIndex].name = selectedValue;
            // 标记为未保存
            if (typeof markAsUnsaved === 'function') {
                markAsUnsaved();
            }
            // 重新渲染以更新输入框
            renderBuildMode();
            // 同步到Code模式
            if (typeof syncToCode === 'function') {
                syncToCode();
            }
        }
    };
    
    // 删除按钮
    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn btn-sm btn-danger';
    removeBtn.innerHTML = '<i class="bi bi-trash"></i>';
    removeBtn.title = '删除指令';
    removeBtn.onclick = () => removeDirective(siteIndex, dirIndex);
    
    // 指令说明（可选）
    const descriptionDiv = document.createElement('div');
    descriptionDiv.className = 'directive-description';
    descriptionDiv.style.fontSize = '0.85em';
    descriptionDiv.style.color = '#6c757d';
    descriptionDiv.style.marginTop = '4px';
    
    if (selectedDir && selectedDir.description) {
        descriptionDiv.textContent = selectedDir.description;
    }
    
    // 监听选择变化，更新说明
    nameSelect.addEventListener('change', () => {
        const selected = caddyDirectives.find(d => d.value === nameSelect.value);
        if (selected && selected.description) {
            descriptionDiv.textContent = selected.description;
        } else {
            descriptionDiv.textContent = '';
        }
    });
    
    argsContainer.appendChild(descriptionDiv);
    
    item.appendChild(nameLabel);
    item.appendChild(nameSelect);
    item.appendChild(argsContainer);
    item.appendChild(removeBtn);
    
    return item;
}

// 更新基础认证的args（自动编码）
function updateBasicauthArgs(siteIndex, dirIndex) {
    const directive = window.sitesData[siteIndex].directives[dirIndex];
    if (directive.name === 'basicauth' && directive.basicauthData) {
        const username = directive.basicauthData.username || '';
        const password = directive.basicauthData.password || '';
        if (username && password) {
            // 编码为base64: username:password
            const encoded = btoa(`${username}:${password}`);
            directive.args = [username, encoded];
        } else {
            directive.args = [];
        }
    }
}

// 添加指令
window.addDirective = function(siteIndex) {
    if (!window.sitesData[siteIndex].directives) {
        window.sitesData[siteIndex].directives = [];
    }
    window.sitesData[siteIndex].directives.push({
        name: '',
        args: []
    });
    
    // 标记为未保存
    if (typeof markAsUnsaved === 'function') {
        markAsUnsaved();
    }
    
    // 保存当前可见的第一个站点索引（renderSitesList 会检查并保存）
    savedFirstVisibleSiteIndex = null; // 重置，让 renderSitesList 重新计算
    
    // 渲染构建模式（内部会调用 renderSitesList，并在完成后恢复滚动位置）
    renderBuildMode();
    
    // 同步到Code模式
    if (typeof syncToCode === 'function') {
        syncToCode();
    }
};

// 删除指令
window.removeDirective = function(siteIndex, dirIndex) {
    if (confirm('确定要删除这个指令吗？')) {
        window.sitesData[siteIndex].directives.splice(dirIndex, 1);
        // 标记为未保存
        if (typeof markAsUnsaved === 'function') {
            markAsUnsaved();
        }
        renderBuildMode();
        // 更新站点列表中的指令数量
        renderSitesList();
        // 同步到Code模式
        if (typeof syncToCode === 'function') {
            syncToCode();
        }
    }
};

// 显示HTTP头管理模态框
function showHeaderManageModal() {
    // 创建模态框
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.id = 'headerManageModal';
    modal.tabIndex = -1;
    
    const config = window.headersConfig || {};
    const allHeaders = (window.commonHeaders || []).filter(h => h.value !== 'custom');
    const defaultHeaders = config.defaultHeaders || [];
    const customHeaders = config.customHeaders || [];
    const storageType = config.storageType || 'local';
    
    // 分离默认配置和用户配置
    const defaultHeaderValues = new Set(defaultHeaders.map(h => h.value));
    const defaultList = allHeaders.filter(h => h.isDefault !== false && defaultHeaderValues.has(h.value));
    const customList = allHeaders.filter(h => h.isDefault === false || !defaultHeaderValues.has(h.value));
    
    modal.innerHTML = `
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title"><i class="bi bi-gear"></i> 管理HTTP头选项</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="alert alert-info mb-3">
                        <small>
                            <i class="bi bi-info-circle"></i> 
                            存储方式: <strong>${storageType === 'redis' ? 'Redis' : '本地文件'}</strong>
                            <br>
                            默认配置（${defaultList.length}个）会提交到Git，用户配置（${customList.length}个）不会提交到Git
                        </small>
                    </div>
                    <div class="mb-3">
                        <button class="btn btn-sm btn-primary" onclick="showAddHeaderForm()">
                            <i class="bi bi-plus-circle"></i> 添加新选项
                        </button>
                    </div>
                    <div id="addHeaderForm" style="display: none;" class="mb-3 p-3 bg-light rounded">
                        <h6>添加HTTP头选项（用户配置）</h6>
                        <div class="mb-2">
                            <label class="form-label small" for="newHeaderValue">HTTP头值 <span class="text-danger">*</span></label>
                            <input type="text" class="form-control form-control-sm" id="newHeaderValue" name="newHeaderValue" placeholder="如: -Server 或 X-Custom-Header value">
                        </div>
                        <div class="mb-2">
                            <label class="form-label small" for="newHeaderLabel">显示名称</label>
                            <input type="text" class="form-control form-control-sm" id="newHeaderLabel" name="newHeaderLabel" placeholder="如: 隐藏服务器信息">
                        </div>
                        <div class="mb-2">
                            <label class="form-label small" for="newHeaderDescription">描述</label>
                            <input type="text" class="form-control form-control-sm" id="newHeaderDescription" name="newHeaderDescription" placeholder="如: 删除Server响应头">
                        </div>
                        <div class="d-flex gap-2">
                            <button class="btn btn-sm btn-success" onclick="saveNewHeader()">保存</button>
                            <button class="btn btn-sm btn-secondary" onclick="cancelAddHeader()">取消</button>
                        </div>
                    </div>
                    <h6 class="mt-3 mb-2">默认配置 <span class="badge bg-secondary">${defaultList.length}</span></h6>
                    <div class="list-group mb-3">
                        ${defaultList.length > 0 ? defaultList.map((header, index) => {
                            const originalIndex = allHeaders.findIndex(h => h.value === header.value);
                            return `
                                <div class="list-group-item">
                                    <div class="d-flex justify-content-between align-items-start">
                                        <div class="flex-grow-1">
                                            <div class="fw-bold">${header.label || header.value}</div>
                                            <small class="text-muted">${header.value}</small>
                                            ${header.description ? `<div class="small text-muted mt-1">${header.description}</div>` : ''}
                                        </div>
                                        <span class="badge bg-secondary ms-2">默认</span>
                                    </div>
                                </div>
                            `;
                        }).join('') : '<div class="list-group-item text-muted">暂无默认配置</div>'}
                    </div>
                    <h6 class="mt-3 mb-2">用户配置 <span class="badge bg-primary">${customList.length}</span></h6>
                    <div class="list-group">
                        ${customList.length > 0 ? customList.map((header, index) => {
                            const originalIndex = allHeaders.findIndex(h => h.value === header.value);
                            return `
                                <div class="list-group-item d-flex justify-content-between align-items-start">
                                    <div class="flex-grow-1">
                                        <div class="fw-bold">${header.label || header.value}</div>
                                        <small class="text-muted">${header.value}</small>
                                        ${header.description ? `<div class="small text-muted mt-1">${header.description}</div>` : ''}
                                    </div>
                                    <button class="btn btn-sm btn-outline-danger ms-2" onclick="deleteHeaderOption(${originalIndex})" title="删除">
                                        <i class="bi bi-trash"></i>
                                    </button>
                                </div>
                            `;
                        }).join('') : '<div class="list-group-item text-muted">暂无用户配置</div>'}
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">关闭</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
    
    // 模态框关闭后移除
    modal.addEventListener('hidden.bs.modal', () => {
        modal.remove();
    });
}

// 显示添加HTTP头表单
function showAddHeaderForm() {
    const form = document.getElementById('addHeaderForm');
    if (form) {
        form.style.display = 'block';
        document.getElementById('newHeaderValue')?.focus();
    }
}

// 取消添加HTTP头
function cancelAddHeader() {
    const form = document.getElementById('addHeaderForm');
    if (form) {
        form.style.display = 'none';
        document.getElementById('newHeaderValue').value = '';
        document.getElementById('newHeaderLabel').value = '';
        document.getElementById('newHeaderDescription').value = '';
    }
}

// 保存新HTTP头
async function saveNewHeader() {
    showMessage('HTTP头配置需要直接修改 config/directives.yaml 配置文件中的 header 指令配置，修改后请刷新页面', 'info');
    cancelAddHeader();
}

// 删除HTTP头选项
async function deleteHeaderOption(index) {
    showMessage('HTTP头配置需要直接修改 config/directives.yaml 配置文件中的 header 指令配置，修改后请刷新页面', 'info');
}

// 切换模式
async function switchMode(mode) {
    window.currentMode = mode;
    
    const buildBtn = document.getElementById('buildModeBtn');
    const codeBtn = document.getElementById('codeModeBtn');
    const buildEditor = document.getElementById('buildModeEditor');
    const codeEditor = document.getElementById('codeModeEditor');
    const syncBtn = document.getElementById('syncFromCodeBtn');
    
    if (mode === 'build') {
        buildBtn.classList.add('active');
        buildBtn.classList.remove('btn-outline-primary');
        buildBtn.classList.add('btn-primary');
        codeBtn.classList.remove('active');
        codeBtn.classList.remove('btn-primary');
        codeBtn.classList.add('btn-outline-primary');
        buildEditor.style.display = 'block';
        codeEditor.style.display = 'none';
        syncBtn.style.display = 'none';
        
        // 从Code模式同步数据（等待完成）
        await syncFromCode();
        renderBuildMode();
    } else {
        codeBtn.classList.add('active');
        codeBtn.classList.remove('btn-outline-primary');
        codeBtn.classList.add('btn-primary');
        buildBtn.classList.remove('active');
        buildBtn.classList.remove('btn-primary');
        buildBtn.classList.add('btn-outline-primary');
        buildEditor.style.display = 'none';
        codeEditor.style.display = 'block';
        syncBtn.style.display = 'block';
        
        // 从Build模式同步到Code模式（等待完成）
        await syncToCode();
    }
}

