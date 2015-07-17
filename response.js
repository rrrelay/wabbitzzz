var Exchange = require('./exchange'),
	Queue = require('./queue'),
	ezuuid = require('ezuuid'),
	defaultExchange = new Exchange({type:'fanout'});

module.exports = function(methodName){
	var key = ezuuid();
	var q = new Queue({name: methodName+key, key: methodName, exchangeName: '_rpc_send'});

	var listenOnly = false;

	var fn = function(cb){

		q.ready
			.timeout(10000)
			.then(function(){
				q(function(msg, ack){
					var done = function(err, res){
						if (!listenOnly){
							if (err){
								defaultExchange.publish({_rpcError:true, _message: err.toString()}, {key:msg._rpcKey});
							} else {
								defaultExchange.publish(res, {key:msg._rpcKey});
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
