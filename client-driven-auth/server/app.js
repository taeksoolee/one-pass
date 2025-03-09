const users = [
  ['admin', '1234'],
];

const jwt = require('jsonwebtoken');
const JWT_SECRET = require('uuid').v4();
const tokens = new Set();
// This is a secret key that the server uses to sign the JWT token

const express = require('express');
const app = express();
app.use(require('cors')());

app.use(express.json());

app.get('/', (req, res) => {
  return res.send('Hello, World!');
});

app.post('/auth/login', (req, res) => {
  const { username, password } = req.body;

  const findUser = users.find(user => user[0] === username && user[1] === password);
  if (!findUser) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const accessToken = jwt.sign({ username }, JWT_SECRET, { expiresIn: '1m' });
  const refreshToken = jwt.sign({ username }, JWT_SECRET, { expiresIn: '7w' });

  res.json({
    accessToken,
    refreshToken,
  });
});

app.post('/auth/refresh', (req, res) => {
  const { refreshToken } = req.body;

  try {
    const { username } = jwt.verify(refreshToken, JWT_SECRET);
    const accessToken = jwt.sign({ username }, JWT_SECRET, { expiresIn: '1m' });
    
    res.json({
      accessToken,
    });
  } catch (e) {
    res.status(401).json({ message: 'Unauthorized' });
  }
});

app.post('/auth/logout', (req, res) => {
  // TODO: 유효한 토큰 관리
  // 현재는 필요없을것 같아 미구현. 클라이언트에서 토큰 지우면 로그아웃인것으로 봄
  res.status(204).end();
});

app.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});