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
    origin: ['https://client-real-time-collab-playground-for-code.vercel.app/?vercelToolbarCode=2d1IRCbPLrwh_Wa','https://client-real-time-collab-playground-for-code.vercel.app','http://localhost:3000', 'http://192.168.1.17:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
}));

// Set up the Socket.io server with CORS configuration
const io = new Server(server, {
    cors: {
        origin: ['https://client-real-time-collab-playground-for-code.vercel.app/?vercelToolbarCode=2d1IRCbPLrwh_Wa','https://client-real-time-collab-playground-for-code.vercel.app','http://localhost:3000', 'http://192.168.1.17:3000'],
        methods: ['GET', 'POST'],
    }
});

// Middleware to parse JSON requests
app.use(express.json());
app.get('/', (req, res) => {
    res.send('Welcome to the Real-time Code Playground!');
});

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false,
    },
});

// Connect to the database
pool.connect((err) => {
    if (err) {
        console.error('Error acquiring client', err.stack);
        return;
    }
    console.log('Connected to the database successfully');
});

// WebSocket setup
io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('joinSession', async (sessionId) => {
        socket.join(sessionId);
        console.log(`User joined session: ${sessionId}`);

        const result = await pool.query('SELECT code FROM sessions WHERE id = $1', [sessionId]);
        if (result.rows.length > 0) {
            const currentCode = result.rows[0].code || '';
            socket.emit('codeChange', currentCode);
        } else {
            console.error('Session not found');
            socket.emit('error', 'Session not found');
        }
    });

    socket.on('codeChange', async (data) => {
        const { sessionId, code } = data;

        // Update the session in the database
        await pool.query('UPDATE sessions SET code = $1 WHERE id = $2', [code, sessionId]);

        // Broadcast code changes to all other users in the same session
        socket.broadcast.to(sessionId).emit('codeChange', code);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

// Endpoint to create a new session
// Endpoint to create a new session
app.post('/api/sessions', async (req, res) => {
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
        console.error('Error creating session:', err.stack);
        res.status(500).json({ error: 'Failed to create session' });
    }
});

// Endpoint to update session code
app.put('/api/sessions/:id', async (req, res) => {
    const { id } = req.params;
    const { code } = req.body;
    console.log('Updating session:', id, 'with code:', code);

    try {
        const result = await pool.query('UPDATE sessions SET code = $1 WHERE id = $2', [code, id]);
        
        // Using type assertion to handle potential null value
        if (result && (result as { rowCount: number }).rowCount > 0) {
            res.status(200).json({ message: 'Session code updated successfully' });
        } else {
            res.status(404).json({ error: 'Session not found' });
        }
    } catch (err) {
        console.error('Error updating session code:', err);
        res.status(500).json({ error: 'Failed to update session code' });
    }
});

// Endpoint to get session details
app.get('/api/sessions/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('SELECT * FROM sessions WHERE id = $1', [id]);
        if (result.rows.length > 0) {
            res.json(result.rows[0]);
        } else {
            res.status(404).json({ error: 'Session not found' });
        }
    } catch (err: any) {
        console.error('Error fetching session', err.stack);
        res.status(500).json({ error: 'Failed to fetch session' });
    }
});

// Start the server
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
