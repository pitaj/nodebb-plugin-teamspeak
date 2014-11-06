#nodebb-plugin-teamspeak

A powerful utility for TS3 admins, this plugin allows for automated Teamspeak admin abilities to be configured from NodeBB. The setup is pretty self-explanatory, all done from the admin page.

##Installation

Two options:

 1.  Install the plugin through the ACP (if it ever gets added to the list *cough cough*)
 2.  Run `npm install nodebb-plugin-teamspeak` in the root directory of the NodeBB install

Don't forget to restart after installing the plugin. After installing, a Teamspeak entry should appear in the ACP under plugins

##Configuration
Before doing anything, enter the correct server information into the form at the top of the page.

Then, click the **Add task** button to add a new task form, which will appear next to the default one.
You can then select the trigger, action, and target for this task. 

For instance, to poke the `Server Admin` group when an `Untagged` user connects, input the following configuration:
* **Trigger select:** Group connect
* **Trigger value:** 14
* **Action select:** Poke
* **Action value:** A new user connected
* **Target select:** Group
* **Target value:** 6

##Features
* Auto Move clients of specified server groups to specified channels on connection. 
* Channel Notify sends a message to specified clients, if clients join a specified channel.
* Server Group Notify: send a message to specified clients, if members of a specified server group connects to TS3 server.
* Server Group Protection to kick people which are unauthorized member of a protected server group. 
* Bad nickname check to kick people with a bad name from the server. 
* Bad channel name check to delete channels with a bad name. 
* Move idle users to another channel and sends a message.
* Kick idle users with a kick reason.
* Send a warning message if someone is idle.
* Move to a specified channel if client status is away (after some seconds idle), can move back if not away anymore
* Move to a specified channel if client status is headphone or microphone muted (after some seconds idle)
* Send a message every X minutes to virtual server or a special channel
* Send a welcome message to every connecting client, can send a special welcome message to specified server group members

## Suggestions? Encountered a Bug?
Please submit all feature requests and bugs with the [Issue tracker at Github.](https://github.com/pitaj/nodebb-plugin-teamspeak/issues) Thanks
