/* ============================================================
   Configuración de Metria
   ------------------------------------------------------------
   Sin datos de Firebase la app arranca en MODO DEMOSTRACIÓN:
   todo queda guardado solo en este navegador (IndexedDB).
   Para producción, completar `firebase` con los datos del proyecto
   (ver INSTALAR.md) y publicar reglas-firebase.json.
   La apiKey de Firebase no es un secreto: identifica el proyecto.
   La seguridad real está en las reglas de la base.
   ============================================================ */

export const CONFIG = {
  app: 'Metria',
  version: '1.2.0',
  consultorio: 'Consultorio médico',     // nombre que ven los pacientes
  responsable: 'Responsable de la base: Dr. Claudio A. Ravasi',
  contacto: 'claudioravasi@outlook.com',    // correo para derechos de acceso, rectificación y supresión

  // Coordinador/a médico/a: autoriza a cada profesional antes de que pueda entrar.
  // Se guarda el HASH SHA-256 de su correo (en minúsculas) para no publicar el correo en GitHub.
  // El correo en texto va solo en reglas-firebase.json (las reglas no son públicas).
  // Para calcularlo: python3 -c "import hashlib; print(hashlib.sha256('correo@ejemplo.com'.encode()).hexdigest())"
  coordinadorHash: '11f4c9f31f86365cac05e65858ff43ea6b0a22b3438064d3e9be928da6f20bfd',

  // Servidor de códigos de ingreso de pacientes (Google Apps Script publicado como aplicación web).
  // Ver apps-script/Codigos.gs e INSTALAR.md. En modo demo no se usa.
  codigosURL: 'https://script.google.com/macros/s/AKfycbxHs7I9GhqKwTYY2_IEPrrfgnr3rkE2-BOi7lW42k8nJtIjho7kHq3o_Vc1Xbi3T6U6zA/exec',

  firebase: {
    apiKey: 'AIzaSyCEDXi8ugKd4jlEAnbmFrz8GDl3ZZQfBhA',
    authDomain: 'metria-e08ce.firebaseapp.com',
    databaseURL: 'https://metria-e08ce-default-rtdb.firebaseio.com',
    projectId: 'metria-e08ce',
    storageBucket: 'metria-e08ce.firebasestorage.app',
    messagingSenderId: '1096441546580',
    appId: '1:1096441546580:web:98776c853d6a207598aac1',
  },

  // Estudios
  horasTrasDescarga: 72,          // se borran 3 días después de la primera descarga
  diasRetencionMaxima: 90,        // si nunca se descargan, se borran igual a los 90 días
  tamanoMaximoMB: 25,
  minutosInactividad: 15,         // cierre de sesión automático
  minutosCodigo: 10,              // vigencia del código de ingreso de los pacientes
};

export const MS_HORA = 3600000;
export const MS_DIA = 86400000;
