"use strict"

module.exports = function(app, settings){
	var debug 		= require('debug')('authub')
		,nodemailer	= require('nodemailer')
		, log4js		= require('log4js')
		, logger 		= log4js.getLogger()
		, express 	= require('express')
		, util 			= require('util')
		, url 			= require('url')
		, validator = require('validator');

	var router 		= express.Router();
	var dbs 			= app.locals.dbs;


	router.get("/activate", function(req, res, next){
		var account = req.x_account_config.name;
		//Activate administrator user, get identity from res.locals.vericode_token;
		var vericodeToken = res.locals.vericode_token;

		var identity = vericodeToken.identity;
		if(!identity){
			return res.status(403).json({
				success: false,
				errCode: 403,
				errMsg: "invalid_identity"
			});
		}

		if(validator.isEmail(identity)){
			//It's email verification
			dbs.connectToMaster(function(err, db){
	      if(err){
	        logger.error(err);
	        return res.status(500);
	      }

	      db.model('Account')
	        .findOne({ email: identity })
	        .then(function(instance){
						if(!instance){
							return res.status(403).json({
								success: false,
								errCode: 403,
								errMsg: "invalid_identity"
							});
						}
						instance.activated = true;

						return instance.save();
	        })
					.then(function(){
						return res.status(200).json({
	            success: true
	          });
					})
	        .catch(function(err){
	          logger.error(err);
	          return res.status(500).json({
							success: false,
							errCode: 500,
							errMsg: err.message
						});
	        });
	    });
		}else{
			return res.status(501).json({
				success: false,
				errMsg: "not_supported"
			})
		}
	});

  router.get("/config", function(req, res, next){

    if(req.identity.ut !== 'client'){
      return res.status(403).json({
        success: false,
        errMsg: "invalid_identity_type"
      })
    }

    var accountName = req.query.account;

    dbs.connectToMaster(function(err, db){
      if(err){
        logger.error(err);
        return res.status(500).json({
          success: false,
          errMsg: err.message,
          error: err.errors
        });
      }

      db.model('Account')
        .findOne({ name: accountName })
        .then(function(instance){
          if(!instance){
            return res.status(403).json({
              success: false,
              errCode: 403,
              errMsg: "invalid_account"
            });
          }

          return res.json({
            success: true,
            data: {
              accessToken: instance.accessToken
            }
          });
        })
        .catch(function(err){
          logger.error(err);
          return res.status(500).json({
            success: false,
            errMsg: err.message,
            error: err.errors
          });
        });
    });
  })

  router.post("/reset_password", function(req, res, next){
		var newPassword = req.body.new_password;
		var oldPassword = req.body.old_password;
		var isAdmin = req.body.isAdmin;

		console.log("request identity:", req.identity);

		var username = req.identity.sub;

		dbs.connectToMaster(function(err, db){
			if(err){
				logger.error(err);
				throw err;
			}

			db.model('Account')
				.resetPassword(username,
						oldPassword, newPassword, isAdmin, function(err, user){
							if(err) throw err;

							return res.status(200).json({
								success: true
							});
						});
		});
	});



	app.use('/accounts', router);
}
