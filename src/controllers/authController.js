import bcrypt from 'bcrypt';
import { generateToken } from '../utils/generateToken.js';

export const registerUser = async (req, res) => {
  const { name, phoneNumber, password } = req.body;
  const email = req.body.email || null;

  if (!name || !phoneNumber || !password) {
    return res
      .status(400)
      .json({ message: 'name, phoneNumber and password are required' });
  }

  try {
    const userExists = await req.db.User.findOne({ where: { phoneNumber } });
    if (userExists) {
      return res
        .status(400)
        .json({ message: 'User with this phone number already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await req.db.User.create({
      name,
      phoneNumber,
      password: hashedPassword,
      role: 'patient',
      email: email,
    });

    await req.db.Patient.create({
      userId: user.id,
      age: null,
      gender: null,
      allergies: '',
      notes: '',
    });

    const token = generateToken(user.id, user.role);

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user.id,
        name: user.name,
        phoneNumber: user.phoneNumber,
        role: user.role,
      },
    });
  } catch (err) {
    res
      .status(500)
      .json({ message: 'Registration failed', error: err.message });
    console.log(err);
  }
};

export const loginUser = async (req, res) => {
  const { phoneNumber, password } = req.body;

  if (!phoneNumber || !password) {
    return res
      .status(400)
      .json({ message: 'phoneNumber and password are required' });
  }

  try {
    const user = await req.db.User.findOne({ where: { phoneNumber } });

    if (!user) {
      return res
        .status(400)
        .json({ message: 'Invalid phone number or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res
        .status(400)
        .json({ message: 'Invalid phone number or password' });
    }

    const token = generateToken(user.id, user.role);

    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        phoneNumber: user.phoneNumber,
        role: user.role,
      },
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({ message: 'Login failed', error: err.message });
  }
};

export const getProfile = async (req, res) => {
  try {
    const user = await req.db.User.findByPk(req.user.userId, {
      attributes: ['id', 'name', 'phoneNumber', 'role'],
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json(user);
  } catch (err) {
    res
      .status(500)
      .json({ message: 'Failed to fetch profile', error: err.message });
  }
};

