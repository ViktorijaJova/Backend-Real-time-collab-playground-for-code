import express from 'express';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { VM } from 'vm2'; // Add vm2 for code execution

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

// Create a session
app.post('/api/sessions', async (req, res) => {
    const { creatorId, code } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO sessions (creator_id, code, role) VALUES ($1, $2, $3) RETURNING *',
            [creatorId, code, 'creator'] // Set role to 'creator'
        );
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error creating session:', error);
        res.status(500).json({ error: 'Failed to create session' });
    }
});

// Get a session by ID
app.get('/api/sessions/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('SELECT * FROM sessions WHERE id = $1', [id]);
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching session:', error);
        res.status(500).json({ error: 'Failed to fetch session' });
    }
});

// Update session code
app.put('/api/sessions/:id', async (req, res) => {
    const { id } = req.params;
    const { code } = req.body;
    try {
        await pool.query('UPDATE sessions SET code = $1 WHERE id = $2', [code, id]);
        res.sendStatus(204); // No content
    } catch (error) {
        console.error('Error updating session:', error);
        res.status(500).json({ error: 'Failed to update session' });
    }
});

// Socket.io connection
io.on('connection', (socket) => {
    console.log('A user connected');

    // Join a session
    socket.on('joinSession', (sessionId) => {
        socket.join(sessionId);
        console.log(`User joined session: ${sessionId}`);

        // Emit the current code to the user who just joined
        pool.query('SELECT code FROM sessions WHERE id = $1', [sessionId])
            .then(result => {
                socket.emit('codeChange', result.rows[0].code);
            })
            .catch(error => {
                console.error('Error fetching code for session:', error);
            });
    });

    // Handle code change events
    socket.on('codeChange', ({ sessionId, code }) => {
        console.log(`Code change in session ${sessionId}: ${code}`);
        
        // Broadcast the change to all clients in the session
        socket.to(sessionId).emit('codeChange', code);
        
        // Optionally, update the code in the database
        pool.query('UPDATE sessions SET code = $1 WHERE id = $2', [code, sessionId])
            .catch(error => {
                console.error('Error updating code in session:', error);
            });
    });

    // Handle running code
    socket.on('runCode', (sessionId: string, code: string) => {
        const vm = new VM();
        let output = '';
    
        try {
            // Capture console.log output
            const oldLog = console.log;
            console.log = (msg) => {
                output += msg + '\n'; // Append output
            };
    
            // Execute the user's code
            vm.run(code);
    
            // Restore console.log
            console.log = oldLog;
        } catch (error) {
            if (error instanceof Error) {
                output = `Error: ${error.message}`;
            } else {
                output = 'Error: An unknown error occurred.';
            }
        }
    
        // Emit the output to the specific user who requested to run the code
        socket.emit('codeOutput', output);
    });

    socket.on('disconnect', () => {
        console.log('A user disconnected');
    });
});

// Start the server
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
