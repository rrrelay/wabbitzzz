var exchange = require('./exchange');
var queue = require('./queue');
var request = require('./request');
var response = require('./response');
var rpc = require('./rpc');
var connection = require('./connection').Connection;

function wabbitzzz (opt) {
	return {
		Exchange: exchange(opt),
		Queue: queue(opt),
		request: request(opt),
		response: response(opt),
		rpc: rpc(opt),
		Connection: connection(opt),
	};
}

wabbitzzz.Exchange = exchange();
wabbitzzz.Queue = queue();
wabbitzzz.request = request();
wabbitzzz.response = response();
wabbitzzz.rpc = rpc();

module.exports = wabbitzzz;
