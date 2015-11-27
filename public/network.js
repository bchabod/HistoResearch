var newtork = document.getElementById("cache").innerHTML;
window.alert(network);
var parseData = vis.network.convert(newtork);
var data = {
	nodes: parsedData.nodes,
	edges: parsedData.edges
}
var options = parsedData.nodes;
var container = document.getElementById('mynetwork');
var options.nodes = {
	color: 'red'
};
var network = new vis.Network(container,data,options);
