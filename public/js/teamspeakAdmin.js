$("#tasks").on("change", "select", function(){
  var i = $(this).index();
  var trigger = $('.task-trigger').eq(i),
      triggervalue = $('.task-trigger-value').eq(i),
      action = $('.task-action').eq(i),
      actionvalue = $('.task-action-value').eq(i),
      target = $('.task-target').eq(i),
      targetvalue = $('.task-target-value').eq(i);

      triggervalue.datepicker("off");
      $([trigger, action, target]).children().removeAttr("disabled");


  if(trigger.val() === "timedate"){
    triggervalue.attr("placeholder", "yyyy-mm-dd HH:mm, repeat [daily, weekly, monthly, yearly]").datepicker();
  }
  if(trigger.val() === "connect"){
    triggervalue.attr("placeholder", "Group id#");
  }
  if(trigger.val() === "interval"){
    triggervalue.attr("placeholder", "Delay in minutes");
  }
  if(trigger.val() === "idle" || trigger === "muted" || trigger === "recording"){
    target.children().filter(function(){ return this.value !== "client"; }).attr("disabled", true);
    target.val("client");
    triggervalue.attr("placeholder", "Delay in minutes");
  }


  if(action.val() === "kick"){
    target.children().filter(function(){ return this.value !== "client"; }).attr("disabled", true);
    target.val("client");
  }
  if(action.val() === "poke" || action.val() === "kick" || action.val() === "message"){
    targetvalue.attr("placeholder", "Message text");
  } else {
    targetvalue.attr("placeholder", "Group id#");
  }


  if(target.val() === "client" || target.val() === "server"){
    targetvalue.css("display", "none");
  }
  if(target.val() === "group") {
    targetvalue.css("display", "").attr("placeholder", "Group id#");
  }
  if(target.val() === "channel"){
    targetvalue.css("display", "").attr("placeholder", "Channel id#");
  }
});

function collectData(){

  var tasks = {};
  $(".task").each(function(){
    var task = $(this);
    tasks[task.children(".task-name").val()] = {
      trigger: task.children(".task-trigger").val(),
      triggervalue: task.children(".task-trigger-value").val(),
      action: task.children(".task-action").val(),
      actionvalue: task.children(".task-action-value").val(),
      target: task.children(".task-target").val(),
      targetvalue: task.children(".task-target-value").val()
    };
  });
  return tasks;
}

function addTask(){
  return $("#defaulttask")
    .clone()
    .removeAttr("id")
    .removeAttr("style")
    .addClass("task")
    .appendTo("#tasks");
}

$('#save').click( function (event) {

  event.preventDefault();

  var tasks = collectData();

  if(!tasks) return false;

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
  var x;
  for(x in tasks){
    if(tasks.hasOwnProperty(x)){
      var newTask = addTask();
      newTask.children(".task-name").val(x);
      newTask.children(".task-trigger").val(tasks[x].trigger);
      newTask.children(".task-trigger-value").val(tasks[x].triggervalue);
      newTask.children(".task-action").val(tasks[x].action);
      newTask.children(".task-action-value").val(tasks[x].actionvalue);
      newTask.children(".task-target").val(tasks[x].target);
      newTask.children(".task-target-value").val(tasks[x].targetvalue);
    }
  }
});

$("#addTask").click(function(e){
  e.preventDefault();
  addTask();
});
