(function(module) {

	var fs = require('fs'),
			path = require("path"),
			ts3sq = require("node-teamspeak");

			console.log(1);

	module.exports.renderTSwidget = function(widget, callback) {

		var serverInfo = {
			address: widget.data.address,
			username: widget.data.username,
			password: widget.data.password,
			name: widget.data.name,

		};

		var ts = new ts3sq(serverInfo.address);

    ts.on("error", function(err){ console.error(err); });
    ts.on("connect", function(res){
      ts.send("login", {client_login_name: serverInfo.username, client_login_password: serverInfo.password}, function(err, res){
        if(err) console.error(err);
        ts.send("use", {sid:1}, function(err, res){
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
			      ts.send("clientlist", function(err, clients){
			        if(err) console.error(err);
			        //console.log(clients);
			        ts.send("channellist", function(err, channels){
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
			          //console.log(c+1);
			          function addclient(c){
			            //console.log(c);
			            ts.send("clientinfo", { clid: clients[c].clid }, function (err, clientinfo){

			              if(err) console.error(err);

			              clientsinfo.push(clientinfo);
			              var it = find(cascade, clients[c].cid);
			              if(it){
			                if(!it.users) it.users = [];
			                it.users.push(clientinfo);
			              }

			              if(c+1 >= len){
			                ts.send("quit");
			                if(callback) return callback(cascade, clientsinfo);
			              } else {
			                addclient(c+1);
			              }

			            });
			          }
			          addclient(0);
			          //if(callback) callback(cascade, clientsinfo);
			        });
			      });
			    }

					getChannelsAndClients(HTMLresponse);

				});
			});
		});
	};

	module.exports.defineWidget = function(widgets, callback) {
		widgets.push({
			widget: "teamspeak",
			name: "Teamspeak viewer",
			description: "Any text, html, or embedded script.",
			content: fs.readFileSync(path.resolve(__dirname, './public/templates/widget.tpl')),
		});

		callback(null, widgets);
	};

}(module));
