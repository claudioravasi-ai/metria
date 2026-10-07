/* ============================================================
   Textos legales y vista de Privacidad.
   MODELO — a revisar por un abogado matriculado antes de publicar.
   Deben decir exactamente lo que la app hace (ver reglas-firebase.json).
   ============================================================ */

import { h } from '../core/dom.js';
import { icono } from '../core/iconos.js';
import { heroe, tarjeta, chip, aviso, modal, toast, confirmar, fechaHora, plegable, vacio } from '../core/ui.js';
import { CONFIG } from '../config.js';
import { backend, exportarMisDatos, solicitar, VERSION_CONSENTIMIENTO } from '../data/servicio.js';
import { campo, fuerzaClave } from '../ui/campos.js';

const AAIP = 'La AGENCIA DE ACCESO A LA INFORMACIÓN PÚBLICA, en su carácter de Órgano de Control de la Ley N° 25.326, tiene la atribución de atender las denuncias y reclamos que interpongan quienes resulten afectados en sus derechos por incumplimiento de las normas vigentes en materia de protección de datos personales.';
const ACCESO = 'El titular de los datos personales tiene la facultad de ejercer el derecho de acceso a los mismos en forma gratuita a intervalos no inferiores a seis meses, salvo que se acredite un interés legítimo al efecto conforme lo establecido en el artículo 14, inciso 3 de la Ley N° 25.326.';

export const POLITICA = () => [
  ['Quién es responsable', `${CONFIG.consultorio}. ${CONFIG.responsable}. Contacto para ejercer tus derechos: ${CONFIG.contacto}. La base de datos debe estar inscripta en el Registro Nacional de Bases de Datos de la AAIP.`],
  ['Qué datos guardamos', 'Identificación (nombre, apellido, DNI, fecha de nacimiento, sexo biológico, correo y teléfono opcional), datos de salud que cargás vos o tu médico (medidas, presión, hábitos, enfermedades, medicación, laboratorio), el plan de tratamiento que indique tu médico, tu registro de síntomas y los estudios médicos que te cargue. Los datos de salud son datos sensibles (arts. 2 y 7 de la Ley 25.326).'],
  ['Para qué', 'Únicamente para tu atención médica: calcular índices orientativos (metabolismo, IMC, riesgo cardiovascular), que tu médico evalúe tratamientos y que puedas retirar tus estudios. No se usan para publicidad, no se venden y no se ceden a terceros (art. 11).'],
  ['Quién los ve', 'Vos y los profesionales del consultorio autorizados uno por uno por el coordinador médico, todos obligados al secreto profesional (Ley 17.132, art. 11) y a la confidencialidad (Ley 25.326, art. 10). Cada apertura o descarga de un estudio queda registrada y la podés ver en esta sección.'],
  ['Dónde se guardan', 'En Firebase (Google Cloud), un servicio de terceros cuyos servidores pueden estar fuera de la Argentina. Al registrarte prestás consentimiento expreso para esa transferencia internacional (art. 12). Los datos viajan cifrados (HTTPS) y el proveedor los cifra en sus servidores; no es un cifrado "de punta a punta": el consultorio y el proveedor técnico podrían acceder bajo las reglas de seguridad publicadas.'],
  ['Análisis con inteligencia artificial', 'Si tu médico lo pide, la app envía a Anthropic (Claude, Estados Unidos) una copia de tu ficha SIN nombre, DNI, correo ni fecha de nacimiento (solo edad, sexo, medidas, enfermedades, medicación y análisis) para obtener una segunda opinión de apoyo. El resultado lo revisa tu médico; la IA no decide tu tratamiento. Anthropic no usa esos datos para entrenar sus modelos.'],
  ['Estudios médicos', `No se guardan dentro de la app ni en tu equipo: quedan en la base y se traen solo cuando los abrís. Al descargarlos por primera vez quedan disponibles ${CONFIG.horasTrasDescarga} horas más; cumplido ese plazo la base deja de entregarlos y se borran definitivamente en el siguiente borrado programado (corre cada hora). Si nunca los descargás, se borran a los ${CONFIG.diasRetencionMaxima} días. El original queda en la historia clínica del prestador, que la conserva al menos 10 años (Ley 26.529, art. 18).`],
  ['Cuánto tiempo', 'Tu ficha se conserva mientras tengas cuenta. Si pedís la baja, se suprimen tus datos de la app salvo lo que el consultorio deba conservar como historia clínica por obligación legal.'],
  ['Tus derechos', `Acceso (gratis cada 6 meses, respuesta en 10 días corridos), rectificación, actualización y supresión (respuesta en 5 días hábiles), y revocar tu consentimiento (arts. 14 a 16). Podés descargar tus datos y hacer pedidos desde Privacidad, o escribir a ${CONFIG.contacto}. ${ACCESO}`],
  ['Cómo se ingresa', `Pacientes: sin contraseña. Cada ingreso pide un código de 6 números que se envía a tu correo desde la cuenta de Google del consultorio; vence a los ${CONFIG.minutosCodigo} minutos, sirve una sola vez y se guarda cifrado (hash), no en texto. Profesionales: correo verificado, contraseña de al menos 12 caracteres y autorización del coordinador, que verifica la matrícula; sin esa autorización no pueden ver ningún dato.`],
  ['Seguridad', `Reglas de acceso por persona en la base, cierre de sesión por ${CONFIG.minutosInactividad} minutos de inactividad, registro de accesos y borrado automático de estudios (art. 9 y Resolución AAIP 47/2018). Si ocurriera un incidente de seguridad, se notificará a los afectados y a la AAIP.`],
  ['Autoridad de control', AAIP],
];

