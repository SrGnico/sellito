import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from '@playwright/test'

// Recorrido completo de un negocio nuevo: crear cuenta → asistente (logo, premio, datos) → PIN → QR.
// Escribe en el proyecto real, por eso solo corre con E2E_FULL=1, y al final borra lo que creó
// (negocio y código de alta con la CLI de Firebase; la cuenta, con la API de Auth). El logo subido
// queda en Storage (businesses/{id}/public/).
test.skip(!process.env.E2E_FULL, 'Solo con E2E_FULL=1')
test.describe.configure({ mode: 'serial' })

const LOGO = fileURLToPath(new URL('../public/icons/icon-192.png', import.meta.url))
const created: { businessId?: string; enrollCode?: string; idToken?: string } = {}

async function idToken(page: Page): Promise<string | undefined> {
  return page.evaluate(
    () =>
      new Promise<string | undefined>((resolve) => {
        const open = indexedDB.open('firebaseLocalStorageDb')
        open.onsuccess = () => {
          const req = open.result.transaction('firebaseLocalStorage').objectStore('firebaseLocalStorage').getAll()
          req.onsuccess = () => resolve(req.result.find((r: { value?: { stsTokenManager?: { accessToken: string } } }) => r.value?.stsTokenManager)?.value.stsTokenManager.accessToken)
          req.onerror = () => resolve(undefined)
        }
        open.onerror = () => resolve(undefined)
      }),
  )
}

test('alta de un negocio nuevo con el asistente', async ({ page, isMobile }) => {
  test.skip(isMobile && !process.env.E2E_SHOTS, 'Una vez alcanza')
  const shot = (name: string) =>
    process.env.E2E_SHOTS ? page.screenshot({ path: `${process.env.E2E_SHOTS}/${test.info().project.name}-${name}.png`, fullPage: true }) : undefined
  const email = `e2e+${Date.now()}@misellito.com.ar`

  await page.goto('/login')
  await page.getByRole('button', { name: 'Creá una' }).click()
  await page.getByLabel('Mail').fill(email)
  await page.getByLabel('Contraseña').fill('prueba-e2e-1234')
  await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click()

  // Presentación → nombre del negocio → asistente.
  await page.getByRole('button', { name: 'Omitir' }).click()
  await page.getByLabel('Nombre del negocio').fill('Prueba E2E')
  await page.getByRole('button', { name: 'Crear mi negocio' }).click()
  await expect(page).toHaveURL(/\/panel\/configurar/)
  created.idToken = await idToken(page)

  await shot('0-inicio')
  // 1. Logo y color: sin logo no avanza.
  await page.getByRole('button', { name: 'Siguiente' }).click()
  await expect(page.getByRole('alert')).toContainText('Subí tu logo')
  await page.locator('input[type=file]').setInputFiles(LOGO)
  await expect(page.getByRole('button', { name: 'Cambiar' })).toBeVisible()
  await page.getByTitle('#7BD389').click()
  await page.getByRole('button', { name: 'Siguiente' }).click()

  await shot('1-marca')
  // 2. Premio: con la sugerencia de descuento y una condición.
  await expect(page.getByRole('heading', { name: 'El premio' })).toBeVisible()
  await page.getByRole('button', { name: '20% de descuento' }).click()
  await page.getByLabel('Condiciones (opcional)').fill('Un sello por compra mayor a $5.000')
  await page.getByRole('button', { name: 'Siguiente' }).click()

  await shot('2-premio')
  // 3. Datos.
  await expect(page.getByRole('heading', { name: 'Datos de tus clientes' })).toBeVisible()
  await page.getByLabel('Mail').check()
  // Regalo de cumpleaños: prenderlo también pide el cumpleaños al cliente.
  await page.getByRole('switch', { name: 'Saludar a mis clientes en su cumpleaños' }).click()
  await expect(page.getByRole('checkbox', { name: 'Cumpleaños' })).toBeChecked()
  await page.getByRole('radio', { name: 'Todo el mes de su cumpleaños' }).check()
  await page.getByRole('button', { name: 'Siguiente' }).click()

  await shot('3-datos')
  // 4. PIN del escáner.
  await expect(page.getByRole('heading', { name: 'Escáner del local' }).first()).toBeVisible()
  const pins = page.locator('input[inputmode=numeric]')
  await pins.nth(0).fill('4321')
  await pins.nth(1).fill('4321')
  await page.getByRole('button', { name: 'Guardar PIN' }).click()
  await expect(page.getByText('PIN activo')).toBeVisible()
  created.businessId = (await page.getByRole('link', { name: 'Abrir escáner' }).getAttribute('href'))?.split('/')[2]
  await page.getByRole('button', { name: 'Siguiente' }).click()

  await shot('4-pin')
  // 5. QR listo, con su link de alta.
  await expect(page.getByRole('heading', { name: '¡Tu tarjeta está lista!' })).toBeVisible()
  const qr = page.getByRole('img', { name: /QR/ }).first()
  await expect(qr).toBeVisible()
  const alt = (await qr.getAttribute('alt')) ?? ''
  created.enrollCode = alt.match(/\/c\/([A-Za-z0-9]+)/)?.[1]
  await shot('5-qr')
  await page.getByRole('button', { name: 'Ir al panel' }).click()

  // El inicio ya no ofrece el asistente y muestra el premio.
  await expect(page).toHaveURL(/\/panel$/)
  await expect(page.getByText('Armá tu tarjeta en 3 minutos')).toHaveCount(0)
  await expect(page.getByText(/20% de descuento/).first()).toBeVisible()

  await shot('6-panel')
  // El link de alta del cliente funciona y muestra la condición.
  if (created.enrollCode) {
    await page.goto(`/c/${created.enrollCode}`)
    await expect(page.getByRole('heading', { name: 'Sumate a la tarjeta de Prueba E2E' })).toBeVisible()
    await expect(page.getByText('Un sello por compra mayor a $5.000')).toBeVisible()
    await expect(page.getByLabel(/Tu cumpleaños/)).toBeVisible()
    await expect(page.getByText(/durante todo el mes de tu cumple/)).toBeVisible()
  }
})

test.afterAll(async () => {
  const project = process.env.E2E_PROJECT ?? 'sellito-23c14'
  const firebase = (path: string) =>
    execFileSync('firebase', ['firestore:delete', path, '-r', '--force', '--project', project], { stdio: 'ignore' })
  if (created.businessId) firebase(`businesses/${created.businessId}`)
  if (created.enrollCode) firebase(`enrollCodes/${created.enrollCode}`)
  if (created.idToken && process.env.VITE_FIREBASE_API_KEY) {
    await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${process.env.VITE_FIREBASE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: created.idToken }),
    })
  }
  console.log('Limpieza E2E:', { businessId: created.businessId, enrollCode: created.enrollCode, cuenta: Boolean(created.idToken) })
})
