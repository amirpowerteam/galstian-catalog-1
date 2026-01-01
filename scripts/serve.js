const { spawnSync, spawn } = require('child_process');
const path = require('path');
const port = process.env.PORT || process.argv[2] || '8080';

function run(cmd, args) {
  const p = spawn(cmd, args, { stdio: 'inherit', shell: true });
  p.on('exit', (code) => process.exit(code));
}

function existsSyncCommand(cmd) {
  try {
    const res = spawnSync(cmd, ['--version'], { stdio: 'ignore', shell: true });
    return res && res.status === 0;
  } catch (e) {
    return false;
  }
}

console.log(`Serving project from ${process.cwd()} on port ${port}...`);

if (existsSyncCommand('python')) {
  run('python', ['-m', 'http.server', port]);
} else if (existsSyncCommand('py')) {
  run('py', ['-3', '-m', 'http.server', port]);
} else {
  console.log('Python not found in PATH, falling back to npx http-server (will prompt to install if needed).');
  run('npx', ['http-server', '-p', port]);
}
