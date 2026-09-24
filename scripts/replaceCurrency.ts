import fs from 'fs';
import path from 'path';

function walkDir(dir: string, callback: (filePath: string) => void) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      walkDir(dirPath, callback);
    } else if (dirPath.endsWith('.tsx') || dirPath.endsWith('.ts')) {
      callback(dirPath);
    }
  });
}

function processFile(filePath: string) {
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  // Add import if needed
  const needsImport = /₱.*?(Math\.round|toFixed|formatPrice|price|totalAmount|vehicleBasePrice|grandTotal|itemsSubtotal|urgentFee|Number\()/.test(content);
  if (needsImport && !content.includes('formatCurrency') && !content.includes('import { formatCurrency }')) {
    content = `import { formatCurrency } from '@/lib/formatCurrency';\n` + content;
  }

  // Replace common patterns
  content = content.replace(/₱\{Math\.round\(([^}]+)\)\}/g, '₱{formatCurrency($1)}');
  content = content.replace(/₱\{Number\(([^}]+)\)\.toFixed\(2\)\}/g, '₱{formatCurrency($1)}');
  content = content.replace(/₱\{\(([^}]+)\)\.toFixed\(2\)\}/g, '₱{formatCurrency($1)}');
  content = content.replace(/₱\{formatPrice\(([^}]+)\)\}/g, '₱{formatCurrency($1)}');
  content = content.replace(/₱([0-9]+\.[0-9]{2})/g, (match, p1) => `₱{formatCurrency(${p1})}`);
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${filePath}`);
  }
}

walkDir(path.join(__dirname, '../src'), processFile);
