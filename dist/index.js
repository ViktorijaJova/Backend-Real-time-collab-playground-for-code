"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const pg_1 = require("pg");
const dotenv_1 = __importDefault(require("dotenv"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
dotenv_1.default.config();
const app = express_1.default();
const server = http_1.default.createServer(app);
// Enable CORS for Express HTTP requests
app.use(cors_1.default({
    origin: [
        'http://localhost:3000',
        'https://client-real-time-collab-playground-for-code.vercel.app',
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
}));
// Set up the Socket.io server with CORS configuration
const io = new socket_io_1.Server(server, {
    cors: {
        origin: [
            'http://localhost:3000',
            'https://client-real-time-collab-playground-for-code.vercel.app',
        ],
        methods: ['GET', 'POST'],
    }
});
// Middleware to parse JSON requests
app.use(express_1.default.json());
app.get('/', (req, res) => {
    res.send('Welcome to the Real-time Code Playground!');
});
// Connect to the database
const pool = new pg_1.Pool({
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
