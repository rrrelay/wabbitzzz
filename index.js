var exchange = require('./exchange');
var queue = require('./queue');
var request = require('./request');
var response = require('./response');
var rpc = require('./rpc');

module.exports = function (opt) {
	if (!opt) opt = {};
	return {
		Exchange: exchange(opt),
		Queue: queue(opt),
		request: request,
		response: response(opt),
		rpc: rpc,
	};
};
