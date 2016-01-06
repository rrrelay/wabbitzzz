var Exchange = require('./exchange'),
	Queue = require('./queue'),
	ezuuid = require('ezuuid'),
	_ = require('lodash');

var ex = new Exchange({type:'direct', name: '_rpc_send_direct'});

var DEFAULTS = {timeout: 3000};
function createOptions(methodName, options){
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
	return options;
}

module.exports = function(){
	var options = createOptions.apply(null, _.toArray(arguments));
	var methodName = options.methodName;

	return function(req, cb){
		var key = req._rpcKey = ezuuid();

		return ex.ready.then(function(){

			var q = new Queue({
				ack: false,
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
					console.log('something happened');
					cb(err);
				});



			q(function(msg){
				clearTimeout(myTimeout);
				try {
					if (cb){
						if (msg._rpcError){
							cb(msg);
						} else{
							cb(null, msg);
						}
					}
				} catch (e){
					console.error(e);
				}

				q.close();
			});


			var myTimeout = setTimeout(function(){
				cb(new Error('timeout'));
				q.close();
			}, options.timeout);
			
		});

	};

};
module.exports.createOptions = createOptions;
