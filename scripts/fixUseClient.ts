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

  // Check if it starts with import { formatCurrency } ... and then 'use client';
  if (content.startsWith("import { formatCurrency } from '@/lib/formatCurrency';\n'use client';")) {
    content = content.replace(
      "import { formatCurrency } from '@/lib/formatCurrency';\n'use client';",
      "'use client';\nimport { formatCurrency } from '@/lib/formatCurrency';"
    );
  } else if (content.startsWith("import { formatCurrency } from '@/lib/formatCurrency';\r\n'use client';")) {
    content = content.replace(
      "import { formatCurrency } from '@/lib/formatCurrency';\r\n'use client';",
      "'use client';\r\nimport { formatCurrency } from '@/lib/formatCurrency';"
    );
  }

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed use client in ${filePath}`);
  }
}

walkDir(path.join(__dirname, '../src'), processFile);
