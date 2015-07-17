var Exchange = require('./exchange'),
	Queue = require('./queue'),
	ezuuid = require('ezuuid');

var ex = new Exchange({type:'topic', name: '_rpc_send'});

module.exports = function(methodName){

	return function(req, cb){
		var key = req._rpcKey = ezuuid();

		return ex.ready.then(function(){
			var q = new Queue({
				autoDelete: true,
				exclusive: true,
				exchangeName: methodName,
				key: key,
				name: 'baloney' + key,
				ready: function(){
					ex.publish(req, {key: methodName});
				},
			});

			q(function(msg, ack){
				try {
					if (cb)cb(null, msg);
				} catch (e){
					console.error(e);
				}
				ack();
				q.destroy();
			});
			
		});

	};

};
