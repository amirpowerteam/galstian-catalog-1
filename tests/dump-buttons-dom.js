const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:8080/', { waitUntil: 'load' });
  await new Promise(r => setTimeout(r, 2000));
  const info = await page.evaluate(() => {
    const buttons = Array.from(document.getElementsByTagName('button'));
    return { count: buttons.length, sample: buttons.slice(0, 20).map(b => b.outerHTML.slice(0,200)) };
  });
  console.log(JSON.stringify(info, null, 2));
  await browser.close();
})();
