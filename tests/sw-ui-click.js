const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function run() {
  const url = 'http://127.0.0.1:8080/';
  const userDataDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'sw-ui-'));
  console.log('Using userDataDir:', userDataDir);

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'], userDataDir });
  const page = await browser.newPage();
  page.on('console', (m) => console.log('[PAGE]', m.text()));

  await page.goto(url, { waitUntil: 'load', timeout: 60000 });

  // Enable management mode by setting localStorage and reloading
  await page.evaluate(() => { localStorage.setItem('isManagementMode', 'true'); });
  await page.reload({ waitUntil: 'load' });
  // Wait for settings section to be present
  await page.waitForSelector('.ControlPanelSidebar, h3', { timeout: 10000 }).catch(() => {});

  // Click Export Browser Backup button
  // Ensure Control Panel view is opened via header menu (click Control Panel nav)
  await page.evaluate(() => {
    const cp = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.trim() === 'Control Panel');
    if (cp) cp.click();
  });
  await new Promise(r => setTimeout(r, 500));

  const clicked = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.trim().startsWith('Export Browser Backup'));
    if (!btn) return false;
    btn.click();
    return true;
  });
  console.log('Clicked Export Browser Backup:', clicked);

  // Click Get SW Stats button
  const clicked2 = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.trim().startsWith('Get SW Stats'));
    if (!btn) return false;
    btn.click();
    return true;
  });
  console.log('Clicked Get SW Stats:', clicked2);

  await new Promise(r => setTimeout(r, 2500));
  await browser.close();
  console.log('Done.');
}

run().catch(e => { console.error(e); process.exit(2); });
