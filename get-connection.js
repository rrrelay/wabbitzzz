var CONN_STRING = process.env.WABBITZZZ_URL || 'amqp://localhost';
var amqplib = require('amqplib');
var Promise = require('bluebird');

function _getConnection(){
	return Promise.resolve(amqplib.connect(CONN_STRING))
		.then(function(conn) {
			process.once('SIGINT', conn.close.bind(conn));
			return conn;
		});
}

var p;
module.exports = function(){
	if (!p) {
		p = _getConnection();
	}

	return p;
};
