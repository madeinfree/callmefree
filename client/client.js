const express = require('express')
const app = express()

app.use('/public', express.static('./public/'))

app.get('/', function(req, res) {
  res.sendFile(__dirname + '/public/index.html')
})

app.listen(3000, function() {
  console.log('listening on *:3000')
})
