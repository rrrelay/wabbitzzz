var response = require('./response'),
	request = require('./request'),
	ezuuid = require('ezuuid'),
	expect = require('chai').expect;

describe('queue', function(){
	it('should be able to make rpc calls', function(done){
		this.timeout(10000);
		var listen = response('aaa');
		var key = ezuuid();

		listen(function(err, req, cb){
			cb(null, {msg:key});
		});

		setTimeout(function(){
			request('aaa')({}, function(err, res){
				expect(res.msg).to.be.equal(key);
				done();
			});
		}, 2000);
	});
});

