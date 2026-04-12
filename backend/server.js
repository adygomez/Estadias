// backend/server.js

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

//  CORS - Configuración con variables de entorno
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : ['http://localhost:3001', 'http://localhost:3000'];

const corsOptions = {
  origin: function (origin, callback) {
    // Permitir requests sin origin (como Postman, mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    // Permitir localhost en desarrollo
    if (origin.includes('localhost')) {
      return callback(null, true);
    }
    
    // Permitir cualquier subdominio de railway.app
    if (origin.includes('railway.app')) {
      return callback(null, true);
    }
    
    // Verificar si el origin está en la lista permitida
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

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//  Archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));
app.use('/pdfs', express.static(path.join(__dirname, 'public/pdfs')));

//  Rutas API existentes
app.use('/api', require('./routers/alumno.js'));
app.use('/api', require('./routers/auth.js'));
app.use('/api', require('./routers/grupo.js'));

// Endpoint público para obtener configuración (sin autenticación)
app.get('/api/config', (req, res) => {
  res.json({
    baseUrl: process.env.BASE_URL || req.protocol + '://' + req.get('host'),
    allowedOrigins: allowedOrigins
  });
});

// Endpoint público para obtener logros (sin autenticación)
const Logro = require('./models/Logro');
const Evento = require('./models/Evento');
app.get('/api/logros', async (req, res) => {
  try {
    const logros = await Logro.find({ activo: true }).sort({ orden: 1 });
    res.json(logros);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/eventos', async (req, res) => {
  try {
    const eventos = await Evento.find().sort({ orden: 1, createdAt: 1 });
    res.json(eventos);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

//  Rutas Dashboard API
app.use('/api/dashboard', require('./routers/dashboard'));

// Middleware de autenticación para dashboards
const { authenticateToken, requireAdmin, requireSubdireccion, requireControlEscolar } = require('./middleware/auth');

// Ruta para verificar autenticación (usada por el frontend)
app.get('/api/auth/verify', authenticateToken, (req, res) => {
  res.json({ 
    authenticated: true, 
    user: req.user,
    message: 'Usuario autenticado' 
  });
});

// Ruta para verificar si es admin (usada por el frontend)
app.get('/api/auth/verify-admin', authenticateToken, requireAdmin, (req, res) => {
  res.json({ 
    authenticated: true, 
    user: req.user,
    message: 'Usuario autenticado como administrador' 
  });
});

// Ruta para verificar si puede acceder a dashboard-subdireccion (admin o subdireccion)
app.get('/api/auth/verify-dashboard-admin', authenticateToken, requireSubdireccion, (req, res) => {
  res.json({ 
    authenticated: true, 
    user: req.user,
    message: 'Usuario autorizado para dashboard-subdireccion' 
  });
});

// Ruta para verificar si puede acceder a dashboard-controlEscolar (control_escolar o admin)
app.get('/api/auth/verify-control-escolar', authenticateToken, requireControlEscolar, (req, res) => {
  res.json({ 
    authenticated: true, 
    user: req.user,
    message: 'Usuario autorizado para dashboard-controlEscolar' 
  });
});

// Proteger rutas HTML del dashboard
// Nota: Las rutas HTML se sirven directamente, pero el frontend debe verificar el token
// dashboard-admin ahora redirige a dashboard-subdireccion (ambos admin y subdireccion usan la misma vista)
app.get('/dashboard-admin', (req, res) => {
  res.redirect(302, '/dashboard-subdireccion');
});

app.get('/dashboard-controlEscolar', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard-controlEscolar.html'));
});

app.get('/dashboard-subdireccion', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard-subdireccion.html'));
});

// Panel administrativo (solo admin)
app.get('/admin-panel', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'views', 'admin-panel.html'));
});

// Redirecciones para compatibilidad con rutas antiguas
app.get('/dashboard', (req, res) => {
  res.redirect(302, '/dashboard-subdireccion');
});

app.get('/dashboard-carga', (req, res) => {
  res.redirect(302, '/dashboard-controlEscolar');
});

// Middleware para manejar errores en rutas de API (debe ir antes de la ruta catch-all)
app.use('/api', (err, req, res, next) => {
  console.error('Error en API:', err);
  res.status(err.status || 500).json({ 
    message: err.message || 'Error interno del servidor' 
  });
});

//  Conexión MongoDB Atlas
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('✅ Conectado a MongoDB Atlas'))
  .catch(err => console.error('❌ Error en la conexión', err));

// Ruta catch-all para páginas HTML (debe ir al final)
app.get('*', (req, res) => {
  // Solo servir HTML si no es una ruta de API
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    // Para rutas de API no encontradas, devolver JSON
    res.status(404).json({ message: 'Ruta de API no encontrada' });
  }
});


const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en puerto ${PORT}`);
});
