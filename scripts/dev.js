// VS Code sets ELECTRON_RUN_AS_NODE=1 in all terminals (it is itself Electron in Node mode).
// This makes any Electron app started from a VS Code terminal run as plain Node.js,
// losing the full Electron API. Strip it before launching.
const { spawnSync } = require('child_process')

const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE

const result = spawnSync('npx', ['electron-vite', 'dev'], {
  stdio: 'inherit',
  env,
  shell: true,
  cwd: process.cwd(),
})

process.exit(result.status ?? 0)
