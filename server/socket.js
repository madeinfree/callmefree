const app = require('express')()
const http = require('http').createServer(app)
const cors = require('cors')
const bodyParser = require('body-parser')
const io = require('socket.io')(http)
const crypto = require('crypto')
const users = require('./mock/users.json')

const onlineUsers = {}

app.use(cors())
app.use(bodyParser.json({ extended: false }))

app.post('/login', (req, res) => {
  const { email, password } = req.body
  const user = users.find(
    user => user.email === email && user.password === password
  )
  if (user) {
    res.status(200).send({
      isLogin: true,
      id: user.id,
      name: user.name,
      email: user.email,
      call_num: user.call_num
    })
  } else {
    res.status(401).send({
      isLogin: false
    })
  }
})
app.get('/users', (req, res) => {
  const secuUsers = users.map(user => ({
    name: user.name,
    email: user.email,
    call_num: user.call_num,
    isOnline: Object.keys(onlineUsers).find(
      key => onlineUsers[key].call_num === user.call_num
    )
      ? true
      : false
  }))
  res.setHeader(
    'ETag',
    crypto
      .createHash('md5')
      .update(JSON.stringify(secuUsers))
      .digest('hex')
  )
  return res.status(200).send(secuUsers)
})

io.on('connection', socket => {
  const hashKey = crypto
    .createHash('sha1')
    .update(socket.id)
    .digest('hex')
  if (!onlineUsers[hashKey]) {
    onlineUsers[hashKey] = {
      socket
    }
    console.log(`a user connected => ${hashKey}`)
  }
  // 登入記錄
  socket.on('board', msg => {
    const hashKey = crypto
      .createHash('sha1')
      .update(socket.id)
      .digest('hex')
    onlineUsers[hashKey].email = msg.email
    onlineUsers[hashKey].name = msg.name
    onlineUsers[hashKey].call_num = msg.call_num
    socket.broadcast.emit('user join', {
      email: onlineUsers[hashKey].email,
      name: onlineUsers[hashKey].name,
      call_num: onlineUsers[hashKey].call_num
    })
  })
  socket.on('disconnect', reason => {
    const hashKey = crypto
      .createHash('sha1')
      .update(socket.id)
      .digest('hex')
    if (onlineUsers[hashKey]) {
      socket.broadcast.emit('user leave', {
        email: onlineUsers[hashKey].email,
        name: onlineUsers[hashKey].name,
        call_num: onlineUsers[hashKey].call_num
      })
      delete onlineUsers[hashKey]
      console.log(`a user disconnect => ${hashKey}`)
    }
  })
})

http.listen(52991, function() {
  console.log('listening on *:52991')
})
