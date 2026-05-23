// ===== 全局状态 =====
let files = [];
let rules = [];
let presets = JSON.parse(localStorage.getItem('renamePresets') || '[]');
let historyStack = [];
let ruleIdCounter = 0;

// ===== 初始化 =====
document.addEventListener('DOMContentLoaded', () => {
    initDefaultPresets();
    renderPresets();
    updateStats();

    // 拖拽事件
    const dropZone = document.getElementById('dropZone');

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        handleFiles(e.dataTransfer.files);
    });
});

// ===== 文件处理 =====
function selectFiles() {
    document.getElementById('fileInput').click();
}

function handleFiles(fileList) {
    const newFiles = Array.from(fileList).map((file, index) => ({
        id: Date.now() + index,
        file: file,
        originalName: file.name,
        newName: file.name,
        status: 'pending',
        path: file.webkitRelativePath || file.name
    }));

    files = [...files, ...newFiles];
    applyRules();
    renderFiles();
    updateStats();

    // 文件过多提示
    const fileHint = document.getElementById('fileHint');
    if (fileHint) {
        if (files.length > 50) {
            fileHint.classList.add('show');
        } else {
            fileHint.classList.remove('show');
        }
    }
}

function clearFiles() {
    files = [];
    renderFiles();
    updateStats();
    const fileHint = document.getElementById('fileHint');
    if (fileHint) fileHint.classList.remove('show');
}

// ===== 规则管理 =====
function toggleDropdown() {
    document.getElementById('addRuleMenu').classList.toggle('show');
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('.add-rule-menu')) {
        document.getElementById('addRuleMenu').classList.remove('show');
    }
});

function addRule(type) {
    ruleIdCounter++;
    const rule = {
        id: ruleIdCounter,
        type: type,
        enabled: true,
        params: getDefaultParams(type)
    };
    rules.push(rule);
    renderRules();
    applyRules();
    updateStats();
    document.getElementById('addRuleMenu').classList.remove('show');
}

function getDefaultParams(type) {
    switch(type) {
        case 'replace': return { search: '', replace: '', caseSensitive: false };
        case 'regex': return { pattern: '', replacement: '', flags: 'g' };
        case 'sequence': return { start: 1, step: 1, digits: 3, position: 'end', separator: '_' };
        case 'case': return { caseType: 'lower' };
        case 'insert': return { text: '', position: 'start', index: 0 };
        case 'remove': return { start: 0, end: 0, pattern: '' };
        case 'clear': return { keepExtension: true };
        case 'custom': return { code: '// 可用变量: name (文件名), ext (扩展名), index (索引)\n// 返回新文件名\nreturn name + "_" + index;' };
        default: return {};
    }
}

function removeRule(id) {
    rules = rules.filter(r => r.id !== id);
    renderRules();
    applyRules();
    updateStats();
}

function moveRule(id, direction) {
    const index = rules.findIndex(r => r.id === id);
    if (index === -1) return;

    if (direction === 'up' && index > 0) {
        [rules[index], rules[index - 1]] = [rules[index - 1], rules[index]];
    } else if (direction === 'down' && index < rules.length - 1) {
        [rules[index], rules[index + 1]] = [rules[index + 1], rules[index]];
    }

    renderRules();
    applyRules();
}

function updateRuleParam(id, key, value) {
    const rule = rules.find(r => r.id === id);
    if (rule) {
        rule.params[key] = value;
        applyRules();
    }
}

// ===== 渲染规则 =====
function renderRules() {
    const container = document.getElementById('ruleList');

    if (rules.length === 0) {
        container.innerHTML = '<div class="empty-state" id="emptyRules"><p>暂无规则，点击上方按钮添加</p></div>';
        return;
    }

    container.innerHTML = rules.map((rule, index) => `
        <div class="rule-item" data-id="${rule.id}" data-type="${rule.type}">
            <div class="rule-header">
                <div class="rule-title">
                    <span class="rule-number">${index + 1}</span>
                    ${getRuleIcon(rule.type)} ${getRuleName(rule.type)}
                </div>
                <div class="rule-actions">
                    <button class="icon-btn" onclick="moveRule(${rule.id}, 'up')" title="上移">↑</button>
                    <button class="icon-btn" onclick="moveRule(${rule.id}, 'down')" title="下移">↓</button>
                    <button class="icon-btn delete" onclick="removeRule(${rule.id})" title="删除">×</button>
                </div>
            </div>
            ${renderRuleParams(rule)}
        </div>
    `).join('');
}

