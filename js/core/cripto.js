/* Utilidades criptográficas del navegador (requieren conexión segura: https o localhost). */

const te = new TextEncoder();

export async function sha256hex(texto) {
  const b = await crypto.subtle.digest('SHA-256', te.encode(String(texto)));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/** ¿Este correo es el del coordinador? Se compara contra un hash: el correo no queda escrito en el código público. */
export async function esCorreoCoordinador(email, hash) {
  if (!email || !hash) return false;
  try { return (await sha256hex(String(email).trim().toLowerCase())) === hash; } catch { return false; }
}

/** Identificador del paciente a partir de su correo (el mismo que usa el servidor de códigos). */
export async function uidPaciente(email) {
  return 'pac_' + (await sha256hex(String(email).trim().toLowerCase())).slice(0, 24);
}
