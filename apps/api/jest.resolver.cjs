// Resolver de Jest para el código del proyecto.
// Con "nodenext", los imports relativos se escriben con extensión .js
// (por ejemplo, './health.controller.js') aunque el archivo real sea .ts.
// Este resolver intenta primero el .ts SOLO para imports relativos de nuestro
// código; las dependencias de node_modules se resuelven sin cambios.
module.exports = (request, options) => {
  const esRelativo = /^\.{1,2}\//.test(request);
  const esCodigoPropio = !options.basedir.includes('node_modules');
  if (esRelativo && esCodigoPropio && request.endsWith('.js')) {
    try {
      return options.defaultResolver(request.replace(/\.js$/, '.ts'), options);
    } catch {
      // Si no existe el .ts, se resuelve el import tal como está escrito.
    }
  }
  return options.defaultResolver(request, options);
};
