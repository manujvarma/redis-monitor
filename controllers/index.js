
const { response } = require('express');
const express = require('express');
const app = express();
const port = 4000;
const fs = require('fs');
const path = require('path');
const redis = require('redis');
const md5 = require('md5');

//#region Redis
function redisPing(redisPort, redisHost, redisPassword) {
    let redisClient = redis.createClient(redisPort, redisHost, redisPassword);
    let pingResult = redisClient.ping();
    return pingResult;
}
//#endregion

//#region  DatabaseSetup
const Sequelize = require('sequelize');
const { stringify } = require('querystring');
const { Console } = require('console');
const sequelize = new Sequelize({
    // The `host` parameter is required for other databases
    // host: 'localhost'
    dialect: 'sqlite',
    storage: './database.sqlite'
});

sequelize.authenticate()
    .then(() => {
        console.log('Connection has been established successfully.');
    })
    .catch(err => {
        console.error('Unable to connect to the database:', err);
    });

const RedisInfo = sequelize.define('RedisInfo',
    {
        md5: Sequelize.TEXT,
        host: Sequelize.TEXT,
        port: Sequelize.INTEGER,
        password: Sequelize.TEXT
    }
);

sequelize.sync({ force: true })
    .then(() => {
        // console.log(`Database & tables created!`);

        RedisInfo.bulkCreate([
            { md5: 'one', host: 'localhost', port: 15762, password: 'abv' }
        ]).then(function () {
            return RedisInfo.findAll();
        }).then(function (redisInfo) {
            console.log(redisInfo);
        });
    });

//#endregion


//#region  Controllers
app.get('/', async function (request, response) {
    try {
        let indexPath = path.join(__dirname, "..", "templates", "index_page.html");
        fs.readFile(indexPath, 'utf8', (err, data) => {
            if (err) {
                console.error(err);
                response.send("Catastrophic failure while reading HTML file.")
            }
            response.send(data)
        });
    }
    catch (ex) {
        console.error(ex);
    }
});

// Redis list api
app.get('/api/redis_list', async function (request, response) {
    RedisInfo.findAll().then(redisInfo => response.json(redisInfo));
});


// Redis info api
app.get('/api/redis_info', async function (request, response) {
    console.info(request.query.md5)
    RedisInfo.findAll({ where: { md5: request.query.md5 } }).then(redisInfo => response.json(redisInfo));
});

// Redis monitor API
app.get('/api/redis_info', async function (request, response) {
    RedisInfo.findAll({ where: { md5: request.query.md5 } }).then(redisInfo => response.json(redisInfo));
});

// Redis Ping
app.get('/api/ping', async function (request, response) {
    try {
        let host = request.query.host;
        let port = request.query.port;
        if (port == null || port == '')
            port = 6379;
        let password = request.query.password;
        let pingResult = redisPing(port, host, password);
        response.send(pingResult);
    }
    catch (ex) {
        response.send({ 'Success': 0, 'data': 'ping error!' })
    }
});

// Redis Add
app.post('/api/add', async function (request, response) {
    let redisHost = request.query.host;
    let redisPort = request.query.port;
    if (redisPort == null || redisPort == '')
        redisPort = 6379;
    let redisPassword = request.query.password;
    try {
        let pingResult = redisPing(redisPort, redisHost, redisPassword);
        if (pingResult == false)
            response.send('Ping Error!');
    }
    catch (ex) {
        response.send('Ping Error!')
    }
    let redisMd5 = md5(redisHost + redisPort)
    RedisInfo.findAll({ where: { md5: redisMd5 } })
        .then(redisInfo => {
            let checkRedisInfoExist = "NOTEXIST"+redisInfo;
            if (checkRedisInfoExist != "NOTEXIST") {
                   RedisInfo.find({where: {md5 : redisMd5}})
                   .on('success', function(project){
                       if(project)
                       {
                           project.update({
                               password: redisPassword
                           })
                           .success(function() {
                               response.send(redisInfo)
                           })
                       }
                   })
            }            
            else {
                RedisInfo.create({ md5: redisMd5, host: redisHost, password: redisPassword, port: redisPort })
                    .then(function (redisInfo) {
                        response.send(redisInfo)
                    });``
            };
        });
});


app.listen(port, () => console.log(`Redis-Monitor listening on port ${port}!`));

//#endregion

