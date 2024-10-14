import express from 'express';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { VM } from 'vm2';

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
    console.log('Creating session with creatorId:', creatorId, 'and initial code:', code);
    try {
        const result = await pool.query(
            'INSERT INTO sessions (creator_id, code, role) VALUES ($1, $2, $3) RETURNING *',
            [creatorId, code, 'creator']
        );
        console.log('Session created:', result.rows[0]);

        // Insert creator as a participant
        await pool.query(
            'INSERT INTO participants (session_id, user_name, role) VALUES ($1, $2, $3)',
            [result.rows[0].id, creatorId, 'creator']
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
    console.log('Fetching session with ID:', id);
    try {
        const result = await pool.query('SELECT * FROM sessions WHERE id = $1', [id]);
        console.log('Fetched session:', result.rows[0]);
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching session:', error);
        res.status(500).json({ error: 'Failed to fetch session' });
    }
});

// Kick a participant
app.delete('/api/sessions/:sessionId/participants/:userName', async (req, res) => {
    const { sessionId, userName } = req.params;
    console.log(`Kicking participant ${userName} from session ${sessionId}`);
    try {
        await pool.query('DELETE FROM participants WHERE session_id = $1 AND user_name = $2', [sessionId, userName]);
        console.log(`Participant ${userName} kicked from session ${sessionId}`);
        res.sendStatus(204); // No content
    } catch (error) {
        console.error('Error kicking participant:', error);
        res.status(500).json({ error: 'Failed to kick participant' });
    }
});

// Lock a session
app.put('/api/sessions/:id/lock', async (req, res) => {
    const { id } = req.params;
    console.log(`Locking session with ID: ${id}`);
    try {
        await pool.query('UPDATE sessions SET locked = TRUE WHERE id = $1', [id]);
        console.log(`Session ${id} locked`);
        res.sendStatus(204); // No content
    } catch (error) {
        console.error('Error locking session:', error);
        res.status(500).json({ error: 'Failed to lock session' });
    }
});

// Unlock a session
app.put('/api/sessions/:id/unlock', async (req, res) => {
    const { id } = req.params;
    console.log(`Unlocking session with ID: ${id}`);
    try {
        await pool.query('UPDATE sessions SET locked = FALSE WHERE id = $1', [id]);
        console.log(`Session ${id} unlocked`);
        res.sendStatus(204); // No content
    } catch (error) {
        console.error('Error unlocking session:', error);
        res.status(500).json({ error: 'Failed to unlock session' });
    }
});

// Update session code
app.put('/api/sessions/:id', async (req, res) => {
    const { id } = req.params;
    const { code } = req.body;
    console.log(`Updating code for session ${id}:`, code);
    try {
        await pool.query('UPDATE sessions SET code = $1 WHERE id = $2', [code, id]);
        console.log(`Code updated for session ${id}`);
        res.sendStatus(204); // No content
    } catch (error) {
        console.error('Error updating session:', error);
        res.status(500).json({ error: 'Failed to update session' });
    }
});

// Socket.io connection
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Join a session
    socket.on('joinSession', (sessionId) => {
        socket.join(sessionId);
        console.log(`User ${socket.id} joined session: ${sessionId}`);

        // Emit the current code to the user who just joined
        pool.query('SELECT code FROM sessions WHERE id = $1', [sessionId])
            .then(result => {
                socket.emit('codeChange', result.rows[0].code);
                console.log(`Emitting current code to user ${socket.id} for session ${sessionId}`);
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

    socket.on('kickParticipant', (sessionId, userName) => {
        console.log(`Kicking participant ${userName} from session ${sessionId} via socket`);
        pool.query('DELETE FROM participants WHERE session_id = $1 AND user_name = $2', [sessionId, userName])
            .then(() => {
                // Notify all users in the session that a participant has been kicked
                socket.to(sessionId).emit('participantKicked', userName);
                console.log(`Participant ${userName} kicked from session ${sessionId}`);
            })
            .catch(error => {
                console.error('Error kicking participant via socket:', error);
            });
    });
    
    socket.on('lockSession', (sessionId) => {
        console.log(`Locking session ${sessionId} via socket`);
        pool.query('UPDATE sessions SET locked = TRUE WHERE id = $1', [sessionId])
            .then(() => {
                socket.to(sessionId).emit('sessionLocked', true);
                console.log(`Session ${sessionId} locked and notified clients`);
            })
            .catch(error => {
                console.error('Error locking session via socket:', error);
            });
    });
    
    socket.on('unlockSession', (sessionId) => {
        console.log(`Unlocking session ${sessionId} via socket`);
        pool.query('UPDATE sessions SET locked = FALSE WHERE id = $1', [sessionId])
            .then(() => {
                socket.to(sessionId).emit('sessionUnlocked', false);
                console.log(`Session ${sessionId} unlocked and notified clients`);
            })
            .catch(error => {
                console.error('Error unlocking session via socket:', error);
            });
    });

    // Handle running code
    // socket.on('runCode', (sessionId: string, code: string) => {
    //     console.log(`Running code in session ${sessionId}:`, code);
    //     const vm = new VM();
    //     let output = '';
    
    //     try {
    //         // Capture console.log output
    //         const oldLog = console.log;
    //         console.log = (msg) => {
    //             output += msg + '\n'; // Append output
    //         };
    
    //         // Wrap the code execution to catch any errors
    //         vm.run(`(function() { ${code} })();`);
    
    //         // Restore console.log
    //         console.log = oldLog;
    //     } catch (error) {
    //         output = `Error: `;
    //         console.error('Error executing code:', error);
    //     }
    
    //     // Emit the output to the specific user who requested to run the code
    //     socket.emit('codeOutput', output);
    //     console.log(`Output from code execution in session ${sessionId}:`, output);
    // });

    socket.on('disconnect', () => {
        console.log('A user disconnected:', socket.id);
    });
});

// Start the server
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
