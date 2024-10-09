import express from 'express';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import http from 'http';
import { Server } from 'socket.io';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Middleware to parse JSON requests
app.use(express.json());

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false, // Allow self-signed certificates for development purposes
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

    // Handle user joining a session
    socket.on('joinSession', (sessionId) => {
        socket.join(sessionId); // Join a room based on session ID
        socket.to(sessionId).emit('userJoined', { message: 'A user has joined the session' });
    });

    // Handle code changes from users
    socket.on('codeChange', async (data) => {
        const { sessionId, code } = data; // Assume data includes sessionId and code
        
        // Update the session in the database
        await pool.query('UPDATE sessions SET code = $1 WHERE id = $2', [code, sessionId]);

        // Broadcast code changes to all other users in the same session
        socket.broadcast.to(sessionId).emit('codeChange', { sessionId, code });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

// Endpoint to create a new session
app.post('/api/sessions', async (req, res) => {
    const { creatorId } = req.body; // Assume creatorId is passed in the request body
    try {
        const result = await pool.query(
            'INSERT INTO sessions (creator_id, code, created_at) VALUES ($1, $2, NOW()) RETURNING *',
            [creatorId, ''] // Initialize with empty code
        );
        res.status(201).json(result.rows[0]); // Return the created session
    } catch (err: any) {
        console.error('Error creating session', err.stack);
        res.status(500).json({ error: 'Failed to create session' });
    }
});

// Endpoint to get session details
app.get('/api/sessions/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('SELECT * FROM sessions WHERE id = $1', [id]);
        if (result.rows.length > 0) {
            res.json(result.rows[0]); // Return session data
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
