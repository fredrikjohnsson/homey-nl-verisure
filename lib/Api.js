'use strict';

const Homey = require('homey');
var request = require('request');
var xml2js = require('xml2js');

var timer = ms => new Promise( res => setTimeout(res, ms));

class VerisureApi {
	
	constructor() {
		
		this._SERVERS = ['e-api01.verisure.com', 'e-api02.verisure.com'];
		this._BASE_HOST = Homey.ManagerSettings.get('base_host');
		
		if(this._BASE_HOST == null) {
			this._BASE_HOST = 'e-api02.verisure.com';
		}

		this._BASE_URL = 'https://' + this._BASE_HOST + '/xbn/2';


	}

	delay () {
		
		timer(30000).then(_=>console.log("done"));
		
	}

	serverSelect() {
		
		if(Homey.ManagerSettings.get('username')) {

		console.log("serverSelect; username found.");	
			var bla = this;
			var servers = this._SERVERS;

			for (var i = 0; i < servers.length; i++) {
				var server = servers[i];
				console.log("serverSelect [" + i + "]; try " + server);

				var userid = Homey.ManagerSettings.get('username');
				var password = Homey.ManagerSettings.get('password');
				var cred = Buffer.from("CPE/" + userid + ":" + password).toString('base64');

				var opt = {
					port: 443,
					url: 'https://' + server + '/xbn/2' + '/cookie',
					method: 'POST',
					headers: {
						'Host' : server,
						  'Content-Type': 'application/xml;charset=UTF-8',
						  'Authorization' : 'Basic ' + cred
					},
					timeout: 1000
				  };
				 console.log("serverSelect; Send request. to " + server);
				  request( opt, function requestCallback( error, response, body ) {
					console.log('serverSelect; parse result for ' + server);
					var ref = bla;
					// resolve / reject
					if ( error ) {				
						console.log(error);
					} else {
						console.log('ServerSelect server ' + server + ' BODY: ' + body);
						var parser = new xml2js.Parser();
						var res = parser.parseString(body, function (err, result) {
						console.log('parsing: ' + result["response"]);
							
							if(result["response"] && result["response"]["status"]) {
								if(result["response"]["status"][0]) {
									console.log('SERVER ' + server + ' ERROR. Return!');
									ref.delay();
									return true;
								}
								else {
									console.log('SET SERVER: ' . server);
									ref.setBaseHost(server);
									return;
								}
							} else {
								if(result["response"] && result["response"]['createCookieResponse']) {
									console.log('SET SERVER ' + server + ' with cookie: ' + result["response"]['createCookieResponse'][0]['cookie'][0]);
									var token = result["response"]['createCookieResponse'][0]['cookie'][0];
									ref.setToken(result);
									ref.setBaseHost(server);
									return;
								}
								else {
									console.log('SERVER ERROR #87');
									ref.delay();
									return true;
								}
							}
	
							
						});
						
					}
				});
			}     

			
		}
	}

	serverTest(options) {
		
	}

	sendRequest ( options ) {
		'use strict';
		console.log("sending request to " + this._BASE_URL);
		
		var bla = this;
		return new Promise( function ( resolve, reject ) {
			request( options, function requestCallback( error, response, body ) {
				// handle response errors
				console.log("Received content-type:" + response.headers['content-type']);
				console.log("Received status code: " + response.statusCode);
				
				if (error) {
					reject(response);
				} else if (!(/^2/.test('' + response.statusCode))) { // Status Codes other than 2xx
					console.log('** Fucking API sucks, need other server!!');
					reject(error);
				} else if (options.json && !response.headers) {
					reject('no headers found. request failed');
				} else if (options.json && response.headers['content-type'] !== 'application/json;charset=UTF-8') {
					reject('Expected JSON, but got html');
				} 
				//if(response.headers['content-type'] !== 'application/json;charset=UTF-8' || response.headers['content-type'] !== 'application/xml;charset=UTF-8') {
				//	console.log('Received wrong content-type!');
				//	bla.serverSelect();
				//	reject ('Wrong content-type');
				//} 
				
				// resolve / reject
				if ( error ) {
					console.log('ERR' + error);
					reject( error );
				} else {
					console.log('SendRequest Result ' + bla._BASE_URL + ': ' + body);
					resolve( body );
				}
			});
		});
	}
	setBaseHost(server) {
		console.log('setBaseHost to ' + server);
		Homey.ManagerSettings.set('base_host', server);
	}
	authenticate() {
		
		console.log('base host: ' + this._BASE_HOST);
		

		if (Homey.ManagerSettings.get('username') != null) {      
			
			console.log('Authenticating ......... ');

			var userid = Homey.ManagerSettings.get('username');
			var password = Homey.ManagerSettings.get('password');

			var cred = Buffer.from("CPE/" + userid + ":" + password).toString('base64');

			var opt = {
				port: 443,
				url: this._BASE_URL + '/cookie',
				method: 'POST',
				headers: {
					'Host' : this._BASE_HOST,
				  	'Content-Type': 'application/xml;charset=UTF-8',
				  	'Authorization' : 'Basic ' + cred
				}
			  };
			  
			  this.sendRequest(opt).then( this.parseApiResponse).then( this.setToken).catch(this.logger);
			  
		 }
		 else {
			 console.log('no user cred');
		 }
	}
	
	
	parseApiResponse(input) {
				
		console.log("see if we can parse the request");		
		return new Promise( function ( resolve, reject ) {
			var parser = new xml2js.Parser();
			var res = parser.parseString(input, function (err, result) {
				console.log('PARSED: ' + result);
				resolve(result);
				
			});
		}).catch(function(err) {
			this.serverSelect();
		 });
	}
	
