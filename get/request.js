var _ = require('lodash');
var Queue = require('../queue');
var request = require('../request');
var staleCache = {};

module.exports = function(){
	var options = request.createOptions.apply(null, _.toArray(arguments));
	var sendRequest = request(options);

	function _setCache(key, val){
		staleCache[key] = val;

		setTimeout(function(){
			delete staleCache[key];
		}, 10000);
	}

	return function(resourceKey, cb){
		var staleQueue;
		var staleVal = staleCache[resourceKey];

		if (staleVal){
			return setTimeout(function(){
				var val = _.cloneDeep(staleVal);
				val._cached = true;
				cb(null, staleVal);
			}, 0);
		}

		sendRequest({_resourceKey: resourceKey}, function(err, res){
			if (err){
				staleQueue = new Queue({
					exchangeName: options.methodName + '__stale__',
					key: resourceKey,
					exclusive: true,
					autoDelete: true,
					durable: false,
					ack: false,
				});

				var timeout = setTimeout(function(){
					if (handled) return;
					staleQueue.close();
				}, 5000);

				var handled = false;
				staleQueue(function(msg){
					if (handled) return;
					handled = true;

					clearTimeout(timeout);

					msg._stale = true;
					_setCache(resourceKey, msg);

					cb(null, msg);

					setTimeout(function(){
						staleQueue.close();
					}, 0);

				});
			} else {
				cb(err, res);
			}
		});
	};
};

