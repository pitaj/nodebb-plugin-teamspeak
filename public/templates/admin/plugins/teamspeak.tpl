<h1><i class="fa fa-microphone"></i> Teamspeak Automation configuration</h1>
<hr />

<div class="bg-primary alert">
    <p>This plugin allows certain tasks to be executed when certain events happen in a Teamspeak server.</p>
</div>

<form id="serverInfo">
  <div class="thirds">
    Server address: <input type="text" class="form-control" id="ts-address" placeholder="Enter server address" />
  </div>
  <div class="thirds">
    Server port: <input type="text" class="form-control" id="ts-port" placeholder="default port is 10011" />
  </div>
  <div class="thirds">
    Username: <input type="text" class="form-control" id="ts-username" placeholder="Enter serverquery username" />
  </div>
  <div class="thirds">
    Password: <input type="text" class="form-control" id="ts-password" placeholder="Enter serverquery password" />
  </div>
  <div class="thirds">
    Server ID: <input type="text" class="form-control" id="ts-sid" placeholder="Virtualserver id #" />
  </div>

</form>

<form id="taskMaker">
  <h3>Create automated tasks below</h3>

  <div id="tasks">
    <p>This is the GUI for creating very simple tasks. <br>
      Note: For chat commands, designate variable arguments by enclosing them in braces, like so: {{example_argument}}.
      They can then be referred to by the task later. See the given "movechannel" task for an example. <br>
      Time and date actions will occur at noon machine time.
      </p>
    <button class="btn" id="addTask">Add task</button>
    <br><br>

    <div id="defaulttask" style="display:none">

      <strong>Name: <input type="text" class="task-name form-control" placeholder="Task name"/></strong>
      <br>

      The trigger for this class:
      <select class="task-trigger form-control">

        <option value="timedate">Time & date</option>
        <option value="interval">Interval</option>
        <option value="connect">Group connect</option>
        <option value="idle">Idle</option>
        <option value="muted">Mic & Sound muted</option>
        <option value="recording">User recording</option>
        <option value="chatcommand">Chat command</option>

      </select>
      <br>
      <input type="text" class="task-trigger-value form-control" placeholder="yyyy/mm/dd HH:mm" />
      <!--
          Amount of minutes for idle, muted, recording
          Datepicker for time and date
          Command for chat command
          Group id for group connect
      -->
      <br>
      The action for this task:
      <select class="task-action form-control">
        <option value="poke">Poke</option>
        <option value="move">Move</option>
        <option value="kick">Kick</option>
        <option value="message">Message</option>
        <option value="info">Information</option>
      </select>
      <br>
      <input type="text" class="task-action-value form-control" placeholder="Message" />
      <!--
          Message for poke, kick, message
          Destination channel for move
      -->
      <br>
      The target for this task:
      <select class="task-target form-control">
        <option value="group">Group</option>
        <option value="client">Client</option>
        <option value="channel">Channel</option>
        <option value="server">The whole server</option>
      </select>
      <!--
        nothing but client visible for actions [kick]
        nothing but client visible for triggers
          [idle, muted, recording]
      -->
      <br>
      <input type="text" class="task-target-value form-control" placeholder="Group id#" />
      <!--
          hidden for server
          visible for group, channel
          hidden for client if idle, connect, mute, record
      -->

      <br>
      <button class="removeTask btn btn-warning" >Remove task</button>

    </div>


  </div>
  <br>
  <button class="btn btn-lg btn-primary" id="save">Save</button>
</form>

<script type='text/javascript'>

