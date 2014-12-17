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

	it('should be able to publish a delayed message', function(done){
		this.timeout(10000);

		var message = ezuuid(),
			exchangeName = ezuuid();

		var beginTicks;

		var exchange = new Exchange({name: exchangeName});
		exchange.on('ready', function(){
			var queue = new Queue({
				autoDelete: true,
				exclusive: true,
				exchangeNames: [exchangeName],
				ready: function(){
					beginTicks = Date.now();

					exchange.delayedPublish({message: message}, {delay:2000});
				}
			});

			queue(function(msg, ack){
				if (msg.message !== message) return done('got a message I shouldnt have');

				var timeDiff = Date.now() - beginTicks;

				if (timeDiff<=2000){
					return done(new Error('too fast'));
				}

				ack();
				done();
			});
		});

	});
});
