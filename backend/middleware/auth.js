// backend/middleware/auth.js
const jwt = require('jsonwebtoken');

// Middleware para verificar token JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ message: 'Token de acceso requerido' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'tu-secret-key-super-segura-cambiar-en-produccion', (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Token inválido o expirado' });
    }
    req.user = user; // Agregar información del usuario al request
    next();
  });
};

// Middleware para verificar que el usuario sea admin
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Usuario no autenticado' });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Acceso denegado. Se requieren permisos de administrador' });
  }

  next();
};

// Middleware para verificar que el usuario sea subdirección o admin
const requireSubdireccion = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Usuario no autenticado' });
  }

  if (req.user.role !== 'subdireccion' && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Acceso denegado. Se requiere rol de subdirección o administrador' });
  }

  next();
};

// Middleware para verificar que el usuario sea control escolar o admin
const requireControlEscolar = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Usuario no autenticado' });
  }

  if (req.user.role !== 'control_escolar' && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Acceso denegado. Se requiere rol de control escolar o administrador' });
  }

  next();
};

module.exports = {
  authenticateToken,
  requireAdmin,
  requireSubdireccion,
  requireControlEscolar
};

