var CONN_STRING = process.env.WABBITZZZ_URL || 'amqp://localhost';
var amqplib = require('amqplib');
var q = require('q');

function _getConnection(){
	return q(amqplib.connect(CONN_STRING))
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
