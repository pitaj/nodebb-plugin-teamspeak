(function(module, realModule) {

	"use strict";

	var fs = require("fs"),
			async = require('async'),
	    path = require("path"),
			ts3sq = require("node-teamspeak"),
			db = realModule.parent.require('./database'),
			later = require("later"),
			beautify = require('js-beautify').js_beautify,
			ts;

	var defaultTasks = {
		"pokeclient": {
			action: "poke",
			actionvalue: "{{message}}",
			target: "client",
			targetvalue: "{{client}}",
			trigger: "chatcommand",
			triggervalue: "!poke {{client}} {{message}}"
		}
	};

	later.date.localTime();

	module.init = function (params, callback) {

		params.router.get('/admin/plugins/teamspeak', params.middleware.admin.buildHeader, renderAdmin);
		params.router.get('/api/admin/plugins/teamspeak', renderAdmin);

		params.router.get('/api/plugins/teamspeak', renderFront);

		params.router.post('/api/admin/plugins/teamspeak/save', save);

		db.getObject('plugins:teamspeak', function(err, data) {
			if (err) { return; }
			if (data && data.tasks && data.tasks !== "{}") {
				data = { tasks : JSON.parse(data.tasks) };

			} else {
				data = {
					tasks : defaultTasks
				};
			}

			updateTimers(data);
			callback();
		});
	};

	module.addAdminNavigation = function(header, callback) {

		header.plugins.push({
			route: '/plugins/teamspeak',
			icon: 'fa-microphone', // || fa-headphones || fa-volume-up
			name: 'Teamspeak Admin'
		});

		callback(null, header);
	};

	function render (res, next, path) {
		db.getObject('plugins:teamspeak', function(err, data) {
			if (err) {
				return next(err);
			}
			if (data && data.tasks && data.tasks !== "{}") {
				data = { tasks : JSON.parse(data.tasks) };

			} else {
				data = {
					tasks : defaultTasks
				};
			}

			delete data.tasks.__serverInfo__;

			res.render(path, data);
		});
	}

	function renderAdmin (req, res, next) {
		render( res, next, 'admin/plugins/teamspeak' );
	}
	function renderFront (req, res, next) {
		render( res, next, 'plugins/teamspeak' );
	}

	function save (req, res, next) {
		var data = { tasks : req.body.tasks };

		db.setObject('plugins:teamspeak', data, function(err) {
			err ? res.json(500, 'Error while saving settings') : res.json('Settings successfully saved');
		});

		updateTimers({ tasks: JSON.parse(data.tasks) });

	}

	var timers = {}; // key is task name, value is cancel function

	var MYID = "";

	var clientsIdleMuted = {}; // object of client clids and time been away, muted

	var checkIdleMutedInterval = 500;

	function updateTimers(data){
		var tasks = data.tasks;

		if(!tasks.serverInfo){
			console.error("No serverinfo");
			return false;
		}

		var serverInfo = tasks.serverInfo;
		serverInfo.sid = serverInfo.sid || 1;
		serverInfo.queryname = serverInfo.queryname || "Server";
		delete tasks.serverInfo;
		delete tasks.disabled;

		function connect(){

			if(ts && ts.send && typeof ts.send === "function") {
				ts.send("quit");
			}

			ts = new ts3sq(serverInfo.address, serverInfo.port);
			ts.on("error", function(err){ console.error(err); });
			ts.on("close", function(){ setTimeout(connect, 1000); });
			ts.on("connect", function(res){
				ts.send("login", { client_login_name: serverInfo.username, client_login_password: serverInfo.password }, function(err, res){
					if(err) {console.error(err);}
					ts.send("use", { sid: serverInfo.sid }, function(err, res){
						if(err) {console.error(err); }
						ts.send("clientupdate", { client_nickname: serverInfo.queryname }, function(err, res){
							if(err) {console.error(err);}
							ts.send("clientfind", { pattern: serverInfo.queryname }, function(err, info){
								if(err) { console.error(err); }

								if(info.length){
									info = info[0];
								}
								MYID = info.cid;

								var i;
								for(i in timers){
									if (timers.hasOwnProperty(i)){
										timers[i]();
									}
								}
								ts.removeAllListeners();
								var x;
								for(x in tasks){
									if(tasks.hasOwnProperty(x)){
										timers[x] = setupTask(tasks[x], serverInfo);
									}
								}

								timers.idlemute = checkIdleMuted();

							});
						});
					});
				});
			});
		}

		connect();

		function checkIdleMuted(){

			var currentcim = {};

			var timer;

			ts.send("clientlist", function(err, clients){
				if(err){ console.error(err); }
				if(!clients){
					setTimeout(checkIdleMuted, checkIdleMutedInterval);
				}
				if(!clients.length){ clients = [clients]; }
				async.map(clients, function(client, cb){

					ts.send("clientinfo", { clid: client.clid }, function (err, clientinfo){

						if(err) {console.error(err);}


						currentcim[client.clid] = {
							away: (clientinfo.client_away*1) ? true : false,
							muted: (clientinfo.client_input_muted*1) && (clientinfo.client_output_muted*1)
						};

						cb(null, client.clid);

					});
				}, function(err, results){
					var x, mutedclients = [], idleclients = [];
					for(x in currentcim){
						if(currentcim.hasOwnProperty(x)){

							if(!clientsIdleMuted[x]){
								clientsIdleMuted[x] = {
									away : 0,
									muted: 0
								};
							}

							if(currentcim[x].away) {
								clientsIdleMuted[x].away++;
							} else {
								clientsIdleMuted[x].away = 0;
							}
							if(currentcim[x].muted) {
								clientsIdleMuted[x].muted++;
							} else {
								clientsIdleMuted[x].muted = 0;
							}
						}
					}

					for(x in clientsIdleMuted){
						if(clientsIdleMuted.hasOwnProperty(x)){
							if(!currentcim[x]){
								delete clientsIdleMuted[x];
							}
						}
					}

					// console.log(beautify(JSON.stringify(clientsIdleMuted)));

					timer = setTimeout(checkIdleMuted, checkIdleMutedInterval);

				});
			});

		}

	}

	function setupTask(task, serverInfo){

		function getClientsInChannel(callback, channelid){
			ts.send("clientlist", function(err, clients){
				if(err) { console.error(err);  }
				ts.send("channellist", function(err, channels){
					if(err) { console.error(err); }

					function followUp(thecid, currentcid){
						if(thecid === currentcid){ return true; }
						for(var i=0; i<channels.length; i++){
							if(channels[i].cid === currentcid){
								return followUp(thecid, channels[i].pid);
							}
						}
					}

					var usersInChannel = [];

					for(var i=0; i<clients.length; i++){
						if(followUp(channelid, clients[i].cid)){
							usersInChannel.push(clients[i]);
						}
					}

					callback(usersInChannel);
				});
			});
		}

		function clientfind(nick, cb){
			ts.send("clientfind", { pattern: nick }, function(err, info){
				if(err) {console.error(err);}

				if(!info) {return false;}

				if(!info.length){
					info = [info];
				}
				var x;
				for(x in info){
					if(info.hasOwnProperty(x)){
						cb(info[x]);
					}
				}
			});
		}
		function channelfind(name, cb){
			ts.send("channelfind", { pattern: name }, function(err, info){
				if(err) {console.error(err);}
				if(!info.length) {info = [info];}
				var x;
				for(x in info){
					if(info.hasOwnProperty(x)){
						cb(info[x]);
					}
				}
			});
		}

		var action = {

			poke: {
				group: function(actionvalue, targetvalue, clid){
					ts.send("clientlist", function(err, clients){
						if(!clients.length) { clients = [clients]; }
						function go(client){
							ts.send("clientinfo", { clid: client.clid }, function (err, clientinfo){
								if(err) { console.error(err); }
								var groups = (""+clientinfo.client_servergroups).split(',');

								var match = false;
								for(var i=0; i<groups.length; i++){
									if(groups[i] === targetvalue){
										match = true;
									}
								}

								if(match){
									ts.send("clientpoke", { clid: client.clid, msg: actionvalue }, function(err, res){
										if (err) {console.error(err);}
									});
								}

							});
						}

						for(var i=0; i<clients.length; i++){
							go(clients[i]);
						}
					});
				},
				channel: function(actionvalue, targetvalue, clid){
					channelfind(targetvalue, function(info){
						getClientsInChannel(function(users){
							var arr = [];
							for(var i=0; i<users.length; i++){
								arr.push(users[i].clid);
							}
							ts.send("clientpoke", { clid: arr, msg: actionvalue }, function(err, res){
								if (err) { console.error(err); }
							});
						}, info.cid);
					});
				},
				client: function(actionvalue, targetvalue, clid){
					if(targetvalue === null && clid){
						ts.send("clientpoke", { clid: clid, msg: actionvalue }, function(err, res){
							if (err) {console.error(err);}
						});
					} else {
						clientfind(targetvalue, function(info){
							ts.send("clientpoke", { clid: info.clid, msg: actionvalue }, function(err, res){
								if (err) {console.error(err);}
							});
						});
					}
				},
				server: function(actionvalue, targetvalue, clid){
					ts.send("clientlist", function(err, clients){
						if(err) {console.error(err);}
						if(!clients){
							console.error([clients, "not exist"]);
							return;
						}
						if(!clients.length) {clients = [clients];}

						var clids = [];

						for(var i=0; i<clients.length; i++){
							clids.push(clients[i].clid);
						}
						ts.send("clientpoke", { clid: clids, msg: actionvalue }, function(err, res){
							if (err) {console.error(err);}
						});
					});
				}
			},

			move: {
				channel: function(actionvalue, targetvalue, clid){

					channelfind(targetvalue, function(info){
						getClientsInChannel(function(users){

							var arr = [];

							for(var i=0; i<users.length; i++){
								arr.push(users[i].clid);
							}
							channelfind(actionvalue, function(info){
								ts.send("clientmove", { clid: arr, cid: info.cid }, function(err, res){
									if (err) { console.error(err); }
								});
							});
						}, info.cid);
					});
				},
				client: function(actionvalue, targetvalue, clid){
					if(targetvalue === null && clid){
						ts.send("clientmove", { clid: clid, cid: actionvalue }, function(err, res){
							if (err) {console.error(err);}

						});
					} else {
						clientfind(targetvalue, function(info){
							ts.send("clientmove", { clid: info.clid, cid: actionvalue }, function(err, res){
								if (err) {console.error(err);}

							});
						});
					}
				}
			},

			kick: {

				client: function(actionvalue, targetvalue, clid){
					clientfind(targetvalue, function(info){
						ts.send("clientkick", { clid: info.cid, reasonid: 5, reasonmsg: actionvalue }, function(err, res){
							if (err) {console.error(err);}

						});
					});
				}
			},

			message: {
				client: function(actionvalue, targetvalue, clid){
					if(targetvalue === null && clid){
						ts.send("sendtextmessage", { targetmode: 1, target: clid, msg: actionvalue }, function(err, res){
							if (err) {console.error(err);}

						});
					} else {
						clientfind(targetvalue, function(info){
							ts.send("sendtextmessage", { targetmode: 1, target: info.clid, msg: actionvalue }, function(err, res){
								if (err) {console.error(err);}

							});
						});
					}
				},
				group: function(actionvalue, targetvalue, clid){
					ts.send("clientlist", function(err, clients){
						if(!clients.length) {clients = [clients];}

						function go(client){
							ts.send("clientinfo", { clid: client.clid }, function (err, clientinfo){
								if(err) {console.error(err);}
								var groups = (""+clientinfo.client_servergroups).split(',');

								var match = false;
								for(var i=0; i<groups.length; i++){
									if(groups[i] === targetvalue){
										match = true;
									}
								}

								if(match){
									ts.send("sendtextmessage", { targetmode: 1, target: client.clid, msg: actionvalue }, function(err, res){
										if (err) {console.error(err);}
									});
								}

							});
						}

						for(var i=0; i<clients.length; i++){
							go(clients[i]);
						}

					});
				},
				channel: function(actionvalue, targetvalue, clid){
					channelfind(targetvalue, function(info){
						ts.send("sendtextmessage", { targetmode: 2, target: info.clid, msg: actionvalue }, function(err, res){
							if (err) {console.error(err);}
						});
					});
				},
				server: function(actionvalue, targetvalue, clid){
					ts.send("sendtextmessage", { targetmode: 3, target: serverInfo.sid, msg: actionvalue }, function(err, res){
						if (err) {console.error(err);}
					});
				}
			},
			info: {
				client: function(actionvalue, targetvalue, clid){
					clientfind(targetvalue, function(info){
						ts.send("clientinfo", { clid: info.clid }, function(err, client){
							if(err) { console.error(err); }
							client = beautify(JSON.stringify(client));
							client = [client.substring(0, Math.floor(client.length/2)), client.substring(Math.floor(client.length/2))];
							ts.send("sendtextmessage", { targetmode: 1, target: clid, msg: "CLIENTINFO:\n"+client[0] }, function(err, res){
								if (err){ console.error(err);}
								ts.send("sendtextmessage", { targetmode: 1, target: clid, msg: client[1] }, function(err, res){
									if (err){ console.error(err);}
								});
							});
						});
					});
				},
				channel: function(actionvalue, targetvalue, clid){
					channelfind(targetvalue, function(info){
						ts.send("channelinfo", { cid: info.cid }, function(err, channel){
							if(err) {console.error(err);}
							ts.send("sendtextmessage", { targetmode: 1, target: clid, msg: "CHANNELINFO:\n" +beautify(JSON.stringify(channel)) }, function(err, res){
								if (err) {console.error(err);}
							});
						});

					});
				},
				server: function(actionvalue, targetvalue, clid){
					ts.send("serverinfo", function(err, info){
						if(err) {console.error(err);}
							info = beautify(JSON.stringify(info));
							info = [
								info.substring(0, Math.floor(info.length/5)),
								info.substring(Math.floor(info.length/5), Math.floor(info.length*2/5)),
								info.substring(Math.floor(info.length*2/5), Math.floor(info.length*3/5)),
								info.substring(Math.floor(info.length*3/5), Math.floor(info.length*4/5)),
								info.substring(Math.floor(info.length*4/5))
							];
						ts.send("sendtextmessage", { targetmode: 1, target: clid, msg: "SERVERINFO: \n"+info[0] }, function(err, res){
							if (err) {console.error(err);}
							ts.send("sendtextmessage", { targetmode: 1, target: clid, msg: info[1] }, function(err, res){
								if (err) {console.error(err);}
								ts.send("sendtextmessage", { targetmode: 1, target: clid, msg: info[2] }, function(err, res){
									if (err) {console.error(err);}
									ts.send("sendtextmessage", { targetmode: 1, target: clid, msg: info[3] }, function(err, res){
										if (err) {console.error(err);}
										ts.send("sendtextmessage", { targetmode: 1, target: clid, msg: info[4] }, function(err, res){
											if (err) {console.error(err);}
										});
									});
								});
							});
						});
					});
				}
			}
		};

		if(!(task.trigger === "timedate" || task.trigger === "interval"  ||
				  task.trigger === "connect" || task.trigger === "idle" 		 ||
						task.trigger === "muted" || task.trigger === "recording" ||
						task.trigger === "chatcommand")) { return false; }

		var triggers = ({

			timedate: function(){
				var da = task.triggervalue.split(/[\/\:\s]/g);
				//var d = new Date( da[0], da[1], da[2], da[3], da[4], 0 );

				// console.log(da);

				var sched = later.parse.recur().on(da[0]*1).year().on(da[1]*1).month().on(da[2]*1).dayOfMonth().on(da[3]*1).hour().on(da[4]*1).minute();

				// console.log(beautify(JSON.stringify(sched)));

				function func(){
					try {
						action[task.action][task.target](task.actionvalue, task.targetvalue);
					} catch(e){
						console.error(e);
					}
				}

				var j = later.setTimeout(func, sched);

				return j.clear;
			},
			interval: function(){

				var da = task.triggervalue.split(/\:/g);

				// console.log(da);

				var sched = da[0]*60*60*1000 + da[1]*60*1000 + da[2]*1000;

				// console.log(beautify(JSON.stringify(sched)));

			  var t = setInterval(function(){
					action[task.action][task.target](task.actionvalue, task.targetvalue);
				}, sched);

				return function(){ clearInterval(t); };
			},
			connect: function(){
				ts.send("servernotifyregister", { event: "server" }, function(err, res){
					if(err) {console.error(err);}
					ts.addListener("cliententerview", function(client){
						var groups = (""+client.client_servergroups).split(',');
						var targetgroups = task.triggervalue.split(",");
						for(var x=0; x<targetgroups.length; x++){
							for(var i=0; i<groups.length; i++){
								if(groups[i] === targetgroups[x]){
									action[task.action][task.target](task.actionvalue, task.targetvalue);
								}
							}
						}
					});
				});

				return function(){  };
			},
			idle: function(){
				var grace = task.triggervalue*60*1000/checkIdleMutedInterval;
				var onIdle = function(clid){ action[task.action][task.target](task.actionvalue, null, clid); };
				var timer;
				function check(){
					var x;
					for(x in clientsIdleMuted){
						if(clientsIdleMuted.hasOwnProperty(x)){
							if(clientsIdleMuted[x].away >= grace){
								onIdle(x);
								clientsIdleMuted[x].away = -1000;
							}
						}
					}
					timer = setTimeout(check, checkIdleMutedInterval);
				}
				check();
				return function(){ clearTimeout(timer); };
			},
			muted: function(){
				var grace = task.triggervalue*60*1000/checkIdleMutedInterval;
				var onMuted = function(clid){ action[task.action][task.target](task.actionvalue, null, clid); };
				var timer;

				function check(){
					var x;
					for(x in clientsIdleMuted){
						if(clientsIdleMuted.hasOwnProperty(x)){
							if(clientsIdleMuted[x].muted >= grace){
								onMuted(x);
								clientsIdleMuted[x].muted = -1000;
							}
						}
					}
					timer = setTimeout(check, checkIdleMutedInterval);
				}
				check();
				return function(){ clearTimeout(timer); };

			},
			chatcommand: function(){
				var command = task.triggervalue.split(" ");

				ts.send("servernotifyregister", { event: "textserver" }, function(err, res){
					if(err) {console.error(err);}

					ts.addListener("textmessage", function(info){

						if(info.invokerid === MYID){
							return;
						}

						var msg = info.msg.split(" ");

						if(msg[0] === command[0]){
							var actionvalue, targetvalue;

							if(task.actionvalue === command[1]){
								actionvalue = msg[1];
							} else if(task.actionvalue === command[2]){
								actionvalue = msg[2];
							}
							if(task.targetvalue === command[1]){
								targetvalue = msg[1];
							} else if(task.targetvalue === command[2]){
								targetvalue = msg[2];
							}

							action[task.action][task.target](actionvalue, targetvalue , info.invokerid);
						}

					});
				});
				return function(){  };
			}
		});

		return triggers[task.trigger]();
	}

}(module.exports, module));