function getRuleIcon(type) {
    const icons = {
        replace: '',
        regex: '',
        sequence: '',
        case: '',
        insert: '',
        remove: '',
        custom: ''
    };
    return icons[type] || '';
}

function getRuleName(type) {
    const names = {
        replace: '查找替换',
        regex: '正则表达式',
        sequence: '序列号',
        case: '大小写转换',
        insert: '插入文本',
        remove: '删除清理',
        custom: '自定义 JS',
        clear: '清空文件名'
    };
    return names[type] || type;
}

function renderRuleParams(rule) {
    const p = rule.params;
    switch(rule.type) {
        case 'replace':
            return `
                <div class="form-group">
                    <label>查找</label>
                    <input type="text" class="form-control" value="${escapeHtml(p.search)}" oninput="updateRuleParam(${rule.id}, 'search', this.value)" placeholder="要查找的文本">
                </div>
                <div class="form-group">
                    <label>替换为</label>
                    <input type="text" class="form-control" value="${escapeHtml(p.replace)}" oninput="updateRuleParam(${rule.id}, 'replace', this.value)" placeholder="替换后的文本">
                </div>
            `;
        case 'regex':
            return `
                <div class="form-group">
                    <label>正则表达式</label>
                    <input type="text" class="form-control" value="${escapeHtml(p.pattern)}" oninput="updateRuleParam(${rule.id}, 'pattern', this.value)" placeholder="例如: \\d+">
                </div>
                <div class="form-group">
                    <label>替换为</label>
                    <input type="text" class="form-control" value="${escapeHtml(p.replacement)}" oninput="updateRuleParam(${rule.id}, 'replacement', this.value)" placeholder="例如: $1">
                </div>
            `;
        case 'sequence':
            return `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                    <div class="form-group">
                        <label>起始编号</label>
                        <input type="number" class="form-control" value="${p.start}" oninput="updateRuleParam(${rule.id}, 'start', parseInt(this.value)||0)">
                    </div>
                    <div class="form-group">
                        <label>步长</label>
                        <input type="number" class="form-control" value="${p.step}" oninput="updateRuleParam(${rule.id}, 'step', parseInt(this.value)||1)">
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                    <div class="form-group">
                        <label>位数</label>
                        <input type="number" class="form-control" value="${p.digits}" oninput="updateRuleParam(${rule.id}, 'digits', parseInt(this.value)||1)">
                    </div>
                    <div class="form-group">
                        <label>位置</label>
                        <select class="form-control" onchange="updateRuleParam(${rule.id}, 'position', this.value)">
                            <option value="end" ${p.position === 'end' ? 'selected' : ''}>末尾</option>
                            <option value="start" ${p.position === 'start' ? 'selected' : ''}>开头</option>
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label>分隔符</label>
                    <input type="text" class="form-control" value="${escapeHtml(p.separator)}" oninput="updateRuleParam(${rule.id}, 'separator', this.value)">
                </div>
            `;
        case 'case':
            return `
                <div class="form-group">
                    <label>转换方式</label>
                    <select class="form-control" onchange="updateRuleParam(${rule.id}, 'caseType', this.value)">
                        <option value="lower" ${p.caseType === 'lower' ? 'selected' : ''}>小写</option>
                        <option value="upper" ${p.caseType === 'upper' ? 'selected' : ''}>大写</option>
                        <option value="title" ${p.caseType === 'title' ? 'selected' : ''}>首字母大写</option>
                        <option value="camel" ${p.caseType === 'camel' ? 'selected' : ''}>驼峰命名</option>
                    </select>
                </div>
            `;
        case 'insert':
            return `
                <div class="form-group">
                    <label>插入文本</label>
                    <input type="text" class="form-control" value="${escapeHtml(p.text)}" oninput="updateRuleParam(${rule.id}, 'text', this.value)" placeholder="要插入的文本">
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                    <div class="form-group">
                        <label>位置</label>
                        <select class="form-control" onchange="updateRuleParam(${rule.id}, 'position', this.value)">
                            <option value="start" ${p.position === 'start' ? 'selected' : ''}>开头</option>
                            <option value="end" ${p.position === 'end' ? 'selected' : ''}>末尾</option>
                            <option value="index" ${p.position === 'index' ? 'selected' : ''}>指定位置</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>索引位置</label>
                        <input type="number" class="form-control" value="${p.index}" oninput="updateRuleParam(${rule.id}, 'index', parseInt(this.value)||0)" ${p.position !== 'index' ? 'disabled' : ''}>
                    </div>
                </div>
            `;
        case 'remove':
            return `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                    <div class="form-group">
                        <label>起始位置</label>
                        <input type="number" class="form-control" value="${p.start}" oninput="updateRuleParam(${rule.id}, 'start', parseInt(this.value)||0)">
                    </div>
                    <div class="form-group">
                        <label>结束位置</label>
                        <input type="number" class="form-control" value="${p.end}" oninput="updateRuleParam(${rule.id}, 'end', parseInt(this.value)||0)">
                    </div>
                </div>
                <div class="form-group">
                    <label>或匹配模式（留空则按位置）</label>
                    <input type="text" class="form-control" value="${escapeHtml(p.pattern)}" oninput="updateRuleParam(${rule.id}, 'pattern', this.value)" placeholder="要删除的文本">
                </div>
            `;
        case 'clear':
            return `
                <div class="form-group">
                    <label>
                        <input type="checkbox" ${p.keepExtension ? 'checked' : ''} onchange="updateRuleParam(${rule.id}, 'keepExtension', this.checked)">
                        保留扩展名
                    </label>
                    <p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 4px;">
                        勾选后保留原扩展名，否则文件名完全清空
                    </p>
                </div>
            `;
        case 'custom':
            return `
                <div class="form-group">
                    <label>JavaScript 代码</label>
                    <textarea class="js-editor" oninput="updateRuleParam(${rule.id}, 'code', this.value)" placeholder="// 可用变量: name (文件名), ext (扩展名), index (索引)\n// 返回新文件名\nreturn name + '_' + index;">${escapeHtml(p.code)}</textarea>
                </div>
            `;
        default:
            return '';
    }
}

