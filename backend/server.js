// backend/server.js

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : ['http://localhost:3001', 'http://localhost:3000'];

// Hosts permitidos por defecto en producción (además de los que vengan en ALLOWED_ORIGINS).
// Coincide con cualquier subdominio del host indicado, anclado al final del hostname para
// evitar matches accidentales tipo "cbtis272.mx.malicioso.com".
const allowedHostSuffixes = [
  'railway.app',
  'cbtis272.mx'
];

const matchesAllowedHost = (origin) => {
  try {
    const { hostname } = new URL(origin);
    return allowedHostSuffixes.some(
      suffix => hostname === suffix || hostname.endsWith('.' + suffix)
    );
  } catch (_) {
    return false;
  }
};

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    if (origin.includes('localhost')) {
      return callback(null, true);
    }

    if (matchesAllowedHost(origin)) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`⚠️ CORS bloqueado para origin: ${origin}`);
      callback(new Error('No permitido por CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
};
app.use(cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const publicDir = path.join(__dirname, 'public');
function querySuffix(req) {
  return req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
}

// Redirecciones 301 desde URLs con .html hacia rutas limpias
const legacyHtmlRedirects = {
  '/index.html': '/',
  '/ventas.html': '/ventas',
  '/programacion.html': '/programacion',
  '/preparacion-alimentos-bebidas.html': '/preparacion-alimentos-bebidas',
  '/gestion-innovacion-turistica.html': '/gestion-innovacion-turistica',
  '/robotica.html': '/robotica',
  '/educacion-dual.html': '/educacion-dual',
  '/sobre-nosotros.html': '/sobre-nosotros',
  '/servicios-escolares.html': '/servicios-escolares',
  '/login.html': '/login',
  '/register-admin.html': '/register-admin'
};
Object.entries(legacyHtmlRedirects).forEach(([from, to]) => {
  app.get(from, (req, res) => res.redirect(301, to + querySuffix(req)));
});

app.get('/inicio', (req, res) => res.redirect(301, '/' + querySuffix(req)));

const htmlPages = [
  ['/ventas', 'ventas.html'],
  ['/programacion', 'programacion.html'],
  ['/preparacion-alimentos-bebidas', 'preparacion-alimentos-bebidas.html'],
  ['/gestion-innovacion-turistica', 'gestion-innovacion-turistica.html'],
  ['/robotica', 'robotica.html'],
  ['/educacion-dual', 'educacion-dual.html'],
  ['/sobre-nosotros', 'sobre-nosotros.html'],
  ['/servicios-escolares', 'servicios-escolares.html'],
  ['/login', 'login.html'],
  ['/register-admin', 'register-admin.html']
];
htmlPages.forEach(([route, file]) => {
  app.get(route, (req, res) => res.sendFile(path.join(publicDir, file)));
});

app.use(express.static(publicDir));
app.use('/pdfs', express.static(path.join(__dirname, 'public/pdfs')));

app.use('/api', require('./routers/auth.js'));
app.use('/api', require('./routers/grupo.js'));

app.get('/api/config', (req, res) => {
  res.json({
    baseUrl: process.env.BASE_URL || req.protocol + '://' + req.get('host'),
    allowedOrigins: allowedOrigins
  });
});

const Evento = require('./models/Evento');
app.get('/api/eventos', async (req, res) => {
  try {
    const eventos = await Evento.find().sort({ orden: 1, createdAt: 1 });
    res.json(eventos);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.use('/api/dashboard', require('./routers/dashboard'));

const { authenticateToken, requireAdmin } = require('./middleware/auth');

app.get('/api/auth/verify', authenticateToken, (req, res) => {
  res.json({
    authenticated: true,
    user: req.user,
    message: 'Usuario autenticado'
  });
});

app.get('/api/auth/verify-admin', authenticateToken, requireAdmin, (req, res) => {
  res.json({
    authenticated: true,
    user: req.user,
    message: 'Usuario autenticado como administrador'
  });
});

app.get('/admin-panel', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'views', 'admin-panel.html'));
});

app.get('/dashboard', (req, res) => {
  res.redirect(302, '/admin-panel');
});

app.get('/dashboard-admin', (req, res) => {
  res.redirect(302, '/admin-panel');
});

app.get('/dashboard-subdireccion', (req, res) => {
  res.redirect(302, '/admin-panel');
});

app.get('/dashboard-controlEscolar', (req, res) => {
  res.redirect(302, '/admin-panel');
});

app.get('/dashboard-carga', (req, res) => {
  res.redirect(302, '/admin-panel');
});

app.use('/api', (err, req, res, next) => {
  console.error('Error en API:', err);
  res.status(err.status || 500).json({
    message: err.message || 'Error interno del servidor'
  });
});

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('✅ Conectado a MongoDB Atlas'))
  .catch(err => console.error('❌ Error en la conexión', err));

app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    res.status(404).json({ message: 'Ruta de API no encontrada' });
  }
});


const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en puerto ${PORT}`);
});
