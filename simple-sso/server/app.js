const fs = require('fs');
const jwt = require('jsonwebtoken');
const path = require('path');
const spdy = require('spdy');
const crypto = require('crypto');

const express = require('express');
const app = express();

// This is a secret key that the server uses to sign the JWT token
const JWT_SECRET = require('uuid').v4();

const Origins = {
  clientA: {
    HOST: 'https://test-a.com:5555',
    REDIRECT: '/redirect.html',
  },
  clientB: {
    HOST: 'https://test-b.com:5556',
    REDIRECT: '/redirect.html',
  },
}

const users = [
  ['admin', '1234', 'clientA',],
  ['user', '1234', 'clientB',],
];


const codes = (() => {
  const algorithm = 'aes-256-cbc';
  const key = crypto.randomBytes(32);
  const iv = crypto.randomBytes(16);

  const data = new Set();

  const getHashText = (user) => {
    const username = user[0];
    const role = user[2];
    return username + ':::' + role;
  }

  const splitHashText = (hash) => {
    return hash.split(':::');
  }

  const cipher = (text) => {
    const encrypt = crypto.createCipheriv(algorithm, key, iv);
    const encryptResult = encrypt.update(text, 'utf8', 'base64')
      + encrypt.final('base64');
      
    return encryptResult
  }
  
  const decipher = (encrypted) => {
    const decode = crypto.createDecipheriv(algorithm, key, iv);
    const decodeResult = decode.update(encrypted, 'base64', 'utf8')
      + decode.final('utf8');

    return decodeResult;
  }
  

  const addData = (user) => {
    const userHash = cipher(getHashText(user));

    const newCode = jwt.sign({ _: userHash }, JWT_SECRET, {
      expiresIn: 60 * 5,
    });
    
    data.add(newCode);

    return newCode;
  }
  
  const deleteData = (code) => {
    data.delete(code);
  }

  /**
   * 한번 사용하면 코드 삭제
   * @param {string} code
   * @returns {[[string, string], Error]} - [[username, host], Error]
   */
  const getData = (code) => {
    const isExist = data.has(code);
    if (isExist) {
      deleteData(code);
      const [username, role] = splitHashText(decipher(jwt.decode(code, JWT_SECRET)._));
      return [[username, role], null];
    } else {
      return [null, Error('Invalid code')];
    }
  }

  // 1초마다 코드의 만료시간을 확인하고 만료된 코드를 삭제
  setInterval(() => {
    for (const code of data) {
      try {
        const { exp } = jwt.decode(code, JWT_SECRET);
        if (Date.now() >= exp * 1000) {
          data.delete(code);
        }
      } catch (e) {
        data.delete(code);
      }
    }
  }, 3000);

  return {
    data,
    addData,
    getData,
    // deleteData,
  }
})();

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

// app.use(express.static(path.resolve(__dirname, 'public')));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(require('cors')({
  origin: Object.keys(Origins).map(key => Origins[key].HOST),
  credentials: true,
}));
app.use(require('cookie-parser')());


app.get('/', (req, res) => {
  const auth = req.cookies.auth;
  if (auth) {
    res.sendFile(path.resolve(__dirname, 'public', 'signed.html'));
  } else {
    res.sendFile(path.resolve(__dirname, 'public', 'index.html'));
  }
});

app.post('/login',
  (req, res) => {
    console.log(req.body);
    const { username, password } = req.body;

    const findedUser = users.find(([user, pass]) => user === username && pass === password);
    const isLogined = !!findedUser;

    if (!isLogined) {
      return res.status(401).redirect('/?error=Invalid username or password');
    }

    const code = codes.addData(findedUser);

    const [,,role] = findedUser;
    const { HOST: host, REDIRECT: redirect } = Origins[role];

    const refreshToken = jwt.sign({ username, role }, JWT_SECRET, {
      expiresIn: REFRESH_TOKEN_EXPIRED_TIME,
    });

    res.cookie('auth', refreshToken, {
      maxAge: REFRESH_TOKEN_EXPIRED_TIME,
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
    });

    res.redirect(`${host}${redirect}?code=${code}`);
  },
);

app.get('/logout', (req, res) => {
  res.clearCookie('auth');
  res.clearCookie('refreshToken');
  res.redirect('/');
});

app.post('/auth/login', (req, res) => {
  const { code } = req.body;

  const [result, error] = codes.getData(code);

  if (error || result === null) {
    return res.status(401).json({
      message: error.message,
    });
  }

  const [username, role] = result;
  const host = Origins[role].HOST;

  // 요청 url의 origin을 추출
  const originDoamin = new URL(req.get('origin')).hostname;
  const domain = new URL(host).hostname;
  if (originDoamin !== domain) {
    return res.status(403).json({
      message: 'Invalid domain',
    });
  }

  const refreshToken = jwt.sign({ username, role, }, JWT_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRED_TIME,
  });

  console.log(domain);
  res.cookie('refreshToken', refreshToken, {
    maxAge: REFRESH_TOKEN_EXPIRED_TIME,
    // path: '/auth',
    httpOnly: true,
    secure: true,
    sameSite: 'none',
  });

  res.status(204);
});

app.get('/auth/refresh', (req, res) => {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({
      message: 'not authorized',
    });
  }

  try {
    const { username, role } = jwt.verify(refreshToken, JWT_SECRET);

    const originHost = new URL(req.get('origin')).hostname;
    const host = new URL(Origins[role].HOST).hostname;
    if (originHost !== host) {
      return res.status(403).json({
        message: 'Invalid domain',
      });
    }

    const accessToken = jwt.sign({ username, role }, JWT_SECRET, {
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

  res.cookie('refreshToken', '', { maxAge: 0, httpOnly: false, });
  res.status(204).send();  
});

app.get('/resources', auth, (req, res) => {
  res.send('resources');
});

spdy.createServer({
  key: fs.readFileSync(path.resolve('certs', 'private-key.pem')),
  cert: fs.readFileSync(path.resolve('certs', 'certificate.pem')),
  
}, app)
.listen(3000, () => {
  console.log('Server is running on https://localhost:3000');
});

// app.listen(3000, () => {
//   console.log('Server is running on http://localhost:3000');
// });

/**
 * Client A
 */
const clientA = express();
clientA.use(express.static(path.resolve(__dirname, 'public', 'client-a')));
spdy.createServer({
  key: fs.readFileSync(path.resolve('certs', 'private-key.pem')),
  cert: fs.readFileSync(path.resolve('certs', 'certificate.pem')),
}, clientA)
.listen(5555, () => {
  console.log('Server is running on https://test-a.com:5555');
});

/**
 * Client B
 */
const clientB = express();
clientB.use(express.static(path.resolve(__dirname, 'public', 'client-b')));
spdy.createServer({
  key: fs.readFileSync(path.resolve('certs', 'private-key.pem')),
  cert: fs.readFileSync(path.resolve('certs', 'certificate.pem')),
}, clientB)
.listen(5556, () => {
  console.log('Server is running on https://test-b.com:5556');
});