function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ===== 应用规则 =====
function applyRules() {
    if (files.length === 0) return;

    files.forEach((fileObj, index) => {
        let name = fileObj.originalName;

        rules.forEach(rule => {
            if (!rule.enabled) return;

            // 每个规则处理前重新计算当前 baseName 和 ext
            let ext = name.includes('.') ? name.slice(name.lastIndexOf('.')) : '';
            let baseName = name.includes('.') ? name.slice(0, name.lastIndexOf('.')) : name;

            try {
                switch(rule.type) {
                    case 'replace':
                        const flags = rule.params.caseSensitive ? 'g' : 'gi';
                        name = name.replace(new RegExp(escapeRegex(rule.params.search), flags), rule.params.replace);
                        break;
                    case 'regex':
                        const regex = new RegExp(rule.params.pattern, rule.params.flags || 'g');
                        name = name.replace(regex, rule.params.replacement);
                        break;
                    case 'sequence':
                        const seq = String(rule.params.start + index * rule.params.step).padStart(rule.params.digits, '0');
                        if (rule.params.position === 'end') {
                            name = baseName + rule.params.separator + seq + ext;
                        } else {
                            name = seq + rule.params.separator + baseName + ext;
                        }
                        break;
                    case 'case':
                        const base = name.includes('.') ? name.slice(0, name.lastIndexOf('.')) : name;
                        const extension = name.includes('.') ? name.slice(name.lastIndexOf('.')) : '';
                        switch(rule.params.caseType) {
                            case 'lower': name = base.toLowerCase() + extension; break;
                            case 'upper': name = base.toUpperCase() + extension; break;
                            case 'title': 
                                name = base.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()) + extension;
                                break;
                            case 'camel':
                                name = base.toLowerCase().replace(/[^a-zA-Z0-9]+(.)/g, (m, chr) => chr.toUpperCase()) + extension;
                                break;
                        }
                        break;
                    case 'insert':
                        if (rule.params.position === 'start') {
                            name = rule.params.text + name;
                        } else if (rule.params.position === 'end') {
                            name = name + rule.params.text;
                        } else {
                            const idx = Math.max(0, Math.min(rule.params.index, name.length));
                            name = name.slice(0, idx) + rule.params.text + name.slice(idx);
                        }
                        break;
                    case 'remove':
                        if (rule.params.pattern) {
                            name = name.split(rule.params.pattern).join('');
                        } else if (rule.params.start < rule.params.end) {
                            name = name.slice(0, rule.params.start) + name.slice(rule.params.end);
                        }
                        break;
                    case 'clear':
                        if (rule.params.keepExtension) {
                            name = ext;
                        } else {
                            name = '';
                        }
                        break;
                    case 'custom':
                        const fn = new Function('name', 'ext', 'index', 'originalName', rule.params.code);
                        const result = fn(baseName, ext, index, fileObj.originalName);
                        if (result) name = result + ext;
                        break;
                }
            } catch(e) {
                console.error('Rule error:', e);
            }
        });

        fileObj.newName = name || fileObj.originalName;
    });

    checkConflicts();
    renderFiles();
}

