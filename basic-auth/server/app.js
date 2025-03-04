const express = require('express');
const app = express();
const { body, validationResult } = require('express-validator');

const jwt = require('jsonwebtoken');

// This is a secret key that the server uses to sign the JWT token
const JWT_SECRET = require('uuid').v4();

const throwValidation = (req, res, next) => {
  const result = validationResult(req);
  try {
    result.throw();
    next();
  } catch (e) {
    res.status(400).json({
      errors: e.array(),
    });
  }
}

const users = [
  ['admin', '1234'],
];

const ACCESS_TOKEN_EXPIRED_TIME = 60 * 2; // 2m
const REFRESH_TOKEN_EXPIRED_TIME = 60 * 60 * 24 * 7; // 7d

const auth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({
      message: 'Authorization header is required',
    });
  }

  const [type, token] = authHeader.split(' ');

  if (type !== 'Bearer') {
    return res.status(401).json({
      message: 'Invalid authorization type',
    });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (e) {
    res.status(401).json({
      message: 'Invalid token',
    });
  }
}

app.use(express.json());
app.use(require('cors')({
  origin: ['http://localhost:5555'],
  credentials: true,
}));
app.use(require('cookie-parser')());

app.get('/', auth, (req, res) => {
  res.send('Hello World!');
});

app.post('/auth/login', 
  body('username').notEmpty().isString().withMessage('Username is required'),
  body('password').notEmpty().isString().withMessage('Password is required'),
  throwValidation,
  (req, res) => {
    const { username, password } = req.body;

    const isLogined = !!users.find(([user, pass]) => user === username && pass === password);

    if (!isLogined) {
      return res.status(401).json({
        message: 'Invalid username or password',
      });
    }
  
    const accessToken = jwt.sign({ username, }, JWT_SECRET, {
      expiresIn: ACCESS_TOKEN_EXPIRED_TIME,
    });
    const refreshToken = jwt.sign({ username }, JWT_SECRET, {
      expiresIn: REFRESH_TOKEN_EXPIRED_TIME,
    });

    res.cookie('refreshToken', refreshToken, { maxAge: REFRESH_TOKEN_EXPIRED_TIME, httpOnly: false, sameSite: 'strict', path: '/auth' });
    res.json({
      accessToken,
    });
  },
);

app.get('/auth/refresh', (req, res) => {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({
      message: 'not authorized',
    });
  }

  try {
    const payload = jwt.verify(refreshToken, JWT_SECRET);
    const accessToken = jwt.sign({ username: payload.username }, JWT_SECRET, {
      expiresIn: ACCESS_TOKEN_EXPIRED_TIME,
    });
    res.json({
      accessToken,
    });
  } catch (e) {
    res.status(401).json({
      message: 'Invalid refresh token',
    });
  }
});

app.delete('/auth/logout', (req, res) => {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({
      message: 'not authorized',
    });
  }

  res.cookie('refreshToken', '', { maxAge: 0, httpOnly: false, sameSite: 'strict' });
  res.status(204).send();  
});

app.get('/resources', auth, (req, res) => {
  res.send('resources');
});

app.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});