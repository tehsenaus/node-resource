var coop = require("coop");
var resource = require("./lib/resource");
var promise = require("node-promise");

var nextUid = 0;
function uid (o) {
	if(!o.__uid) {
		o.__uid = ++nextUid;
	}
	return o.__uid;
}

var InMemoryDb = coop.Options.derived({
	options: {
		
	},

	initialize: function(resource) {
		this.store = {};
		this.latestID = 0;
	},

	list: function (query) {
		var p = new promise.Promise();
		p.resolve( Object.keys(this.store).map(function (k) {
			return this[k];
		}, this.store) );
		return p;
	},

	create: function (data) {
		// TODO: deep clone
		var _data = {};
		var id = _data.id = ++this.latestID;
		for(var n in data) _data[n] = data[n];
		
		this.store[id] = _data;

		var p = new promise.Promise();
		p.resolve(_data);
		return p;
	}
});

var InMemoryChildDb = new coop.Class({
	
});


module.exports = function () {
	var inmem = resource.Resource.serverDataStores.inMemory = function (resource, dataStoreName) {
		return new InMemoryDb(resource, dataStoreName);
	}
	var child = resource.Resource.serverDataStores['inMemory-child'] = function (resource, dataStoreName) {
		return new InMemoryChildDb(resource, dataStoreName);
	}

	resource.Resource.serverDataStores.document = inmem;
	resource.Resource.serverDataStores['document-child'] = child;
}