"use strict"

module.exports = function(app, options){
	var debug 		= require('debug')('authub')
    , log4js    = require('log4js')
    , logger    = log4js.getLogger()
		, express 	= require('express')
		, util 			= require('util')
		, url 			= require('url')
    , jwt 			= require('jsonwebtoken')
    , _         = require("lodash");

	let router 		= express.Router();
	let dbs 			= app.locals.dbs;
	let xConfig 		= app.locals.x_config;	//custom app config

  router.post("/token", function(req, res, next){
    let account           = req.x_account_config;
    let accountName       = account.name;


    //THe POST request put all parameters by x-www-form-urlencoded
    switch(req.body.grant_type){
      case "code":
        var authCode 		= req.body.code
          ,clientId 		= req.body.client_id
          ,clientSecret = req.body.client_secret;

        return res.status(501).json({
            success: false,
            errCode: 501,
            errMsg: "auth_type_not_implemented_yet"
        });
        break;
			case 'client_credential':
        var clientId     = req.body.client_id
          , clientSecret = req.body.client_secret;

        dbs.connectToMaster(function(err, db){
          if(err){
            logger.error(err);
            return res.status(500).json({
              success: false,
              errMsg: err.messag,
              internalError: err
            });
          }
          db.model('Client')
						.findOne({
							_id: clientId
						})
						.populate('account')
						.then(function(client){
              if(!client){
                return res.status(401).json({
                  success: false,
                  errCode: 401,
                  errMsg: "invalid_client_credential"
                });
              }

              client.compareClientSecrect(clientSecret,
									function(err, isMatched){

								console.log("====> ===>", client.account.accessToken);

								if(isMatched === true){
                  var claims = {
                    sub: client.name,
                    id: client._id,
										ut: 'client',
										scope: client.scope,
										account: client.account.name,
                    iss: req.get('host')
                  };

                  var accessToken = jwt.sign(claims, client.account.accessToken.secret
                                  ,{
                                      algorithms: [ client.account.accessToken.algorithm ]
                                      ,expiresIn: 86400
                                  });

                  var refreshToken = jwt.sign(claims, client.account.refreshToken.secret
                                  ,{
                                      algorithms: [ client.account.refreshToken.algorithm ]
                                      ,expiresIn: 30 * 24 * 60 * 60
                                  });

                  return res.json({
                    success: true
                    ,access_token: accessToken
                    ,refresh_token: refreshToken
                  });
                }else{
                  res.status(401).json({
                    success: false,
                    errCode: 401,
                    errMsg: 'invalid_client_credential'
                  });
                }
              })
            })
						.catch(function(err){
							console.error(err);
							return res.status(403).json({
								success: false,
								errMsg: "error_in_authenticate_client"
							})
						});
        });

        break;
      case "password":
        var username = req.body.username
          ,password = req.body.password;
				dbs.connectToMaster(function(err, db){
					if(err){
						logger.error(err);
						return res.status(500).json({
							success: false,
							errMsg: err.messag,
							internalError: err
						});
					}
					db.model('Account').getAuthenticated(username, password,
						function(err, user, reason){
								if(err){
									logger.error(err);
									return res.status(403).json({
										success: false,
										errCode: 403,
										errMsg: err.message,
										internalError: err
									});
								}

								if(user !== null){ //success
									//Generate JWT token
									var claims = {
										sub: user.username,
										ut: 'admin',
										iss: req.get('host')
									};
									var accessToken = jwt.sign(claims, user.accessToken.secret
																	,{
																			algorithms: [ user.accessToken.algorithm ]
																			,expiresIn: user.accessToken.expiresIn
																	});

									var refreshToken = jwt.sign(claims, user.refreshToken.secret
																	,{
																			algorithms: [ user.refreshToken.algorithm ]
																			,expiresIn: user.refreshToken.expiresIn
																	});
									return res.json({
										success: true
										,access_token: accessToken
										,refresh_token: refreshToken
									});
								}else{
									return res.json({
										success: false,
										errCode: '401',
										errMsg: 'authentication_failed'
									});
								}
							});
				});
        break;
      case 'client_credential':
				return res.status(501).json({
						success: false,
						errCode: 501,
						errMsg: "auth_type_not_implemented_yet"
				});
        break;
			case 'refresh_token':
				//Refresh token logic
				debug("refresh_token: ", req.body.refresh_token);

				var refreshToken = req.body.refresh_token;
				if(!refreshToken){
					return res.status(403).json({
						success: false,
						errCode: 403,
						errMsg: "invalid_refresh_token"
					});
				}else{
					dbs.connectToMaster(function(err, db){
						if(err){
							logger.error(err);
							return res.status(500).json({
								success: false,
								errMsg: err.messag,
								internalError: err
							});
						}

						db.model("Account").findOne({
							name: accountName
						})
						.then(function(accountInstance){
							if(!accountInstance){
								return res.status(403).json({
									success: false,
									errMsg: "account_does_not_exist"
								})
							}
							let accessTokenSecret = accountInstance.accessToken.secret;
					    let accessTokenExpiresIn  = accountInstance.accessToken.expiresIn;
					    let accessTokenAlgorithm = accountInstance.accessToken.algorithm;
					    let refreshTokenSecret    = accountInstance.refreshToken.secret;
					    let refreshTokenExpiresIn = accountInstance.refreshToken.expiresIn;
					    let refreshTokenAlgorithm = accountInstance.refreshToken.algorithm;

							jwt.verify(refreshToken, refreshTokenSecret, { algorithms: [ refreshTokenAlgorithm ] }
			            ,function(err, token){

											debug("verified: ", token);
											if(err){
												console.error(err);
												return res.status(403).json({
													success: false,
													errCode: 403,
													errMsg: "invalid_refresh_token"
												});
											}

											if(token.ut === "admin"){
												var claims = {
													sub: accountInstance.username,
													ut: 'admin',
													iss: req.get('host')
												};


												var accessToken = jwt.sign(claims, accountInstance.accessToken.secret
																				,{
																						algorithms: [ accountInstance.accessToken.algorithm ]
																						,expiresIn: accountInstance.accessToken.expiresIn
																				});

												var refreshToken = jwt.sign(claims, accountInstance.refreshToken.secret
																				,{
																						algorithms: [ accountInstance.refreshToken.algorithm ]
																						,expiresIn: accountInstance.refreshToken.expiresIn
																				});
												return res.json({
													success: true
													,access_token: accessToken
													,refresh_token: refreshToken
												});
											}else{
												db.model('Client')
							            .findById(token.id, function(err, client){
							              if(err){
							                debug(err);
							                return res.status(500).json({
							                  success: false,
							                  errCode: 500,
							                  errMsg: err.messag,
							                  internalError: err
							                });
							              }

							              if(!client){
							                return res.status(401).json({
							                  success: false,
							                  errCode: 401,
							                  errMsg: "invalid_client_credential"
							                });
							              }

														var claims = {
					                    sub: client.name,
															id: client._id,
															ut: 'client',
															scope: client.scope,
					                    iss: req.get('host')
					                  };
														var accessToken = jwt.sign(claims, client.account.accessToken.secret
					                                  ,{
					                                      algorithms: [ client.account.accessToken.algorithm ]
					                                      ,expiresIn: 86400
					                                  });

					                  var refreshToken = jwt.sign(claims, client.account.refreshToken.secret
					                                  ,{
					                                      algorithms: [ client.account.refreshToken.algorithm ]
					                                      ,expiresIn: 30 * 24 * 60 * 60
					                                  });
					                  return res.json({
					                    success: true
					                    ,access_token: accessToken
					                    ,refresh_token: refreshToken
					                  });
							            });
											}
										})
						})
					});
				}
				break;
      default:
        return res.status(403).json({
          success: false,
          message: "non_supported_grant_type"
        });
		}
  });

	app.use('/oauth2admin', router);
}