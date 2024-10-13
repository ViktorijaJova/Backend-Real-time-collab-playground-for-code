import express, { Request, Response } from 'express';
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

// Connect to the database
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false,
    },
});

// API routes
app.post('/api/sessions', async (req: Request, res: Response) => {
    const { creatorId, code } = req.body; // Get the code from the request body
    console.log('Creating session with:', { creatorId, code }); // Log the incoming data
    try {
        const result = await pool.query(
            'INSERT INTO sessions (creator_id, code, created_at) VALUES ($1, $2, NOW()) RETURNING *',
            [creatorId, code] // Use the code provided by the user
        );

        console.log('Session created:', result.rows[0]); // Log the created session
        res.status(201).json(result.rows[0]); // Return the created session
    } catch (err: any) {
        console.error('Error creating session:', err.message);
        res.status(500).json({ error: 'Failed to create session' });
    }
});

// Endpoint to update session code
// Endpoint to update session code
app.put('/api/sessions/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    const { code } = req.body;
    console.log('Updating session:', id, 'with code:', code);

    try {
        const result = await pool.query('UPDATE sessions SET code = $1 WHERE id = $2', [code, id]);

        // Use optional chaining to handle potential null value
        if (result?.rowCount && result.rowCount > 0) {
            res.status(200).json({ message: 'Session code updated successfully' });
            // Emit code change to all clients connected to this session
            io.emit('codeChange', code);
        } else {
            res.status(404).json({ error: 'Session not found' });
        }
    } catch (err: unknown) {
        console.error('Error updating session code:', (err as any).message || err);
        res.status(500).json({ error: 'Failed to update session code' });
    }
});


// Endpoint to get session details
app.get('/api/sessions/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const result = await pool.query('SELECT * FROM sessions WHERE id = $1', [id]);
        if (result.rows.length > 0) {
            res.json(result.rows[0]);
        } else {
            res.status(404).json({ error: 'Session not found' });
        }
    } catch (err: any) {
        console.error('Error fetching session:', err.message);
        res.status(500).json({ error: 'Failed to fetch session' });
    }
});

// Handle socket connections
io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('codeChange', (newCode) => {
        console.log('Code change received:', newCode);
        // Broadcast the new code to all other connected clients
        socket.broadcast.emit('codeChange', newCode);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

// Start the server
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
