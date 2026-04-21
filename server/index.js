require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const connectDB = require('./configs/db');
const authRoutes = require('./routes/authRoutes');
const Message = require('./models/Message');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.CLIENT_URL,
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);

// Connect to Database
connectDB();

// Basic Route
app.get('/', (req, res) => {
    res.send('Chat Server is Running...');
});

// Socket.io Events
const onlineUsers = new Map();
const roomMessages = new Map(); // Store last 50 messages per room

io.on('connection', (socket) => {
    console.log(`User Connected: ${socket.id}`);

    socket.on('set_user', (userId) => {
        onlineUsers.set(userId, socket.id);
        io.emit('online_users', Array.from(onlineUsers.keys()));
        console.log(`User ${userId} is online`);
    });

    socket.on('join_room', (data) => {
        socket.join(data);
        console.log(`User with ID: ${socket.id} joined room: ${data}`);
        
        // Send message history
        const history = roomMessages.get(data) || [];
        socket.emit('message_history', history);
    });

    socket.on('send_message', async (data) => {
        // Broadcast to room
        socket.to(data.room).emit('receive_message', data);
        
        // Store in memory history
        if (!roomMessages.has(data.room)) {
            roomMessages.set(data.room, []);
        }
        const history = roomMessages.get(data.room);
        history.push(data);
        if (history.length > 50) history.shift(); // Keep last 50

        // Save to DB
        try {
            await Message.create({
                sender: data.userId, 
                content: data.message,
                chatId: data.room,
                status: 'sent'
            });
        } catch (err) {
            console.error("Failed to save message:", err);
        }
    });

    socket.on('disconnect', () => {
        let disconnectedUser;
        for (let [userId, socketId] of onlineUsers.entries()) {
            if (socketId === socket.id) {
                disconnectedUser = userId;
                break;
            }
        }
        if (disconnectedUser) {
            onlineUsers.delete(disconnectedUser);
            io.emit('online_users', Array.from(onlineUsers.keys()));
            console.log(`User ${disconnectedUser} disconnected`);
        }
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
