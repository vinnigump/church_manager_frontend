/* eslint-disable @typescript-eslint/no-require-imports -- ensaio Node externo ao aplicativo */
/* global require, process, __dirname, document, console, getComputedStyle */
const { chromium } = require(process.env.RIO_PLAYWRIGHT_PATH || 'playwright');
const fs = require('fs');
const path = require('path');
const origin = 'http://127.0.0.1:4189';
const account = { id: '10000000-0000-0000-0000-000000000001', personId: '10000000-0000-0000-0000-000000000002', login: 'conta.sintetica.para.validacao.visual', status: 'ACTIVE' };
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    const errors = [], results = [];
    page.on('pageerror', error => errors.push(error.message));
    let failLogin = false;
    await page.route('**/api/**', route => {
      if (route.request().method() !== 'GET') throw Error('Escrita inesperada');
      if (failLogin) return route.fulfill({ status: 401, json: {} });
      if (route.request().url().endsWith('/accounts/me')) return route.fulfill({ json: account });
      if (route.request().url().endsWith('/csrf')) return route.fulfill({ json: { headerName: 'X-CSRF-TOKEN', token: 'synthetic-csrf' } });
      throw Error('Consulta não esperada');
    });
    for (const width of [320, 360, 390, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(origin + '/conta');
      await page.getByRole('heading', { name: 'Entrar', exact: true }).waitFor();
      const geometry = await page.evaluate(() => {
        const group = document.querySelector('.access-layout').getBoundingClientRect();
        const card = document.querySelector('.access-panel').getBoundingClientRect();
        const main = document.querySelector('main').getBoundingClientRect();
        const header = document.querySelector('.app-header').getBoundingClientRect();
        const mainCenter = main.x + main.width / 2;
        return { groupCenterError: Math.abs(group.x + group.width / 2 - mainCenter), cardCenterError: Math.abs(card.x + card.width / 2 - mainCenter), verticalCenterError: Math.abs(group.y + group.height / 2 - (main.y + main.height / 2)), overlap: card.y < header.bottom, overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth, fieldSize: getComputedStyle(document.querySelector('#password')).fontSize, introVisible: getComputedStyle(document.querySelector('.access-intro')).display !== 'none' };
      });
      if (geometry.groupCenterError > 1 || geometry.verticalCenterError > 1 || geometry.overflow || geometry.overlap) throw Error(JSON.stringify({ width, ...geometry }));
      if (width <= 768 && (geometry.cardCenterError > 1 || geometry.introVisible)) throw Error('Cartão mobile não centralizado');
      if (parseFloat(geometry.fieldSize) < 16) throw Error('Campo pequeno');
      if ([390, 1440, 1920].includes(width)) await page.screenshot({ path: path.join(__dirname, `login-${width}.png`), fullPage: true });
      await page.getByLabel('Login', { exact: true }).fill('synthetic');
      await page.getByLabel('Senha', { exact: true }).fill('synthetic-password');
      await page.getByRole('button', { name: 'Mostrar senha', exact: true }).click();
      if (await page.getByLabel('Senha', { exact: true }).getAttribute('type') !== 'text') throw Error('Mostrar senha');
      await page.getByRole('button', { name: 'Ocultar senha', exact: true }).click();
      await page.getByLabel('Senha', { exact: true }).press('Enter');
      await page.getByRole('heading', { name: 'Minha conta', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Sair da conta', exact: true }).waitFor();
      if (await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)) throw Error('Overflow conta');
      if ([390, 1440].includes(width)) await page.screenshot({ path: path.join(__dirname, `account-${width}.png`), fullPage: true });
      await page.getByRole('link', { name: 'Alterar minha senha', exact: true }).click();
      await page.getByRole('heading', { name: 'Alterar minha senha', exact: true }).waitFor();
      await page.goBack();
      await page.getByRole('button', { name: 'Sair da conta', exact: true }).click();
      await page.getByRole('heading', { name: 'Entrar', exact: true }).waitFor();
      results.push({ width, ...geometry, enterLogin: true, passwordLink: true, accountSignout: true });
    }
    await page.setViewportSize({ width: 390, height: 500 });
    await page.goto(origin + '/entrar');
    await page.getByRole('heading', { name: 'Entrar', exact: true }).waitFor();
    if (await page.locator('.access-panel').evaluate(el => el.getBoundingClientRect().top < document.querySelector('.app-header').getBoundingClientRect().bottom)) throw Error('Conteúdo encoberto em tela baixa');
    await page.getByLabel('Login', { exact: true }).fill('synthetic');
    await page.getByLabel('Senha', { exact: true }).fill('synthetic-password');
    failLogin = true;
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await page.getByRole('alert').waitFor();
    if (await page.getByLabel('Senha', { exact: true }).inputValue()) throw Error('Senha não limpa');
    await page.screenshot({ path: path.join(__dirname, 'login-error-390.png'), fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
    if (await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)) throw Error('Overflow zoom CSS 200%');
    if (errors.length) throw Error(errors.join('\n'));
    fs.writeFileSync(path.join(__dirname, 'browser-results.json'), JSON.stringify({ browser: browser.version(), api: 'GETs interceptados com dados sintéticos, sem backend real', results, lowHeight: '390x500 sem sobreposição', errorClearsPassword: true, cssZoom200: 'sem overflow', errors }, null, 2));
    console.log('PASS: sete larguras; centralização, adaptação mobile, Enter, senha, conta, link de senha, saída, erro e zoom.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
