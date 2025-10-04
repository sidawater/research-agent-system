class ResearchAssistant {
    constructor() {
        this.config = null;
        this.references = [];
        this.currentReport = null;
        this.conversations = [];
        this.currentConversation = null;
        this.ws = null;
        this.currentSessionId = this.generateSessionId();
        this.isEditingReport = false;
        this.isConnected = false;
        this.currentAction = '';
        this.lastMessageType = null; // 记录上一条消息类型
        this.lastMessageElement = null; // 记录上一条消息元素
        this.currentPreviewReference = null; // 当前预览的参考文献
        this.referencePreviewContainer = null; // 预览容器缓存
        
        this.init();
    }
    
    async init() {
        await this.loadConfig();
        await this.loadReferences();
        await this.loadHistory();
        this.bindEvents();
        this.setupUI();
        this.updateStatus('应用已就绪');
        
        // 初始化WebSocket连接
        this.initWebSocket();
    }
    
    generateSessionId() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
    
    async loadConfig() {
        try {
            this.config = await window.electronAPI.getConfig();
            this.applyConfig();
        } catch (error) {
            console.error('Error loading config:', error);
            this.config = {
                websocketUrl: 'ws://localhost:8080',
                apiKey: '',
                exportDirectory: '',
                theme: 'light',
                apiServerUrl: 'http://127.0.0.1:8000'
            };
        }
    }
    
    async loadReferences() {
        try {
            this.references = await window.electronAPI.readReferencesDir();
            this.renderReferences();
            this.updateReferencesCount();
        } catch (error) {
            console.error('Error loading references:', error);
            this.updateStatus('加载参考文献时出错', 'error');
        }
    }

    async loadHistory() {
        try {
            const response = await fetch(`${this.config.apiServerUrl}/api/v1/history`);
            const history = await response.json();
            this.renderHistory(history);
        } catch (error) {
            console.error('Error loading history:', error);
            this.updateStatus('加载历史记录时出错', 'error');
        }
    }

    renderHistory(history) {
        const container = document.getElementById('conversationsList');
        if (!container) return;
        
        if (history.length === 0) {
            container.innerHTML = '<div class="empty-message">暂无历史记录</div>';
            return;
        }
        
        // 按时间倒序排列（如果有的话）
        history.sort((a, b) => {
            // 假设有一个 created_at 字段，如果没有则按数组顺序
            if (a.created_at && b.created_at) {
                return new Date(b.created_at) - new Date(a.created_at);
            }
            return 0;
        });
        
        // 保留新对话项，并添加历史记录
        let html = `
            <div class="conversation-item active" data-id="new">
                <div class="conversation-title">新对话</div>
                <div class="conversation-time">刚刚</div>
            </div>
        `;
        
        html += history.map(item => {
            // 截取前20个字符，超出显示...
            const query = item.research_state.query || '';
            const displayQuery = query.length > 20 ? query.substring(0, 20) + '...' : query;
            
            return `
            <div class="conversation-item" data-id="${item.session_id}">
                <div class="conversation-title">${this.escapeHtml(displayQuery)}</div>
                <div class="conversation-time">${item.created_at ? new Date(item.created_at).toLocaleString() : '未知时间'}</div>
            </div>
            `;
        }).join('');
        
        container.innerHTML = html;
        
        // 添加点击事件
        container.querySelectorAll('.conversation-item').forEach(item => {
            item.addEventListener('click', () => {
                this.loadConversation(item.dataset.id);
            });
        });
    }

    loadConversation(sessionId) {
        // 加载特定会话的逻辑
        console.log('Loading conversation:', sessionId);
        // 这里可以根据需要实现加载会话的详细逻辑
    }
    
    applyConfig() {
        // 应用主题
        if (this.config.theme === 'dark') {
            document.body.classList.add('dark-theme');
        } else if (this.config.theme === 'light') {
            document.body.classList.remove('dark-theme');
        }
        
        // 更新设置表单
        if (this.config) {
            const websocketUrl = document.getElementById('websocketUrl');
            const apiServerUrl = document.getElementById('apiServerUrl');
            const apiKey = document.getElementById('apiKey');
            const exportDirectory = document.getElementById('exportDirectory');
            const themeSelect = document.getElementById('themeSelect');
            
            if (websocketUrl) websocketUrl.value = this.config.websocketUrl || '';
            if (apiServerUrl) apiServerUrl.value = this.config.apiServerUrl || '';
            if (apiKey) apiKey.value = this.config.apiKey || '';
            if (exportDirectory) exportDirectory.value = this.config.exportDirectory || '';
            if (themeSelect) themeSelect.value = this.config.theme || 'light';
        }
    }
    
    initWebSocket() {
        if (!this.config.websocketUrl) {
            console.warn('WebSocket URL not configured');
            this.updateStatus('请先配置WebSocket服务器地址', 'error');
            return;
        }
        
        try {
            this.updateStatus('正在连接WebSocket...');
            this.updateConnectionStatus('connecting');
            
            this.ws = new WebSocket(this.config.websocketUrl);
            
            this.ws.onopen = () => {
                this.isConnected = true;
                this.updateStatus('WebSocket连接已建立', 'success');
                this.updateConnectionStatus('connected');
                this.updateProgress(0);
            };
            
            this.ws.onmessage = (event) => {
                this.handleWebSocketMessage(event);
            };
            
            this.ws.onclose = () => {
                this.isConnected = false;
                this.updateStatus('WebSocket连接已关闭');
                this.updateConnectionStatus('disconnected');
                this.updateProgress(0);
                
                // 尝试重新连接
                setTimeout(() => {
                    if (!this.isConnected) {
                        this.initWebSocket();
                    }
                }, 5000);
            };
            
            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.updateStatus('WebSocket连接错误', 'error');
                this.updateConnectionStatus('disconnected');
                this.updateProgress(0);
            };
        } catch (error) {
            console.error('Failed to create WebSocket connection:', error);
            this.updateStatus('创建WebSocket连接失败', 'error');
        }
    }
    
    handleWebSocketMessage(event) {
        try {
            console.log('🔍 原始WebSocket消息:', event.data);
            const message = JSON.parse(event.data);
            const { type, data } = message;
            
            console.log('📨 解析后的消息:', { type, data });
            
            switch (type) {
                case 'action':
                    console.log('🎯 处理action消息');
                    this.displayActionMessage(data);
                    break;
                case 'content':
                    console.log('📝 处理content消息');
                    this.displayContentMessage(data);
                    break;
                case 'ref':
                    console.log('📚 处理ref消息');
                    this.displayRefMessage(data);
                    break;
                case 'code':
                    console.log('💻 处理code消息');
                    this.displayCodeMessage(data);
                    break;
                case 'report':
                    console.log('📄 处理report消息');
                    this.displayReportMessage(data);
                    break;
                case 'references':
                    console.log('🔗 处理references消息');
                    this.displayReferencesMessage(data.results);
                    break;
                case 'error':
                    console.log('❌ 处理error消息');
                    this.displayErrorMessage(data);
                    break;
                default:
                    console.warn('⚠️ 未知消息类型:', type);
                    this.displayContentMessage(data || '未知消息类型');
            }
        } catch (error) {
            console.error('💥 解析WebSocket消息错误:', error);
            this.updateStatus('处理服务器消息时出错', 'error');
            this.addAIMessage('处理服务器响应时出现错误，请检查控制台查看详细信息。', 'error');
        }
    }
    
    displayActionMessage(data) {
        this.currentAction = data;
        this.showActionStatus(data);
        this.updateCurrentTask(data);
        
        // 根据动作更新进度
        if (data.includes('检索') || data.includes('搜索')) {
            this.updateProgress(30);
        } else if (data.includes('生成') || data.includes('撰写')) {
            this.updateProgress(70);
        } else if (data.includes('完成') || data.includes('结束')) {
            this.updateProgress(100);
        }
        
        // action类型不参与消息流合并
        this.lastMessageType = null;
        this.lastMessageElement = null;
    }
    
    displayContentMessage(data) {
        this.handleMessageType('content', data, () => {
            return `<div class="message-text">${this.formatMarkdown(data)}</div>`;
        });
        this.hideActionStatus();
    }
    
    displayRefMessage(data) {
        this.handleMessageType('ref', data, () => {
            return `<div class="message-ref">${this.formatMarkdown(data)}</div>`;
        });
        this.hideActionStatus();
    }
    
    displayCodeMessage(data) {
        this.handleMessageType('code', data, () => {
            return `<pre class="message-code"><code>${this.escapeHtml(data)}</code></pre>`;
        });
        this.hideActionStatus();
    }
    
    displayReportMessage(data) {
        this.currentReport = data;
        this.updateReportPreview(data);
        this.addReportTitle(`报告 - ${new Date().toLocaleString()}`);
        this.addAIMessage('研究报告已生成，您可以在右侧报告标题中查看完整内容。', 'content');
        this.hideActionStatus();
        
        // 报告消息不参与消息流合并
        this.lastMessageType = null;
        this.lastMessageElement = null;
        
        // 切换到报告预览选项卡
        // this.switchTab('report');
    }
    
    displayReferencesMessage(data) {
        if (Array.isArray(data)) {
            // 更新参考文献列表
            this.references = data;
            this.renderReferences();
            this.updateReferencesCount();
            
            // 在对话中添加提示消息
            this.addAIMessage(`已找到 ${data.length} 篇相关文献，您可以在右侧参考文献列表中查看。`, 'content');
        } else if (typeof data === 'object' && data !== null) {
            // 如果是单个参考文献对象，添加到现有列表中
            if (!this.references.find(ref => ref.id === data.id)) {
                this.references.push(data);
                this.renderReferences();
                this.updateReferencesCount();
            }
        }
        this.hideActionStatus();
        
        // 参考文献消息不参与消息流合并
        this.lastMessageType = null;
        this.lastMessageElement = null;
    }
    
    displayErrorMessage(data) {
        this.addAIMessage(`错误: ${data}`, 'error');
        this.hideActionStatus();
        this.updateStatus('处理请求时发生错误', 'error');
        
        // 错误消息不参与消息流合并
        this.lastMessageType = null;
        this.lastMessageElement = null;
    }
    
    // 处理消息类型合并逻辑
    handleMessageType(type, data, contentGenerator) {
        // 如果类型变化，或上一条消息元素不存在，创建新消息
        if (this.lastMessageType !== type || !this.lastMessageElement) {
            this.lastMessageType = type;
            this.lastMessageElement = this.addAIMessage(data, type, false);
        } else {
            // 类型相同，追加到上一条消息
            this.appendToLastMessage(data, contentGenerator);
        }
    }
    
    // 追加内容到上一条消息
    appendToLastMessage(data, contentGenerator) {
        // 如果上一条消息元素不存在，则创建新消息
        if (!this.lastMessageElement) {
            this.lastMessageType = null;
            this.handleMessageType(this.lastMessageType, data, contentGenerator);
            return;
        }
        
        // 获取消息内容元素
        let contentElement;
        if (this.lastMessageType === 'content') {
            contentElement = this.lastMessageElement.querySelector('.message-text');
        } else if (this.lastMessageType === 'ref') {
            contentElement = this.lastMessageElement.querySelector('.message-ref');
        } else if (this.lastMessageType === 'code') {
            contentElement = this.lastMessageElement.querySelector('.message-code');
        }
        
        if (contentElement) {
            // 根据类型处理追加逻辑
            if (this.lastMessageType === 'content') {
                // 内容类型使用Markdown格式
                contentElement.innerHTML += this.formatMarkdown(data);
            } else if (this.lastMessageType === 'ref') {
                // 引用类型使用Markdown格式
                contentElement.innerHTML += this.formatMarkdown(data);
            } else if (this.lastMessageType === 'code') {
                // 代码类型直接追加文本
                const codeElement = contentElement.querySelector('code');
                if (codeElement) {
                    codeElement.textContent += data;
                }
            }
            
            // 更新时间戳
            const timeElement = this.lastMessageElement.querySelector('.message-time');
            if (timeElement) {
                timeElement.textContent = new Date().toLocaleTimeString();
            }
        }
        
        // 滚动到底部
        this.scrollToBottom();
    }
    
    showActionStatus(text) {
        const actionStatus = document.getElementById('actionStatus');
        const actionText = document.getElementById('actionText');
        
        if (actionStatus && actionText) {
            actionText.textContent = text;
            actionStatus.style.display = 'block';
        }
    }
    
    hideActionStatus() {
        const actionStatus = document.getElementById('actionStatus');
        if (actionStatus) {
            actionStatus.style.display = 'none';
        }
    }
    
    bindEvents() {
        // 顶部按钮
        document.getElementById('settingsBtn').addEventListener('click', () => {
            this.showSettings();
        });
        
        document.getElementById('helpBtn').addEventListener('click', () => {
            this.showHelp();
        });
        
        // 设置对话框
        document.getElementById('closeSettings').addEventListener('click', () => {
            this.hideSettings();
        });
        
        document.getElementById('cancelSettings').addEventListener('click', () => {
            this.hideSettings();
        });
        
        document.getElementById('saveSettings').addEventListener('click', () => {
            this.saveSettings();
        });
        
        document.getElementById('selectDirectoryBtn').addEventListener('click', () => {
            this.selectExportDirectory();
        });
        
        document.getElementById('testConnectionBtn').addEventListener('click', () => {
            this.testConnection();
        });
        
        // 帮助对话框
        document.getElementById('closeHelp').addEventListener('click', () => {
            this.hideHelp();
        });
        
        document.getElementById('closeHelpBtn').addEventListener('click', () => {
            this.hideHelp();
        });
        
        // 聊天输入
        document.getElementById('chatInput').addEventListener('input', (e) => {
            this.updateSendButton();
        });
        
        document.getElementById('sendBtn').addEventListener('click', () => {
            this.sendMessage();
        });
        
        document.getElementById('chatInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                this.sendMessage();
            }
        });
        
        // 清空对话
        document.getElementById('clearChatBtn').addEventListener('click', () => {
            this.clearChat();
        });
        
        // 导出报告
        document.getElementById('exportReportBtn').addEventListener('click', () => {
            this.exportReport();
        });
        
        // 选项卡切换
        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', (e) => {
                const tab = e.target.getAttribute('data-tab');
                this.switchTab(tab);
            });
        });
        
        // 新建对话
        document.getElementById('newChatBtn').addEventListener('click', () => {
            this.createNewConversation();
        });
        
        // 编辑报告
        const editReportBtn = document.getElementById('editReportBtn');
        if (editReportBtn) {
            editReportBtn.addEventListener('click', () => {
                this.toggleReportEdit();
            });
        }
        
        // 报告标题点击
        document.addEventListener('click', (e) => {
            if (e.target.closest('.report-title-item')) {
                const item = e.target.closest('.report-title-item');
                const reportId = item.dataset.id;
                this.showReport(reportId);
            }
        });
        
        // 参考文献点击
        document.addEventListener('click', (e) => {
            if (e.target.closest('.reference-item')) {
                const item = e.target.closest('.reference-item');
                console.log(item);
                const refId = item.dataset.id;
                // 从DOM元素中获取local_file和url属性
                const localFile = item.dataset.localFile;
                const url = item.dataset.url;
                
                // 构造参考文献对象
                const reference = {
                    id: refId,
                    local_file: localFile,
                    url: url,
                    title: item.querySelector('.ref-title').title,
                    authors: item.querySelector('.ref-authors').title.split(', ').filter(a => a !== '未知作者'),
                    publication_year: item.querySelector('.ref-year').textContent,
                    abstract: item.querySelector('.ref-abstract')?.title
                };
                
                this.previewReference(reference);
            }
        });
        
        // 模态对话框点击外部关闭
        window.addEventListener('click', (e) => {
            const settingsDialog = document.getElementById('settingsDialog');
            const helpDialog = document.getElementById('helpDialog');
            
            if (e.target === settingsDialog) {
                this.hideSettings();
            }
            if (e.target === helpDialog) {
                this.hideHelp();
            }
        });
        
        // Electron 事件监听
        window.electronAPI.onExportReport(() => {
            this.exportReport();
        });
        
        window.electronAPI.onShowHelp(() => {
            this.showHelp();
        });
    }
    
    setupUI() {
        // 初始化版本信息
        this.setVersionInfo();
        
        // 初始化对话状态
        this.updateConnectionStatus('disconnected');
        this.updateProgress(0);
        
        // 设置默认对话
        this.createNewConversation();
    }
    
    setVersionInfo() {
        // 这里可以动态设置版本信息
        const electronVersion = document.getElementById('electronVersion');
        const nodeVersion = document.getElementById('nodeVersion');
        
        if (electronVersion) {
            electronVersion.textContent = 'process.versions.electron';
        }
        if (nodeVersion) {
            nodeVersion.textContent = 'process.versions.node';
        }
    }
    
    // 设置对话框相关方法
    showSettings() {
        document.getElementById('settingsDialog').style.display = 'block';
    }
    
    hideSettings() {
        document.getElementById('settingsDialog').style.display = 'none';
    }
    
    showHelp() {
        document.getElementById('helpDialog').style.display = 'block';
    }
    
    hideHelp() {
        document.getElementById('helpDialog').style.display = 'none';
    }
    
    async saveSettings() {
        const form = document.getElementById('settingsForm');
        const newConfig = {
            websocketUrl: document.getElementById('websocketUrl').value,
            apiServerUrl: document.getElementById('apiServerUrl').value,
            apiKey: document.getElementById('apiKey').value,
            exportDirectory: document.getElementById('exportDirectory').value,
            theme: document.getElementById('themeSelect').value
        };
        
        try {
            const result = await window.electronAPI.saveConfig(newConfig);
            if (result.success) {
                this.config = newConfig;
                this.applyConfig();
                this.hideSettings();
                this.updateStatus('设置已保存');
                
                // 重新连接WebSocket
                if (this.ws) {
                    this.ws.close();
                }
                this.initWebSocket();
            } else {
                this.updateStatus('保存设置失败: ' + result.error, 'error');
            }
        } catch (error) {
            console.error('Error saving config:', error);
            this.updateStatus('保存设置时出错', 'error');
        }
    }
    
    async selectExportDirectory() {
        try {
            const result = await window.electronAPI.selectExportDirectory();
            if (result.success) {
                document.getElementById('exportDirectory').value = result.directory;
            }
        } catch (error) {
            console.error('Error selecting directory:', error);
            this.updateStatus('选择目录时出错', 'error');
        }
    }
    
    async testConnection() {
        const url = document.getElementById('websocketUrl').value;
        if (!url) {
            this.updateStatus('请输入WebSocket服务器地址', 'error');
            return;
        }
        
        this.updateStatus('正在测试连接...');
        this.updateConnectionStatus('connecting');
        
        // 临时WebSocket连接测试
        try {
            const testWs = new WebSocket(url);
            
            testWs.onopen = () => {
                this.updateStatus('连接测试成功', 'success');
                this.updateConnectionStatus('connected');
                testWs.close();
            };
            
            testWs.onerror = () => {
                this.updateStatus('连接测试失败', 'error');
                this.updateConnectionStatus('disconnected');
            };
            
            // 设置超时
            setTimeout(() => {
                if (testWs.readyState !== WebSocket.OPEN) {
                    this.updateStatus('连接超时', 'error');
                    this.updateConnectionStatus('disconnected');
                    testWs.close();
                }
            }, 5000);
        } catch (error) {
            this.updateStatus('连接测试失败: ' + error.message, 'error');
            this.updateConnectionStatus('disconnected');
        }
    }
    
    // 对话相关方法
    updateSendButton() {
        const input = document.getElementById('chatInput');
        const sendBtn = document.getElementById('sendBtn');
        if (sendBtn) {
            sendBtn.disabled = !input.value.trim();
        }
    }
    
    async sendMessage() {
        const input = document.getElementById('chatInput');
        const message = input.value.trim();
        
        if (!message) return;
        
        // 确保WebSocket连接有效
        try {
            await this.ensureConnection();
        } catch (error) {
            this.updateStatus('无法建立WebSocket连接: ' + error.message, 'error');
            return;
        }
        
        // 获取导出选项
        const needExport = document.getElementById('needExport').checked;
        
        // 清空输入框
        input.value = '';
        this.updateSendButton();
        
        // 添加用户消息
        this.addUserMessage(message);
        
        // 重置消息合并状态
        this.lastMessageType = null;
        this.lastMessageElement = null;
        
        // 准备WebSocket消息
        const wsMessage = {
            session_id: this.currentSessionId,
            query: message,
            need_export: needExport
        };
        
        // 发送消息
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(wsMessage));
            this.updateStatus('消息已发送');
            this.updateProgress(10);
        } else {
            this.updateStatus('WebSocket未连接，无法发送消息', 'error');
        }
    }
    
    addUserMessage(content) {
        const messagesContainer = document.getElementById('chatMessages');
        
        if (!messagesContainer) return;
        
        // 移除欢迎消息
        const welcomeMessage = messagesContainer.querySelector('.welcome-message');
        if (welcomeMessage) {
            welcomeMessage.remove();
        }
        
        const messageElement = document.createElement('div');
        messageElement.className = 'message user-message';
        messageElement.innerHTML = `
            <div class="message-content">
                <div class="message-sender">您</div>
                <div class="message-text">${this.escapeHtml(content)}</div>
                <div class="message-time">${new Date().toLocaleTimeString()}</div>
            </div>
        `;
        
        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    addAIMessage(content, type = 'content', scroll = true) {
        console.log('🤖 添加AI消息:', { content, type, scroll });
        
        const messagesContainer = document.getElementById('chatMessages');
        console.log('📦 消息容器:', messagesContainer);
        
        if (!messagesContainer) {
            console.error('❌ 找不到消息容器: chatMessages');
            return null;
        }
        
        const messageElement = document.createElement('div');
        messageElement.className = `message ai-message ${type}-message`;
        console.log('📄 创建消息元素:', messageElement);
        
        let contentHtml = '';
        if (type === 'ref') {
            contentHtml = `<div class="message-ref">${this.formatMarkdown(content)}</div>`;
        } else if (type === 'code') {
            contentHtml = `<pre class="message-code"><code>${this.escapeHtml(content)}</code></pre>`;
        } else if (type === 'error') {
            contentHtml = `<div class="message-text error-text">${this.escapeHtml(content)}</div>`;
        } else {
            contentHtml = `<div class="message-text">${this.formatMarkdown(content)}</div>`;
        }
        
        messageElement.innerHTML = `
            <div class="message-content">
                <div class="message-sender">AI助手</div>
                ${contentHtml}
                <div class="message-time">${new Date().toLocaleTimeString()}</div>
            </div>
        `;
        
        console.log('📝 消息HTML:', messageElement.innerHTML);
        
        messagesContainer.appendChild(messageElement);
        console.log('✅ 消息已添加到容器');
        
        if (scroll) {
            this.scrollToBottom();
        }
        
        return messageElement;
    }
    
    scrollToBottom() {
        const messagesContainer = document.getElementById('chatMessages');
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }
    
    formatMarkdown(text) {
        if (!text) return '';
        
        // 简单的Markdown转换
        return text
            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/!\[(.*?)\]\((.*?)\)/g, '<img alt="$1" src="$2">')
            .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>')
            .replace(/\n/g, '<br>');
    }
    
    // 选项卡管理
    switchTab(tabName) {
        // 更新选项卡按钮
        document.querySelectorAll('.tab-button').forEach(button => {
            button.classList.toggle('active', button.getAttribute('data-tab') === tabName);
        });
        
        // 更新选项卡内容
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.toggle('active', pane.id === `${tabName}-tab`);
        });
        
        // 特殊处理：切换到文献预览选项卡时，如果没有选中文献，显示提示
        if (tabName === 'reference' && !document.querySelector('.reference-item.active')) {
            this.showReferencePreview(null);
        }
    }
    
    createNewConversation() {
        this.currentSessionId = this.generateSessionId();
        this.clearChat();
        this.updateCurrentSession('新对话');
        this.updateStatus('已创建新对话');
        // 新建对话后优先显示对话tab
        this.switchTab('chat');
        // 重新渲染参考文献列表
        this.renderReferences();
    }
    
    clearChat() {
        const messagesContainer = document.getElementById('chatMessages');
        if (messagesContainer) {
            messagesContainer.innerHTML = `
                <div class="welcome-message">
                    <div class="welcome-icon">🤖</div>
                    <h2>欢迎使用AI研究助手</h2>
                    <p>请在下方输入您的研究问题开始对话。</p>
                </div>
            `;
        }
        
        // 清空当前报告和参考文献
        this.currentReport = null;
        this.updateReportPreview('');
        this.updateReportTitles([]);
        this.hideActionStatus();
        this.updateProgress(0);
        this.updateCurrentTask('等待用户输入');
        
        // 重置消息合并状态
        this.lastMessageType = null;
        this.lastMessageElement = null;
        
        // 清空参考文献列表显示和数据
        this.references = [];
        this.renderReferences();
        this.updateReferencesCount();
    }
    
    // 报告管理
    toggleReportEdit() {
        this.isEditingReport = !this.isEditingReport;
        
        const editor = document.getElementById('reportEditor');
        const content = document.getElementById('reportContent');
        const editBtn = document.getElementById('editReportBtn');
        
        if (!editor || !content || !editBtn) return;
        
        if (this.isEditingReport) {
            editor.value = this.currentReport || '';
            content.style.display = 'none';
            editor.style.display = 'block';
            editor.focus();
            editBtn.textContent = '保存';
        } else {
            this.currentReport = editor.value;
            content.innerHTML = this.formatMarkdown(this.currentReport);
            editor.style.display = 'none';
            content.style.display = 'block';
            editBtn.textContent = '编辑';
            
            // 保存报告更改
            this.saveReport();
        }
    }
    
    async saveReport() {
        // 这里可以添加保存报告的逻辑
        this.updateStatus('报告已保存');
    }
    
    showReport(reportId) {
        // 切换到报告预览选项卡
        this.switchTab('report');
        
        // 这里可以根据reportId加载具体的报告内容
        if (this.currentReport) {
            const reportContent = document.getElementById('reportContent');
            if (reportContent) {
                reportContent.innerHTML = this.formatMarkdown(this.currentReport);
            }
        }
    }
    
    updateReportPreview(content) {
        const preview = document.getElementById('reportContent');
        if (preview) {
            if (content) {
                preview.innerHTML = this.formatMarkdown(content);
            } else {
                preview.innerHTML = '<p class="empty-message">暂无报告内容</p>';
            }
        }
    }
    
    addReportTitle(title) {
        const titlesList = document.getElementById('reportTitlesList');
        if (!titlesList) return;
        
        const titleItem = document.createElement('div');
        titleItem.className = 'report-title-item active';
        titleItem.dataset.id = Date.now().toString();
        titleItem.innerHTML = `
            <div class="report-title-text">${title}</div>
            <div class="report-title-time">${new Date().toLocaleString()}</div>
        `;
        
        // 清空现有标题并添加新标题
        titlesList.innerHTML = '';
        titlesList.appendChild(titleItem);
    }
    
    updateReportTitles(titles) {
        const container = document.getElementById('reportTitlesList');
        if (!container) return;
        
        if (titles.length === 0) {
            container.innerHTML = '<div class="empty-message">报告生成后将显示在这里</div>';
            return;
        }
        
        container.innerHTML = titles.map(title => `
            <div class="report-title-item ${title.id === '1' ? 'active' : ''}" data-id="${title.id}">
                <div class="report-title-text">${title.title}</div>
                <div class="report-title-time">${title.time}</div>
            </div>
        `).join('');
    }
    
    // 参考文献管理
    renderReferences() {
        const container = document.getElementById('referencesList');
        if (!container) return;
        
        if (this.references.length === 0) {
            container.innerHTML = '<div class="empty-message">暂无参考文献</div>';
            return;
        }
        
        container.innerHTML = this.references.map((ref, index) => {
            const refId = ref.id || `ref-${index}`;
            const isActive = this.currentPreviewReference && this.currentPreviewReference.id === refId;
            
            return `
            <div class="reference-item ${isActive ? 'active' : ''}" 
                 data-id="${refId}" 
                 data-local-file="${ref.local_file || ''}" 
                 data-url="${ref.url || ''}">
                <div class="ref-header">
                    <div class="ref-title" title="${this.escapeHtml(ref.title)}">${this.escapeHtml(ref.title)}</div>
                    <div class="ref-badge ${ref.local_file ? 'local' : ''}">
                        ${ref.local_file ? '📄 本地' : '🔗 在线'}
                    </div>
                </div>
                <div class="ref-meta">
                    <div class="ref-authors" title="${ref.authors?.join(', ') || '未知作者'}">
                        ${ref.authors?.join(', ') || '未知作者'}
                    </div>
                    <div class="ref-year">${ref.publication_year || '未知年份'}</div>
                </div>
                ${ref.abstract ? `
                    <div class="ref-abstract" title="${this.escapeHtml(ref.abstract)}">
                        ${this.escapeHtml(ref.abstract)}
                    </div>
                ` : ''}
            </div>
            `;
        }).join('');
        
        // 添加点击事件 - 使用事件委托提高性能
        container.addEventListener('click', (e) => {
            const referenceItem = e.target.closest('.reference-item');
            if (referenceItem) {
                const refId = referenceItem.dataset.id;
                const localFile = referenceItem.dataset.localFile;
                const url = referenceItem.dataset.url;
                
                // 构造参考文献对象
                const reference = {
                    id: refId,
                    local_file: localFile,
                    url: url,
                    title: referenceItem.querySelector('.ref-title').title,
                    authors: referenceItem.querySelector('.ref-authors').title.split(', ').filter(a => a !== '未知作者'),
                    publication_year: referenceItem.querySelector('.ref-year').textContent,
                    abstract: referenceItem.querySelector('.ref-abstract')?.title
                };
                
                this.previewReference(reference);
            }
        });
    }

    renderHistory(history) {
        const container = document.getElementById('conversationsList');
        if (!container) return;
        
        if (history.length === 0) {
            container.innerHTML = '<div class="empty-message">暂无历史记录</div>';
            return;
        }
        
        // 按时间倒序排列
        history.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        
        container.innerHTML = history.map(item => {
            // 截取前20个字符，超出显示...
            const query = item.research_state.query;
            const displayQuery = query.length > 20 ? query.substring(0, 20) + '...' : query;
            
            return `
            <div class="conversation-item" data-id="${item.session_id}">
                <div class="conversation-title">${this.escapeHtml(displayQuery)}</div>
                <div class="conversation-time">${new Date(item.created_at || Date.now()).toLocaleString()}</div>
            </div>
            `;
        }).join('');
        
        // 添加点击事件
        container.querySelectorAll('.conversation-item').forEach(item => {
            item.addEventListener('click', () => {
                this.loadConversation(item.dataset.id);
            });
        });
    }

    async loadConversation(sessionId) {
        // 设置当前会话ID
        this.currentSessionId = sessionId;
        
        // 更新UI - 移除所有conversation-item的active类，并给当前项添加active类
        document.querySelectorAll('.conversation-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.id === sessionId) {
                item.classList.add('active');
            }
        });
        
        // 如果是新对话，执行新建对话逻辑
        if (sessionId === 'new') {
            this.clearChat();
            this.currentSessionId = this.generateSessionId();
            this.updateCurrentSession('新对话');
            this.updateStatus('已创建新对话');
            // 新建对话后优先显示对话tab
            this.switchTab('chat');
            // 重新渲染参考文献列表
            this.renderReferences();
            return;
        }
        
        // 加载特定会话的逻辑
        try {
            const response = await fetch(`${this.config.apiServerUrl}/api/v1/history/${sessionId}`);
            const data = await response.json();
            
            // 清空聊天记录
            this.clearChat();
            
            // 更新当前会话ID和状态
            this.currentSessionId = sessionId;
            this.updateCurrentSession(data.research_state.query || '历史对话');
            this.updateStatus('已加载历史对话');
            
            // 渲染参考文献列表
            if (data.research_state.academic_search_result && 
                data.research_state.academic_search_result.results) {
                this.references = data.research_state.academic_search_result.results;
                this.renderReferences();
                this.updateReferencesCount();
            }
            
            // 渲染报告预览
            if (data.research_state.final_report) {
                this.currentReport = data.research_state.final_report;
                this.updateReportPreview(data.research_state.final_report);
                // 点击历史消息时优先显示报告预览tab
                this.switchTab('report');
            }
            
            // 更新聊天消息（如果有的话）
            if (data.messages && Array.isArray(data.messages)) {
                const messagesContainer = document.getElementById('chatMessages');
                if (messagesContainer) {
                    // 移除欢迎消息
                    const welcomeMessage = messagesContainer.querySelector('.welcome-message');
                    if (welcomeMessage) {
                        welcomeMessage.remove();
                    }
                    
                    // 添加历史消息
                    data.messages.forEach(msg => {
                        const messageElement = document.createElement('div');
                        messageElement.className = `message ${msg.role === 'user' ? 'user-message' : 'ai-message'}`;
                        
                        let contentHtml = '';
                        if (msg.content_type === 'ref') {
                            contentHtml = `<div class="message-ref">${this.formatMarkdown(msg.content)}</div>`;
                        } else if (msg.content_type === 'code') {
                            contentHtml = `<pre class="message-code"><code>${this.escapeHtml(msg.content)}</code></pre>`;
                        } else {
                            contentHtml = `<div class="message-text">${this.formatMarkdown(msg.content)}</div>`;
                        }
                        
                        messageElement.innerHTML = `
                            <div class="message-content">
                                <div class="message-sender">${msg.role === 'user' ? '您' : 'AI助手'}</div>
                                ${contentHtml}
                                <div class="message-time">${new Date(msg.timestamp).toLocaleTimeString()}</div>
                            </div>
                        `;
                        
                        messagesContainer.appendChild(messageElement);
                    });
                    
                    this.scrollToBottom();
                }
            }
        } catch (error) {
            console.error('Error loading conversation:', error);
            this.updateStatus('加载历史对话时出错', 'error');
        }
    }
    
    async previewReference(reference) {
        // 切换到文献预览选项卡
        this.switchTab('reference');
        
        // 使用新的 showReferencePreview 方法
        await this.showReferencePreview(reference);
    }
    
    async showReferencePreview(reference) {
        const content = document.getElementById('referenceContent');
        if (!content) return;

        // 先确保切换到文献预览选项卡
        this.switchTab('reference');

        // 如果点击的是同一个文献，且已经在预览中，则不重复处理
        if (this.currentPreviewReference && this.currentPreviewReference.id === reference.id) {
            return;
        }

        // 更新当前预览的文献
        this.currentPreviewReference = reference;

        if (!reference) {
            content.innerHTML = `
                <div class="empty-message">
                    <p>选择右侧的参考文献进行预览</p>
                    <p class="hint">本地文献将显示文件内容，在线文献将显示网页预览</p>
                </div>
            `;
            return;
        }

        // 更新查看器标题
        const viewerTitle = document.getElementById('referenceViewerTitle');
        if (viewerTitle) {
            viewerTitle.textContent = reference.title;
        }

        // 更新参考文献激活状态
        document.querySelectorAll('.reference-item').forEach(item => {
            item.classList.toggle('active', item.dataset.id === reference.id);
        });

        // 使用缓存的容器或创建新容器
        if (!this.referencePreviewContainer) {
            this.referencePreviewContainer = document.createElement('div');
            content.appendChild(this.referencePreviewContainer);
        }

        // 清空容器内容但保留容器本身
        this.referencePreviewContainer.innerHTML = '';

        if (reference.local_file) {
            // 显示本地文件内容
            this.renderLocalFilePreview(reference, this.referencePreviewContainer);
        } else if (reference.url) {
            // 显示网页预览
            this.renderWebPreview(reference, this.referencePreviewContainer);
        } else {
            this.referencePreviewContainer.innerHTML = `
                <div class="empty-message">
                    <p>该文献没有可预览的内容</p>
                </div>
            `;
        }
    }

    // 新增方法：渲染本地文件预览
    renderLocalFilePreview(reference, container) {
        container.innerHTML = `
            <div class="file-preview">
                <div class="file-header">
                    <h4>${this.escapeHtml(reference.title)}</h4>
                    <div class="file-meta">
                        <span><strong>作者:</strong> ${reference.authors?.join(', ') || '未知'}</span>
                        <span><strong>年份:</strong> ${reference.publication_year || '未知'}</span>
                        <span><strong>文件路径:</strong> ${reference.local_file}</span>
                    </div>
                </div>
                <div class="file-content">
                    <p><strong>摘要:</strong> ${reference.abstract || '无摘要'}</p>
                    ${reference.excerpts ? `
                        <div class="excerpts">
                            <strong>摘录:</strong>
                            <ul>
                                ${reference.excerpts.map(excerpt => `<li>${this.escapeHtml(excerpt)}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}
                    <div class="file-actions">
                        <button class="btn btn-primary open-reference-btn">
                            打开文件
                        </button>
                    </div>
                </div>
            </div>
        `;

        // 添加事件监听器
        const openBtn = container.querySelector('.open-reference-btn');
        openBtn.addEventListener('click', () => {
            this.openReference(reference);
        });
    }

    // 新增方法：渲染网页预览
    renderWebPreview(reference, container) {
        container.innerHTML = `
            <div class="web-preview-container">
                <div class="web-preview-header">
                    <span>网页预览: ${this.escapeHtml(reference.url)}</span>
                    <button class="btn btn-secondary open-external-btn">
                        在新标签页中打开
                    </button>
                </div>
                <!-- iframe 渲染已注释，仅保留新窗口打开功能 -->
                <!--
                <iframe 
                    sandbox="allow-same-origin allow-scripts allow-popups allow-forms" 
                    class="web-preview-frame"
                    src="${this.escapeHtml(reference.url)}"
                ></iframe>
                -->
            </div>
        `;

        // 添加事件监听器
        const openExternalBtn = container.querySelector('.open-external-btn');
        openExternalBtn.addEventListener('click', () => {
            // 使用更接近浏览器新标签页的方式打开链接
            const newWindow = window.open(reference.url, '_blank');
            if (newWindow) {
                newWindow.opener = null;
                newWindow.focus();
            } else {
                // 如果弹窗被阻止，显示提示
                this.updateStatus('弹窗被浏览器阻止，请允许弹窗后重试', 'error');
            }
        });
    }

    async openReference(reference) {
        try {
            this.updateStatus(`正在打开: ${reference.title}`);
            const result = await window.electronAPI.openReference(reference);
            
            if (result.success) {
                let message = `已打开文献: ${reference.title}`;
                if (result.type === 'local') {
                    message += ' (本地文件)';
                } else if (result.type === 'url') {
                    message += ' (在线链接)';
                } else if (result.type === 'url_fallback') {
                    message += ' (本地文件不存在，已打开在线链接)';
                }
                this.updateStatus(message, 'success');
            } else {
                this.updateStatus(`打开失败: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('Error opening reference:', error);
            this.updateStatus('打开文献时出错', 'error');
        }
    }
    
    updateReferencesCount() {
        const countElement = document.getElementById('referencesCount');
        if (countElement) {
            countElement.textContent = this.references.length;
        }
    }
    
    // 导出功能
    async exportReport() {
        if (!this.currentReport) {
            this.updateStatus('没有可导出的报告', 'error');
            return;
        }
        
        try {
            this.updateStatus('正在导出报告...');
            
            const reportData = {
                reportContent: this.currentReport,
                references: this.references,
                title: 'AI生成的研究报告'
            };
            
            const result = await window.electronAPI.exportReport(reportData);
            
            if (result.success) {
                this.updateStatus(`报告已导出到: ${result.exportPath}`, 'success');
                
                // 显示导出成功提示
                this.showExportSuccess(result.exportPath);
            } else {
                this.updateStatus(`导出失败: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('Error exporting report:', error);
            this.updateStatus('导出报告时出错', 'error');
        }
    }
    
    showExportSuccess(exportPath) {
        // 这里可以实现导出成功提示
        console.log('Report exported to:', exportPath);
        // 可以添加通知或对话框显示导出成功信息
    }
    
    // UI状态更新
    updateStatus(message, type = 'info') {
        const statusElement = document.getElementById('statusText');
        if (statusElement) {
            statusElement.textContent = message;
            
            // 根据类型设置颜色
            statusElement.style.color = type === 'error' ? '#f56565' : 
                                      type === 'success' ? '#48bb78' : '#cbd5e0';
        }
    }
    
    updateConnectionStatus(status) {
        const statusElement = document.getElementById('connectionStatus');
        if (!statusElement) return;
        
        const statusMap = {
            disconnected: { text: '未连接', color: '#f56565' },
            connecting: { text: '连接中...', color: '#ed8936' },
            connected: { text: '已连接', color: '#48bb78' }
        };
        
        const statusInfo = statusMap[status] || statusMap.disconnected;
        statusElement.textContent = statusInfo.text;
        statusElement.style.color = statusInfo.color;
    }
    
    updateCurrentTask(task) {
        const taskElement = document.getElementById('currentTask');
        if (taskElement) {
            taskElement.textContent = task;
        }
    }
    
    updateCurrentSession(sessionName) {
        const sessionElement = document.getElementById('currentSession');
        if (sessionElement) {
            sessionElement.textContent = sessionName;
        }
    }
    
    updateProgress(percentage) {
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        
        if (progressFill) {
            progressFill.style.width = `${percentage}%`;
        }
        if (progressText) {
            progressText.textContent = `${percentage}%`;
        }
    }
    
    // 工具方法
    escapeHtml(unsafe) {
        if (unsafe === null || unsafe === undefined) return '';
        
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
    
    // 确保WebSocket连接有效
    async ensureConnection() {
        // 如果已经连接，直接返回
        if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
            return true;
        }
        
        // 如果正在连接中，等待连接结果
        if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('连接超时'));
                }, 5000);
                
                const checkConnection = () => {
                    if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
                        clearTimeout(timeout);
                        resolve(true);
                    }
                };
                
                // 定期检查连接状态
                const interval = setInterval(checkConnection, 500);
                setTimeout(() => clearInterval(interval), 5000);
            });
        }
        
        // 尝试重新连接
        this.updateStatus('正在重新连接WebSocket...');
        this.updateConnectionStatus('connecting');
        
        return new Promise((resolve, reject) => {
            // 如果已有WebSocket实例，先关闭
            if (this.ws) {
                this.ws.close();
            }
            
            try {
                this.ws = new WebSocket(this.config.websocketUrl);
                
                const timeout = setTimeout(() => {
                    reject(new Error('连接超时'));
                }, 5000);
                
                this.ws.onopen = () => {
                    clearTimeout(timeout);
                    this.isConnected = true;
                    this.updateStatus('WebSocket连接已建立', 'success');
                    this.updateConnectionStatus('connected');
                    this.updateProgress(0);
                    resolve(true);
                };
                
                this.ws.onerror = (error) => {
                    clearTimeout(timeout);
                    console.error('WebSocket error:', error);
                    this.updateStatus('WebSocket连接错误', 'error');
                    this.updateConnectionStatus('disconnected');
                    this.updateProgress(0);
                    reject(new Error('连接失败'));
                };
                
                this.ws.onclose = () => {
                    this.isConnected = false;
                    this.updateConnectionStatus('disconnected');
                    this.updateProgress(0);
                };
            } catch (error) {
                console.error('Failed to create WebSocket connection:', error);
                this.updateStatus('创建WebSocket连接失败', 'error');
                reject(error);
            }
        });
    }
}

// 应用启动
document.addEventListener('DOMContentLoaded', () => {
    window.researchAssistant = new ResearchAssistant();
});