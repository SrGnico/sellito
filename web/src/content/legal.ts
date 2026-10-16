// Datos del responsable y textos legales (política de privacidad y términos).
// Revisarlos con un abogado o contador antes de lanzar. Fecha de la versión: LEGAL_UPDATED.

export const LEGAL_UPDATED = '16 de octubre de 2026'

// El titular prefiere no publicar su nombre, CUIT ni domicilio: se informan a quien los pida por mail.
// Ojo: la Ley 25.326 (art. 6) pide informar la identidad y el domicilio del responsable; esto es un
// punto intermedio a revisar con un abogado (ver TODO.md, "Antes de lanzar").
export const RESPONSIBLE = {
  brand: 'Studio Five',
  email: 'hola@misellito.com.ar',
  city: 'Córdoba, Argentina',
}

// Textos exigidos por la AAIP (Disposición 10/2008) para quien recolecta datos personales.
export const AAIP_NOTICE = [
  'El titular de los datos personales tiene la facultad de ejercer el derecho de acceso a los mismos en forma gratuita a intervalos no inferiores a seis meses, salvo que se acredite un interés legítimo al efecto conforme lo establecido en el artículo 14, inciso 3 de la Ley N° 25.326.',
  'La AGENCIA DE ACCESO A LA INFORMACIÓN PÚBLICA, en su carácter de Órgano de Control de la Ley N° 25.326, tiene la atribución de atender las denuncias y reclamos que interpongan quienes resulten afectados en sus derechos por incumplimiento de las normas vigentes en materia de protección de datos personales.',
]

export type LegalSection = { title: string; paragraphs: string[]; list?: string[] }

export function privacySections(appName: string): LegalSection[] {
  return [
    {
      title: 'Quién es el responsable',
      paragraphs: [
        `${appName} es un servicio desarrollado por ${RESPONSIBLE.brand}, con base en ${RESPONSIBLE.city}. ` +
          `Para cualquier consulta sobre tus datos escribinos a ${RESPONSIBLE.email}.`,
        `Los datos de identificación del responsable del tratamiento (nombre o razón social, CUIT y domicilio) se informan a quien los solicite escribiendo a ${RESPONSIBLE.email}.`,
      ],
    },
    {
      title: 'Qué hace el servicio',
      paragraphs: [
        `${appName} permite que un negocio cree una tarjeta de fidelidad digital, que sus clientes la guarden en Apple Wallet o Google Wallet y que el negocio sume sellos desde un celular o una computadora.`,
        `Hay dos tipos de personas cuyos datos tratamos: los dueños de los negocios (nuestros clientes) y los clientes de cada negocio (quienes guardan una tarjeta).`,
      ],
    },
    {
      title: 'Datos de los dueños de negocios',
      paragraphs: ['Para crear y usar la cuenta tratamos:'],
      list: [
        'Mail y contraseña (la contraseña la guarda Firebase Authentication de forma cifrada; nosotros no la vemos).',
        'Datos del negocio: nombre, logo, imágenes, colores, premio, direcciones de los locales y la configuración de la tarjeta.',
        'Datos de la suscripción: plan, estado y el mail de la cuenta de Mercado Pago que paga. Los datos de la tarjeta de crédito o débito los procesa Mercado Pago; nosotros no los recibimos.',
      ],
    },
    {
      title: 'Datos de los clientes de cada negocio',
      paragraphs: [
        'Cuando alguien guarda la tarjeta de un negocio, guardamos solo los datos que ese negocio decidió pedir (nombre, teléfono, mail y/o fecha de cumpleaños; el negocio elige cuáles son necesarios para sumarse a su tarjeta), la cantidad de sellos, los canjes y el historial de sellos, y si aceptó recibir novedades del negocio.',
        `Sobre estos datos, cada negocio es el responsable de su base de clientes y ${appName} actúa como encargado del tratamiento: los guardamos y procesamos solo para prestar el servicio a ese negocio. No los vendemos, no los compartimos con otros negocios y no los usamos para publicidad propia.`,
        'Para mantener la tarjeta actualizada en el celular, Apple y Google nos envían un identificador técnico del dispositivo y del pase. No accedemos a la ubicación del celular: si el negocio activa la cercanía, es el propio celular el que decide mostrar la tarjeta cerca del local.',
      ],
    },
    {
      title: 'Para qué usamos los datos',
      paragraphs: [],
      list: [
        'Prestar el servicio: crear y actualizar las tarjetas, sumar sellos, canjear premios y mostrar estadísticas al negocio.',
        'Hacer llegar a la tarjeta los avisos y novedades que publique el negocio, solo a quienes aceptaron recibirlos.',
        'Si el negocio lo activa y el cliente cargó su cumpleaños: mandarle un saludo ese día (solo si aceptó recibir novedades) y avisarle al negocio, cuando escanea la tarjeta, que tiene un regalo de cumpleaños.',
        'Cobrar la suscripción y avisar sobre pagos, vencimientos y cambios importantes del servicio.',
        'Seguridad: prevenir abusos (por ejemplo, altas masivas de tarjetas) y resolver problemas técnicos.',
        'Medir el uso del sitio de forma agregada (por ejemplo, cuántas visitas tuvo la página por día), sin guardar datos que identifiquen a nadie.',
        'Medir nuestras campañas de publicidad: en este sitio y en el panel de los negocios usamos el Pixel de Meta (Facebook e Instagram), que guarda cookies propias (por ejemplo, _fbp) para saber qué anuncio trajo a cada visita. Nunca lo usamos en las páginas donde los clientes de un negocio guardan su tarjeta ni en el escáner del local. Podés desactivarlo con “No, gracias” en el aviso de cookies.',
        'Cuando un negocio se registra, guardamos de qué campaña llegó (los parámetros del anuncio). Cuando se suscribe, le avisamos a Meta que hubo una suscripción, con el mail de la cuenta cifrado de forma irreversible (hash), para medir el resultado de los anuncios. No enviamos teléfonos ni datos de los clientes de los negocios.',
      ],
    },
    {
      title: 'Con quién los compartimos',
      paragraphs: [
        'Usamos proveedores que procesan datos por cuenta nuestra y con sus propias medidas de seguridad. Algunos alojan los datos fuera de la Argentina (por ejemplo, en Brasil o en Estados Unidos):',
      ],
      list: [
        'Google (Firebase y Google Cloud: base de datos, archivos, funciones y hosting; Google Wallet).',
        'Apple (Apple Wallet y su servicio de notificaciones).',
        'Mercado Pago (cobro de las suscripciones).',
        'Meta Platforms (Pixel y API de Conversiones, para medir nuestros anuncios; solo datos de quienes visitan este sitio o tienen una cuenta de negocio).',
        'OpenStreetMap (convierte las direcciones de los locales en coordenadas; solo recibe la dirección del local).',
        'El servicio de envío de mails que usemos para los avisos de cuenta.',
      ],
    },
    {
      title: 'Cuánto tiempo los guardamos',
      paragraphs: [
        'Los datos de una tarjeta se guardan mientras el negocio use el servicio. Si una suscripción queda vencida, la cuenta pasa a solo lectura y, tras un período sin reactivar, se archiva. Podés pedirnos la eliminación en cualquier momento.',
        'Los datos de campaña de un negocio (de qué anuncio llegó) se guardan mientras exista su cuenta. La cookie con esos datos en tu navegador dura 30 días.',
      ],
    },
    {
      title: 'Tus derechos',
      paragraphs: [
        `Podés pedir acceso, rectificación, actualización o supresión de tus datos escribiendo a ${RESPONSIBLE.email}. Si sos cliente de un negocio, también podés pedírselo directamente al negocio.`,
        ...AAIP_NOTICE,
      ],
    },
    {
      title: 'Cambios en esta política',
      paragraphs: [`Si cambiamos esta política lo vamos a avisar en este sitio. Última actualización: ${LEGAL_UPDATED}.`],
    },
  ]
}

