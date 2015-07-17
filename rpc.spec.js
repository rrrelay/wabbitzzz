var request = require('./request'),
	q  = require('q'),
	_  = require('lodash'),
	response = require('./response'),
	ezuuid = require('ezuuid'),
	expect = require('chai').expect;

describe('queue', function(){
	it('should be able to make rpc calls', function(done){
		this.timeout(10000);

		var METHOD_NAME = 'yeah666';
		var listenOnly = response(METHOD_NAME);
		var listen = response(METHOD_NAME);
		var key = ezuuid();

		listenOnly.disable();

		listenOnly(function(err, req, cb){
			console.log('no one listens to me!: ' + req.msg);
			cb(null, {msg:'just listening...'});
		});

		listen(function(err, req, cb){
			console.log('i gots the good responses');
			cb(null, {msg:req.msg+ '_' + key});
		});

		setTimeout(function(){
			_.chain(_.range(6))
				.map(function(){return q.defer();})
				.map(function(d, i){
					request(METHOD_NAME)({msg: i}, function(err, res){
						if (err) return d.reject(err);

						var expected = i + '_'+key;
						expect(res.msg).to.be.equal(expected);
						console.log('i got back: ' + expected);
						d.resolve();
					});
					return d.promise;
				})
				.thru(q.all)
				.value()
				.then(function(){
					done();
				})
				.catch(done);
		}, 2000);
	});
});

