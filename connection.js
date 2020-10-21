var CONN_STRING = process.env.WABBITZZZ_URL || 'amqp://localhost';
var amqplib = require('amqplib');
var Promise = require('bluebird');
var _ = require('lodash');

function _log(...args) {
	if (global.logger && global.logger.warn) {
		global.logger.warn.apply(global.logger, args);
	} else {
		console.warn.apply(console, args);
	}
}

var connectionsDict = {};

function _closeConnection(conn) {
	var closed = false;
	process.once('SIGINT', () => {
		if (closed) {
			_log('close already ran');
			return;
		}
		_log('running close');
		closed = true;
		conn.close();
	});

	return conn;
}

function _createConnection(connString) {
	return Promise.resolve(amqplib.connect(connString))
		.then(function(conn) {
			_log('WABBITZZZ CONNECTION OPENED');

			conn.on('error', err => {
				_log('WABBITZZZ CONNECTION ERRROR', err);
			});

			conn.on('close', closeData => {
				_log('WABBITZZZ CONNECTION CLOSED', closeData);
				setTimeout(function() {
					_log(`connection closed EXITING NOW.`);
					process.exit(1);
				}, 5000);
			});

			return conn;
		})
		.timeout(30000)
		.catch(function(err){
			_log(`unable to get connect: ${err.message}`);

			setTimeout(function() {
				_log(`unable to get connect EXITING NOW: ${err.message}`);
				process.exit(1);
			}, 5000);

			throw err;
		});
}

function Connection(connString = CONN_STRING) {
	this.connString = connString;
	this.connName = connString || 'main';
}

Connection.prototype.connect = function() {
	if (!connectionsDict[this.connName]) {
		connectionsDict[this.connName] = _createConnection(this.connString);
	}

	return connectionsDict[this.connName]
		.then(conn => {
			this.conn = conn;
			return conn;
		});
}

Connection.prototype.close = function() {
	return Promise.resolve()
		.then(() => {
			delete connectionsDict[this.connName];

			if(this.conn) {
				return this.conn.close();
			};
		});
}

Connection.getConnection = function(connString = CONN_STRING) {
	var connName = connString || 'main';

	if (!connectionsDict[connName]) {
		connectionsDict[connName] = _createConnection(connString)
			.then(_closeConnection);
	}

	return connectionsDict[connName];
}

module.exports = Connection;