function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function checkConflicts() {
    const names = files.map(f => f.newName.toLowerCase());
    const conflicts = [];

    files.forEach((file, i) => {
        const count = names.filter(n => n === file.newName.toLowerCase()).length;
        if (count > 1) {
            conflicts.push(i);
            file.status = 'conflict';
        } else {
            file.status = 'pending';
        }
    });

    const warning = document.getElementById('conflictWarning');
    if (conflicts.length > 0) {
        warning.classList.add('show');
        document.getElementById('conflictText').textContent = `检测到 ${conflicts.length} 个文件名冲突，请修改规则`;
    } else {
        warning.classList.remove('show');
    }

    document.getElementById('conflictCount').textContent = `${conflicts.length} 个冲突`;
    document.getElementById('applyBtn').disabled = conflicts.length > 0 || files.length === 0;
}

// ===== 渲染文件列表 =====
function renderFiles() {
    const container = document.getElementById('fileItems');
    const list = document.getElementById('fileList');

    if (files.length === 0) {
        list.style.display = 'none';
        return;
    }

    list.style.display = 'block';
    container.innerHTML = files.map((file, index) => `
        <div class="file-item">
            <div class="index">${index + 1}</div>
            <div class="old-name" title="${escapeHtml(file.originalName)}">${escapeHtml(file.originalName)}</div>
            <div class="new-name" title="${escapeHtml(file.newName)}">${escapeHtml(file.newName)}</div>
            <div class="status">
                <span class="status-badge status-${file.status}">${getStatusText(file.status)}</span>
            </div>
        </div>
    `).join('');
}

function getStatusText(status) {
    const map = { pending: '待处理', success: '成功', error: '错误', conflict: '冲突' };
    return map[status] || status;
}

// ===== 应用重命名 =====
async function applyRename() {
    if (!window.showDirectoryPicker) {
        showToast('您的浏览器不支持 File System Access API，请使用脚本导出功能', 'error');
        return;
    }

    try {
        // 请求读写权限
        const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
        let successCount = 0;
        let errorCount = 0;
        const errors = [];

        // 保存历史用于撤销
        historyStack.push(files.map(f => ({...f})));

        for (const fileObj of files) {
            // 跳过未变更的文件
            if (fileObj.originalName === fileObj.newName) {
                fileObj.status = 'success';
                successCount++;
                continue;
            }

            try {
                // 1. 获取原文件句柄和内容
                const oldFileHandle = await dirHandle.getFileHandle(fileObj.originalName);
                const oldFile = await oldFileHandle.getFile();
                const fileContent = await oldFile.arrayBuffer();

                // 2. 创建新文件（新文件名）
                const newFileHandle = await dirHandle.getFileHandle(fileObj.newName, { create: true });
                const writable = await newFileHandle.createWritable();
                await writable.write(fileContent);
                await writable.close();

                // 3. 删除原文件
                await dirHandle.removeEntry(fileObj.originalName);

                fileObj.status = 'success';
                successCount++;
            } catch(e) {
                fileObj.status = 'error';
                errorCount++;
                errors.push(`${fileObj.originalName}: ${e.message}`);
                console.error('Rename error:', e);
            }
        }

        renderFiles();

        if (errorCount > 0) {
            showToast(`成功 ${successCount} 个，失败 ${errorCount} 个`, 'warning');
            console.error('Errors:', errors);
        } else {
            showToast(`成功重命名 ${successCount} 个文件`, 'success');
        }
    } catch(e) {
        if (e.name === 'AbortError') {
            showToast('操作已取消', 'info');
        } else {
            showToast('操作发生错误: ' + e.message, 'error');
            console.error(e);
        }
    }
}

// ===== 预设管理 =====
function savePreset() {
    const name = prompt('预设名称:');
    if (!name) return;

    const preset = {
        id: Date.now(),
        name: name,
        rules: JSON.parse(JSON.stringify(rules)),
        created: new Date().toLocaleString()
    };

    presets.push(preset);
    localStorage.setItem('renamePresets', JSON.stringify(presets));
    renderPresets();
    showToast('预设已保存', 'success');
}

