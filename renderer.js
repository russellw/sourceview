const { ipcRenderer } = require('electron');
const fs = require('fs');

const openFileBtn = document.getElementById('openFileBtn');
const upDirectoryBtn = document.getElementById('upDirectoryBtn');
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
            if (result.openedExternally) {
                // File was opened in external application, no need to create tab
                return;
            } else if (result.isDirectory) {
                createDirectoryTab(result);
            } else {
                createTab(result);
            }
        } else if (!result.canceled) {
            alert('Error loading file: ' + result.error);
        }
    } catch (error) {
        alert('Error opening file: ' + error.message);
    }
}

function openInitialFile(event, filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const ext = require('path').extname(filePath).toLowerCase().substring(1);
        const fileName = require('path').basename(filePath);
        
        const fileData = {
            success: true,
            filePath,
            content,
            extension: ext,
            fileName
        };
        
        createTab(fileData);
    } catch (error) {
        alert('Error opening initial file: ' + error.message);
    }
}

function openInitialDirectory(event, directoryPath) {
    try {
        const files = fs.readdirSync(directoryPath).map(fileName => {
            const fullPath = require('path').join(directoryPath, fileName);
            const fileStats = fs.statSync(fullPath);
            return {
                name: fileName,
                path: fullPath,
                isDirectory: fileStats.isDirectory(),
                size: fileStats.size,
                modified: fileStats.mtime
            };
        });
        
        const directoryData = {
            success: true,
            isDirectory: true,
            directoryPath: directoryPath,
            directoryName: require('path').basename(directoryPath),
            files: files
        };
        
        createDirectoryTab(directoryData);
    } catch (error) {
        alert('Error opening initial directory: ' + error.message);
    }
}

openFileBtn.addEventListener('click', openFile);
upDirectoryBtn.addEventListener('click', goUpDirectory);

ipcRenderer.on('open-file', openFile);
ipcRenderer.on('next-tab', nextTab);
ipcRenderer.on('prev-tab', prevTab);
ipcRenderer.on('close-tab', closeActiveTab);
ipcRenderer.on('open-initial-file', openInitialFile);
ipcRenderer.on('open-initial-directory', openInitialDirectory);
ipcRenderer.on('show-shortcuts', showKeyboardShortcuts);
ipcRenderer.on('show-about', showAbout);

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
        fileSize: fileData.fileSize || fileData.content.length,
        lastModified: fileData.lastModified,
        isDirectory: false,
        isImage: fileData.isImage || false
    };
    
    tabs.push(tab);
    createTabElement(tab);
    createTabContent(tab);
    switchToTab(tabId);
    
    tabBar.style.display = 'block';
}

function createDirectoryTab(directoryData) {
    const tabId = ++tabCounter;
    const existingTab = tabs.find(tab => tab.directoryPath === directoryData.directoryPath);
    
    if (existingTab) {
        switchToTab(existingTab.id);
        return;
    }
    
    const tab = {
        id: tabId,
        directoryName: directoryData.directoryName,
        directoryPath: directoryData.directoryPath,
        files: directoryData.files,
        isDirectory: true
    };
    
    tabs.push(tab);
    createTabElement(tab);
    createDirectoryTabContent(tab);
    switchToTab(tabId);
    
    tabBar.style.display = 'block';
}

