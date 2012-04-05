
var coop = require("coop");
var promise = require("node-promise");

var exports = module.exports = {};

var Resource = exports.Resource = new coop.Class([coop.Options], {
	initialize: function(options) {
		this.super.apply(this, arguments);
	}
});
var DelegateResource = exports.DelegateResource = Resource.derived({
	initialize: function (resource) {
		this.super.apply(this, coop.pop(arguments));
		this.resource = resource;
	},

	list: function () {
		return this.resource.list.apply(this.resource, arguments);
	},
	read: function () {
		return this.resource.read.apply(this.resource, arguments);
	},
	create: function () {
		return this.resource.create.apply(this.resource, arguments);
	},
	update: function () {
		return this.resource.update.apply(this.resource, arguments);
	},
	delete: function () {
		return this.resource.delete.apply(this.resource, arguments);
	},
	createQueryFromSlug: function () {
		return this.resource.createQueryFromSlug.apply(this.resource, arguments);
	}
});
var DataStoreResource = exports.DataStoreResource = DelegateResource.derived({
	dataStoreType: 'document',

	initialize: function () {
		this.super.apply(this, coop.push(arguments, this.dataStore = this.dataStoreFactory(this.dataStoreType, this)));
	}
});


var ChildResource = exports.ChildResource = DataStoreResource.derived({
	dataStoreType: 'document-child',

	initialize: function (parentModelClass) {
		this.parentModelClass = parentModelClass;
		this.super.apply(this, coop.pop(arguments));
	},
	list: function () {
		return this.resource.list.apply(this.resource, arguments);
	},
	read: function () {
		return this.resource.read.apply(this.resource, arguments);
	},
	create: function () {
		return this.resource.create.apply(this.resource, arguments);
	},
	update: function () {
		return this.resource.update.apply(this.resource, arguments);
	},
	delete: function () {
		return this.resource.delete.apply(this.resource, arguments);
	}
});


var Model = exports.Model = new coop.Class({
	slugField: 'id',

	initialize: function (context, data) {
		this.update(data);
	},
	update: function (data) {
		
	},
	bake: function () {
		return {};
	},

	validate: function (context) {},
	validateCreate: function (context) {
		return this.validate(context);
	},
	save: function (context) {
		var me = this;
		context = context || exports.globalContext;
		return promise.when(this.validate(context), function () {
			return me.resource.update(context, me.getModelQuery(), me);	
		});
	},

	// wrapper for dynamic model fields.
	field: function (value) {
		var value;
		return function () {
			if(arguments.length > 0) {
				value = arguments[0];
			} else {
				return value;
			}
		}
	}
});
// Creates a concrete subclass of this model class, bound
// to a resource. Any child resources are initialized.
Model.instantiate = function (resource) {
	var model = this.derived({
		resource: resource
	});

	for(var n in model.prototype) {
		var item = model.prototype[n];
		if(ChildResource.issuperclass(item)) {
			model.prototype[n] = new item(model);
		}
	}

	return model;
}


var ModelResource = exports.ModelResource = new coop.Class({
	Model: function () {
		throw "Model class not defined!";
	},

	initialize: function () {
		this.super.apply(this, arguments);
		this.Model = Model.instantiate.call(this.Model, this);
	},

	list: function (context) {
		var me = this;
		return this.super.apply(this, arguments).then(function (data) {
			return data.map(function (i) {
				return me.ctor(context, i);
			});
		});
	},

	create: function (context, data) {
		var me = this,
			model = this.ctor(context, data, true),
			args = [].slice.call(arguments);

		return promise.when(model.validateCreate(context), function () {
			args[1] = model;
			return ModelResource.super(me, 'create').apply(me, args);
		});

		/*for(var n in this.Model.prototype) {
			var child = this.Model.prototype[n];
			if(ChildResource.isinstance(child)) {
				data[child.name] = [];
			}
		}*/
	},
	update: function (context, query, data) {
		var me = this;
		if(this.Model.isinstance(data)) {
			return this.super(context, query, data);
		} else return this.list(context, query).then(function (objects) {
			if(objects.length == 1) {
				var model = objects[0];
				model.update(data);
				return model.save(context);
			} else {
				return promise.defer().reject("Query returned " + objects.length + " results, required 1");
			}
		})
	},

	// Creates an instance of the model from baked data
	ctor: function (context, data, creating) {
		return new this.Model(context, data, creating);
	},
	createQueryFromSlug: function (slug) {
		var query = {};
		query[this.Model.prototype.slugField] = slug;
		return query;
	}
});

exports.serialize = function (x, context) {
	return typeof x.bake === "function" ? x.bake(context) : x;
}



var ClientPublicResource = new coop.Class([Resource], {
	initialize: function (resourceURL, resource) {
		this.resource = resource;
		this.resourceURL = resourceURL;
	},
	list: function (query) {
		return jQuery.get(this.resourceURL, query).then(function (items) {
			return items.map(function (data) {
				return this.resource.ctor(data);
			}, this);
		});
	},
	read: function (id, query) {
		return jQuery.get(this.resourceURL + "/" + id, query).then(function (data) {
			return this.resource.ctor(data);
		});
	},
	create: function (data, query) {
		// TODO: query
		return jQuery.post(this.resourceURL, data).then(function (data) {
			return this.resource.ctor(data);
		});
	},
	update: function () {
		// TODO
	},
	delete: function () {
		// TODO
	}
});




