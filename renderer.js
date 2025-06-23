const { ipcRenderer } = require('electron');
const fs = require('fs');

const openFileBtn = document.getElementById('openFileBtn');
const welcomeTab = document.getElementById('welcomeTab');
const tabBar = document.getElementById('tabBar');
const tabList = document.getElementById('tabList');
const tabsContainer = document.getElementById('tabsContainer');

let tabs = [];
let activeTabId = null;
let tabCounter = 0;

async function openFile() {
    try {
        const result = await ipcRenderer.invoke('open-file-dialog');
        
        if (result.success) {
            createTab(result);
        } else if (!result.canceled) {
            alert('Error loading file: ' + result.error);
        }
    } catch (error) {
        alert('Error opening file: ' + error.message);
    }
}

openFileBtn.addEventListener('click', openFile);

ipcRenderer.on('open-file', openFile);
ipcRenderer.on('next-tab', nextTab);
ipcRenderer.on('prev-tab', prevTab);
ipcRenderer.on('close-tab', closeActiveTab);

function createTab(fileData) {
    const tabId = ++tabCounter;
    const existingTab = tabs.find(tab => tab.filePath === fileData.filePath);
    
    if (existingTab) {
        switchToTab(existingTab.id);
        return;
    }
    
    const tab = {
        id: tabId,
        fileName: fileData.fileName,
        filePath: fileData.filePath,
        content: fileData.content,
        extension: fileData.extension,
        fileSize: fileData.content.length
    };
    
    tabs.push(tab);
    createTabElement(tab);
    createTabContent(tab);
    switchToTab(tabId);
    
    welcomeTab.style.display = 'none';
    tabBar.style.display = 'block';
}

function createTabElement(tab) {
    const tabElement = document.createElement('div');
    tabElement.className = 'tab';
    tabElement.dataset.tabId = tab.id;
    
    tabElement.innerHTML = `
        <span class="tab-title" title="${tab.filePath}">${tab.fileName}</span>
        <button class="tab-close" onclick="closeTab(${tab.id})">&times;</button>
    `;
    
    tabElement.addEventListener('click', (e) => {
        if (!e.target.classList.contains('tab-close')) {
            switchToTab(tab.id);
        }
    });
    
    tabList.appendChild(tabElement);
}

function createTabContent(tab) {
    const tabContent = document.createElement('div');
    tabContent.className = 'tab-content hidden';
    tabContent.dataset.tabId = tab.id;
    
    tabContent.innerHTML = `
        <div class="file-info">
            <span>${tab.fileName}</span>
            <span>${formatFileSize(tab.fileSize)}</span>
            <span>${tab.extension.toUpperCase() || 'Unknown'}</span>
        </div>
        <div class="code-container">
            <pre class="code-block"><code class="code-content ${getLanguageClass(tab.extension)}">${escapeHtml(tab.content)}</code></pre>
        </div>
    `;
    
    tabsContainer.appendChild(tabContent);
    
    const codeElement = tabContent.querySelector('.code-content');
    hljs.highlightElement(codeElement);
}

function switchToTab(tabId) {
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.add('hidden');
    });
    
    const activeTab = document.querySelector(`[data-tab-id="${tabId}"]`);
    if (activeTab) {
        if (activeTab.classList.contains('tab')) {
            activeTab.classList.add('active');
        }
        
        const activeContent = tabsContainer.querySelector(`[data-tab-id="${tabId}"]`);
        if (activeContent) {
            activeContent.classList.remove('hidden');
        }
    }
    
    activeTabId = tabId;
}

function closeTab(tabId) {
    const tabIndex = tabs.findIndex(tab => tab.id === tabId);
    if (tabIndex === -1) return;
    
    tabs.splice(tabIndex, 1);
    
    const tabElement = document.querySelector(`.tab[data-tab-id="${tabId}"]`);
    const tabContent = document.querySelector(`.tab-content[data-tab-id="${tabId}"]`);
    
    if (tabElement) tabElement.remove();
    if (tabContent) tabContent.remove();
    
    if (activeTabId === tabId) {
        if (tabs.length > 0) {
            const newActiveTab = tabs[Math.max(0, tabIndex - 1)];
            switchToTab(newActiveTab.id);
        } else {
            activeTabId = null;
            welcomeTab.style.display = 'flex';
            tabBar.style.display = 'none';
        }
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function nextTab() {
    if (tabs.length <= 1) return;
    
    const currentIndex = tabs.findIndex(tab => tab.id === activeTabId);
    const nextIndex = (currentIndex + 1) % tabs.length;
    switchToTab(tabs[nextIndex].id);
}

function prevTab() {
    if (tabs.length <= 1) return;
    
    const currentIndex = tabs.findIndex(tab => tab.id === activeTabId);
    const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    switchToTab(tabs[prevIndex].id);
}

function closeActiveTab() {
    if (activeTabId !== null) {
        closeTab(activeTabId);
    }
}

window.closeTab = closeTab;

function getLanguageClass(extension) {
    const languageMap = {
        'js': 'language-javascript',
        'jsx': 'language-javascript',
        'ts': 'language-typescript',
        'tsx': 'language-typescript',
        'py': 'language-python',
        'html': 'language-html',
        'htm': 'language-html',
        'css': 'language-css',
        'scss': 'language-scss',
        'sass': 'language-sass',
        'json': 'language-json',
        'xml': 'language-xml',
        'cpp': 'language-cpp',
        'c': 'language-c',
        'java': 'language-java',
        'php': 'language-php',
        'rb': 'language-ruby',
        'go': 'language-go',
        'rs': 'language-rust',
        'sh': 'language-bash',
        'bash': 'language-bash',
        'sql': 'language-sql',
        'md': 'language-markdown',
        'yml': 'language-yaml',
        'yaml': 'language-yaml'
    };
    
    return languageMap[extension] || 'language-plaintext';
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}