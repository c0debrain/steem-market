var deepEqual = require("deep-equal");
var config = require("../config");
import zlib from 'zlib'
var fs = require("fs");
var express = require('express');
var app = express();
// app.use(express.static('dist'));
// This is fired every time the server side receives a request
// app.use(handleRender)
var server = app.listen(config.port);
var ApiCalls = require("./apiCalls");
var io = require('socket.io')(server);
var connectCounter = 0;
var path = require("path");

import React from 'react';
import ReactDOM from 'react-dom';

import { renderToString } from 'react-dom/server'
import { match, RouterContext } from 'react-router'
import routes from '../app/routes.js';
import DataWrapper from "./DataWrapper";
import {write, renderFullPage} from "./utils.js";

console.log("*** Server listening at port:", config.port, "***");

function startServer() {
    app.use((req, res) => {
      // Note that req.url here should be the full URL path from
      // the original request, including the query string.
      match({ routes, location: req.url }, (error, redirectLocation, renderProps) => {
        if (error) {
          res.status(500).send(error.message)
        } else if (redirectLocation) {
          res.redirect(302, redirectLocation.pathname + redirectLocation.search)
      } else if (req.url.indexOf("app.") >= 0 || req.url.indexOf("highcharts") >= 0) {
        //   res.sendFile(__dirname + "/dist" + req.url);
            fs.readFile(path.resolve(__dirname, "../dist/", `.${req.url}`), (err, data) => {
                let type = req.url.indexOf(".js") >= 0 ? "javascript" : "css";
                write(data, `text/${type}`, res)
            })
      } else if (renderProps) {
          // You can also check renderProps.components or renderProps.routes for
          // your "not found" component or route respectively, and send a 404 as
          // below, if you're using a catch-all route.
          let html = renderToString(<DataWrapper data={marketCache}><RouterContext test="test" {...renderProps} /></DataWrapper>);

          res.status(200).send(renderFullPage(html, marketCache));
        } else {
          res.status(404).send('Not found')
        }
      })
    })

    io.on('connection', function (socket) {
        connectCounter++;
        console.log('user connected, total users:', connectCounter);

        // Broadcast data to newly connected user
        for (let event in marketCache) {
            socket.emit(event, marketCache[event]);
        }

        // Decrement user count on disconnect
        socket.on("disconnect", function() {
            connectCounter--;
        });

    });
}

var apiCalls = ApiCalls();
var currentBlock;

var marketCache = {
    orderbook: {bids: [], asks: []},
    tradehistory: [],
    ticker: {},
    markethistory: []
}

apiCalls.init().then((res) => {
    console.log("Api ready, connected to:", res, "\n");
    updateState();
    startServer();
});

function updateState() {
    Promise.all([
            apiCalls.getDynamicGlobal(),
            apiCalls.getOrderBook(),
            apiCalls.getTradeHistory(),
            apiCalls.getTicker(),
            apiCalls.getMarketHistory()
    ])
    .then(function(response) {
        currentBlock = response[0].head_block_number;

        checkChangeAndEmit("orderbook", response[1]);
        checkChangeAndEmit("tradehistory", response[2]);
        checkChangeAndEmit("ticker", response[3]);
        checkChangeAndEmit("markethistory", response[4]);

        setTimeout(updateState, config.pollFrequency);
    }).catch(err => {
        console.log("Api error:", err);
    })
}

function checkChangeAndEmit(event, incoming) {
    if (!deepEqual(incoming, marketCache[event])) {
        console.log(event, "changed at block #", currentBlock);
        if (io && "sockets" in io) {
            io.sockets.emit(event, incoming);
        }

        marketCache[event] = incoming;
    }
}
