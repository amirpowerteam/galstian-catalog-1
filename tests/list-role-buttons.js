const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:8080/', { waitUntil: 'load' });
  await new Promise(r=>setTimeout(r,2000));
  const els = await page.evaluate(() => Array.from(document.querySelectorAll('[role=button]')).map(e => ({ tag: e.tagName, text: (e.textContent && e.textContent.trim().slice(0,80)) || '' })).slice(0,200));
  console.log(els);
  await browser.close();
})();