export function termsSections(appName: string): LegalSection[] {
  return [
    {
      title: 'El servicio',
      paragraphs: [
        `${appName} es un servicio desarrollado por ${RESPONSIBLE.brand} para crear tarjetas de fidelidad digitales que los clientes guardan en Apple Wallet o Google Wallet, sin descargar ninguna app. El negocio suma sellos y canjea premios desde un celular o una computadora con internet.`,
      ],
    },
    {
      title: 'La cuenta',
      paragraphs: [
        'Para usar el servicio hay que crear una cuenta con un mail válido. Sos responsable de cuidar tu contraseña y el PIN del escáner de tu local, y de lo que se haga con ellos.',
      ],
    },
    {
      title: 'Suscripción y pagos',
      paragraphs: [
        'Diseñar la tarjeta es gratis. Para sumar sellos con el escáner hace falta una suscripción mensual, que se cobra por Mercado Pago. El precio vigente está publicado en este sitio y se respeta para las suscripciones ya contratadas; si cambia, lo avisamos con anticipación.',
        'Podés cancelar cuando quieras desde tu cuenta de Mercado Pago: el servicio sigue hasta el final del período pagado. Si un cobro falla, hay unos días de gracia; después el escáner se pausa y el panel queda en modo lectura hasta reactivar. Los clientes conservan sus tarjetas y sus sellos.',
      ],
    },
    {
      title: 'Uso permitido',
      paragraphs: [
        'El servicio es para programas de fidelidad reales. No se puede usar para engañar a los clientes, enviar publicidad a quien no la aceptó, cargar contenido de terceros sin permiso o intentar vulnerar el sistema. Podemos suspender cuentas que lo hagan.',
        'Las imágenes, logos y textos que cargás tienen que ser tuyos o tener permiso para usarlos.',
      ],
    },
    {
      title: 'Los datos de tus clientes',
      paragraphs: [
        'La base de clientes de tu negocio es tuya: sos responsable de usarla según la Ley 25.326 (solo para tu programa de fidelidad y para escribir a quienes aceptaron novedades). Podés exportarla cuando quieras. Ver la Política de privacidad.',
      ],
    },
    {
      title: 'Lo que depende de terceros',
      paragraphs: [
        'Las tarjetas funcionan sobre Apple Wallet y Google Wallet. La cercanía (que la tarjeta aparezca en la pantalla de bloqueo cerca del local) y las notificaciones dependen del celular, de sus permisos y de las reglas de Apple y Google: pueden aparecer, pero no está garantizado que aparezcan siempre.',
        'Hacemos lo posible para que el servicio funcione sin cortes, pero puede haber interrupciones por mantenimiento o por fallas de proveedores. No respondemos por pérdidas indirectas ni por el lucro cesante derivado del uso del servicio.',
      ],
    },
    {
      title: 'Cambios y contacto',
      paragraphs: [
        `Podemos actualizar estos términos; los cambios importantes los avisamos por mail o en el panel. Consultas: ${RESPONSIBLE.email}. Los datos de identificación del titular se informan a pedido por ese mismo medio. Última actualización: ${LEGAL_UPDATED}.`,
      ],
    },
  ]
}
