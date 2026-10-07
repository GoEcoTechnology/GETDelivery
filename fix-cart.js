const fs = require('fs');
let code = fs.readFileSync('src/app/customer/cart/page.tsx', 'utf8');

const replacement = `  const removeItem = async (id: number) => {
    setItems(prev => prev.filter(item => item.id !== id));
    try {
      await fetch(\`/api/cart/\${id}\`, { method: 'DELETE' });
    } catch (err) {
      console.error(err);
      fetchCart();
    }
  };

  const updateQuantity = async (id: number, delta: number) => {
    let newQty = 1;
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
    try {
      await fetch(\`/api/cart/\${id}\`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: newQty })
      });
    } catch (err) {
      console.error(err);
    }
  };

  const setQuantityExact = async (id: number, qty: number) => {
    const validQty = Math.max(1, qty);
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, quantity: validQty };
      }
      return item;
    }));
    try {
      await fetch(\`/api/cart/\${id}\`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: validQty })
      });
    } catch (err) {
      console.error(err);
    }
  };`;

code = code.replace(/const removeItem = async \(id: number\) => \{[\s\S]*?body: JSON\.stringify\(\{ quantity: newQty \}\)\r?\n      \}\);\r?\n\r?\n/m, replacement + '\n');
fs.writeFileSync('src/app/customer/cart/page.tsx', code);
console.log('Fixed');