export const TERMINOS = () => [
  ['Qué es la app', `${CONFIG.app} acompaña la atención de tu médico: hace cálculos orientativos con fórmulas publicadas (Mifflin-St Jeor, IMC, PREVENT de la AHA, CKD-EPI, entre otras) y te permite retirar estudios.`],
  ['No reemplaza la consulta', 'Los resultados son orientativos y pueden ser inexactos si los datos cargados no son correctos. No es un servicio de emergencias: ante síntomas graves, llamá al 107 o andá a una guardia.'],
  ['Medicación', 'La app no indica medicamentos por sí sola. Las sugerencias del motor son apoyo para tu médico, quien decide la indicación, la dosis y emite la receta por una plataforma registrada (Ley 27.553). Nunca te automediques.'],
  ['Historia clínica', 'La app no es la historia clínica oficial (Ley 26.529): el original queda en el consultorio. La app es un canal para que veas tus datos y retires tus estudios.'],
  ['Tu cuenta', 'Es personal: no compartas los códigos que te llegan ni tu contraseña (profesionales). Avisá enseguida si sospechás que alguien entró a tu cuenta o a tu correo.'],
  ['Profesionales', 'Los profesionales declaran estar matriculados, usan la app bajo su responsabilidad profesional y se comprometen a la confidencialidad y al secreto profesional. El coordinador médico verifica la matrícula y autoriza a cada uno antes de que pueda entrar.'],
];

export function verTexto(titulo, secciones) {
  const m = modal({
    titulo, ancho: 720, clase: 'modal--texto',
    cuerpo: h('div.texto-legal', h('p.modelo', icono('info', { tam: 16 }), 'Modelo a revisar por un abogado matriculado antes de usar con pacientes reales.'),
      ...secciones.map(([t, p]) => h('section', h('h4', t), h('p', p)))),
    acciones: [h('button.btn.btn--primario', { onclick: () => m.cerrar() }, 'Entendido')],
  });
}

/* ---------- Vista de Privacidad del paciente ---------- */
const ACCIONES = {
  'alta-cuenta': 'Creó la cuenta', subio: 'Subió un estudio', abrio: 'Abrió un estudio', descargo: 'Descargó un estudio',
  borro: 'Borró un estudio', 'borrado-automatico': 'Borrado automático por vencimiento', plan: 'Indicó o actualizó el plan',
  'verifico-identidad': 'Verificó la identidad', 'quito-verificacion': 'Quitó la verificación',
};

