var q = require('q');
var amqp = require('amqp');

function _getConnection(){
	var d = q.defer();

	var connection = amqp.createConnection({ url:  process.env.WABBITZZZ_URL || 'amqp://localhost' });
	connection.addListener('ready', d.resolve.bind(d, connection));
	connection.addListener('error', d.reject.bind(d));

	return d.promise.timeout(20 * 1000);
};


var p;
module.exports = function(){
	if (!p) {
		p = _getConnection();
	}

	return p;
}
