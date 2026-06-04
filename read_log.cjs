const fs = require('fs');
const path = '/.gemini/antigravity/brain/4026d0d6-2701-4ae4-89cd-88f7612194ac/.system_generated/logs/overview.txt';
try {
  const data = fs.readFileSync(path, 'utf8');
  console.log(data);
} catch (err) {
  console.error(err);
}
