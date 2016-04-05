"use strict"

let mongoose 	= require('mongoose');
let Schema 		= mongoose.Schema;

let _ 						= require("lodash")
	, bcrypt	 			= require('bcrypt-as-promised') //A promise version of bcrypt
	, randomstring 	= require("randomstring")
	, debug					= require('debug')('authub')
	, Promise 			= require('bluebird');

//-- Delcare Variables --//
var SALT_WORK_FACTOR 	= 10;

let ClientSchema = new Schema({
	name: String,
	secret: { type: String, require: true, default: randomstring.generate(32) },
  account: { type: String, required: true },
	createdAt : { type: Date, default: Date.now },
	updatedAt : { type: Date },
	deletedAt : { type: Date }
});


ClientSchema.pre('save', function(next) {
    var client = this;

    // only hash the password if it has been modified (or is new)
    if (!client.isModified('secret')) return next();

    // generate a salt
    return bcrypt.genSalt(SALT_WORK_FACTOR)
      .then(function(salt) {
        // hash the password using our new salt
				//We don't need to persist the SALT because it has already been incorprated into the hash
				// http://stackoverflow.com/questions/277044/do-i-need-to-store-the-salt-with-bcrypt
        return bcrypt.hash(client.secret, salt);
      })
      .then(function(hash){
        client.secret = hash;
        return next();
      })
      .catch(function(err){
        debug(err);
        return next(err);
      });
});


ClientSchema.statics.generateClient = function(account, cb){
		var clientSecretClearText = randomstring.generate(64);
		var Client = this;

		var client = new Client({
			secret: clientSecretClearText,
			account: account
		});

		client.save(function(err, client){
				if( err ) return cb(err);
				var data = client.toJSON();
				data.clientSecretClearText = clientSecretClearText;
				debug("client create success: ", data);
				return cb(null, data);
		});
};

ClientSchema.statics.generateClientAsync = Promise.promisify(ClientSchema.statics.generateClient);


ClientSchema.methods.compareClientSecrect = function(candidateSecret, cb){
	var client = this;;

	bcrypt.compare(candidateSecret, client.secret)
			.then( function(isMatch) {
					return cb(null, isMatch);
			})
			.catch(function(err){
					return cb(err);
			});
}

module.exports = mongoose.model('Client', ClientSchema);