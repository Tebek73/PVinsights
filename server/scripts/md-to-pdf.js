const path = require('path');
const { mdToPdf } = require('md-to-pdf');

const root = path.join(__dirname, '..', '..');
const src = path.join(root, 'docs', 'APP_DOCUMENTATION.md');
const dest = path.join(root, 'docs', 'APP_DOCUMENTATION.pdf');

mdToPdf(
  { path: src },
  { dest }
)
  .then(() => console.log('PDF written to', dest))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
