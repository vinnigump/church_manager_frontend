/* eslint-disable @typescript-eslint/no-require-imports -- ensaio Node opcional, sem dependência Playwright na aplicação */
/* global require, process, __dirname, document, console, URL, getComputedStyle */
const { chromium } = require(process.env.RIO_PLAYWRIGHT_PATH || 'playwright');
const fs = require('fs');
const path = require('path');
const out = __dirname;
fs.mkdirSync(out, { recursive: true });
const id = '00000000-0000-0000-0000-000000000001';
const routes = { login: '/entrar', catalog: `/eventos/igrejas/${id}/catalogo`, security: `/seguranca/denominacoes/${id}/perfis` };
const account = { id: '10000000-0000-0000-0000-000000000001', personId: '10000000-0000-0000-0000-000000000002', login: 'conta.sintetica.de.validacao.visual', status: 'ACTIVE' };
const results = [];
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/**', async route => {
      if (route.request().method() !== 'GET') throw Error('Escrita inesperada no ensaio');
      const url = new URL(route.request().url());
      let value;
      if (url.pathname.endsWith('/accounts/me')) value = account;
      else if (url.pathname.endsWith('/csrf')) value = { headerName: 'X-CSRF-TOKEN', token: 'synthetic-csrf' };
      else if (url.pathname.endsWith('/authorization')) value = { allowed: ['EVENT_VIEW', 'security:profile:manage'].includes(url.searchParams.get('permissionCode')) };
      else if (url.pathname.endsWith('/types')) value = { items: [{ id: '00000000-0000-0000-0000-000000000003', scopeType: 'DENOMINATION', name: 'Encontro denominacional com título longo para verificar quebra de texto no celular', mandatory: true, enabled: true }], page: 0, size: 20, total: 1 };
      else if (url.pathname.endsWith('/profiles')) value = { items: [{ id: '00000000-0000-0000-0000-000000000003', code: 'READER', name: 'Consulta autorizada de demonstração com título longo', scopeType: 'CHURCH', status: 'ENABLED', revision: 4, publishedVersionId: '00000000-0000-0000-0000-000000000004' }], page: 0, size: 20, total: 1 };
      else throw Error('Consulta inesperada: ' + url.pathname);
      await route.fulfill({ json: value });
    });
    for (const width of [320, 360, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const [name, route] of Object.entries(routes)) {
        await page.goto('http://127.0.0.1:4188' + route);
        await page.getByRole('heading', { name: 'Entrar', exact: true }).waitFor();
        if (name !== 'login') {
          await page.getByLabel('Login', { exact: true }).fill('synthetic');
          await page.getByLabel('Senha', { exact: true }).fill('synthetic');
          await page.getByRole('button', { name: 'Entrar', exact: true }).click();
          await page.locator(name === 'catalog' ? '.event-list li' : '.security-list li').first().waitFor();
        }
        await page.locator('.app-brand img').evaluate(img => img.decode());
        const info = await page.evaluate(() => {
          const logo = document.querySelector('.app-brand img');
          const card = document.querySelector('.access-panel, .event-list li, .security-list li');
          return {
            overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
            logoLoaded: logo.naturalWidth === 1108 && logo.naturalHeight === 505,
            logoRatio: logo.getBoundingClientRect().width / logo.getBoundingClientRect().height,
            radius: getComputedStyle(card).borderRadius,
            fieldSize: document.querySelector('#login') ? getComputedStyle(document.querySelector('#login')).fontSize : null,
            sectionRestriction: [...document.querySelectorAll('.events-panel, .security-panel')].some(el => getComputedStyle(el).maxWidth !== 'none'),
          };
        });
        if (info.overflow || !info.logoLoaded || info.radius !== '17px' || info.sectionRestriction || Math.abs(info.logoRatio - 1108 / 505) > .01) throw Error(JSON.stringify({ width, name, ...info }));
        if (width <= 390 && info.fieldSize && parseFloat(info.fieldSize) < 16) throw Error('Campo menor que 16px');
        results.push({ width, page: name, ...info });
        if ([390, 1440].includes(width)) await page.screenshot({ path: path.join(out, `${name}-${width}.png`), fullPage: true });
      }
    }
    await page.goto('http://127.0.0.1:4188/entrar');
    await page.getByRole('heading', { name: 'Entrar', exact: true }).waitFor();
    // O roteador posiciona o foco no main ao carregar: voltar pelo tab order até o skip link.
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Shift+Tab');
      if (await page.locator('.skip').evaluate(el => el === document.activeElement)) break;
    }
    const focus = await page.evaluate(() => ({ text: document.activeElement.textContent, style: getComputedStyle(document.activeElement).outlineStyle }));
    if (focus.text !== 'Ir para o conteúdo' || focus.style !== 'solid') throw Error('Skip/foco: ' + JSON.stringify(focus));
    await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
    const zoomOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    if (zoomOverflow) throw Error('Overflow com zoom CSS 200%');
    if (errors.length) throw Error(errors.join('\n'));
    fs.writeFileSync(path.join(out, 'browser-results.json'), JSON.stringify({ browser: browser.version(), environment: 'Chrome headless, APIs GET interceptadas com fixtures sintéticas, sem backend real', results, skipFocus: focus, cssZoom200Overflow: zoomOverflow, pageErrors: errors }, null, 2));
    console.log('PASS: 18 combinações de tela/largura; logo, raios, campos, ausência de overflow, foco e zoom CSS 200%.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
