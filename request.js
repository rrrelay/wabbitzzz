var Exchange = require('./exchange'),
	Queue = require('./queue'),
	ezuuid = require('ezuuid'),
	_ = require('lodash');

var ex = new Exchange({type:'direct', name: '_rpc_send'});

var DEFAULTS = {timeout: 3000};
module.exports = function(methodName, options){
	switch (typeof methodName){
		case 'string':
			options = Object(options);
			options.methodName = methodName;
			break;
		case 'object':
			options = methodName;
	}

	methodName = options.methodName;
	options = _.extend({}, DEFAULTS, options);

	return function(req, cb){
		var key = req._rpcKey = ezuuid();

		return ex.ready.then(function(){
			var q = new Queue({
				autoDelete: true,
				exclusive: true,
				durable: false,
				exchangeName: methodName,
				key: key,
				name: 'get_response_' +methodName+'_'+ key,
				ready: function(){
					ex.publish(req, {key: methodName, persistent: false});
				},
			});

			q.ready
				.catch(function(err){
					cb(err);
				});

			q(function(msg, ack){
				clearTimeout(myTimeout);
				try {
					if (cb)cb(null, msg);
				} catch (e){
					console.error(e);
				}
				ack();
				q.destroy();
			});


			var myTimeout = setTimeout(function(){
				q.destroy();
				cb(new Error('timeout'));
			}, options.timeout);
			
		});

	};

};
