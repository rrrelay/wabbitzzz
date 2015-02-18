var Queue = require('./queue'),
	q = require('q'),
	_ = require('lodash'),
	Exchange = require('./exchange'),
	ezuuid = require('ezuuid'),
	expect = require('chai').expect;


describe('queue', function(){
	it('should be able to bind to a single exchange', function(done){
		this.timeout(5000);

		var exchangeName = ezuuid();
		var message = ezuuid();

		var exchange1 = new Exchange({name: exchangeName, autoDelete: true});

		exchange1.on('ready', function(){

			console.log('hello');
			var queue = new Queue({
				autoDelete: true,
				exclusive: true,
				exchangeName: exchangeName,
				ready: function(){
					exchange1.publish({key:message});
				},
			});

			queue(function(msg, ack){
				if (msg.key !== message) return done('got a message I shouldnt have');

				ack();
				done();
			});

		});
	});

	it('should be able to bind to a single exchange with the exchangeNames property', function(done){
		this.timeout(5000);

		var exchangeName = ezuuid();
		var message = ezuuid();

		var exchange1 = new Exchange({name: exchangeName, autoDelete: true});

		exchange1.on('ready', function(){

			var queue = new Queue({
				autoDelete: true,
				exclusive: true,
				exchangeNames: [exchangeName],
				ready: function(){
					exchange1.publish({key:message});
				},
			});

			queue(function(msg, ack){
				if (msg.key !== message) return done('got a message I shouldnt have');

				ack();
				done();
			});

		});
	});

	it('should be able to bind to multiple exchanges', function(done){
		this.timeout(5000);

		var exchangeName1 = ezuuid(),
			exchangeName2 = ezuuid(),
			message1 = ezuuid(),
			message2 = ezuuid();

		var exchange1 = new Exchange({name: exchangeName1, autoDelete: true, durable: false});
		var exchange2 = new Exchange({name: exchangeName2, autoDelete: true, durable: false});

		q.all([exchange1.ready, exchange2.ready])
			.then(function(){
				var queue = new Queue({
					autoDelete: true,
					exclusive: true,
					exchangeNames: [exchangeName1, exchangeName2]
				});

				var gotMessage1 = false, 
					gotMessage2 = false;
				
				queue(function(msg, ack){
					if (msg.key === message1) {
						gotMessage1 = true;
					}
					if (msg.key === message2) {
						gotMessage2 = true;
					}

					ack();

					if (gotMessage1 && gotMessage2){
						done();
					}
				});

				_.delay(exchange1.publish, 200, {key:message1});
				_.delay(exchange2.publish, 200, {key:message2});
			});
	});

	it('should include the _exchange property', function(done){
		this.timeout(5000);

		var exchangeName = ezuuid();
		var message = ezuuid();

		var exchange1 = new Exchange({name: exchangeName, autoDelete: true});

		exchange1.on('ready', function(){

			var queue = new Queue({
				autoDelete: true,
				exclusive: true,
				exchangeName: exchangeName,
				ready: function(){
					exchange1.publish({key:message});
				},
			});

			queue(function(msg, ack){
				if (msg.key !== message) return done('got a message I shouldnt have');

				if (msg._exchange !== exchangeName) return done('bad _exchangeName');

				ack();
				done();
			});

		});
	});

});
