var exchange = require('./exchange'),
	queue = require('./queue'),
	ezuuid = require('ezuuid'),
	_ = require('lodash');

var DEFAULTS = {
	appName: '',
	ttl: 10000,
	shared: false,
};

function createOptions(methodName, options){
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

var defaultExchangeDict = {
	main: exchange()(),
};

module.exports = function(opt){
	const Queue = queue(opt);
	return function () {
		var options = createOptions.apply(null, _.toArray(arguments)),
			key = ezuuid(),
			methodName = options.methodName,
			queueName = options.appName + methodName + (options.shared ? '' : ('_' + key)) + '_rpc', // trailing _rpc important for policy regex
			myQueue = new Queue({
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

			myQueue.ready
				.timeout(80000)
				.then(function(){
					myQueue(function(msg){
						var done = function(err, res){
							var publishOptions = {
								key: msg._replyTo,
								persistent: false,
								correlationId: msg._correlationId,
							};

							if (!listenOnly){
								var exchKey = opt.connString ? opt.connString : 'main';
								if (exchKey && !defaultExchangeDict[exchKey]) {
									defaultExchangeDict[exchKey] = exchange(opt)();
								}
								if (err){
									return defaultExchangeDict[exchKey].publish({
										_rpcError:true,
										_message: err.toString(),
									}, publishOptions);
								} else {
									return defaultExchangeDict[exchKey].publish(res, publishOptions);
								}
							}
						};
						msg._listenOnly = listenOnly;

						try {
							// this is not strictly necessary, but helps avoid bugs for the moment
							delete msg._exchange;
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
		fn.ready = myQueue.ready;

		return fn;

	}
};
module.exports.createOptions = createOptions;
