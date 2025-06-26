# SourceView

A modern source code viewer built with Electron, featuring syntax highlighting, directory browsing, and interactive navigation tools.

## Features

- 📄 **Source Code Viewing** - View source files with syntax highlighting for 20+ languages
- 📁 **Directory Browser** - Navigate directories with visual grid layout and file icons
- 🔗 **Interactive Navigation** - Click folders to browse, parent directory navigation
- 📑 **Multi-Tab Interface** - Open multiple files and directories simultaneously
- 🗺️ **Interactive Minimap** - Visual overview with click-to-navigate functionality
- 🖼️ **Image Support** - Display images directly in the viewer
- 📄 **PDF Integration** - Opens PDFs in system default viewer
- 🛡️ **Binary File Protection** - Safely handles binary files without crashing
- ⌨️ **Keyboard Shortcuts** - Full keyboard navigation support
- 🎨 **Dark Theme** - Professional dark theme optimized for code viewing

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd sourceview

# Install dependencies
npm install

# Run the application
npm start
```

## Usage

### Command Line
```bash
# Open current directory
electron .

# Open specific file
electron . /path/to/file.js

# Open specific directory
electron . /path/to/directory
```

### File Navigation
- **Open File/Directory**: Ctrl+O or toolbar button
- **Parent Directory**: ↑ Up button (when available)
- **Close Tab**: Ctrl+W
- **Next Tab**: Ctrl+Tab
- **Previous Tab**: Ctrl+Shift+Tab

### Minimap Navigation
- Click anywhere on the minimap to jump to that location in the file
- Viewport indicator shows current visible area
- Automatically scales to file content

## Supported File Types

### Programming Languages
JavaScript, TypeScript, Python, Java, C/C++, C#, PHP, Ruby, Go, Rust, Swift, Kotlin, Scala

### Web Technologies
HTML, CSS, SCSS, SASS, Vue, Svelte

### Data Formats
JSON, XML, YAML, CSV, SQL

### Documentation
Markdown, Plain Text, PDF

### Images
PNG, JPG, GIF, SVG, WebP, ICO, BMP

## Architecture

- **Main Process** (`main.js`) - Electron main process handling file operations
- **Renderer Process** (`renderer.js`) - UI logic and file display
- **Styling** (`styles.css`) - Dark theme and responsive layout
- **UI** (`index.html`) - Application structure with custom title bar

## Development

The application is built with:
- **Electron** - Desktop application framework
- **Highlight.js** - Syntax highlighting
- **Node.js fs** - File system operations
- **HTML5 Canvas** - Minimap rendering 