	setToken(input) {
		
		if( Homey.ManagerSettings.get('token') === null ) {
			if(input["response"] && input["response"]['createCookieResponse']) {
				var token = input["response"]['createCookieResponse'][0]['cookie'][0];
				Homey.ManagerSettings.set('token', token);
				console.log('TOKEN: ' + token);
			}
			else {
				console.log("LOGIN FAILED");
				console.log("DATA: " + input["response"]);
			}
		}
		else {
			console.log('TOKEN: ' + token);
		}
		
		
		this.getOverview();
		
	}
	getToken( ) {
		
		if( Homey.ManagerSettings.get('token') === null ) {
			console.log('no token found, new one requesting');
			this.authenticate();
		}
		else {
			this.getOverview();
			return Homey.ManagerSettings.get('token');
		}
		
	}
	
	getInstallation(id) {

		var options = {
			port: 443,
			url: this._BASE_URL + '/installation/'+ Homey.ManagerSettings.get('giid')  +'/',
			method: 'GET',
			headers: {
                'Host': this._BASE_HOST,
			    'Cookie': 'vid=' + Homey.ManagerSettings.get('token')
			  
			}
		  };

		  this.sendRequest(options).then(this.parseApiResponse).then(function ( input ) {
				console.log("GET INSTALLATION: " + input["response"]);
			
			});

	}
	
	getDoorWindow() {
		
		var options = {
			port: 443,
			url: this._BASE_URL + '/installation/'+ Homey.ManagerSettings.get('giid')  +'/device/view/DOORWINDOW/',
			method: 'GET',
			headers: {
                'Host': this._BASE_HOST,
			    'Cookie': 'vid=' + Homey.ManagerSettings.get('token')
			  
			}
		  };

		  this.sendRequest(options).then(this.parseApiResponse).then(this.setDoorWindow);
	}
	setDoorWindow(data) {
				
		Homey.ManagerSettings.set('doorWindow', data["response"]["devices"][0]["doorWindowDevice"]);
	
	}

	getSmartLock() {

		var options = {
			port: 443,
			url: this._BASE_URL + '/installation/'+ Homey.ManagerSettings.get('giid')  +'/doorlockstate/search/',
			method: 'GET',
			headers: {
				'Host': this._BASE_HOST,
				'Cookie': 'vid=' + Homey.ManagerSettings.get('token')
			  
			}
		  };

		  this.sendRequest(options).then(this.parseApiResponse).then(this.setSmartLock);
	}

