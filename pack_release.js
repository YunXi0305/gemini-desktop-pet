const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const projectDir = path.resolve(__dirname);
const rootDistDir = path.resolve(__dirname, '..', 'dist');
const targetAppDir = path.join(rootDistDir, 'GeminiPet');
const electronDist = 'C:\\Users\\29705\\AppData\\Local\\hermes\\hermes-agent\\apps\\desktop\\node_modules\\electron\\dist';

console.log('=== Building Gemini Pet Standalone Portable Edition ===');

// 1. Ensure target directory exists
if (!fs.existsSync(targetAppDir)) {
  fs.mkdirSync(targetAppDir, { recursive: true });
}

// 2. Copy Electron runtime binaries if not already present
function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    fs.readdirSync(src).forEach(child => {
      copyRecursive(path.join(src, child), path.join(dest, child));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

const exeFile = path.join(targetAppDir, 'GeminiPet.exe');
if (!fs.existsSync(exeFile)) {
  console.log('Copying Electron runtime binaries from:', electronDist);
  fs.readdirSync(electronDist).forEach(file => {
    const src = path.join(electronDist, file);
    if (file === 'electron.exe') {
      fs.copyFileSync(src, exeFile);
      console.log('Renamed electron.exe -> GeminiPet.exe');
    } else if (file === 'resources') {
      // Handled below
    } else {
      copyRecursive(src, path.join(targetAppDir, file));
    }
  });
}

// 3. Assemble resources/app
const appResourcesDir = path.join(targetAppDir, 'resources', 'app');
fs.mkdirSync(appResourcesDir, { recursive: true });

// Also copy default_app.asar / resources.pak if in original resources
const origResources = path.join(electronDist, 'resources');
if (fs.existsSync(origResources)) {
  fs.readdirSync(origResources).forEach(f => {
    if (f !== 'default_app.asar') { // We replace default_app with app folder
      copyRecursive(path.join(origResources, f), path.join(targetAppDir, 'resources', f));
    }
  });
}

console.log('Packaging app source files into resources/app...');
const includeFiles = [
  'package.json',
  'main.js',
  'pet.html',
  'settings.html',
  'gemini-pet.js',
  'key_watcher.exe',
  'app.ico',
  'LICENSE',
  'README.md'
];

includeFiles.forEach(f => {
  const src = path.join(projectDir, f);
  if (fs.existsSync(src)) {
    try {
      fs.copyFileSync(src, path.join(appResourcesDir, f));
    } catch (_) {}
  }
});

// Copy assets
const assetsSrc = path.join(projectDir, 'assets');
const assetsDest = path.join(appResourcesDir, 'assets');
if (fs.existsSync(assetsSrc)) {
  copyRecursive(assetsSrc, assetsDest);
}

console.log('GeminiPet standalone app directory assembled successfully at:');
console.log(targetAppDir);

// 4. Create ZIP package
const zipPath = path.join(rootDistDir, 'GeminiPet-v1.0.0-win-x64.zip');
if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

console.log('Compressing portable package to:', zipPath);
const psCmd = `Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory('${targetAppDir}', '${zipPath}', [System.IO.Compression.CompressionLevel]::Optimal, $true)`;
execSync(`powershell -Command "${psCmd}"`, { stdio: 'inherit' });
  console.log('=== Package built successfully! ===');
  console.log('Release ZIP:', zipPath);
