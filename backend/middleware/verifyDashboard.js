// backend/middleware/verifyDashboard.js
const { authenticateToken, requireAdmin } = require('./auth');

// Middleware para proteger las rutas HTML del dashboard
// Verifica el token desde el header Authorization o desde una cookie
const protectDashboard = async (req, res, next) => {
  // Permitir acceso si hay un token válido en el header
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    // Si hay token en el header, verificar con el middleware de autenticación
    return authenticateToken(req, res, () => {
      requireAdmin(req, res, next);
    });
  }

  // Si no hay token, verificar si hay una cookie de sesión (opcional)
  // Por ahora, si no hay token, denegar acceso
  return res.status(401).json({ 
    message: 'Acceso denegado. Debes iniciar sesión como administrador.',
    redirect: '/login.html'
  });
};

module.exports = protectDashboard;

