import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from '@playwright/test'

// Recorrido completo de un negocio nuevo: crear cuenta → asistente (logo, premio, datos) → vista previa
// con el botón de activar (en borrador no hay QR ni escáner).
// Escribe en el proyecto real, por eso solo corre con E2E_FULL=1, y al final borra lo que creó
// (negocio y código de alta con la CLI de Firebase; la cuenta, con la API de Auth). El logo subido
// queda en Storage (businesses/{id}/public/).
test.skip(!process.env.E2E_FULL, 'Solo con E2E_FULL=1')
test.describe.configure({ mode: 'serial' })

const LOGO = fileURLToPath(new URL('../public/icons/icon-192.png', import.meta.url))
const created: { businessId?: string; enrollCode?: string; idToken?: string } = {}

// El negocio del usuario (las reglas le dejan leer los suyos), para borrarlo al final.
async function businessIdOf(token: string): Promise<string | undefined> {
  const project = process.env.E2E_PROJECT ?? 'sellito-23c14'
  const uid = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).user_id as string
  const res = await fetch(`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents:runQuery`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'businesses' }],
        where: { fieldFilter: { field: { fieldPath: 'ownerUid' }, op: 'EQUAL', value: { stringValue: uid } } },
      },
    }),
  })
  const rows = (await res.json()) as { document?: { name: string } }[]
  return rows.find((r) => r.document)?.document?.name.split('/').pop()
}

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
  // 4. En borrador el asistente termina en la vista previa: iPhone y Android, botón de activar.
  await page.getByRole('button', { name: 'Ver cómo queda' }).click()
  await expect(page).toHaveURL(/\/panel\/vista-previa/)
  await expect(page.getByText('iPhone · Apple Wallet')).toBeVisible()
  await expect(page.getByText('Android · Google Wallet')).toBeVisible()
  await expect(page.getByRole('button', { name: /^Activar mi tarjeta/ })).toBeVisible()
  await expect(page.getByText('Pagás solo cuando activás. Podés cancelar cuando quieras.')).toBeVisible()
  if (created.idToken) created.businessId = await businessIdOf(created.idToken)

  await shot('4-vista-previa')
  // QR, escáner y clientes llevan a la vista previa hasta activar.
  for (const path of ['qr', 'escaner', 'clientes']) {
    await page.goto(`/panel/${path}`)
    await expect(page).toHaveURL(/\/panel\/vista-previa/)
  }

  // El inicio ya no ofrece el asistente, muestra el premio y que falta activar.
  await page.goto('/panel')
  await expect(page.getByText('Armá tu tarjeta en 3 minutos')).toHaveCount(0)
  await expect(page.getByText(/20% de descuento/).first()).toBeVisible()
  await expect(page.getByText('Falta activar')).toBeVisible()

  await shot('5-panel')
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
