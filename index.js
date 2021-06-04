const express = require('express');

const app = express();
const http = require('http').createServer(app);

require('dotenv').config();

const axios = require('axios');
const PORT = 7000 || process.env.PORT;

var whitelist = [process.env.DEV_DOMAIN, process.env.FRONT_DOMAIN];

var corsOptions = {
  origin: function (origin, callback) {
    if (whitelist.indexOf(origin) !== -1) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  }
}

const io = require('socket.io')(http, {
    cors: corsOptions
});

const mysql = require('mysql');

var connection = mysql.createConnection({
    host     : 'localhost',
    user     : process.env.USER,
    password : process.env.PASSWORD,
    database : process.env.DATABASE
});

connection.connect((err) => {
    if (err) console.log(err + '')
});

io.on('connection', (socket) => {
    socket.on('USER_LOGIN', async (token) => {

        axios.get(process.env.AUTH_URL, { headers: { Authorization: 'Bearer ' + token } }).then(resp => {
            socket.user = resp.data.user;
            socket.emit('SERVER_SEND_CHECK_AUTH', true);
            io.emit('USER_LOGGING_IN', resp.data.user.username);
        }).catch (err => {
            socket.emit('SERVER_SEND_CHECK_AUTH', false);
            console.log(err.response.data)
        })
        
    });
    socket.on('USER_ENTRANCE', () => {
        const sql = "SELECT * FROM chat ORDER BY created_at DESC LIMIT 100";

        connection.query(sql, (error, results, fields) => {
            if (!error) {
                socket.emit('SERVER_SEND_LIST_CHAT', results.reverse())
            } else {
                console.log(error)
            }
        });
    });

    socket.on('USER_TYPING', (status) => {
        if (status) {
            socket.broadcast.emit('SOMEONE_TYPING', socket.user.username);
        } else {
            socket.broadcast.emit('SOMEONE_TYPING', null);
        }
        
    });

    socket.on('USER_SEND_CHAT', (message) => {
       const chatObj = { username: socket.user.username, message, created_at: new Date() };
       
       connection.query('INSERT INTO chat SET ?', chatObj, (error, results, fields) => {
            if (!error) {
                connection.query('SELECT * FROM chat WHERE id = ?' , [results.insertId], (error, results, fields) => {
                    if (!error) {
                        io.emit('SERVER_UPDATE_CHAT', results[0]);
                        socket.broadcast.emit('PLAY_COMING_MESSAGE_SOUND');
                    }
                })
            }
       })

    });

});

app.get('/', (req, res) => {
    res.send('ok');
});

http.listen(PORT, () => console.log('App running on port ' + PORT));