(async () => {
  try {
    const base = 'http://127.0.0.1:8080';
    const root = await fetch(base + '/');
    console.log('ROOT Status:', root.status);
    const txt = await root.text();
    console.log('ROOT Length:', txt.length);

    const sw = await fetch(base + '/sw.js');
    console.log('SW Status:', sw.status);
    const swText = await sw.text();
    const lines = swText.split(/\r?\n/);
    console.log('SW first 40 lines:');
    for (let i = 0; i < Math.min(40, lines.length); i++) {
      console.log(lines[i]);
    }
  } catch (e) {
    console.error('Error checking server:', e.message || e);
    process.exit(2);
  }
})();
