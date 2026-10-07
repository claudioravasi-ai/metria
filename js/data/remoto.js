/* ============================================================
   Backend de PRODUCCIÓN: Firebase Authentication + Realtime Database
   ------------------------------------------------------------
   Misma API que local.js. Los permisos los hacen cumplir las reglas
   publicadas en la consola de Firebase (reglas-firebase.json): sin
   publicarlas, la app no es segura.
   Varios equipos a la vez: cada vista escucha su rama con onValue y
   se actualiza sola cuando otro equipo escribe.
   ============================================================ */

const V = '10.14.1';
const URL = (m) => `https://www.gstatic.com/firebasejs/${V}/firebase-${m}.js`;

export const modo = 'firebase';
export let TS = null;

let A, D, auth, db, offset = 0, CFG;

export async function iniciar(CONFIG) {
  CFG = CONFIG;
  const [app, authM, dbM] = await Promise.all([import(URL('app')), import(URL('auth')), import(URL('database'))]);
  A = authM; D = dbM;
  const fb = app.initializeApp(CONFIG.firebase);
  auth = A.getAuth(fb);
  auth.languageCode = 'es';
  db = D.getDatabase(fb, CONFIG.firebase.databaseURL);
  TS = D.serverTimestamp();
  D.onValue(D.ref(db, '.info/serverTimeOffset'), (s) => { offset = s.val() || 0; });
  await A.setPersistence(auth, A.browserSessionPersistence);
}

/** Hora del servidor (corrige el reloj del equipo). */
export const ahora = () => Date.now() + offset;

/* ---------- Base ---------- */
const r = (ruta) => D.ref(db, ruta);
export const leer = async (ruta) => (await D.get(r(ruta))).val();
export const escribir = (ruta, valor) => D.set(r(ruta), valor);
export const actualizar = (ruta, cambios) => D.update(ruta ? r(ruta) : D.ref(db), cambios);
export const borrar = (ruta) => D.remove(r(ruta));
export const nuevaClave = () => D.push(D.ref(db, 'claves')).key;
export async function agregar(ruta, valor) {
  const p = D.push(r(ruta));
  await D.set(p, valor);
  return p.key;
}
export function escuchar(ruta, cb) {
  return D.onValue(r(ruta), (s) => cb(s.val()), (e) => { console.warn('Sin permiso para', ruta.split('/')[0], e.code); cb(null); });
}

/* ---------- Autenticación ---------- */
// Los pacientes entran con un token propio (uid "pac_…") que entrega el servidor de códigos
// después de comprobar el código enviado a su correo: ese código ya verifica el correo.
const esPaciente = (u) => u.uid.startsWith('pac_');
const mapUser = (u) => (u ? { uid: u.uid, email: u.email, verificado: u.emailVerified || esPaciente(u), paciente: esPaciente(u) } : null);
export const usuario = () => mapUser(auth.currentUser);
export const alCambiarSesion = (cb) => A.onAuthStateChanged(auth, (u) => cb(mapUser(u)));

export async function ingresar(email, clave, recordar = false) {
  await A.setPersistence(auth, recordar ? A.browserLocalPersistence : A.browserSessionPersistence);
  await A.signInWithEmailAndPassword(auth, String(email).trim(), clave);
}
export async function registrar(email, clave) {
  const c = await A.createUserWithEmailAndPassword(auth, String(email).trim(), clave);
  try { await A.sendEmailVerification(c.user); } catch { /* se puede reenviar después */ }
  return { uid: c.user.uid };
}
export const salir = () => A.signOut(auth);

/* Pacientes: código de un solo uso por correo (servidor: apps-script/Codigos.gs) */
async function servidor(accion, datos) {
  if (!CFG.codigosURL) throw Object.assign(new Error('sin servidor de códigos'), { code: 'codigo/sin-servidor' });
  let j;
  try {
    const r = await fetch(CFG.codigosURL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ accion, ...datos }) });
    j = await r.json();
  } catch { throw Object.assign(new Error('red'), { code: 'auth/network-request-failed' }); }
  if (!j.ok) throw Object.assign(new Error(j.error || 'error'), { code: `codigo/${j.error || 'error'}` });
  return j;
}
export const pedirCodigo = (email) => servidor('pedir', { email: String(email).trim().toLowerCase() });
export async function ingresarConCodigo(email, codigo, recordar = false) {
  const { token } = await servidor('verificar', { email: String(email).trim().toLowerCase(), codigo: String(codigo).replace(/\D/g, '') });
  await A.setPersistence(auth, recordar ? A.browserLocalPersistence : A.browserSessionPersistence);
  await A.signInWithCustomToken(auth, token);
}
/** Segunda opinión con IA: el servidor verifica que quien pide sea un médico autorizado. */
export async function analizarIA(datos) {
  if (!CFG.codigosURL) throw Object.assign(new Error('sin servidor'), { code: 'ia/sin-servidor' });
  const idToken = await auth.currentUser.getIdToken();
  try { return (await servidor('ia', { idToken, datos })).resultado; }
  catch (e) { throw Object.assign(new Error(e.code === 'codigo/no-autorizado' ? 'tu cuenta no está autorizada' : e.code === 'codigo/ia-sin-clave' ? 'falta la clave de Anthropic en el servidor' : 'el servidor no respondió'), { code: e.code }); }
}
/** Le avisa por correo al coordinador que hay profesionales esperando autorización (el servidor lo lee de la base). */
export const avisarCoordinador = () => servidor('avisoProfesional', {}).catch(() => {});
export async function restablecer(email) {
  try { await A.sendPasswordResetEmail(auth, String(email).trim()); } catch { /* respuesta genérica: no revela si el correo existe */ }
}
export async function reenviarVerificacion() {
  if (auth.currentUser) await A.sendEmailVerification(auth.currentUser);
}
export async function recargarUsuario() {
  if (!auth.currentUser) return null;
  await A.reload(auth.currentUser);
  await auth.currentUser.getIdToken(true); // las reglas leen email_verified del token
  return mapUser(auth.currentUser);
}
/** Cambio de correo de un profesional: Firebase manda un enlace al correo nuevo y el cambio se aplica al abrirlo. */
export async function cambiarCorreo(clave, nuevo) {
  const u = auth.currentUser;
  await A.reauthenticateWithCredential(u, A.EmailAuthProvider.credential(u.email, clave));
  await A.verifyBeforeUpdateEmail(u, String(nuevo).trim());
  return { inmediato: false };
}
export async function cambiarClave(actual, nueva) {
  const u = auth.currentUser;
  const cred = A.EmailAuthProvider.credential(u.email, actual);
  await A.reauthenticateWithCredential(u, cred);
  await A.updatePassword(u, nueva);
}

// En producción no hay atajos de demostración.
export const entrarComo = null;
export const adelantarReloj = null;
export const relojAdelantado = () => 0;
export const reiniciarDemo = null;
