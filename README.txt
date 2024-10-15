Overview
This backend serves a real-time collaborative coding playground application built with Node.js, Express, Socket.io for real-time communication, and PostgreSQL as the database (hosted on Heroku). The application allows multiple users to create or join coding sessions, collaborate on code in real time, and manage the session (e.g., locking the session, kicking participants).

Technologies:
Node.js: The core runtime environment for running the server-side JavaScript code.
Express.js: A fast and lightweight web framework for creating API routes.
Socket.io: For bi-directional real-time communication between the server and clients.
PostgreSQL (Heroku Postgres): A relational database for storing session and participant data.
Heroku: Cloud platform hosting the backend server and database.

1. Running the Server
To run the server locally:
bash
Copy code
npm run dev
2. Heroku Postgres
To connect to the Postgres database on Heroku:

bash
Copy code
heroku pg:psql --app realtime-code-playground-app
3. Running a TypeScript File
Run a specific TypeScript file:
bash
Copy code
npx ts-node src/index.ts
Running in Development
Steps:
Start the PostgreSQL database locally or ensure the Heroku Postgres database is properly configured.
Run the development server:
bash
Copy code
npm run dev
The server will be running on http://localhost:4000 by default.