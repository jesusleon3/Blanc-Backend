/**
 * Detiene el PostgreSQL efímero al terminar la corrida de Jest. Ver `global-setup.js` para la
 * segunda red de seguridad (Ryuk) cuando este hook no llega a ejecutarse.
 */
module.exports = async () => {
  const contenedor = globalThis.__CONTENEDOR_POSTGRES__;
  if (contenedor) {
    await contenedor.stop();
    globalThis.__CONTENEDOR_POSTGRES__ = undefined;
  }
};
