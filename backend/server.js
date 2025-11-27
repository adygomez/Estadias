// backend/server.js

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

//  CORS
const corsOptions = {
  origin: 'https://registro272.onrender.com',
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

// Endpoint público para obtener logros (sin autenticación)
const Logro = require('./models/Logro');
app.get('/api/logros', async (req, res) => {
  try {
    const logros = await Logro.find({ activo: true }).sort({ orden: 1 });
    res.json(logros);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

//  Rutas Dashboard API
app.use('/api/dashboard', require('./routers/dashboard'));

// Middleware de autenticación para dashboards
const { authenticateToken, requireAdmin } = require('./middleware/auth');

// Ruta para verificar autenticación (usada por el frontend)
app.get('/api/auth/verify', authenticateToken, requireAdmin, (req, res) => {
  res.json({ 
    authenticated: true, 
    user: req.user,
    message: 'Usuario autenticado como administrador' 
  });
});

// Proteger rutas HTML del dashboard
// Nota: Las rutas HTML se sirven directamente, pero el frontend debe verificar el token
app.get('/dashboard-admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'views', 'dashboard-admin.html'));
});

app.get('/dashboard-controlEscolar', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard-controlEscolar.html'));
});

// Redirecciones para compatibilidad con rutas antiguas
app.get('/dashboard', (req, res) => {
  res.redirect(302, '/dashboard-admin');
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
