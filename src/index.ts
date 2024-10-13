// Assuming you have express and socket.io setup
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const { Pool } = require('pg'); // PostgreSQL client
const pool = new Pool({ /* your db config */ });

app.use(cors());
app.use(express.json());

// Create a session
app.post('/api/sessions', async (req, res) => {
    const { creatorId, code } = req.body;
    const result = await pool.query('INSERT INTO sessions (creator_id, code) VALUES ($1, $2) RETURNING *', [creatorId, code]);
    res.json(result.rows[0]);
});

// Get a session by ID
app.get('/api/sessions/:id', async (req, res) => {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM sessions WHERE id = $1', [id]);
    res.json(result.rows[0]);
});

// Update session code
app.put('/api/sessions/:id', async (req, res) => {
    const { id } = req.params;
    const { code } = req.body;
    await pool.query('UPDATE sessions SET code = $1 WHERE id = $2', [code, id]);
    res.sendStatus(204); // No content
});

// Socket.io connection
io.on('connection', (socket) => {
    console.log('A user connected');

    // Join a session
    socket.on('joinSession', (sessionId) => {
        socket.join(sessionId);
        console.log(`User joined session: ${sessionId}`);
        
        // Here you can emit the current code to the user who just joined
        pool.query('SELECT code FROM sessions WHERE id = $1', [sessionId])
            .then(result => {
                socket.emit('codeChange', result.rows[0].code);
            });
    });

    // Handle code change events
    socket.on('codeChange', ({ sessionId, code }) => {
        console.log(`Code change in session ${sessionId}: ${code}`);
        
        // Broadcast the change to all clients in the session
        socket.to(sessionId).emit('codeChange', code);
        
        // Optionally, update the code in the database
        pool.query('UPDATE sessions SET code = $1 WHERE id = $2', [code, sessionId]);
    });

    socket.on('disconnect', () => {
        console.log('A user disconnected');
    });
});

// Start the server
server.listen(4000, () => {
    console.log('Server is running on port 4000');
});
