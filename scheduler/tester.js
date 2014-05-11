// this is a task class which represents a task

// the source is the partition that is in the    
// the sink is the last partition to analyze
// the nodes is a list of partitions for the worker to analyze
    
function Task(sources, sinks) {
  this.sources = sources;
  this.sinks = sinks; 
}


function Scheduler(server){
  this.server = server;
  // this object represents a map of work to time
  // it is used to do timeout analysis 
  this.mapWorkToTime = {}; 
  // this represents how long it takes before we timeout a worker
  // this time is in ms; we use this to timeout another worker 
  this.timeOutTime = 1000;

  // this map is used to map a parition to whatever it is dependent on it
  this.mapPartitionToParent = {};

  // this is a map of partition id to whoever is dependent on it
  this.mapPartitionToChildren = {}; 

  // maps sequence number to status
  this.sequenceNumbers = {}
  
  // this maps a worker to the tasks that we assign it
  this.mapWorkerToTasks = {} 

  // this is the list of the targets we want to compute
  this.targets = {}

}

Scheduler.prototype = {

  //this function will remove a value from an array
  RemoveFromArray: function(arr1, value) {
    index = arr1.indexOf(value);
    if (index > -1) {
      newarray = arr1.splice(index,1);
    }
  },
 //Builds partition dependencies based on json object 
  //See example-submission.json

  BuildDependencyTree: function(submission) {
    var json = JSON.parse(submission);
    
    //Check if this submission has already been added
    for (var i = 0; i < json.rdds.length; i++) {
        var rdd = json.rdds[i];  

        for (var j = 0; j < rdd.length; j++) {
          var partition = rdd[j];
          //Build node <- parents relationships
          if (!(partition.id in this.mapPartitionToParent)) {
            this.mapPartitionToParent[partition.id] = partition.dependencies;
          } else {
            this.mapPartitionToParent[partition.id] = Array.prototype.push.apply(this.mapPartitionToParent[partition.id], partition.dependencies);
          }  

	  //Build node <- children relationships
          for (var k = 0; k < partition.dependencies.length; k ++) {
            var dependency = partition.dependencies[k];
            if(!(dependency in this.mapPartitionToChildren)) {
              this.mapPartitionToChildren[dependency] = [partition.id];
            } else {
              this.mapPartitionToChilrden[dependency] = this.mapPartitionToChildren.push(partition.id);
            }
          }

        }
      }    
    } 

  }


}
var scheduler =  new Scheduler("hello");
temp =[5,4,6];
console.log("temp before is this,",temp);
scheduler.RemoveFromArray(temp,5);
console.log("temp after is this", temp)
console.log(scheduler.server);
var task = new Task([5,6,7],[7,8,9]);
console.log(task.sinks);
console.log(task.sources);

/*
Exception: missing ( before condition
*/

/*
Exception: syntax error
*/
/*
Exception: syntax error
*/
/*
undefined
*/
/*
undefined
*/
/*
undefined
*/
/*
undefined
*/