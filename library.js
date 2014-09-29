(function(module, realModule) {

	var fs = require("fs"),
			async = require('async'),
	    path = require("path"),
			ts3sq = require("node-teamspeak"),
			db = realModule.parent.require('./database'),
			schedule = require("node-schedule"),
			ts;

	module.renderTSwidget = function(widget, callback) {

		var serverInfo = {
			address: widget.data.address,
			username: widget.data.username,
			password: widget.data.password,
			name: widget.data.name,
			sqaddress: widget.data.sqaddress,
			sqport: widget.data.sqport,
			sid: widget.data.sid
		};

		var tsw = new ts3sq(serverInfo.sqaddress, serverInfo.sqport);

    tsw.on("error", function(err){ console.error(err); });
    tsw.on("connect", function(res){
      tsw.send("login", { client_login_name: serverInfo.username, client_login_password: serverInfo.password }, function(err, res){
        if(err) console.error(err);
        tsw.send("use", { sid:serverInfo.sid }, function(err, res){
          if(err) console.error(err);

					function HTMLresponse(obj, clients){
			      //console.log(JSON.stringify(obj));
			      console.log(JSON.stringify(clients));

			      var online_clients = [];

			      for(var z=0; z<clients.length; z++){
			        if(clients[z].client_type == 0 && clients[z].client_away == 0){
			          online_clients.push(clients[z]);
			        }
			      }

			      var pre = ""+fs.readFileSync("./public/templates/ts3.tpl");
			      var rep = {
			        "ts3-online-clients": online_clients.length,
			        "ts3-server-name": serverInfo.name || "Teamspeak Server",
			        "ts3-address" : serverInfo.address,
			        "ts3-tree": cycle(obj),
			      }

						if(!widget.data.showtree){
							rep["ts3-tree"] = "<!-- tree hidden -->"
						}

			      for(var x in rep){
			        pre = pre.replace(new RegExp("{{"+x+"}}", "g"), rep[x]);
			      }

			      function cycle(o){
			        var html = "";
			        for(var x in o){
			          html += "<div class='channel";
			          var spacerI = o[x].channel_name.match(/\[[lrcLRC]*spacer[0-9]*\]/);
			          //console.log(spacerI);
			          o[x].channel_name = o[x].channel_name.replace(/\[[lrcLRC]*spacer[0-9]*\]/, '');
			          if(spacerI){
			            html += " "+spacerI[0].replace('[', '').replace(']','');
			            switch(o[x].channel_name){
			              case "___":
			                html += " solidline";
			                break;
			              case "---":
			                html += " dashline";
			                break;
			              case "...":
			                html += " dotline";
			                break;
			              case "-.-":
			                html += " dashdotline";
			                break;
			              case "-..":
			                html += " dashdotdotline";
			                break;
			            }
			          }
			          html += "'><div class='channel_name'>"+o[x].channel_name+"</div>";
			          if(o[x].users)
			            for(var i=0; i< o[x].users.length; i++){
			              var client = o[x].users[i];
			              if(client.client_type == 0){
			                html += "<div class='client";
			                var a = client.client_servergroups.split(',');
			                for(var c =0; c<a.length; c++){
			                  html += " servergroup"+a[c];
			                }
			                if(client.client_away) html += " away";
			                if(client.client_input_muted) html += " inputmuted";
			                if(client.client_output_muted) html += " outputmuted";
			                html+= "' >"+o[x].users[i].client_nickname+"</div>";
			              }
			            }
			          if(o[x].subChannels)
			            html += cycle(o[x].subChannels);
			          html += "</div>";

			        }

			        return html;
			      }

						callback(null, pre);

			    }

			    function getChannelsAndClients(callback){
			      tsw.send("clientlist", function(err, clients){
			        if(err) console.error(err);
			        //console.log(clients);
			        tsw.send("channellist", function(err, channels){
			          if(err) console.error(err);
			          //console.log(util.inspect(channels));
			          var cascade = [];
			          function find(arr, cid){
			            for(var x=0; x < arr.length; x++){

			              if(arr[x].cid == cid){
			                return arr[x];
			              } else if(arr[x].subChannels) {
			                var out = find(arr[x].subChannels, cid);
			                if(out) return out;
			              }
			            }
			          }
			          //console.log(channels);
			          for(var i=0; i<channels.length; i++){
			            var it = find(cascade, channels[i].pid);
			            if(it){
			              if(!it.subChannels) it.subChannels = [];
			              it.subChannels.push(channels[i]);
			            } else {
			              cascade.push(channels[i]);
			            }
			          }

			          if(!clients.length) clients = [clients];

			          //console.log(clients[0]);
			          //console.log(clients);
			          //console.log(clients.length);

			          var clientsinfo = [];
			          var len = clients.length;

								async.map(clients, function(client, cb){

			            tsw.send("clientinfo", { clid: client.clid }, function (err, clientinfo){

			              if(err) console.error(err);

			              clientsinfo.push(clientinfo);
			              var it = find(cascade, client.cid);
			              if(it){
			                if(!it.users) it.users = [];
			                it.users.push(clientinfo);
			              }

										cb(null, clientinfo);

			            });
			          }, function(err, results){
									tsw.send("quit");
			            if(callback) callback(cascade, clientsinfo);
								});
			        });
			      });
			    }

					getChannelsAndClients(HTMLresponse);

				});
			});
		});
	};

	module.defineWidget = function(widgets, callback) {
		widgets.push({
			widget: "teamspeak",
			name: "Teamspeak viewer",
			description: "Any text, html, or embedded script.",
			content: fs.readFileSync(path.resolve(__dirname, './public/templates/widget.tpl')),
		});

		callback(null, widgets);
	};


	module.init = function (app, middleware, controllers, callback) {

		app.get('/admin/plugins/teamspeak', middleware.admin.buildHeader, renderAdmin);
		app.get('/api/admin/plugins/teamspeak', renderAdmin);




		app.get('/api/plugins/teamspeak', renderFront);

		app.post('/api/admin/plugins/teamspeak/save', save);

		callback();
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
					tasks : {
						"movechannel": {
							"trigger":"chatcommand",
							"triggervalue":"!movechannel {{startchannel}} {{endchannel}}",
							"action":"move",
							"actionvalue":"{{endchannel}}",
							"target":"channel",
							"targetvalue":"{{startchannel}}"
						},
					},
				};
			}

			console.log(data);

			res.render(path, data);
		});
	};

	function renderAdmin (req, res, next) { render( res, next, 'admin/plugins/teamspeak' ) };
	function renderFront (req, res, next) { render( res, next, 'plugins/teamspeak' ) };

	function save (req, res, next) {

		console.log(req.body.tasks);

		var data = { tasks : req.body.tasks };
		db.setObject('plugins:teamspeak', data, function(err) {
			err ? res.json(500, 'Error while saving settings') : res.json('Settings successfully saved');
		});

		updateTimers(data);

	}

	function updateTimers(data){
		var tasks = JSON.parse(data.tasks);
		console.log(tasks);
		if(!tasks.serverInfo){
			console.error("No serverinfo");
			return false;
		}

		var serverInfo = tasks.serverInfo;

		delete tasks.serverInfo;

		ts = new ts3sq(serverInfo.address);

		ts.on("error", function(err){ console.error(err); });
		ts.on("connect", function(res){
			ts.send("login", { client_login_name: serverInfo.username, client_login_password: serverInfo.password }, function(err, res){
				if(err) console.error(err);
				ts.send("use", { sid:1 }, function(err, res){
					if(err) console.error(err);
					var i;
					for(i in timers){
						if (timers.hasOwnProperty(i)){
							timers[i]();
						}
					}


					var x;
					for(x in tasks){
						if(tasks.hasOwnProperty(x)){

							timers[x] = setupTask(tasks[x]);

						}
					}

					console.log(timers);

				});
			});
		});



	}

	var timers = {}; // key is task name, value is object

	function setupTask(task, serverInfo){

		function getClientsInChannel(callback, channelid){
			ts.send("clientlist", function(err, clients){
				if(err) console.error(err);
				ts.send("channellist", function(err, channels){
					if(err) console.error(err);
					var cascade = [];
					function find(arr, cid){
						for(var x=0; x < arr.length; x++){
							if(arr[x].cid == cid){
								return arr[x];
							} else if(arr[x].subChannels) {
								var out = find(arr[x].subChannels, cid);
								if(out) return out;
							}
						}
					}
					for(var i=0; i<channels.length; i++){
						var it = find(cascade, channels[i].pid);
						if(it){
							if(!it.subChannels) it.subChannels = [];
							it.subChannels.push(channels[i]);
						} else {
							cascade.push(channels[i]);
						}
					}
					if(!clients.length) clients = [clients];

					for(var i=0; i<clients.length; i++){
						if(clients[i].client_type == 0){
							var it = find(cascade, clients[i].cid);
							if(it){
								if(!it.users) it.users = [];
								it.users.push(clients[i]);
							}
						}
					}

					function gatherUsers(arr){
						var usersInChannel = [];
						if(arr.users){
							usersInChannel = usersInChannel.concat(arr.users);
						}
						if(arr.subChannels) {
							for(var x=0; x < arr.subChannels.length; x++){
								var out = gatherUsers(arr.subChannels);
								if(out) usersInChannel = usersInChannel.concat(out);
							}
						}
						return usersInChannel;
					}
					var usersInChannel = gatherUsers(find(cascade, channelid));
					callback(usersInChannel);
				});
			});
		}

		var action = {

			poke: {
				group: function(){
					ts.send("clientlist", function(err, clients){
						if(!clients.length) clients = [clients];
		        var len = clients.length;
		        async.map(clients, function(client, cb){
		          ts.send("clientinfo", { clid: client.clid }, function (err, clientinfo){
		            if(err) console.error(err);
								var groups = (""+clientinfo.client_servergroups).split(',');

								var match = false;
								for(var i=0; i<groups.length; i++){
									if(groups[i] == task.targetvalue){
										match = true;
									}
								}

								if(match){
									ts.send("clientpoke", { clid: client.clid, msg: task.actionvalue }, function(err, res){
										if (err) console.error(err);
										cb(null, match);
									});
								} else {
									cb(null, match);
								}

		          });
		        }, function(){

						});
					});
				},
				channel: function(){

					getClientsInChannel(function(users){
						async.map(users, function(client, cb){
							ts.send("clientpoke", { clid: client.clid, msg: task.actionvalue }, function(err, res){
								if (err) console.error(err);
								cb(null, res);
							});
						}, function(err, results){

						});
					}, task.targetvalue);
				},
				client: function(){
					ts.send("clientpoke", { clid: task.targetvalue, msg: task.actionvalue }, function(err, res){
						if (err) console.error(err);

					});
				},
				server: function(){
					ts.send("clientlist", function(err, clients){
						if(!clients.length) clients = [clients];
						async.map(clients, function(client, cb){
							ts.send("clientpoke", { clid: client.clid, msg: task.actionvalue }, function(err, res){
								if (err) console.error(err);
								cb(null, res);
							});
						}, function(){

						});
					});
				}
			},

			move: {
				channel: function(){

					getClientsInChannel(function(users){
						async.map(users, function(client, cb){
							ts.send("clientmove", { clid: client.clid, cid: task.actionvalue }, function(err, res){
								if (err) console.error(err);
								cb(null, res);
							});
						}, function(err, results){

						});
					}, task.targetvalue);
				},
				client: function(){
					ts.send("clientmove", { clid: task.targetvalue, cid: task.actionvalue }, function(err, res){
						if (err) console.error(err);

					});
				}
			},

			kick: {
				client: function(){
					ts.send("clientkick", { clid: task.targetvalue, reasonid: 5, reasonmsg: task.actionvalue }, function(err, res){
						if (err) console.error(err);

					});
				}
			},

			message: {
				client: function(){
					ts.send("sendtextmessage", { targetmode: 3, target: task.targetvalue, msg: task.actionvalue }, function(err, res){
						if (err) console.error(err);

					});
				},
				group: function(){
					ts.send("clientlist", function(err, clients){
						if(!clients.length) clients = [clients];
						var len = clients.length;
						async.map(clients, function(client, cb){
							ts.send("clientinfo", { clid: client.clid }, function (err, clientinfo){
								if(err) console.error(err);
								var groups = (""+clientinfo.client_servergroups).split(',');

								var match = false;
								for(var i=0; i<groups.length; i++){
									if(groups[i] == task.targetvalue){
										match = true;
									}
								}

								if(match){
									ts.send("sendtextmessage", { targetmode: 3, target: client.clid, msg: task.actionvalue }, function(err, res){
										if (err) console.error(err);
										cb(null, match);
									});
								} else {
									cb(null, match);
								}

							});
						}, function(){

						});
					});
				},
				channel: function(){
					ts.send("sendtextmessage", { targetmode: 2, target: task.targetvalue, msg: task.actionvalue }, function(err, res){
						if (err) console.error(err);

					});
				},
				server: function(){
					ts.send("sendtextmessage", { targetmode: 1, target: 1, msg: task.actionvalue }, function(err, res){
						if (err) console.error(err);

					});
				}
			}
		}

		if(!(task.trigger === "timedate" || task.trigger === "interval"  ||
				  task.trigger === "connect" || task.trigger === "idle" 		 ||
						task.trigger === "muted" || task.trigger === "recording" ||
						task.trigger === "chatcommand")) return false;

		return ({

			timedate: function(){
				var da = task.triggervalue.split(/[\/\:\s]/g);
				console.log(da);
				var d = new Date( da[0], da[1], da[2], da[3], da[4], 0 );
				console.log(d);

				var j = schedule.scheduleJob(d, function(){
					console.log("ran");
					action[task.action][task.target]();
				});

				return function(){ j.cancel(); };
			},
			interval: function(){
				var t = {};

				try {

				t = global.setInterval(function(){
					action[task.action][task.target]();
				}, task.triggervalue*60000);
			} catch(e){
				console.error(JSON.stringify(e));
			}

				return function(){ clearTimeout(t); };
			},
			connect: function(){
				ts.send("servernotifyregister", { event: "server" }, function(err, res){
					if(err) console.error(err);
					ts.addListener("cliententerview", function(client){
						var groups = (""+client.client_servergroups).split(',');
						var match = false;

						for(var i=0; i<groups.length; i++){
							if(groups[i] == task.triggervalue){
								action[task.action][task.target]();
							}
						}
					});
				});

				return function(){ ts.removeAllListeners("cliententerview"); };
			},
			idle: function(){
				var grace = task.triggervalue;

			},
			muted: function(){
				var grace = task.triggervalue;

			},
			recording: function(){
				var grace = task.triggervalue;

			},
			chatcommand: function(){
				var command = task.triggervalue;
				var com = command.match(/\{\{[a-zA-Z0-9]+\}\}/g);

				ts.send("servernotifyregister", { event: "textserver" }, function(err, res){
					if(err) console.error(err);

					ts.addListener("textmessage", function(info){
						var msg = info.msg;
						msg = msg.split(" ");

						if(msg[0] === command.split(" ")[0]){
							if(task.actionvalue === com[0]){
								task.actionvalue = msg[1];
							}
							if(task.actionvalue === com[1]){
								task.actionvalue = msg[2];
							}
							if(task.targetvalue === com[0]){
								task.targetvalue = msg[1];
							}
							if(task.targetvalue === com[1]){
								task.targetvalue = msg[2];
							}
						}
						console.log(task.targetvalue);
						console.log(task.actionvalue);

						action[task.action][task.target]();
					});
				});

				return function(){ ts.removeAllListeners("textmessage"); };

			}
		})[task.trigger]();

	}

}(module.exports, module));
