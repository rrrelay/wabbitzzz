// just a promise wrapper around request
var Promise = require('bluebird');
var request = require('./request');
var _ = require('lodash');

function rpc (connString, method, message = {}, options) {
	options = Object(options);
	var _request = request(connString);

	return new Promise(function(resolve, reject) {
		return _request(method, options)(message, function(err, res) {
			if (err) {
				return reject(err);
			}

			resolve(res);
		});
	});
};

module.exports = function (opt = {}) {
	return _.partial(rpc, opt.connString);
}
