var Queue = require('./queue'),
	Exchange = require('./exchange'),
	ezuuid = require('ezuuid');

describe('exchange', function(){
	it('should be able to publish to the default exchange', function(done){
		this.timeout(5000);

		var message = ezuuid(),
			queueName = ezuuid(),
			defaultExchanage = new Exchange();

		defaultExchanage.on('ready', function(){
			var queue = new Queue({
				autoDelete: true,
				exclusive: true,
				name: queueName,
				ready: function(){
					defaultExchanage.publish(
							{message:message}, 
							{key:queueName}
						);
				}
			});

			queue(function(msg, ack){
				if (msg.message !== message) return done('got a message I shouldnt have');

				ack();
				done();
			});

		});
	});
});
