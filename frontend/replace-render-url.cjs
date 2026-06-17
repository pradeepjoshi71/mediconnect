'use strict';

const fs = require('fs');
const path = require('path');

const vercelPath = path.join(__dirname, 'vercel.json');
if (fs.existsSync(vercelPath)) {
  const content = fs.readFileSync(vercelPath, 'utf8');
  const backendUrl = process.env.VITE_API_URL || 'https://mediconnect-backend.onrender.com';
  const cleanBackendUrl = backendUrl.replace(/\/$/, '');

  const updatedContent = content.replace(/https:\/\/mediconnect-backend\.onrender\.com/g, cleanBackendUrl);

  fs.writeFileSync(vercelPath, updatedContent);
  console.log(`[prebuild] Vercel proxy rewrite updated to: ${cleanBackendUrl}`);
} else {
  console.warn(`[prebuild] vercel.json not found at: ${vercelPath}`);
}