	setSmartLock(data) {
		//console.log("setSmartLock: " + data["response"]["doorLockStatus"]);
		Homey.ManagerSettings.set('SmartLock', data["response"]["doorLockStatus"]);
		
		
	}
	setLockState(deviceLabel, state) {

			if (Homey.ManagerSettings.get('username') != null && Homey.ManagerSettings.get('keycode') != null) {      
			
				var keyCode = Homey.ManagerSettings.get('keycode');
				
				if(state === true) {
					var v = "lock";
				} else {
					var v = "unlock";
				}
				
				
				//console.log('set state ' + deviceLabel + ' to ' + v + ' with key ' + Homey.ManagerSettings.get('keycode') );

				var opt = {
					port: 443,
					url: this._BASE_URL + '/installation/' + Homey.ManagerSettings.get('giid') + '/device/' + deviceLabel + '/' + v,
					method: 'PUT',
					headers: {
						'Host' : this._BASE_HOST,
						'Accept': 'application/json, text/javascript, */*; q=0.01',
						'Content-Type': 'application/json',
						'Cookie': 'vid=' + Homey.ManagerSettings.get('token')
					},
					body: {
						code : Homey.ManagerSettings.get('keycode')
					},
					json: true			
				  };
				  
				  this.sendRequest(opt).catch(this.logger);
				  
			 }
			 else {
				 console.log('no user cred');
			 }
	}

    getInstallations() {

		var options = {
			port: 443,
			url: this._BASE_URL + '/installation/search?email=' + Homey.ManagerSettings.get('username'),
			method: 'GET',
			headers: {
                'Host': this._BASE_HOST,
			    'Cookie': 'vid=' + Homey.ManagerSettings.get('token')
			  
			}
		  };
		  
		  this.sendRequest(options).then(this.parseApiResponse).then(this.setInstallationKey);
    }
    
    setInstallationKey(input) {
	    
		Homey.ManagerSettings.set('giid', input["response"]['installation'][0]['giid'][0]);
		Homey.ManagerSettings.set('alarm_name', input["response"]['installation'][0]['street'][0]);
		Homey.ManagerSettings.set('alarm_houseno', input["response"]['installation'][0]['streetNo1'][0]);
		
	 	
    }
    
    getArmState() {
	    
			var options = {
				port: 443,
				url: this._BASE_URL + '/installation/' + Homey.ManagerSettings.get('giid') + '/armstate',
				method: 'GET',
				headers: {
					'Host': this._BASE_HOST,
					'Cookie': 'vid=' + Homey.ManagerSettings.get('token')
				  
				}
			  };
			 
				this.sendRequest(options).then(this.parseApiResponse).then(function ( input ) {
					
						Homey.ManagerSettings.set('armstate', input["response"]["installationStatus"][0]["statusType"][0]);
						console.log(' unknown status: ' + input["response"]);

						return Homey.ManagerSettings.get('armstate'); 
						
			});
			
		    return Homey.ManagerSettings.get('armstate');  
	}
	
	setArmState(newState) {

		if(newState === "partially_armed") {
            var v = "ARMED_HOME";
        }
        else if(newState === "armed") {
            var v = "ARMED_AWAY";
        }
        else if(newState === "disarmed") {
            var v = "DISARMED";
        }
        else {
            console.log(' unknown status: ' + state);
        }


		if (Homey.ManagerSettings.get('username') != null) {      
			
			var keyCode = Homey.ManagerSettings.get('keycode');

			var opt = {
				port: 443,
				url: this._BASE_URL + '/installation/' + Homey.ManagerSettings.get('giid') + '/armstate/code',
				method: 'PUT',
				headers: {
					'Host' : this._BASE_HOST,
					'Accept': 'application/json, text/javascript, */*; q=0.01',
                    'Content-Type': 'application/json',
				  	'Cookie': 'vid=' + Homey.ManagerSettings.get('token')
				},
				body: {
					code : Homey.ManagerSettings.get('keycode'),
					state : v
				},
				json: true			
			  };
			  
			  this.sendRequest(opt).then( this.parseApiResponse).then( this.setToken).catch(this.logger);
			  
		 }
		 else {
			 console.log('no user cred');
		 }
	}
	
    
    getOverview() {
		
		if(Homey.ManagerSettings.get('giid') != null) {

		
		var options = {
			port: 443,
			url: this._BASE_URL + '/installation/' + Homey.ManagerSettings.get('giid') + '/overview',
			method: 'GET',
			headers: {
				'Host': this._BASE_HOST,
				'Cookie': 'vid=' + Homey.ManagerSettings.get('token')
			  
			}
		  };

		  this.sendRequest(options).then(this.parseApiResponse).then(this.setDevices);
		}
	}
	setDevices(data) {

		Homey.ManagerSettings.set('climateStatus', data["response"]["installationOverview"][0].climateValues[0]); 
		
	}
    respond(value) {
	    return value;
    }
    
    logger ( data ) {
		
		console.log( data );
	}


}
	
module.exports = VerisureApi