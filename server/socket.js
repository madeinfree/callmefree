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
    onlineUsers[hashKey].email = msg.email
    onlineUsers[hashKey].name = msg.name
    onlineUsers[hashKey].call_num = msg.call_num
    socket.broadcast.emit('user join', {
      email: onlineUsers[hashKey].email,
      name: onlineUsers[hashKey].name,
      call_num: onlineUsers[hashKey].call_num
    })
  })
  // 替使用者撥打電話
  socket.on('call user allow check', msg => {
    const { caller, callee } = msg
    const callerUser = onlineUsers[hashKey]
    let calleeUser = null
    for (let key in onlineUsers) {
      if (onlineUsers[key].call_num === callee) {
        calleeUser = onlineUsers[key]
      }
    }
    if (calleeUser) {
      calleeUser.socket.emit('user call in', {
        name: callerUser.name,
        call_num: callerUser.call_num
      })
    }
  })
  socket.on('allow answer', msg => {
    const { name, call_num } = msg
    const answerUser = onlineUsers[hashKey]
    let offerUser = null
    for (let key in onlineUsers) {
      if (onlineUsers[key].call_num === call_num) {
        offerUser = onlineUsers[key]
      }
    }
    if (offerUser) {
      offerUser.socket.emit('notify:user wait from offer', {
        name: answerUser.name,
        call_num: answerUser.call_num
      })
    }
  })
  socket.on('PC:send offer to answer', msg => {
    const { offer, name, call_num } = msg
    const callerUser = onlineUsers[hashKey]
    let calleeUser = null
    for (let key in onlineUsers) {
      if (onlineUsers[key].call_num === call_num) {
        calleeUser = onlineUsers[key]
      }
    }
    if (calleeUser) {
      calleeUser.socket.emit('PC:get caller offer', {
        name: callerUser.name,
        call_num: callerUser.call_num,
        offer
      })
    }
  })
  socket.on('PC:send answer to offer', msg => {
    const { answer, name, call_num } = msg
    const answerUser = onlineUsers[hashKey]
    let offerUser = null
    for (let key in onlineUsers) {
      if (onlineUsers[key].call_num === call_num) {
        offerUser = onlineUsers[key]
      }
    }
    if (offerUser) {
      offerUser.socket.emit('notify:user wait from answer', {
        name: answerUser.name,
        call_num: answerUser.call_num,
        answer
      })
    }
  })
  socket.on('PC:send candidate to answer', msg => {
    const { candidate, name, call_num } = msg
    const callerUser = onlineUsers[hashKey]
    let calleeUser = null
    for (let key in onlineUsers) {
      if (onlineUsers[key].call_num === call_num) {
        calleeUser = onlineUsers[key]
      }
    }
    if (calleeUser) {
      calleeUser.socket.emit('PC:get candidate', {
        name: callerUser.name,
        call_num: callerUser.call_num,
        candidate
      })
    }
  })
  socket.on('PC:send candidate to offer', msg => {
    const { candidate, name, call_num } = msg
    const answerUser = onlineUsers[hashKey]
    let offerUser = null
    for (let key in onlineUsers) {
      if (onlineUsers[key].call_num === call_num) {
        offerUser = onlineUsers[key]
      }
    }
    if (offerUser) {
      offerUser.socket.emit('PC:get candidate', {
        name: answerUser.name,
        call_num: answerUser.call_num,
        candidate
      })
    }
  })
  socket.on('disconnect', reason => {
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