export function vistaPrivacidad({ uid, perfil, auditoria, estudios, medicos = {} }) {
  const B = backend();
  const quien = (q) => (q === uid ? 'Vos' : q === 'sistema' ? 'Sistema (borrado programado)' : medicos[q] ? `${medicos[q].nombre} ${medicos[q].apellido}` : 'Profesional del consultorio');
  const reg = Object.values(auditoria || {}).sort((a, b) => b.cuando - a.cuando).slice(0, 60);
  const titulos = Object.fromEntries(Object.entries(estudios || {}).map(([k, m]) => [k, m.titulo]));
  const pedir = async (tipo, titulo, ayuda) => {
    const ta = h('textarea', { rows: 4, maxlength: 1000, placeholder: ayuda, 'aria-label': titulo });
    const ok = await new Promise((res) => {
      const m = modal({ titulo, ancho: 520, cuerpo: h('div', h('p.ayuda', 'Tu pedido le llega al consultorio. Te responden por correo en los plazos de la ley.'), ta), alCerrar: (v) => res(v),
        acciones: [h('button.btn.btn--suave', { onclick: () => m.cerrar(false) }, 'Cancelar'), h('button.btn.btn--primario', { onclick: () => m.cerrar(true) }, 'Enviar pedido')] });
    });
    if (!ok) return;
    try { await solicitar(uid, tipo, ta.value); toast('Pedido enviado', 'ok'); } catch { toast('No se pudo enviar el pedido', 'error'); }
  };

  return h('div.seccion',
    heroe('privacidad', 'Privacidad y seguridad', 'Tus datos de salud son tuyos. Acá ves quién accedió y ejercés tus derechos.'),
    h('div.grid-3',
      bloque('usuarios', 'Quién ve tus datos', 'Vos y los profesionales habilitados del consultorio, con secreto profesional.'),
      bloque('candado', 'Cómo se protegen', 'Correo verificado, reglas por persona en la base, cierre por inactividad y registro de accesos.'),
      bloque('reloj', 'Cuándo se borran', `Los estudios, ${CONFIG.horasTrasDescarga} h después de descargarlos (o a los ${CONFIG.diasRetencionMaxima} días).`)),
    tarjeta('Tus derechos (Ley 25.326)', { icono: 'escudo' },
      h('div.derechos',
        h('button.derecho', { type: 'button', onclick: async () => {
          const datos = await exportarMisDatos(uid);
          const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' });
          const a = h('a', { href: URL.createObjectURL(blob), download: `mis-datos-${CONFIG.app.toLowerCase()}.json` });
          document.body.append(a); a.click(); a.remove();
          toast('Descargaste una copia de tus datos (sin los archivos de estudios).', 'ok');
        } }, icono('bajar', { tam: 22 }), h('strong', 'Acceso'), h('small', 'Descargá una copia de tus datos')),
        h('button.derecho', { type: 'button', onclick: () => pedir('rectificacion', 'Pedir una corrección', 'Ej.: mi DNI está mal, es 12.345.678') }, icono('editar', { tam: 22 }), h('strong', 'Rectificación'), h('small', 'Corregir un dato que no podés editar')),
        h('button.derecho', { type: 'button', onclick: () => pedir('baja', 'Pedir la baja', 'Contanos si querés borrar toda tu cuenta o algún dato en particular') }, icono('basura', { tam: 22 }), h('strong', 'Supresión'), h('small', 'Pedir la baja de tus datos')),
        h('button.derecho', { type: 'button', onclick: () => pedir('revocacion', 'Revocar el consentimiento', 'Indicá qué consentimiento querés revocar') }, icono('x', { tam: 22 }), h('strong', 'Revocación'), h('small', 'Retirar tu consentimiento'))),
      h('p.ayuda', `Consentimiento aceptado el ${fechaHora(perfil.consentimiento?.fecha)} (versión ${perfil.consentimiento?.version || VERSION_CONSENTIMIENTO}).`)),
    tarjeta('Historial de accesos', { icono: 'ojo', extra: chip(`${reg.length} registros`, 'neutro') },
      reg.length ? h('ul.auditoria', ...reg.map((r) => h('li', h('span.aud-ico', icono(r.accion === 'descargo' ? 'bajar' : r.accion === 'abrio' ? 'ojo' : r.accion?.startsWith('borr') ? 'basura' : 'info', { tam: 16 })),
        h('div', h('strong', ACCIONES[r.accion] || r.accion), h('small', `${quien(r.quien)}${r.estudio && titulos[r.estudio] ? ' · ' + titulos[r.estudio] : ''}`)), h('time', fechaHora(r.cuando))))) : vacio('ojo', 'Sin registros', '')),
    tarjeta('Cómo entrás', { icono: 'candado' },
      h('p', 'Tu cuenta no tiene contraseña que recordar ni que se pueda perder: cada vez que entrás te mandamos un código de 6 números a ', h('strong', perfil.email || 'tu correo'), '.'),
      h('ul.lista.lista--chica',
        h('li', `Vence a los ${CONFIG.minutosCodigo} minutos y sirve una sola vez: el próximo ingreso usa uno nuevo.`),
        h('li', 'Nadie del consultorio lo conoce ni te lo va a pedir.'),
        h('li', 'Para cambiar el correo, pedilo con «Rectificación» (arriba).'))),
    tarjeta('Documentos', { icono: 'texto' },
      h('div.botones', h('button.btn.btn--suave', { type: 'button', onclick: () => verTexto('Política de privacidad', POLITICA()) }, 'Política de privacidad'),
        h('button.btn.btn--suave', { type: 'button', onclick: () => verTexto('Términos de uso', TERMINOS()) }, 'Términos de uso')),
      h('p.ayuda.legal-pie', AAIP)));
}

