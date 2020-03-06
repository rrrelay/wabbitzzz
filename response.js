var exchange = require('./exchange'),
	_queue = require('./queue'),
	ezuuid = require('ezuuid'),
	_ = require('lodash');

var DEFAULTS = {
	appName: '',
	ttl: 10000,
	shared: false,
};

var exchanges = {};
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
const MainExchange = exchange();
var defaultExchangeDict = {
	main: new MainExchange(),
};

function response (connString){
	var options = createOptions.apply(null, _.toArray(arguments).slice(1)),
		key = ezuuid(),
		methodName = options.methodName,
		queueName = options.appName + methodName + (options.shared ? '' : ('_' + key)) + '_rpc', // trailing _rpc important for policy regex
		Queue = _queue({ connString }),
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
			.timeout(80000)
			.then(function(){
				queue(function(msg){
					var done = function(err, res){
						var publishOptions = {
							key: msg._replyTo,
							persistent: false,
							correlationId: msg._correlationId,
						};

						if (!listenOnly){
							const conn = connString ? connString : 'main';
							if (err){
								return defaultExchangeDict[conn].publish({
									_rpcError:true,
									_message: err.toString(),
								}, publishOptions);
							} else {
								return defaultExchangeDict[conn].publish(res, publishOptions);
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
	fn.ready = queue.ready;

	return fn;
};

module.exports = function (opt = {}) {
	if (opt.connString && !defaultExchangeDict[opt.connString]) {
		const AltExchange = exchange(opt);
		defaultExchangeDict[opt.connString] = new AltExchange();
	}
	return _.partial(response, opt.connString)
}
module.exports.createOptions = createOptions;
