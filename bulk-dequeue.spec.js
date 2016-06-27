var bulkDequeue = require('./bulk-dequeue'),
	Promise = require('bluebird'),
	_ = require('lodash'),
	Exchange = require('./exchange'),
	ezuuid = require('ezuuid'),
	expect = require('chai').expect;


describe('bulk-dequeue', function(){
	it('should get two messages at once', function(done){
		this.timeout(5000);

		var exchangeName = ezuuid();
		var message1 = ezuuid();
		var message2 = ezuuid();

		var exchange1 = new Exchange({name: exchangeName, autoDelete: true});

		exchange1.on('ready', function(){
			var readMessages = function(messages, ack){
				var msg = _.first(messages);
				if (msg.key !== message1 && msg.key !== message2) {
					return done('got a message I shouldnt have');
				}
				var msg = _.first(_.rest(messages));
				if (msg.key !== message1 && msg.key !== message2) {
					return done('got a message I shouldnt have');
				}

				ack();
				done();
			};

			var queue = bulkDequeue({
				autoDelete: true,
				delay: 500,
				maxDelay: 5000,
				exchangeNames: [exchangeName],
				ready: function(){
					exchange1.publish({key:message1});
					exchange1.publish({key:message2});
				},
			}, readMessages);


		});
	});
	it('should get two batches', function(done){
		this.timeout(5000);

		var exchangeName = ezuuid();
		var message1 = ezuuid();
		var message2 = ezuuid();
		var message3 = ezuuid();

		var exchange1 = new Exchange({name: exchangeName, autoDelete: true});

		exchange1.on('ready', function(){
			var firstBatchGood = false;
			var readMessages = function(messages, ack){
				var msg;
				if (!firstBatchGood){
					msg = _.first(messages);
					if (msg.key !== message1 && msg.key !== message2) {
						return done('1: got a message I shouldnt have.');
					}
					msg = _.first(_.rest(messages));
					if (msg.key !== message1 && msg.key !== message2) {
						return done('2: got a message I shouldnt have.');
					}
					firstBatchGood = true;
					ack();
				} else {
					msg = _.first(messages);
					if (msg.key !== message3) {
						return done('3: got a message I shouldnt have.');
					}
					done();
				}
			};

			var queue = bulkDequeue({
				autoDelete: true,
				delay: 500,
				maxDelay: 5000,
				exchangeNames: [exchangeName],
				ready: function(){
					exchange1.publish({key:message1});
					exchange1.publish({key:message2});
					setTimeout(function(){
						exchange1.publish({key:message3});
					}, 1000);
				},
			}, readMessages);


		});
	});
});
