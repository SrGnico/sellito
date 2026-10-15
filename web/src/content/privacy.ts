// Textos legales y de privacidad. Editarlos acá; no están repetidos en otro lado.

// Aviso en el panel (sección Clientes).
export const OWNER_DATA_NOTICE = {
  title: 'Los datos de tus clientes son tuyos',
  text:
    'Tu negocio es el responsable de esta base de datos y de usarla según la Ley 25.326 de Protección de Datos Personales: ' +
    'usala solo para tu programa de fidelidad y para escribirles a quienes aceptaron recibir novedades, ' +
    'guardala de forma segura y borrá los datos de quien te lo pida.',
}

// Casilla en el alta del cliente final. Si cambia el texto, subir la versión: cada tarjeta guarda
// la versión que aceptó (consent.version).
export const CONSENT_VERSION = '2026-10'
export const consentText = (businessName: string) => `Acepto recibir novedades y promociones de ${businessName}.`
