/* eslint-disable @typescript-eslint/no-require-imports -- ensaio Node externo ao aplicativo */
/* global require, process, __dirname, document, console */
const { chromium } = require(process.env.RIO_PLAYWRIGHT_PATH || 'playwright');
const fs = require('fs');
const path = require('path');
const origin = 'http://127.0.0.1:4190';
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    const errors = [], results = [];
    page.on('pageerror', error => errors.push(error.message));
    let calls = 0;
    await page.route('**/api/**', route => {
      calls++;
      if (route.request().method() !== 'GET') throw Error('Escrita inesperada');
      const url = route.request().url();
      if (url.endsWith('/accounts/me')) return route.fulfill({ json: { id: '10000000-0000-0000-0000-000000000001', personId: '10000000-0000-0000-0000-000000000002', login: 'conta.sintetica', status: 'ACTIVE' } });
      if (url.endsWith('/csrf')) return route.fulfill({ json: { headerName: 'X-CSRF-TOKEN', token: 'synthetic' } });
      throw Error('Consulta inesperada: ' + url);
    });
    async function signIn() {
      await page.getByLabel('Login', { exact: true }).fill('synthetic');
      await page.getByLabel('Senha', { exact: true }).fill('synthetic-password');
      await page.getByLabel('Senha', { exact: true }).press('Enter');
    }
    for (const width of [320, 360, 390, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1000 });
      const previousCalls = calls;
      await page.goto(origin + '/');
      await page.getByRole('heading', { name: 'Entrar', exact: true }).waitFor();
      if (await page.getByRole('navigation').count()) throw Error('Menu presente antes de autenticar');
      if (calls !== previousCalls) throw Error('API consultada na Home pública');
      const geometry = await page.evaluate(() => {
        const group = document.querySelector('.access-layout').getBoundingClientRect();
        const main = document.querySelector('main').getBoundingClientRect();
        return { centerError: Math.abs(group.x + group.width / 2 - document.documentElement.clientWidth / 2), verticalError: Math.abs(group.y + group.height / 2 - (main.y + main.height / 2)), overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth };
      });
      if (geometry.centerError > 1 || geometry.verticalError > 1 || geometry.overflow) throw Error(JSON.stringify({ width, ...geometry }));
      if ([390, 1440].includes(width)) await page.screenshot({ path: path.join(__dirname, `public-home-${width}.png`), fullPage: true });
      await signIn();
      await page.getByRole('heading', { name: 'Bem-vindo', exact: true }).waitFor();
      if (page.url() !== origin + '/') throw Error('Login normal não abriu Home');
      await page.getByRole('navigation', { name: 'Principal' }).waitFor();
      if (await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)) throw Error('Overflow na Home logada');
      if ([390, 1440].includes(width)) await page.screenshot({ path: path.join(__dirname, `authenticated-home-${width}.png`), fullPage: true });
      await page.getByRole('button', { name: 'Sair', exact: true }).click();
      await page.getByRole('heading', { name: 'Entrar', exact: true }).waitFor();
      if (page.url() !== origin + '/' || await page.getByRole('navigation').count()) throw Error('Saída não voltou à Home pública');
      await page.goto(origin + '/conta');
      await page.getByRole('heading', { name: 'Entrar', exact: true }).waitFor();
      if (await page.getByRole('navigation').count()) throw Error('Menu em acesso protegido sem sessão');
      await signIn();
      await page.getByRole('heading', { name: 'Minha conta', exact: true }).waitFor();
      if (!page.url().endsWith('/conta')) throw Error('Destino protegido perdido');
      await page.getByRole('button', { name: 'Sair da conta', exact: true }).click();
      await page.getByRole('heading', { name: 'Entrar', exact: true }).waitFor();
      if (page.url() !== origin + '/' || await page.getByRole('navigation').count()) throw Error('Saída da conta não limpou destino');
      results.push({ width, ...geometry, publicNoNavigation: true, defaultLoginHome: true, authenticatedNavigation: true, protectedReturn: true, bothSignoutsHome: true });
    }
    if (errors.length) throw Error(errors.join('\n'));
    fs.writeFileSync(path.join(__dirname, 'browser-results.json'), JSON.stringify({ browser: browser.version(), environment: 'Chrome headless com GETs sintéticos, sem backend real', results, errors }, null, 2));
    console.log('PASS: sete larguras, Home pública sem menu, login normal para Home, menus autenticados, retorno protegido e ambas as saídas.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
