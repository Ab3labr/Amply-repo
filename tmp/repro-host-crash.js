const { chromium } = require('playwright');

(async () => {
  try {
    const response = await fetch('http://localhost:3000/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostName: 'TestHost' }),
    });
    const data = await response.json();
    const code = data.roomCode;
    console.log('roomCode', code);

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const hostPage = await context.newPage();
    const guestPage = await context.newPage();
    let hostError = null;

    hostPage.on('console', msg => console.log('[HOST CONSOLE]', msg.type(), msg.text()));
    hostPage.on('pageerror', err => {
      hostError = err;
      console.error('[HOST PAGE ERROR]', err.message, err.stack);
    });
    hostPage.on('requestfailed', req => console.log('[HOST REQUEST FAILED]', req.url(), req.failure()?.errorText));

    guestPage.on('console', msg => console.log('[GUEST CONSOLE]', msg.type(), msg.text()));
    guestPage.on('pageerror', err => console.error('[GUEST PAGE ERROR]', err.message, err.stack));
    guestPage.on('requestfailed', req => console.log('[GUEST REQUEST FAILED]', req.url(), req.failure()?.errorText));

    await hostPage.goto(`http://localhost:3000/host/${code}`, { waitUntil: 'networkidle' });
    console.log('host page loaded');
    await hostPage.waitForSelector('input[placeholder="Add a YouTube link to the queue"]', { timeout: 15000 });

    await guestPage.goto('http://localhost:3000/join', { waitUntil: 'networkidle' });
    console.log('guest join loaded');

    await guestPage.fill('input[placeholder="Your Name"]', 'Guest');
    await guestPage.fill('input[placeholder="Room Code (e.g. A7F9XQ)"]', code);
    await guestPage.click('button:has-text("Continue")');
    await guestPage.waitForSelector('button:has-text("Yes, Join")', { timeout: 10000 });
    await guestPage.click('button:has-text("Yes, Join")');
    await guestPage.waitForURL(`**/room/${code}`, { timeout: 10000 });
    console.log('guest joined room');

    const url = 'https://www.youtube.com/watch?v=jNQXAC9IVRw';
    await hostPage.fill('input[placeholder="Add a YouTube link to the queue"]', url);
    await hostPage.click('button:has-text("+")');
    console.log('host queued URL');

    await hostPage.waitForSelector('text=Now Playing', { timeout: 20000 });
    console.log('host now playing visible');
    await guestPage.waitForSelector('text=Now Playing', { timeout: 20000 });
    console.log('guest now playing visible');

    await guestPage.waitForTimeout(10000);
    console.log('waiting for potential host crash...');

    if (hostError) {
      console.log('HOST ERROR DETECTED', hostError.message);
    } else {
      console.log('NO HOST ERROR DETECTED yet');
    }

    await hostPage.screenshot({ path: 'tmp/host-page.png', fullPage: true });
    await guestPage.screenshot({ path: 'tmp/guest-page.png', fullPage: true });
    console.log('screenshots taken');

    await browser.close();
    if (hostError) process.exit(1);
  } catch (err) {
    console.error('SCRIPT ERROR', err);
    process.exit(1);
  }
})();