const bloque = (ic, t, d) => h('div.bloque-priv', h('span', icono(ic, { tam: 22 })), h('strong', t), h('small', d));

/** Cambio de correo (solo profesionales). */
export function cambioCorreo(perfil) {
  const B = backend();
  if (B.modo === 'demo' && !B.usuario()?.uid?.startsWith('u')) return h('p.ayuda', `${perfil.email} · Las cuentas de ejemplo de la demo no se pueden modificar.`);
  const nuevo = h('input', { type: 'email', autocomplete: 'email', 'aria-label': 'Correo nuevo' });
  const clave = h('input', { type: 'password', autocomplete: 'current-password', 'aria-label': 'Contraseña actual' });
  const btn = h('button.btn.btn--primario', { type: 'button' }, 'Cambiar correo');
  btn.onclick = async () => {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(nuevo.value.trim())) { toast('Revisá el correo nuevo', 'error'); return; }
    if (perfil.titular && !(await confirmar({ titulo: 'Sos el coordinador', texto: 'El rol de coordinador está atado a tu correo actual. Si lo cambiás, hay que actualizarlo también en las reglas de Firebase y en js/config.js; si no, dejás de ser coordinador.', si: 'Cambiar igual', peligro: true }))) return;
    btn.disabled = true;
    try {
      const r = await B.cambiarCorreo(clave.value, nuevo.value.trim());
      toast(r?.inmediato ? 'Correo actualizado' : 'Te mandamos un enlace al correo nuevo: el cambio se aplica cuando lo abrís.', 'ok', 7000);
      nuevo.value = clave.value = '';
    } catch (e) { toast(e.code === 'auth/email-already-in-use' ? 'Ese correo ya está en uso' : 'La contraseña no es correcta', 'error'); }
    finally { btn.disabled = false; }
  };
  return h('div', h('p.ayuda', `Correo actual: ${perfil.email}`),
    h('div.grid-form', h('div.campo', h('label', 'Correo nuevo'), nuevo), h('div.campo', h('label', 'Contraseña actual'), clave), h('div.campo', h('label', '\u00a0'), btn)));
}

export function cambioClave() {
  const B = backend();
  if (B.modo === 'demo' && !B.usuario()?.uid?.startsWith('u')) return h('p.ayuda', 'Las cuentas de ejemplo de la demo no tienen contraseña.');
  const act = h('input', { type: 'password', autocomplete: 'current-password', 'aria-label': 'Contraseña actual' });
  const nue = h('input', { type: 'password', autocomplete: 'new-password', minlength: 10, 'aria-label': 'Nueva contraseña' });
  const btn = h('button.btn.btn--primario', { type: 'button' }, 'Cambiar contraseña');
  btn.onclick = async () => {
    if (nue.value.length < 10) { toast('La nueva contraseña debe tener al menos 10 caracteres', 'error'); return; }
    btn.disabled = true;
    try { await B.cambiarClave(act.value, nue.value); act.value = nue.value = ''; toast('Contraseña actualizada', 'ok'); }
    catch { toast('La contraseña actual no es correcta', 'error'); }
    finally { btn.disabled = false; }
  };
  return h('div.grid-form', h('div.campo', h('label', 'Contraseña actual'), act), h('div.campo', h('label', 'Nueva contraseña'), nue, fuerzaClave(nue)), h('div.campo', h('label', ' '), btn));
}

export { AAIP, plegable, aviso, confirmar, campo };
