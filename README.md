# Setup

* Install node.js
* run `npm install` in the base directory.
* run `node index.js` in the base directory.
* Go to http://yourhostname:5000 to start the master.
* Launch the provided peer url on the slaves.

# Usage

In general, you'll want to import your data over HTTP:

```
var dataset = RDD.http(["http://me.com/data1", "http://me.com/data2"]); // 2 partitions.
```

However, you'll need to be careful about CORS restrictions. If that's a
problem, use CORS Proxy (http://www.corsproxy.com/me.com/data1).

After createing an RDD for your dataset, if your dataset only consists of a few
files, you'll probably want to break it up into lines and then split the rdds
into multiple partitions:

```
var lines = dataset.lines().split(100); // 200 partitions
```

Unfortunately, even if you don't have that many workers, you'll still need to
split up the partitions because the amount of data that can be transfered over
a webrtc socket is limited (per message) and we don't chunk data.

Then run your computation (find the longest line):

```JavaScript
lines.map(function(line) {
  return line.length;
}).fold(0, function(a, b) {
  return a > b ? a : b;
}).print(); // Print triggers the actual computation.
```

If you want to plot line lengths, you can use plotLine:

```JavaScript
lines.map(function(line) {
  return line.length;
}).plotLine();
```

# Custom RDDs

To write a custom RDD, just call `RDD.implement`. For example, the map RDD is
implemented as follows (you can input this directly into the interactive
console):

```JavaScript
// RDD.
var MappedRDD = RDD.implement({
  // Initialization function. This function is allowd to set rdd private state.
  // This will be run once on every peer.
  init: function(parent, fn) {
    this.parent = parent;
    this.fn = fn;
  },
  // Produces a list of partitions. This will be run once on every peer.
  getPartitions: function() {
    var that = this;
    return _.map(this.parent.partitions, function(parent, index)  {
      return new RDD.Partition(that, index, parent);
    });
  },
  // Compute a partition. This is where all the work is done.
  //
  // Because JavaScript is non-blocking, compute takes a "processor" instead
  // of returning an iterator. In a blocking language, the parent would call next on
  // an iterator returned by the child to get the next item to process and
  // would call hasNext to determine if the iterator has any more items left.
  // In this (asynchrounous) system, the parent passes a `processor` to the child
  // and the child calls `processor.process` on every item and `processor.done`
  // when there are no more items to process.
  //
  // The task context is a context shared by a single task on a single worker.
  // You probably shouldn't touch it but make sure to pass it to child iterators.
  //
  // Rules of compute:
  //   1. Compute MUST synchronously call iterate on the dependencies.
  //   2. Compute MUST NOT synchrounously call the processor.
  compute: function(taskContext, partition, processor) {
    var that = this;
    partition.dependencies[0].iterate(taskContext, {
      process: function(item) {
        processor.process(that.fn(item));
      },
      done: processor.done
    });
  },
});

// You can use `extend` to add extension functions to all RDDs.
// JavaScript has no types.
RDD.extend("map", function(fn) {
  return new MappedRDD(this, fn);
});
```
