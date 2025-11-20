'use strict';

/**
 * @file    server.js
 * @brief   basic nodeJS web server for local testing
 * @author  Sarah Rosanna Busch
 * @date    20 Nov 2025
 */

const http = require('http');
const url = require('url');
const fs = require('fs');

const PORT = 9090;

const server = new http.createServer(function (req, res) {
    var query = url.parse(req.url, true);  
    var filename = __dirname + query.pathname;

    if(req.method === 'POST') {
        req.setEncoding('utf8');
        req.on('data', function(data) {
            console.log(data);
            res.write(JSON.stringify({ack:true}));
            res.end();
        });
    } else if(req.method === 'GET') {
        fs.readFile(filename, function(err, data) {
            if (err) {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                return res.end("404 File Not Found: " + filename);
            }

            // Extract extension
            const ext = filename.split('.').pop().toLowerCase();
            let mimeType;

            switch (ext) {
                case 'html':
                    mimeType = 'text/html';
                    break;
                case 'js':
                    // Correct MIME type for both classic and module scripts
                    mimeType = 'text/javascript';
                    break;
                case 'css':
                    mimeType = 'text/css';
                    break;
                case 'svg':
                    mimeType = 'image/svg+xml';
                    break;
                default:
                    mimeType = 'text/plain';
            }

            console.log('serving: ' + filename + ' as ' + mimeType);
            res.writeHead(200, { 'Content-Type': mimeType });
            res.write(data);
            res.end();
        });
    }
    
});

server.listen(PORT);

server.once('listening', function() {
    console.log('server listening on port ' + PORT);
});

server.on('error', function(e) {
    console.log('error code: ' + e.code);
});
