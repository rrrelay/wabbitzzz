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

function Connection(connString = CONN_STRING) {
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

function _createConnection(fn, connString) {
	const connName = connString || 'main';

	if (!connectionsDict[connName]) {
		connectionsDict[connName] = Connection(connString).then(fn);
	}

	return connectionsDict[connName];
}

var connectionsDict = {};

module.exports = {
	Connection: _.partial(_createConnection, (conn) => conn),
	getConnection: _.partial(_createConnection, _closeConnection),
}
