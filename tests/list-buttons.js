const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:8080/', { waitUntil: 'load' });
  await page.evaluate(() => { localStorage.setItem('isManagementMode','true'); });
  await page.reload({ waitUntil: 'load' });
  const texts = await page.evaluate(() => Array.from(document.querySelectorAll('button')).map(b => b.textContent && b.textContent.trim()).filter(Boolean).slice(0,200));
  console.log(texts);
  await browser.close();
})();