const fs = require('fs');
const path = require('path');

function replaceInFiles(dir, ext) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === 'node_modules') continue;
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      replaceInFiles(fullPath, ext);
    } else if (fullPath.endsWith(ext)) {
      let content = fs.readFileSync(fullPath, 'utf8');
      const newContent = content.replace(/<script src="([^"]+)"><\/script>/g, '<script type="module" src="$1"></script>');
      if (content !== newContent) {
        fs.writeFileSync(fullPath, newContent, 'utf8');
        console.log('Updated', fullPath);
      }
    }
  }
}

replaceInFiles('.', '.html');
