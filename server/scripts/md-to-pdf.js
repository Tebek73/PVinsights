// Compatibility entry point for the consolidated documentation renderer.
// Set PYTHON to a Python executable with reportlab installed when necessary.
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const script = path.resolve(__dirname, '../../docs/scripts/build-documentation.py');
const result = spawnSync(process.env.PYTHON || 'python', [script], { stdio: 'inherit' });
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
