var Exchange = require('./exchange'),
	Queue = require('./queue'),
	ezuuid = require('ezuuid'),
	_ = require('lodash');

var DEFAULTS = {
	appName: '',
	ttl: 10000,
	shared: false,
};

var exchanges = {};
function _createOptions(methodName, options){
	switch (typeof methodName){
		case 'string':
			options = Object(options);
			options.methodName = methodName;
			break;
		case 'object':
			options = methodName;
	}

	options = _.extend({}, DEFAULTS, options);

	if (options.appName && !/_$/.test(options.appName)) 
		options.appName += '_';


	return options;
}

module.exports = function(){
	var options = _createOptions.apply(null, _.toArray(arguments)),
		key = ezuuid(),
		methodName = options.methodName,
		exchange = exchanges[methodName] || new Exchange({
			type: 'topic', 
			name: methodName,
		}),
		queueName = options.appName + methodName + (options.shared ? '' : ('_' + key)),
		queue = new Queue({
			name: queueName,
			ack: false,
			exclusive: !options.shared,
			autoDelete: true,
			durable: false,
			key: methodName,
			exchangeName: '_rpc_send_direct',
			arguments: {
				'x-message-ttl': options.ttl,
			},
		});

	var listenOnly = false;

	var fn = function(cb){

		queue.ready
			.timeout(10000)
			.then(function(){
				queue(function(msg){
					var done = function(err, res){
						if (!listenOnly){
							if (err){
								exchange.publish({
									_rpcError:true, 
									_message: err.toString(),
								}, {
									key:msg._rpcKey,
									persistent: false, 
								});
							} else {
								exchange.publish(res, {key:msg._rpcKey, persistent: false});
							}
						}
					};

					try {
						cb(null, msg, done);
					} catch (err){
						console.log('unhandled error while processing ' + methodName);
						console.error(err);
						cb(err);
					}
				});
			})
			.catch(function(err){
				console.error(err);
				cb(err);
			});


	};
	fn.enable =function(){ listenOnly = false; };
	fn.disable = function(){ listenOnly = true; };
	fn.ready = queue.ready;

	return fn;
};