function createTabElement(tab) {
    const tabElement = document.createElement('div');
    tabElement.className = 'tab';
    tabElement.dataset.tabId = tab.id;
    
    const title = tab.isDirectory ? tab.directoryPath : tab.filePath;
    const name = tab.isDirectory ? `📁 ${tab.directoryName}` : tab.fileName;
    
    tabElement.innerHTML = `
        <span class="tab-title" title="${title}">${name}</span>
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
    
    const contentArea = tab.isImage 
        ? `<div class="image-container">
               <img src="file://${tab.filePath}" alt="${tab.fileName}" class="image-display">
           </div>`
        : `<div class="code-container">
               <pre class="code-block"><code class="code-content ${getLanguageClass(tab.extension)}">${escapeHtml(tab.content)}</code></pre>
           </div>`;
    
    tabContent.innerHTML = `
        <div class="file-info">
            <span>${getFileIcon(tab.extension)} ${tab.fileName}</span>
            <span>${formatFileSize(tab.fileSize)}</span>
            <span>${tab.extension.toUpperCase() || 'Unknown'}</span>
            <span>${formatTimestamp(tab.lastModified)}</span>
        </div>
        ${contentArea}
    `;
    
    tabsContainer.appendChild(tabContent);
    
    if (!tab.isImage) {
        const codeElement = tabContent.querySelector('.code-content');
        if (codeElement) {
            hljs.highlightElement(codeElement);
        }
    }
}

function createDirectoryTabContent(tab) {
    const tabContent = document.createElement('div');
    tabContent.className = 'tab-content hidden';
    tabContent.dataset.tabId = tab.id;
    
    const filesList = tab.files.map(file => {
        const extension = file.isDirectory ? '' : file.name.split('.').pop();
        const icon = getFileIcon(extension, file.isDirectory);
        const isBinary = !file.isDirectory && isBinaryFile(extension);
        
        let cssClasses = file.isDirectory ? 'directory' : 'file';
        if (isBinary) {
            cssClasses += ' binary';
        }
        
        return `
            <div class="file-item ${cssClasses}" data-path="${file.path}" data-is-binary="${isBinary}">
                <span class="file-icon">${icon}</span>
                <span class="file-name">${file.name}</span>
            </div>
        `;
    }).join('');
    
    const directoryModified = tab.files.length > 0 
        ? Math.max(...tab.files.map(f => new Date(f.modified).getTime()))
        : null;
    
    tabContent.innerHTML = `
        <div class="file-info">
            <span>📁 ${tab.directoryName}</span>
            <span>${tab.files.length} items</span>
            <span>Directory</span>
            <span>${formatTimestamp(directoryModified ? new Date(directoryModified) : null)}</span>
        </div>
        <div class="directory-container">
            <div class="files-list">
                ${filesList}
            </div>
        </div>
    `;
    
    tabsContainer.appendChild(tabContent);
    
    // Add click handlers for files and directories
    const fileItems = tabContent.querySelectorAll('.file-item.file');
    fileItems.forEach(item => {
        item.addEventListener('click', () => {
            const isBinary = item.dataset.isBinary === 'true';
            if (isBinary) {
                // Ignore clicks on binary files
                return;
            }
            const filePath = item.dataset.path;
            openFileFromPath(filePath);
        });
    });
    
    const directoryItems = tabContent.querySelectorAll('.file-item.directory');
    directoryItems.forEach(item => {
        item.addEventListener('click', () => {
            const directoryPath = item.dataset.path;
            navigateToDirectory(tab.id, directoryPath);
        });
    });
}

async function openFileFromPath(filePath) {
    try {
        const result = await ipcRenderer.invoke('open-file-from-path', filePath);
        
        if (result.success) {
            if (result.openedExternally) {
                // File was opened in external application, no need to create tab
                return;
            } else {
                createTab(result);
            }
        } else {
            alert('Error opening file: ' + result.error);
        }
    } catch (error) {
        alert('Error opening file: ' + error.message);
    }
}

function navigateToDirectory(tabId, directoryPath) {
    try {
        const files = fs.readdirSync(directoryPath).map(fileName => {
            const fullPath = require('path').join(directoryPath, fileName);
            const fileStats = fs.statSync(fullPath);
            return {
                name: fileName,
                path: fullPath,
                isDirectory: fileStats.isDirectory(),
                size: fileStats.size,
                modified: fileStats.mtime
            };
        });
        
        // Update the tab data
        const tab = tabs.find(t => t.id === tabId);
        if (tab) {
            tab.directoryPath = directoryPath;
            tab.directoryName = require('path').basename(directoryPath);
            tab.files = files;
            
            // Update tab title
            const tabElement = document.querySelector(`[data-tab-id="${tabId}"]`);
            if (tabElement && tabElement.classList.contains('tab')) {
                const titleElement = tabElement.querySelector('.tab-title');
                if (titleElement) {
                    titleElement.textContent = `📁 ${tab.directoryName}`;
                    titleElement.title = tab.directoryPath;
                }
            }
            
            // Update tab content
            const tabContent = tabsContainer.querySelector(`[data-tab-id="${tabId}"]`);
            if (tabContent) {
                tabContent.remove();
                createDirectoryTabContent(tab);
                
                // Make sure the tab is still active
                if (activeTabId === tabId) {
                    const newTabContent = tabsContainer.querySelector(`[data-tab-id="${tabId}"]`);
                    if (newTabContent) {
                        newTabContent.classList.remove('hidden');
                    }
                }
            }
        }
    } catch (error) {
        alert('Error navigating to directory: ' + error.message);
    }
}

function goUpDirectory() {
    if (activeTabId !== null) {
        const tab = tabs.find(t => t.id === activeTabId);
        if (tab) {
            if (tab.isDirectory) {
                const parentPath = require('path').dirname(tab.directoryPath);
                // Don't go above root directory
                if (parentPath !== tab.directoryPath) {
                    navigateToDirectory(tab.id, parentPath);
                }
            } else {
                // For file tabs, open the containing directory in a new tab
                const containingDir = require('path').dirname(tab.filePath);
                openDirectoryInNewTab(containingDir);
            }
        }
    }
}

function openDirectoryInNewTab(directoryPath) {
    try {
        const files = fs.readdirSync(directoryPath).map(fileName => {
            const fullPath = require('path').join(directoryPath, fileName);
            const fileStats = fs.statSync(fullPath);
            return {
                name: fileName,
                path: fullPath,
                isDirectory: fileStats.isDirectory(),
                size: fileStats.size,
                modified: fileStats.mtime
            };
        });
        
        const directoryData = {
            success: true,
            isDirectory: true,
            directoryPath: directoryPath,
            directoryName: require('path').basename(directoryPath),
            files: files
        };
        
        createDirectoryTab(directoryData);
    } catch (error) {
        alert('Error opening directory: ' + error.message);
    }
}

function updateUpButtonVisibility() {
    if (activeTabId !== null) {
        const tab = tabs.find(t => t.id === activeTabId);
        if (tab) {
            if (tab.isDirectory) {
                const parentPath = require('path').dirname(tab.directoryPath);
                // Show button if we can go up (not at root)
                if (parentPath !== tab.directoryPath) {
                    upDirectoryBtn.style.display = 'inline-block';
                    upDirectoryBtn.title = 'Go up to parent directory';
                } else {
                    upDirectoryBtn.style.display = 'none';
                }
            } else {
                // For file tabs, always show button to open containing directory
                upDirectoryBtn.style.display = 'inline-block';
                upDirectoryBtn.title = 'Open containing directory';
            }
        } else {
            upDirectoryBtn.style.display = 'none';
        }
    } else {
        upDirectoryBtn.style.display = 'none';
    }
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
    updateUpButtonVisibility();
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
            tabBar.style.display = 'none';
            updateUpButtonVisibility();
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

function formatTimestamp(date) {
    if (!date) return 'Unknown';
    
    const timestamp = new Date(date);
    const now = new Date();
    const diffMs = now - timestamp;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
        return timestamp.toLocaleTimeString();
    } else if (diffDays === 1) {
        return 'Yesterday';
    } else if (diffDays < 7) {
        return `${diffDays} days ago`;
    } else {
        return timestamp.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
    }
}

function isBinaryFile(extension) {
    const binaryExtensions = [
        // Executables and libraries
        'exe', 'dll', 'so', 'dylib', 'app', 'deb', 'rpm', 'msi', 'dmg',
        'bin', 'run', 'com', 'scr', 'pif', 'gadget',
        
        // Compiled code
        'o', 'obj', 'lib', 'a', 'pyc', 'pyo', 'class', 'jar',
        
        // Database files
        'db', 'sqlite', 'sqlite3', 'mdb', 'accdb',
        
        // Office documents (binary formats)
        'docx', 'xlsx', 'pptx', 'odt', 'ods', 'odp',
        
        // Audio files
        'mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a',
        
        // Video files
        'mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm', 'm4v',
        
        // Archive files
        'zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'lzma',
        
        // Other binary formats
        'iso', 'img', 'vdi', 'vmdk', 'qcow2', 'vhd',
        'ttf', 'otf', 'woff', 'woff2', 'eot',
        'swf', 'fla'
    ];
    
    return binaryExtensions.includes(extension.toLowerCase());
}

function getFileIcon(extension, isDirectory = false) {
    if (isDirectory) return '📁';
    
    const iconMap = {
        // Programming languages
        'js': '📜',
        'jsx': '⚛️',
        'ts': '📘',
        'tsx': '⚛️',
        'py': '🐍',
        'java': '☕',
        'cpp': '⚙️',
        'c': '⚙️',
        'cs': '🔷',
        'php': '🐘',
        'rb': '💎',
        'go': '🐹',
        'rs': '🦀',
        'swift': '🦉',
        'kt': '🎯',
        'scala': '🔺',
        
        // Web technologies
        'html': '🌐',
        'htm': '🌐',
        'css': '🎨',
        'scss': '🎨',
        'sass': '🎨',
        'less': '🎨',
        'vue': '💚',
        'svelte': '🧡',
        
        // Data formats
        'json': '📋',
        'xml': '📋',
        'yaml': '📋',
        'yml': '📋',
        'csv': '📊',
        'sql': '🗃️',
        
        // Documentation
        'md': '📝',
        'txt': '📄',
        'pdf': '📕',
        'doc': '📄',
        'docx': '📄',
        'rtf': '📄',
        
        // Images
        'png': '🖼️',
        'jpg': '🖼️',
        'jpeg': '🖼️',
        'gif': '🖼️',
        'svg': '🖼️',
        'webp': '🖼️',
        'ico': '🖼️',
        'bmp': '🖼️',
        
        // Audio/Video
        'mp3': '🎵',
        'wav': '🎵',
        'flac': '🎵',
        'mp4': '🎬',
        'avi': '🎬',
        'mkv': '🎬',
        'mov': '🎬',
        
        // Archives
        'zip': '📦',
        'rar': '📦',
        '7z': '📦',
        'tar': '📦',
        'gz': '📦',
        
        // Config files
        'config': '⚙️',
        'conf': '⚙️',
        'ini': '⚙️',
        'env': '🔧',
        
        // Build files
        'dockerfile': '🐳',
        'makefile': '🔨',
        'package': '📦',
        'lock': '🔒',
        
        // Shell scripts
        'sh': '💻',
        'bash': '💻',
        'zsh': '💻',
        'fish': '💻',
        'ps1': '💻',
        'bat': '💻',
        'cmd': '💻'
    };
    
    return iconMap[extension.toLowerCase()] || '📄';
}

function showKeyboardShortcuts() {
    showModal('Keyboard Shortcuts', `
        <div class="shortcuts-list">
            <div class="shortcut-section">
                <h3>File Operations</h3>
                <div class="shortcut-item">
                    <span class="shortcut-key">Ctrl+O</span>
                    <span class="shortcut-desc">Open File or Directory</span>
                </div>
            </div>
            
            <div class="shortcut-section">
                <h3>Tab Navigation</h3>
                <div class="shortcut-item">
                    <span class="shortcut-key">Ctrl+Tab</span>
                    <span class="shortcut-desc">Next Tab</span>
                </div>
                <div class="shortcut-item">
                    <span class="shortcut-key">Ctrl+Shift+Tab</span>
                    <span class="shortcut-desc">Previous Tab</span>
                </div>
                <div class="shortcut-item">
                    <span class="shortcut-key">Ctrl+W</span>
                    <span class="shortcut-desc">Close Tab</span>
                </div>
            </div>
            
            <div class="shortcut-section">
                <h3>View</h3>
                <div class="shortcut-item">
                    <span class="shortcut-key">F5</span>
                    <span class="shortcut-desc">Reload</span>
                </div>
                <div class="shortcut-item">
                    <span class="shortcut-key">F11</span>
                    <span class="shortcut-desc">Toggle Fullscreen</span>
                </div>
                <div class="shortcut-item">
                    <span class="shortcut-key">Ctrl++</span>
                    <span class="shortcut-desc">Zoom In</span>
                </div>
                <div class="shortcut-item">
                    <span class="shortcut-key">Ctrl+-</span>
                    <span class="shortcut-desc">Zoom Out</span>
                </div>
            </div>
        </div>
    `);
}

function showAbout() {
    showModal('About SourceView', `
        <div class="about-content">
            <h2>SourceView</h2>
            <p>A modern source code viewer with syntax highlighting and directory browsing.</p>
            
            <div class="feature-list">
                <h3>Features:</h3>
                <ul>
                    <li>📄 View source code files with syntax highlighting</li>
                    <li>📁 Browse directories with visual grid layout</li>
                    <li>🔗 Navigate directories by clicking folders</li>
                    <li>⬆️ Quick parent directory navigation</li>
                    <li>📑 Multi-tab interface for easy file switching</li>
                    <li>🎨 Dark theme optimized for code viewing</li>
                </ul>
            </div>
            
            <div class="usage-info">
                <h3>Usage:</h3>
                <p>Launch with: <code>electron . [path]</code></p>
                <p>Opens current directory by default, or specified file/directory.</p>
            </div>
        </div>
    `);
}

function showModal(title, content) {
    // Remove existing modal if any
    const existingModal = document.querySelector('.modal-overlay');
    if (existingModal) {
        existingModal.remove();
    }
    
    const modalHtml = `
        <div class="modal-overlay">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>${title}</h2>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    ${content}
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Add event listeners
    const modal = document.querySelector('.modal-overlay');
    const closeBtn = modal.querySelector('.modal-close');
    
    closeBtn.addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
    
    // Close on Escape key
    document.addEventListener('keydown', function escapeHandler(e) {
        if (e.key === 'Escape') {
            modal.remove();
            document.removeEventListener('keydown', escapeHandler);
        }
    });
}