const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

router.post('/auth/login', async (req, res) => {
  const { username, password } = req.body;
  console.log('🔐 Intentando login con:', username);

  try {
    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ message: 'Usuario no encontrado' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: 'Contraseña incorrecta' });

    // Generar token JWT
    const token = jwt.sign(
      { 
        id: user._id, 
        username: user.username, 
        role: user.role 
      },
      process.env.JWT_SECRET || 'tu-secret-key-super-segura-cambiar-en-produccion',
      { expiresIn: '24h' } // Token expira en 24 horas
    );

    res.status(200).json({ 
      message: 'Login exitoso',
      token: token,
      user: {
        id: user._id,
        username: user.username,
        role: user.role
      }
    });
  } catch (err) {
    console.error('❌ Error en login:', err);
    res.status(500).json({ message: 'Error del servidor' });
  }
});
// Endpoint protegido: Listar usuarios (solo admin)
router.get('/auth/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const users = await User.find().select('-password'); // Excluir contraseñas
    res.json(users);
  } catch (err) {
    console.error('❌ Error al listar usuarios:', err);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// Endpoint protegido: Crear usuario (solo admin)
router.post('/auth/users', authenticateToken, requireAdmin, async (req, res) => {
  const { username, password, role } = req.body;
  console.log('🛠️ Creando nuevo usuario:', username, 'con rol:', role);

  try {
    // Validar datos
    if (!username || !password || !role) {
      return res.status(400).json({ message: 'Faltan datos requeridos: username, password, role' });
    }

    // Validar rol
    const rolesValidos = ['admin', 'subdireccion', 'control_escolar'];
    if (!rolesValidos.includes(role)) {
      return res.status(400).json({ message: 'Rol inválido. Roles válidos: admin, subdireccion, control_escolar' });
    }

    // Verificar si el usuario ya existe
    const existing = await User.findOne({ username });
    if (existing) {
      return res.status(400).json({ message: 'El usuario ya existe' });
    }

    // Encriptar contraseña
    const hashed = await bcrypt.hash(password, 10);
    
    // Crear nuevo usuario
    const newUser = new User({ 
      username, 
      password: hashed,
      role 
    });
    await newUser.save();

    // Retornar usuario sin contraseña
    const userResponse = newUser.toObject();
    delete userResponse.password;

    res.status(201).json({ 
      message: 'Usuario creado exitosamente',
      user: userResponse
    });
  } catch (err) {
    console.error('❌ Error al crear usuario:', err);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// Endpoint protegido: Actualizar usuario (solo admin)
router.put('/auth/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { username, password, role } = req.body;
  console.log('🔄 Actualizando usuario:', id);

  try {
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Validar que no se elimine el último admin
    if (user.role === 'admin' && role !== 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin' });
      if (adminCount === 1) {
        return res.status(400).json({ message: 'No se puede cambiar el rol del último administrador' });
      }
    }

    // Validar que el usuario no se elimine a sí mismo
    if (req.user.id === id && role !== 'admin') {
      return res.status(400).json({ message: 'No puedes cambiar tu propio rol de administrador' });
    }

    // Actualizar campos
    if (username) user.username = username;
    if (role) {
      const rolesValidos = ['admin', 'subdireccion', 'control_escolar'];
      if (!rolesValidos.includes(role)) {
        return res.status(400).json({ message: 'Rol inválido' });
      }
      user.role = role;
    }
    if (password) {
      user.password = await bcrypt.hash(password, 10);
    }

    await user.save();

    // Retornar usuario sin contraseña
    const userResponse = user.toObject();
    delete userResponse.password;

    res.json({ 
      message: 'Usuario actualizado exitosamente',
      user: userResponse
    });
  } catch (err) {
    console.error('❌ Error al actualizar usuario:', err);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// Endpoint protegido: Eliminar usuario (solo admin)
router.delete('/auth/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  console.log('🗑️ Eliminando usuario:', id);

  try {
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Validar que no se elimine a sí mismo
    if (req.user.id === id) {
      return res.status(400).json({ message: 'No puedes eliminar tu propia cuenta' });
    }

    // Validar que no se elimine el último admin
    if (user.role === 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin' });
      if (adminCount === 1) {
        return res.status(400).json({ message: 'No se puede eliminar el último administrador' });
      }
    }

    await User.findByIdAndDelete(id);

    res.json({ message: 'Usuario eliminado exitosamente' });
  } catch (err) {
    console.error('❌ Error al eliminar usuario:', err);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// Endpoint legacy: Mantener para compatibilidad
router.post('/auth/register-admin', authenticateToken, requireAdmin, async (req, res) => {
  const { username, password } = req.body;
  console.log('🛠️ Registrando nuevo admin (legacy):', username);

  try {
    const existing = await User.findOne({ username });
    if (existing) return res.status(400).json({ message: 'El usuario ya existe' });

    const hashed = await bcrypt.hash(password, 10);
    const newUser = new User({ 
      username, 
      password: hashed,
      role: 'admin'
    });
    await newUser.save();

    res.status(201).json({ message: 'Administrador creado' });
  } catch (err) {
    console.error('❌ Error en register-admin:', err);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

module.exports = router;
