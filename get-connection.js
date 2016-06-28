var CONN_STRING = process.env.WABBITZZZ_URL || 'amqp://localhost';
var amqplib = require('amqplib');
var Promise = require('bluebird');

function _getConnection(){
	return Promise.resolve(amqplib.connect(CONN_STRING))
		.then(function(conn) {
			var closed = false;
			function close(){
				if (closed) return;
				closed = true;
				conn.close();
			}

			process.once('SIGINT', close);
//			process.once('SIGTERM', close);
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
