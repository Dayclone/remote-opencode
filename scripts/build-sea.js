import esbuild from 'esbuild';
import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, chmodSync, writeFileSync, unlinkSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

async function build() {
  console.log('🚀 Starting SEA build process...');

  const distDir = join(rootDir, 'dist');
  if (!existsSync(distDir)) {
    mkdirSync(distDir);
  }

  const bundlePath = join(distDir, 'bundle.cjs');
  const blobPath = join(distDir, 'sea-prep.blob');

  // 1. Bundle with esbuild
  console.log('📦 Bundling with esbuild...');
  await esbuild.build({
    entryPoints: [join(rootDir, 'src/cli.ts')],
    bundle: true,
    platform: 'node',
    target: 'node22',
    outfile: bundlePath,
    format: 'cjs',
    minify: true,
    sourcemap: false,
    external: ['fsevents'],
    // This banner effectively silences the native warning and shims the environment
    banner: {
      js: `
        (function() {
          const p = process;
          const e = p.emit;
          p.emit = function(n, d) {
            if (n === 'warning' && d && d.message && d.message.includes('require() provided to the main script')) return false;
            return e.apply(p, arguments);
          };
        })();
        var _m = require("module");
        var _u = require("url");
        var __filename = process.execPath;
        var __dirname = require("path").dirname(__filename);
        var require = _m.createRequire(_u.pathToFileURL(__filename).href);
        var _importMetaUrl = _u.pathToFileURL(__filename).href;
      `.trim().replace(/\n/g, ''),
    },
    define: {
      'import.meta.url': '_importMetaUrl',
    }
  });

  // 2. Generate SEA blob
  console.log('🔮 Generating SEA blob...');
  execSync('node --experimental-sea-config sea-config.json', { cwd: rootDir, stdio: 'inherit' });

  // 3. Create the executable
  const isWindows = process.platform === 'win32';
  const executableName = isWindows ? 'remote-opencode.exe' : 'remote-opencode';
  const outputPath = join(distDir, executableName);
  
  if (isWindows && existsSync(outputPath)) {
    console.log(`🗑️ Replacing existing ${executableName}...`);
    try {
      execSync('taskkill /F /IM remote-opencode.exe /T', { stdio: 'ignore' });
    } catch (e) {}
    
    const oldPath = outputPath + '.old';
    if (existsSync(oldPath)) {
      try { unlinkSync(oldPath); } catch (e) {}
    }
    
    try {
      renameSync(outputPath, oldPath);
    } catch (e) {}
  }

  console.log(`🔨 Creating ${executableName}...`);
  try {
    copyFileSync(process.execPath, outputPath);
    await new Promise(r => setTimeout(r, 1000));
  } catch (err) {
    if (err.code === 'EBUSY') {
        console.error('❌ Error: Locked.');
        process.exit(1);
    }
    throw err;
  }

  // 4. Inject the blob
  console.log('💉 Injecting blob into binary...');
  const fuse = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2';
  try {
    const postjectCmd = `npx postject "${outputPath}" NODE_SEA_BLOB "${blobPath}" --sentinel-fuse ${fuse}`;
    execSync(postjectCmd, { stdio: 'inherit' });
    if (!isWindows) {
      chmodSync(outputPath, 0o755);
    }
  } catch (e) {
    console.error('❌ Failed to inject blob.');
    process.exit(1);
  }

  // 5. Cleanup
  console.log('🧹 Cleaning up intermediate files...');
  try {
    if (existsSync(bundlePath)) unlinkSync(bundlePath);
    if (existsSync(blobPath)) unlinkSync(blobPath);
  } catch (err) {}

  console.log(`✅ Build complete! Final Executable: ${outputPath}`);
}

build().catch(err => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});
