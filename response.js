var Exchange = require('./exchange'),
	Queue = require('./queue'),
	ezuuid = require('ezuuid');

var exchanges = {};
module.exports = function(methodName){
	var key = ezuuid(),
		exchange = exchanges[methodName] || new Exchange({type: 'topic', name: methodName}),
		queue = new Queue({name: methodName+key, key: methodName, exchangeName: '_rpc_send'});

	var listenOnly = false;

	var fn = function(cb){

		queue.ready
			.timeout(10000)
			.then(function(){
				queue(function(msg, ack){
					var done = function(err, res){
						if (!listenOnly){
							if (err){
								exchange.publish({_rpcError:true, _message: err.toString()}, {key:msg._rpcKey});
							} else {
								exchange.publish(res, {key:msg._rpcKey});

							}
						}
						ack();
					};

					cb(null, msg, done);
				});
			})
			.catch(function(err){
				cb(err);
			});


	};
	fn.enable =function(){ listenOnly = false; };
	fn.disable = function(){ listenOnly = true; };
	return fn;
};
