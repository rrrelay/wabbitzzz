var CONN_STRING = process.env.WABBITZZZ_URL || 'amqp://localhost';
var amqplib = require('amqplib');
var q = require('q');
var ezuuid = require('ezuuid');
var _ = require('lodash');

var initChannel = q(amqplib.connect(CONN_STRING))
	.then(function(conn) {
		process.once('SIGINT', conn.close.bind(conn));
		console.log('got the connection');
		return conn.createChannel();
	})
	.then(function(chan){
		var options = { noAck: true };
		return chan.consume('amq.rabbitmq.reply-to',_handleResponse, options)
			.then(function(){
				return chan.assertExchange('_rpc_send_direct', 'direct', { durable: true });
			})
			.then(function(){
				return chan;
			});
	})
	.catch(function(err){
		console.error(err);
	});

function _handleResponse(response){
	if (!response || !response.properties || !response.properties.correlationId){
		return console.dir('error, bad response.', response);
	}

	var correlationId = response.properties.correlationId;
	var requestEntry = requestLookup[correlationId];

	if (!requestEntry){
		return console.dir('error, unknown correlationId.');
	}

	clearTimeout(requestEntry.timeout);

	var msg = JSON.parse(response.content.toString());
	console.dir(msg);
	requestEntry.cb(null, msg);
}

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

var requestLookup = {};
module.exports = function(){
	var options = createOptions.apply(null, _.toArray(arguments));
	var methodName = options.methodName;

	return function(req, cb){
		var correlationId = ezuuid();
		var requestEntry = requestLookup[correlationId] = {
			cb: cb,
		};
		return initChannel
			.then(function(chan){
				var options = {
					key: methodName,
					correlationId: correlationId,
					persistent: false,
					replyTo: 'amq.rabbitmq.reply-to',
					contentType: 'application/json',
				};

				return chan.publish('_rpc_send_direct', methodName, new Buffer(JSON.stringify(req)), options);
			})
			.then(function(){
				requestEntry.timeout = setTimeout(function(){
					cb(new Error('timeout'));
				}, options.timeout);
			})
			.catch(function(err){
				console.error(err);
			});
	};

};
module.exports.createOptions = createOptions;
