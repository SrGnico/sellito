import { expect, test } from '@playwright/test'

const CUIT_NUMBER = /\b\d{2}-?\d{8}-?\d\b/

// Páginas públicas y flujos que no escriben datos.

test('landing: mensaje principal, demo y pie sin datos personales', async ({ page }) => {
  await page.goto('/landing')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByText('Studio Five').first()).toBeVisible()
  const html = await page.content()
  expect(html).not.toMatch(/\.web\.app|cloudfunctions\.net/)
  expect(html).not.toMatch(CUIT_NUMBER)
})

for (const [path, title] of [
  ['/privacidad', /privacidad/i],
  ['/terminos', /términos/i],
  ['/soporte', /soporte/i],
] as const) {
  test(`${path} se ve y explica lo que tiene que explicar`, async ({ page }) => {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title)
    await expect(page.getByRole('link', { name: /hola@/ }).first()).toBeVisible()
    expect(await page.locator('main').innerText()).not.toMatch(CUIT_NUMBER)
  })
}

test('la política explica nombre, teléfono y mail', async ({ page }) => {
  await page.goto('/privacidad')
  const text = (await page.locator('main').innerText()).toLowerCase()
  for (const word of ['nombre', 'teléfono', 'mail']) expect(text).toContain(word)
})

test('tarjeta de prueba: pide nombre, mail y cumpleaños (con regalo)', async ({ page }) => {
  await page.goto('/c/prueba')
  await expect(page.getByRole('heading', { name: /Sumate a la tarjeta/ })).toBeVisible()
  const otra = page.getByRole('button', { name: 'Es para otra persona' })
  if (await otra.isVisible()) await otra.click()
  await expect(page.getByLabel('Tu nombre')).toBeVisible()
  await expect(page.getByLabel('Tu mail')).toBeVisible()
  await expect(page.getByLabel(/Tu cumpleaños/)).toBeVisible()
  await expect(page.getByText(/abrazo doble de cumple/)).toBeVisible()
})

test('tarjeta de prueba: en computadora ofrece iPhone y Android; en iPhone, Apple Wallet', async ({ page, isMobile }) => {
  await page.goto('/c/prueba')
  await expect(page.getByRole('heading', { name: /Sumate a la tarjeta/ })).toBeVisible()
  if (isMobile) {
    await expect(page.getByRole('button', { name: 'Agregar a Apple Wallet' })).toBeVisible()
  } else {
    await expect(page.getByRole('radio', { name: /iPhone/ }).or(page.getByRole('button', { name: /iPhone/ })).first()).toBeVisible()
    await expect(page.getByRole('radio', { name: /Android/ }).or(page.getByRole('button', { name: /Android/ })).first()).toBeVisible()
  }
})

test('código de alta inexistente: aviso claro', async ({ page }) => {
  await page.goto('/c/zzzzzz')
  await expect(page.getByText(/no (existe|encontramos)|no es válido/i).first()).toBeVisible()
})

test('login: valida campos y permite pasar a crear cuenta', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.locator('.help-error, [role=alert]').first()).toBeVisible()
  await page.getByRole('button', { name: 'Creá una' }).click()
  await expect(page.getByRole('button', { name: 'Crear cuenta', exact: true })).toBeVisible()
  await expect(page.locator('meta[name=robots]')).toHaveAttribute('content', /noindex/)
})

test('panel sin sesión manda al login', async ({ page }) => {
  await page.goto('/panel')
  await expect(page).toHaveURL(/\/login/)
})

test('escáner: pide PIN y rechaza uno corto', async ({ page }) => {
  await page.goto('/escaner/negocioQueNoExiste')
  const pin = page.getByLabel('PIN')
  await expect(pin).toBeVisible()
  await pin.fill('12')
  await pin.press('Enter')
  await expect(page.getByText('El PIN tiene entre 4 y 6 números.')).toBeVisible()
})
