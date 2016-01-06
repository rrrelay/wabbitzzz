var _ = require('lodash');
var Queue = require('../queue');
var request = require('../request');

module.exports = function(){
	var options = request.createOptions.apply(null, _.toArray(arguments));

	var sendRequest = request(options);
	return function(resourceKey, cb){
		var staleQueue;
		sendRequest({_resourceKey: resourceKey}, function(err, res){
			if (err && /^timeout$/i.test(err.message)){
				staleQueue = new Queue({
					exchangeName: options.methodName + '__stale__',
					key: resourceKey,
					exclusive: true,
					autoDelete: true,
					durable: false,
				});

				staleQueue(function(msg, ack){
					console.log('WARNING: using stale value for '+options.methodName + ' ' + resourceKey);
					cb(null, msg);
					ack();
				});
			} else {
				cb(err, res);
			}
		});
	};
};