function renderPresets() {
    const container = document.getElementById('presetList');
    if (presets.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.85rem;">暂无预设</p>';
        return;
    }

    container.innerHTML = presets.map(p => `
        <div class="preset-item" onclick="loadPreset(${p.id})">
            <div>
                <div style="font-weight: 500;">${escapeHtml(p.name)}</div>
                <div style="font-size: 0.8rem; color: var(--text-secondary);">${p.created} · ${p.rules.length} 条规则</div>
            </div>
            <button class="icon-btn delete" onclick="event.stopPropagation(); deletePreset(${p.id})" title="删除">×</button>
        </div>
    `).join('');
}

function loadPreset(id) {
    const preset = presets.find(p => p.id === id);
    if (!preset) return;

    rules = JSON.parse(JSON.stringify(preset.rules));
    renderRules();
    applyRules();
    updateStats();
    showToast('预设已加载', 'success');
}

function deletePreset(id) {
    presets = presets.filter(p => p.id !== id);
    localStorage.setItem('renamePresets', JSON.stringify(presets));
    renderPresets();
}

function exportPresets() {
    const data = JSON.stringify(presets, null, 2);
    downloadFile(data, 'rename-presets.json', 'application/json');
}

function importPresets() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                presets = JSON.parse(event.target.result);
                localStorage.setItem('renamePresets', JSON.stringify(presets));
                renderPresets();
                showToast('预设已导入', 'success');
            } catch(e) {
                showToast('导入失败，文件格式错误', 'error');
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

// ===== 脚本导出 =====
function exportScript(type) {
    if (files.length === 0) {
        showToast('请先添加文件', 'error');
        return;
    }

    let script = '';

    if (type === 'bash') {
        script = '#!/bin/bash\n# 批量重命名脚本\n# 请在文件所在目录运行\n\n';
        files.forEach(f => {
            if (f.originalName !== f.newName) {
                script += `mv "${f.originalName}" "${f.newName}"\n`;
            }
        });
        script += '\necho "重命名完成"\n';
    } else if (type === 'powershell') {
        script = '# 批量重命名脚本\n# 请在文件所在目录运行\n\n';
        files.forEach(f => {
            if (f.originalName !== f.newName) {
                script += `Rename-Item -Path "${f.originalName}" -NewName "${f.newName}"\n`;
            }
        });
        script += '\nWrite-Host "重命名完成"\n';
    }

    document.getElementById('scriptOutput').value = script;
    downloadFile(script, `rename.${type === 'bash' ? 'sh' : 'ps1'}`, 'text/plain');
}

function downloadFile(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    showToast('脚本已下载', 'success');
}

// ===== 统计 =====
function updateStats() {
    document.getElementById('fileCount').textContent = `${files.length} 个文件`;
    document.getElementById('ruleCount').textContent = `${rules.length} 条规则`;
}

// ===== Toast 提示 =====
function initDefaultPresets() {
    // 如果没有预设，添加几个常用的
    if (presets.length === 0) {
        const defaultPresets = [
            
            {
                id: 1000000000002,
                name: '项目文件编号',
                rules: [
                    { id: 1, type: 'clear', enabled: true, params: { keepExtension: true } },
                    { id: 2, type: 'insert', enabled: true, params: { text: 'PROJECT_', position: 'start', index: 0 } },
                    { id: 3, type: 'sequence', enabled: true, params: { start: 1, step: 1, digits: 3, position: 'end', separator: '_' } }
                ],
                created: '系统预设'
            },
            {
                id: 1000000000003,
                name: '音乐批量重命名',
                rules: [
                    { id: 1, type: 'clear', enabled: true, params: { keepExtension: true } },
                    { id: 2, type: 'insert', enabled: true, params: { text: 'Music_', position: 'start', index: 0 } },
                    { id: 3, type: 'sequence', enabled: true, params: { start: 1, step: 1, digits: 4, position: 'end', separator: '' } }
                ],
                created: '系统预设'
            },
            {
                id: 1000000000004,
                name: '图片批量重命名',
                rules: [
                    { id: 1, type: 'clear', enabled: true, params: { keepExtension: true } },
                    { id: 2, type: 'insert', enabled: true, params: { text: 'IMG_', position: 'start', index: 0 } },
                    { id: 3, type: 'sequence', enabled: true, params: { start: 1, step: 1, digits: 4, position: 'end', separator: '' } }
                ],
                created: '系统预设'
            },
            {
                id: 1000000000005,
                name: '日期前缀归档',
                rules: [
                    { id: 1, type: 'insert', enabled: true, params: { text: new Date().toISOString().slice(0,10).replace(/-/g,'') + '_', position: 'start', index: 0 } }
                ],
                created: '系统预设'
            }
        ];
        presets = defaultPresets;
        localStorage.setItem('renamePresets', JSON.stringify(presets));
    }
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}