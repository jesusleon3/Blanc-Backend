/**
 * Se ejecuta una vez por archivo de pruebas, dentro del worker (`setupFilesAfterEnv`).
 *
 * Cierra la conexión que el worker abrió contra su base de datos al terminar el archivo. Sin
 * esto, Jest avisa de que el worker "no terminó de forma ordenada" y depende de `forceExit` para
 * salir — un comportamiento que esconde fugas reales cuando aparezcan.
 *
 * Se registra aquí, y no en cada spec, para no tocar los ~50 puntos de llamada.
 */
afterAll(async () => {
  const { cerrarBaseDeDatosDePrueba } = require('../src/database/test-utils/postgres-de-prueba');
  await cerrarBaseDeDatosDePrueba();
});
