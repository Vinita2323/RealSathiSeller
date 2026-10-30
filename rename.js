const fs = require('fs');
const path = require('path');

const replacements = [
  { regex: /Captains/g, replacement: 'Captains' },
  { regex: /Captain/g, replacement: 'Captain' },
  { regex: /captains/gi, replacement: 'captains' },
  { regex: /captain/gi, replacement: 'captain' },
  { regex: /Captains/g, replacement: 'Captains' },
  { regex: /Captain/g, replacement: 'Captain' },
  { regex: /captains/g, replacement: 'captains' },
  { regex: /captain/g, replacement: 'captain' },
  { regex: /CAPTAINS/g, replacement: 'CAPTAINS' },
  { regex: /CAPTAIN/g, replacement: 'CAPTAIN' }
];

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let newContent = content;
  
  for (const rule of replacements) {
    newContent = newContent.replace(rule.regex, rule.replacement);
  }
  
  // Keep original mongoose collection name as 'captains' to avoid data loss
  // If we find mongoose.model('Captain', captainSchema), let's ensure collection is 'captains'
  // Actually, wait, let's just do the replacements and then I'll manually fix the model file if needed.
  
  if (content !== newContent) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`Updated content in: ${filePath}`);
  }
}

function processDirectory(dir) {
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      if (!file.includes('node_modules') && !file.includes('.git') && !file.includes('dist') && !file.includes('build')) {
        processDirectory(fullPath);
      }
    } else {
      if (file.match(/\.(js|jsx|ts|tsx|json|html|css|scss|md)$/)) {
        processFile(fullPath);
      }
    }
  });
}

// Rename files
function renameFiles(dir) {
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    if (stat && stat.isDirectory()) {
      if (!file.includes('node_modules') && !file.includes('.git') && !file.includes('dist') && !file.includes('build')) {
        renameFiles(fullPath);
      }
    }
    
    // Check if filename contains 'captain' or 'Captain'
    let newFileName = file;
    if (file.includes('Captain')) {
      newFileName = file.replace(/Captain/g, 'Captain');
    }
    if (newFileName.includes('captain')) {
      newFileName = newFileName.replace(/captain/g, 'captain');
    }
    
    if (newFileName !== file) {
      const newPath = path.join(dir, newFileName);
      fs.renameSync(fullPath, newPath);
      console.log(`Renamed file: ${fullPath} -> ${newPath}`);
    }
  });
}

const targetDir = 'd:/Appzeto/Shippnex';
console.log('Starting content replacement...');
processDirectory(targetDir);
console.log('Starting file renaming...');
renameFiles(targetDir);
console.log('Done.');
