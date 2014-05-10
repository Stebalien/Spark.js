// this object represents a map of work to time
// it is used to do timeout analysis 
var mapWorkToTime = new Object();
// this represents how long it takes before we timeout a variable
var timeOutTime = 1000;

// this map is used to map a parition to whatever is dependent on it
// it is an array of a partition id to what is dependent on it
var mapPartitionToParent = new Object();

// this is a map of partition id to whatever is dependent on it
var mapPartitionToChildren = new Object();

// this is a task class which represents a task

// the source is the partition that is in the    
// the sink is the last partition to analyze
// the nodes is a list of partitions for the worker to analyze
    
function Task(sources, sink, nodes) 
  this.source = source;
  this.sink = sink; 
  this.nodes = nodes;
}

// the time that it currently is
function getTime() {
   var currentTime =  new Date().getTime();
}

//this function will remove a value from an array
function removeFromArray(arr1, value) {
   index = arr1.indexOf(value);
   if (index > -1) {
     newarray = arr1.splice(index,1);
   }
   return newarray;
}

// this function is responsible for removing nodes from the mapPartitiontoParent
//that do not have any parents so we can get some vertices to start with 
function initialize( partitionlist) {
 for (var i = 0; i<partitionlist.length; i++) {
	partition = partition[i];
 	if (mapPartitionToParent[partition].length == 0) {
		   delete mapPartitionToParent(partition);
	} 

 }

}

// this function is responsible for removing nodes from the graph
// we go through all of its children and remove the dependency of that child in the parent graph
// if the child no longer has any parents, we remove it from the mapPartitionToParent
// nodes are free to be assigned if they are not in the mapPartitionToParent but in the other map 
function removeNode(partition) {
	var children = mapPartitionToChildren[partition];
        for (var i = 0; i < children.length; i++) {
		child = children[i];
                mapPartitionToParent[child] = removeFromArray(mapPartitionToParent[child], partition)
                if (mapPartitionToParent[child].length == 0) {
		   delete mapPartitionToParent(child);
		} 
	}
        delete mapPartitionToChildren[partition];   
}


function removeTask(task) {
      for (var i = 0; i < task.nodes.length; i++) {
	 removeNode(task.nodes[i]);
      } 		  
} 

//the code that finishes the task 
function finishTask(workerId, task) {
    // code when one receives a new task Id
    var currentTime =  new Date().getTime();
    mapWorkToTime[workerId] = currentTime
    removeTask(task)
    	
}
//iterate through all the partitions
// finds the first one that does not have any partitions
// this needs to be finished
function assignTask(workerId, task, partitionList) {
     // code for actually assigned a workerto a given task
  
} 

//this method is responsible for 
function alterTime() {
   for (var key in mapWorkToTime) {
	oldTime = mapWorkToTime[key];
	if (getTime() > oldTime + timeOutTime) {
	   console.log("we have done the appropriate log out time")
	}
   }
}


