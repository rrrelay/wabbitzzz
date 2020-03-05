// just a promise wrapper around request
var Promise = require('bluebird');
var request = require('./request');

module.exports = function (opt) {
	return function(method, message = {}, options) {
		options = Object(options);

		return new Promise(function(resolve, reject) {
			return request(opt)(method, options)(message, function(err, res) {
				if (err) {
					return reject(err);
				}

				resolve(res);
			});
		});
	}
};