(function(){

  $("#tasks").on("change", "select", function(){
    var i = $(this).parent();

    var trigger = i.children('.task-trigger'),
        triggervalue = i.children('.task-trigger-value'),
        action = i.children('.task-action'),
        actionvalue = i.children('.task-action-value'),
        target = i.children('.task-target'),
        targetvalue = i.children('.task-target-value');

    triggervalue.datetimepicker("destroy");
    i.children().children().removeAttr("disabled");

    if(trigger.val() === "timedate"){
      triggervalue.attr("placeholder", "yyyy/mm/dd HH:mm").datetimepicker();
    }
    if(trigger.val() === "interval"){
      triggervalue.attr("placeholder", "Interval in HH:mm:s");
    }
    if(trigger.val() === "connect"){
      triggervalue.attr("placeholder", "Group id#");
    }
    if(trigger.val() === "idle" || trigger === "muted" || trigger === "recording"){
      target.children().filter(function(){ return this.value !== "client"; }).attr("disabled", true);
      target.val("client");
      triggervalue.attr("placeholder", "Delay in minutes");
    }
    if(trigger.val() === "chatcommand"){
      triggervalue.attr("placeholder", "full chat command (including ! or / or whatever)");
    }


    if(action.val() === "kick"){
      target.children().filter(function(){ return this.value !== "client"; }).attr("disabled", true);
      target.val("client");
      actionvalue.css("display", "").attr("placeholder", "Message text");
    }
    if(action.val() === "poke" || action.val() === "kick" || action.val() === "message"){
      actionvalue.css("display", "").attr("placeholder", "Message text");
    }
    if(action.val() === "move") {
      actionvalue.css("display", "").attr("placeholder", "Destination channel");
    }
    if(target.val() === "info"){
      actionvalue.css("display", "none");
    }


    if(target.val() === "server"){
      targetvalue.css("display", "none");
    }
    if(target.val() === "group") {
      targetvalue.css("display", "").attr("placeholder", "Group id#");
    }
    if(target.val() === "channel"){
      targetvalue.css("display", "").attr("placeholder", "Channel name");
    }

    if(target.val() === "client"){
      if(trigger.val() === "idle" || trigger.val() === "muted" || trigger.val() === "recording" || trigger.val() === "connect"){
        targetvalue.css("display", "none");
      } else {
        targetvalue.css("display", "").attr("placeholder", "Client nickname");
      }
    }
  });

  function collectData(){

    var tasks = {};
    $(".task").each(function(){
      var task = $(this);
      var name = task.find(".task-name").val();

      tasks[name] = {
        trigger: task.children(".task-trigger").val(),
        triggervalue: task.children(".task-trigger-value").val(),
        action: task.children(".task-action").val(),
        actionvalue: task.children(".task-action-value").val(),
        target: task.children(".task-target").val(),
        targetvalue: task.children(".task-target-value").val()
      };
    });

    console.log(tasks);

    return tasks;
  }

  function addTask(){
    var x = $("#defaulttask")
      .clone()
      .removeAttr("id")
      .removeAttr("style")
      .addClass("task")
      .appendTo("#tasks");
    x.children("select").trigger("change");
    return x;
  }

  $('#save').click( function (event) {

    event.preventDefault();

    var tasks = collectData();

    var serverInfo = {
      address: $("#ts-address").val(),
      username: $("#ts-username").val(),
      password: $("#ts-password").val(),
      port: $("#ts-port").val(),
      sid: $("#ts-sid").val()
    }

    console.warn(serverInfo);

    if(!tasks && !(serverInfo.address && serverInfo.username && serverInfo.password)) return false;

    tasks.serverInfo = serverInfo;

    $.post('/api/admin/plugins/teamspeak/save', {
        _csrf : $('#csrf_token').val(),
        tasks : JSON.stringify(tasks)
    }, function(data) {
        if(typeof data === 'string') {
            app.alertSuccess(data);
        }
    });

  });

  $.getJSON('/api/admin/plugins/teamspeak', function (data) {
    var tasks = data.tasks;

    console.log(tasks);

    if(tasks.serverInfo){
      $("#ts-address").val(tasks.serverInfo.address);
      $("#ts-username").val(tasks.serverInfo.username);
      $("#ts-password").val(tasks.serverInfo.password);
      $("#ts-port").val(tasks.serverInfo.port);
      $("#ts-sid").val(tasks.serverInfo.sid);

      console.error(tasks.serverInfo);

      delete tasks.serverInfo;
    }

    var x;
    for(x in tasks){
      if(tasks.hasOwnProperty(x)){
        var newTask = addTask();

        newTask.find(".task-name").val(x);
        newTask.children(".task-trigger").val(tasks[x].trigger);
        newTask.children(".task-trigger-value").val(tasks[x].triggervalue);
        newTask.children(".task-trigger-repeat").val(tasks[x].triggerrepeat)
        newTask.children(".task-action").val(tasks[x].action);
        newTask.children(".task-action-value").val(tasks[x].actionvalue);
        newTask.children(".task-target").val(tasks[x].target);
        newTask.children(".task-target-value").val(tasks[x].targetvalue);

        newTask.children("select").trigger("change");
      }
    }
  });

  $("#addTask").click(function(e){
    e.preventDefault();
    addTask();
  });

  $("#tasks").on("click", ".removeTask", function(e){
    e.preventDefault();
    $(this).parent().remove();
  });

  $("#tasks").on("click", "input[type=text]", function(e){
    e.preventDefault();
    $(this).select();
  });


})();

</script>

<style>

  .btn.btn-lg.btn-primary {
    margin-left: 20px;
  }
  .task {
    margin-right: 30px;
    width:400px;
    float: left;
    display: inline-block;
    margin-bottom: 30px;
  }
  .thirds {
    display: inline-block;
    float: left;
    margin-right: 5%;
    width: 15%;
  }
  #taskMaker {
    margin-top: 100px;
  }

</style>

<script src="/plugins/nodebb-plugin-teamspeak/public/datetimepicker/jquery.datetimepicker.min.js"></script>
