const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const session = require('express-session');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Configuration: Set in .env
const MATTERMOST_URL = 'https://teams.szn.cz';
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const GALLERY_PASSWORD = process.env.GALLERY_PASSWORD || 'password123';

// Middleware to parse JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Setup session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'someSecretKey',
  resave: false,
  saveUninitialized: false
}));

// Serve static files from the "public" folder (if needed)
app.use(express.static(path.join(__dirname, 'public')));

// --- Authentication Middleware & Routes ---

// Middleware to require authentication
function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) {
    next();
  } else {
    res.redirect('/login');
  }
}

// GET /login: Display a simple login form
app.get('/login', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Login</title>
      <style>
        body { background: #121212; color: #e0e0e0; font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
        form { background: #1e1e1e; padding: 20px; border-radius: 8px; }
        input { padding: 10px; font-size: 16px; margin-right: 10px; }
        button { padding: 10px 15px; font-size: 16px; cursor: pointer; }
      </style>
    </head>
    <body>
      <form method="POST" action="/login">
        <h2>Login to Access Emoji Gallery</h2>
        <input type="password" name="password" placeholder="Enter Password" required />
        <button type="submit">Login</button>
      </form>
    </body>
    </html>
  `);
});

// POST /login: Process the login form
app.post('/login', (req, res) => {
  const password = req.body.password;
  if (password === GALLERY_PASSWORD) {
    req.session.authenticated = true;
    res.redirect('/gallery');
  } else {
    res.send('Incorrect password. <a href="/login">Try again</a>');
  }
});

// Protected route: /gallery serves the gallery HTML from the private folder.
app.get('/gallery', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'private', 'mattermost_emojis.html'));
});

// --- API Endpoints ---

// GET /api/emoji: Fetch emoji data (supports pagination)
app.get('/api/emoji', async (req, res) => {
  const page = req.query.page || 0;
  const perPage = req.query.per_page || 200;
  const targetUrl = `${MATTERMOST_URL}/api/v4/emoji?page=${page}&per_page=${perPage}`;
  try {
    const response = await fetch(targetUrl, {
      headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` }
    });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).send(`Error fetching emoji data: ${error.toString()}`);
  }
});

// GET /api/emoji/:id/image: Fetch emoji image and pipe it to the client
app.get('/api/emoji/:id/image', async (req, res) => {
  const id = req.params.id;
  const targetUrl = `${MATTERMOST_URL}/api/v4/emoji/${id}/image`;
  try {
    const response = await fetch(targetUrl, {
      headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` }
    });
    res.set('Content-Type', response.headers.get('Content-Type'));
    response.body.pipe(res);
  } catch (error) {
    res.status(500).send(`Error fetching emoji image: ${error.toString()}`);
  }
});

// POST /api/users/ids: Fetch user details for an array of user IDs
app.post('/api/users/ids', async (req, res) => {
  const ids = req.body; // Expects an array of user IDs
  const targetUrl = `${MATTERMOST_URL}/api/v4/users/ids`;
  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(ids)
    });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).send(`Error fetching user details: ${error.toString()}`);
  }
});

app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});