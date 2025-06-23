const { ipcRenderer } = require('electron');
const fs = require('fs');

const openFileBtn = document.getElementById('openFileBtn');
const welcomeMessage = document.getElementById('welcomeMessage');
const codeBlock = document.getElementById('codeBlock');
const codeContent = document.getElementById('codeContent');
const fileInfo = document.getElementById('fileInfo');
const fileName = document.getElementById('fileName');
const fileSize = document.getElementById('fileSize');
const fileType = document.getElementById('fileType');

async function openFile() {
    try {
        const result = await ipcRenderer.invoke('open-file-dialog');
        
        if (result.success) {
            displayFile(result);
        } else if (!result.canceled) {
            alert('Error loading file: ' + result.error);
        }
    } catch (error) {
        alert('Error opening file: ' + error.message);
    }
}

openFileBtn.addEventListener('click', openFile);

ipcRenderer.on('open-file', openFile);

function displayFile(fileData) {
    welcomeMessage.style.display = 'none';
    
    fileName.textContent = fileData.fileName;
    fileSize.textContent = formatFileSize(fileData.content.length);
    fileType.textContent = fileData.extension.toUpperCase() || 'Unknown';
    fileInfo.style.display = 'block';
    
    codeContent.textContent = fileData.content;
    codeContent.className = getLanguageClass(fileData.extension);
    
    hljs.highlightElement(codeContent);
    
    codeBlock.style.display = 'block';
}

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