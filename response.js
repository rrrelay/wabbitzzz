var Exchange = require('./exchange'),
	Queue = require('./queue'),
	defaultExchange = new Exchange({type:'fanout'});

module.exports = function(methodName){
	var q = new Queue({name: methodName});

	return function(cb){
		q.ready
			.timeout(10000)
			.then(function(){
				q(function(msg, ack){
					var done = function(err, res){
						if (err){
							defaultExchange.publish({_rpcError:true, _message: err.toString()}, {key:msg._rpcKey});
						} else {
							defaultExchange.publish(res, {key:msg._rpcKey});
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
};
