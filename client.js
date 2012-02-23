
var resource = module.exports = require('resource');

resource.Resource.implement({
	dataStoreFactory: function (type, resource) {
		return null;
	}
});

