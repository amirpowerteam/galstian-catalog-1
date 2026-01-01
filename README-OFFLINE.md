نسخهٔ آفلاین (Standalone)
=================================

این پوشه شامل یک نسخهٔ آفلاین از برنامه است که می‌توانید محلی اجرا کنید.

مراحل سریع برای اجرا:

1. قرار گرفتن در پوشهٔ پروژه (همان جایی که `index.html` هست).

2. اجرای سرور محلی (PowerShell):
```powershell
.\start-server.ps1
```

یا با Batch در CMD:
```cmd
start-server.bat
```

در صورتی که Python نصب ندارید، می‌توانید از `npx http-server` استفاده کنید:
```powershell
npx http-server -p 5173 -c-1 .
```

پس از اجرا مرورگر را باز کنید:

http://localhost:5173/index.html

فعال‌سازی کامل صادرات/واردات Excel (.xlsx)
- برای فعال شدن کامل قابلیت‌های Excel، فایل واقعی `xlsx.full.min.js` را در مسیر `assets/xlsx.full.min.js` قرار دهید. فایل فعلی یک placeholder است.
- دانلود پیشنهادی (روی ماشینی که اینترنت دارد):
 - برای فعال شدن کامل قابلیت‌های Excel، فایل واقعی `xlsx.full.min.js` را در مسیر `assets/xlsx.full.min.js` قرار دهید. فایل فعلی یک placeholder است.
 - ممکن است نسخهٔ مشخص‌شده در CDN موجود نباشد (خطایی شبیه "Couldn't find the requested release version 0.18.9." مشاهده کردید). در این صورت یکی از آدرس‌های عمومی زیر معمولاً کار می‌کند یا آخرین نسخه را دانلود کنید:
   - https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js
   - https://unpkg.com/xlsx/dist/xlsx.full.min.js
 - اگر می‌خواهید یک نسخهٔ خاص را دریافت کنید، به صفحهٔ npm پکیج `xlsx` مراجعه کرده و نسخهٔ موجود را مشخص کنید.

نکات ایمنی
- باز کردن مستقیم `index.html` با `file://` باعث بروز خطاهای CORS می‌شود (origin='null'). همیشه از سرور محلی استفاده کنید.
