import express from 'express';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

dotenv.config();

const app = express();
const server = http.createServer(app);

// Enable CORS for Express HTTP requests
app.use(cors({
    origin: [
        'http://localhost:3000', // Local development
        'https://client-real-time-collab-playground-for-code.vercel.app', // Production
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
}));

// Set up the Socket.io server with CORS configuration
const io = new Server(server, {
    cors: {
        origin: [
            'http://localhost:3000', // Local development
            'https://client-real-time-collab-playground-for-code.vercel.app', // Production
        ],
        methods: ['GET', 'POST'],
    }
});

// Middleware to parse JSON requests
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Welcome to the Real-time Code Playground!');
});

// Connect to the database
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false,
    },
});

// WebSocket setup
io.on('connection', (socket) => {
    console.log(`A user connected: ${socket.id}`);

    socket.on('codeChange', (code) => {
        console.log('Received code change:', code); // Log received code
        socket.broadcast.emit('codeChange', code); // Broadcast to all other clients
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
    });
});


// Start the server
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
