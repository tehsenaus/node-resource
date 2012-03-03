
var resource = module.exports = require('./lib/resource');

var ServerDataStore = resource.ServerDataStore = resource.Resource.derived({
	
});

resource.Resource.implement({
	dataStoreFactory: function (type, resource) {
		return new ServerDataStore();
	}
});

resource.export = function (resources) {
	return resources;
}
