const User = require('../models/User');
const jwt = require('jsonwebtoken');

// In-Memory Mock Database (Used when MongoDB is unavailable)
const mockUsers = new Map();

// Pre-load a default test user for convenience
mockUsers.set('test@example.com', {
    _id: 'mock-id-test',
    username: 'test',
    email: 'test@example.com',
    password: 'password123'
});

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d'
    });
};

// Register User
const registerUser = async (req, res) => {
    const { username, email, password } = req.body;
    
    // Mock Auth Fallback
    if (require('mongoose').connection.readyState !== 1) {
        console.warn('Using Mock Auth for Registration');
        
        if (mockUsers.has(email)) {
            return res.status(400).json({ message: 'User already exists in mock database' });
        }

        const newUser = {
            _id: 'mock-id-' + Date.now(),
            username: username || 'MockUser',
            email: email,
            password: password // In mock mode, we store plain text for simplicity
        };

        mockUsers.set(email, newUser);
        
        return res.status(201).json({
            ...newUser,
            token: generateToken(newUser._id)
        });
    }

    try {
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }
        const user = await User.create({ username, email, password });
        res.status(201).json({
            _id: user._id,
            username: user.username,
            email: user.email,
            token: generateToken(user._id)
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Login User
const loginUser = async (req, res) => {
    const { email, password } = req.body;

    // Mock Auth Fallback
    if (require('mongoose').connection.readyState !== 1) {
        console.warn('Using Mock Auth for Login');
        
        const user = mockUsers.get(email);
        
        if (!user || user.password !== password) {
            return res.status(401).json({ message: 'Invalid mock email or password. Sign Up first if you haven’t!' });
        }

        return res.json({
            _id: user._id,
            username: user.username,
            email: user.email,
            token: generateToken(user._id)
        });
    }

    try {
        const user = await User.findOne({ email });
        if (user && (await user.matchPassword(password))) {
            res.json({
                _id: user._id,
                username: user.username,
                email: user.email,
                token: generateToken(user._id)
            });
        } else {
            res.status(401).json({ message: 'Invalid email or password' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { registerUser, loginUser };
