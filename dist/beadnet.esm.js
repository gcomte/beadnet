import log from 'loglevel';
import extend from 'extend';

let names = ["Lester","Margot","Abdul","Avery","Clara","Ewald","Kendall", "Leda","Dawn","Quinn","Dane","Buster","Carlee","Maud","Jacey","Samara", "Alene","Kaylin","Hubert","Al","Franco","Mervin","Neha","Kole","Candida","Enoch", "Pansy","Ryder","Mabel","Tavares","Landen","Bryon", "Dayne","Derek","Kyla","Estevan","Orval","Violette","Daija", "Stella","Zelma","Robyn","Colby","Joyce","Cruz","Pedro","Leanna", "Emanuel","Hans","Randal","Ivy","Marco", "Abbey","Shea","Ethan","Novella","Abel","Kale","Irma","Esther","Ransom","Glennie", "Edmund","Aric","Aiyana","Trenton","Dana","Wade","Tyrell","Timmy","Dudley","Macy", "Marilie","Kaley","Gayle","Eda","Max","Kaitlyn","Josie","Lea","Nico","Marc"];

function getName() {
	return names[Math.floor(Math.random()*names.length)];
}

log.enableAll();
log.setLevel("TRACE");

const defaultOptions = {
			
	colorScheme: d3.scaleOrdinal(d3.schemeCategory10),

	debug: false,

	container: {
		selector: '#beadnet',
		backgroundColor: '#FFF'
	},

	nodes: {
		radius: 30,
		color: null,
		strokeWidth: 3,
		strokeColor: null,

		/* ['id', 'balance'] */
		text: 'id'
	},

	channels: {
		color: 'gray',
		strokeWidth: 6,
		strokeColor: null,

		/* show channel balance as text path */
		showBalance: false
	},

	beads: {
		radius: 10,
		spacing: 0,
		strokeWidth: 2,
		strokeColor: null,

		showIndex: null
	}
};

/** 
 * Merge default option with user given options 
 * To make a parameter required set it to "undefined" in the defaults. 
 */
function extendDefaultOptions(options) {
	let opt = {};
	extend(true, opt, defaultOptions, options);
	
	opt.nodes.color = opt.nodes.color || opt.colorScheme(0);
	opt.nodes.strokeColor = opt.nodes.strokeColor || opt.container.backgroundColor;

	opt.beads.color = opt.beads.color || opt.colorScheme(10);
	opt.beads.strokeColor = opt.beads.strokeColor || opt.container.backgroundColor;
	opt.beads.animation = opt.beads.animation || d3.easeExp;
	
	opt.beads.distance = 2 * opt.beads.radius + opt.beads.spacing;
	opt.beads.firstPosition = 	opt.nodes.radius + opt.beads.radius + opt.beads.spacing;
	opt.beads.showIndex = opt.beads.showIndex === null ? opt.debug : opt.beads.showIndex;
	
	return opt;
}

const getRandomNumber = function(max) {
	return Math.floor(Math.random() * max);
};

/**
 * TODO:
 */
class Beadnet {

	/**
	 * Create a new BeadNet chart.
	 * @param {Object} options 
	 */
	constructor(options) {
		this._opt = extendDefaultOptions(options);
		log.debug("initializing beadnet with options: ", this._opt);

		/* find the parent container DOM element and insert an SVG */
		this.container = document.querySelector(this._opt.container.selector);
		this.svg = d3.select(this.container)
			.append("svg")
			.attr("class", "beadnet");
		
		this.updateSVGSize();

		/* create svg root element called with class "chart" and initial  */
		this.chart = this.svg.append("g")
			.attr("class", "chart")
			.attr("transform", "translate(0,0) scale(1)");

		/* create a SVG-container-element for all nodes and all channels */
		this.channelContainer = this.chart.append("g").attr("class", "channels");
		this.nodeContainer = this.chart.append("g").attr("class", "nodes");
		
		this._nodes = [];
		this._channels = [];
		this.beadElements = [];

		this.simulation = this._createSimulation();
		
		this.updateSimulationCenter();

		this.behaviors = this.createBehaviors();
		this.svg.call(this.behaviors.zoom);

		this._updateNodes();
		
		window.addEventListener("resize", this.onResize.bind(this));
	}

	/**
	 * Return the node element with the given id.
	 * @param {String} id - the id of the node to find.
	 * @returns {Node|undefinded}
	 */
	_getNodeById(id) {
		return this._nodes.find((node) => node.id == id);
	}

	/**
	 * @returns {d3.forceSimulation} simulation
	 * @private
	 */
	_createSimulation() {
		// return d3.forceSimulation()
			//.nodes(this._nodes)
			// .alphaDecay(0.1)
			// .force("x", d3.forceX().strength(0))
			// .force("y", d3.forceY().strength(1))
			// .force("charge", d3.forceManyBody().strength(-1000).distanceMin(this.forceDistance).distanceMax(3*this.forceDistance))
			// .force("collide", d3.forceCollide(this.forceDistance/6))
			// .force("link", d3.forceLink(this._channels).distance(this.forceDistance))
			// .force("center", d3.forceCenter(this.width / 2, this.height / 2))
			// .alphaTarget(0)
			// .on("tick", this._ticked.bind(this));

		return d3.forceSimulation(this._nodes)
			.force("charge", d3.forceManyBody().strength(-3000))
			.force("link", d3.forceLink(this._channels).strength(0.01).distance(this.forceDistance))
			.force("x", d3.forceX())
			.force("y", d3.forceY())
			//.alphaTarget(0)
			.on("tick", this._ticked.bind(this));
	}

	/**
	 * TODO
	 */
	updateSVGSize() {
		this.width = +this.container.clientWidth;
		this.height = +this.container.clientHeight;
		this.forceDistance = (this.width + this.height)*.1;
		this.svg
			.attr("width", this.width)
			.attr("height", this.height);
	}

	/**
	 * TODO
	 */
	onResize() {
		this.updateSVGSize();
		this.updateSimulationCenter();
		this.createBehaviors();
	}
	
	/**
	 * TODO:
	 */
	createBehaviors() {
		return {

			zoom: d3.zoom()
				.scaleExtent([0.1, 5, 4])
				.on('zoom', () => this.chart.attr('transform', d3.event.transform)),

			drag: d3.drag()
				.on("start", this._onDragStart.bind(this))
				.on("drag", this._onDragged.bind(this))
				.on("end", this._onDragendEnd.bind(this))
		}
	}

	/**
	 * TODO:
	 */
	updateSimulationCenter() {
		const centerX = this.svg.attr('width') / 2;
		const centerY = this.svg.attr('height') / 2;
		this.simulation
			.force("center", d3.forceCenter(centerX, centerY))
			.restart();
	}

	/**
	 * Update DOM elements after this._nodes has been updated.
	 * This creates the SVG repensentation of a node.
	 * 
	 * @private
	 */
	_updateNodes() {
		this._nodeElements = this.nodeContainer
			.selectAll(".node")
			.data(this._nodes, (data) => data.id);

		/* remove deleted nodes */
		this._nodeElements.exit()
			.remove();

		/* create new nodes */
		var nodeParent = this._nodeElements.enter().append("g")
			.attr("class", "node")
			.attr("id", (data) => data.id)
			.attr("balance", (data) => data.balance)
			.style("stroke", this._opt.nodes.strokeColor)
			.style("stroke-width", this._opt.nodes.strokeWidth);
				
		nodeParent.append("circle")
			.attr("class", "node-circle")
			.attr("fill", (data) => data.color)
			.attr("r",  this._opt.nodes.radius)
			.style("cursor", "pointer");
				
		nodeParent.append("text")
			.style("stroke-width", 0.5)
			.attr("class", "node-text")
			.attr("stroke", this._opt.container.backgroundColor)
			.attr("fill", this._opt.container.backgroundColor)
			.attr("font-family", "sans-serif")
			.attr("font-size", "15px")
			.attr("y", "5px")
			.attr("text-anchor", "middle")
			.attr("pointer-events", "none")
			.text((d) => d[this._opt.nodes.text]);

		nodeParent.call(this.behaviors.drag);

		/* update existing nodes */
		this._nodeElements
			.attr("balance", (data) => data.balance)
			.selectAll('.node-text')
			.text((d) => d[this._opt.nodes.text]);

		this.simulation
			.nodes(this._nodes)
			.alpha(1)
			.restart();

		this._nodeElements = this.nodeContainer
			.selectAll(".node");

		return this._nodeElements;
	}

	/**
	 * Adds a new node to the network.
	 * 
	 * @param {Node} node 
	 * @returns {BeatNet}
	 */
	addNode(node) {
		node = node || {};

		/* initialize with default values */
		node.id = node.id || getName();
		node.channelCount = 0;
		node.color = node.color || this._opt.colorScheme(this._nodes.length % 10);

		/* save to nodes array */
		this._nodes.push(node);
		this._updateNodes();

		/* make this funktion chainable */
		return this;
	}

	/**
	 * Adds multible new nodes to the network.
	 * 
	 * @param {Array<Node>} nodes
	 * @returns {BeatNet}
	 */
	addNodes(nodes) {
		nodes.forEach((node) => this.addNode(node));

		/* make this funktion chainable */
		return this;
	}

	/**
	 * Removes a the node with the given id from the network.
	 * 
	 * @param {String} nodeId 
	 * @returns {BeatNet}
	 */
	removeNode(nodeId) {
		this._nodes = this._nodes.filter(node => node.id != nodeId);
		this._updateNodes();	
		
		/* make this funktion chainable */
		return this;
	};

	/**
	 * Create new nodes with random names.
	 * @param {Integer} [count=1] - how many nodes.
	 * @returns {Node}
	 */
	createRandomNodes(count) {
		if ((typeof count !== "undefined" && typeof count !== "number") || count < 0) {
			throw new TypeError('parameter count must be a positive number');
		}
		return Array.from(new Array(count), (x) => {
			return {
				id: getName(),
				balance: getRandomNumber(10)
			};
		});
	}

	/**
	 * TODO: getRandomNode
	 * @returns {Node}
	 */
	getRandomNode() {
		return this._nodes[getRandomNumber(this._nodes.length)];
	}

	/**
	 * TODO:
	 * @private
	 * @returns {d3.selection} this._channelElements
	 */
	_updateChannels() {
		const opt = this._opt;

		this._channelElements = this.channelContainer.selectAll(".channel").data(this._channels);

		/* remove channels that no longer exist */
		this._channelElements.exit().remove();

		/* create new svg elements for new channels */
		var channelRoots = this._channelElements.enter().append("g")
			.attr("class", "channel")
			.attr("id", (d) => d.id)
			.attr("source-balance", (d) => d.sourceBalance)
			.attr("target-balance", (d) => d.targetBalance)
			.attr("source-id", (d) => d.source.id)
			.attr("target-id", (d) => d.target.id);

		channelRoots.append("path")
			.attr("class", "path")
			.attr("id", (d) => `${d.id}_path`)
			.style("stroke-width", opt.channels.strokeWidth)
			.style("stroke", opt.channels.color)
			.style("fill", "none");

		if (this._opt.channels.showBalance) {
			channelRoots.append("text")
				.attr("class", "channel-text")
				.attr("font-family", "Verdana")
				.attr("font-size", "12")
				.attr("dx", 150) //TODO: make this dynamic
				.attr("dy", -7)
				.style("pointer-events", "none")
				.append("textPath")
					.attr("xlink:href", (d) => `#${d.id}_path`)
					.attr("class", "channel-text-path")
					.style("stroke-width", 1)
					.style("stroke", opt.channels.color)
					.style("fill", "none")
					.text((d) => `${d.sourceBalance}:${d.targetBalance}`);
		}

		let sourceBalance = +channelRoots.attr("source-balance");
		let targetBalance = +channelRoots.attr("target-balance");
		var beadArray = Array.from(new Array(sourceBalance), (x, index) => {
			return {
				state: 0,
				index: index
			}
		});
		beadArray.push(...Array.from(new Array(targetBalance), (x, index) => {
			return {
				state: 1,
				index: sourceBalance+index
			}
		}));
	
		let beadElements = channelRoots.selectAll(".bead").data(beadArray);
		
		beadElements.exit().remove();
		
		let beadElement = beadElements.enter().append("g")
			.attr("class", "bead")	
			.attr("channel-state", (d) => d.state) //TODO: 0 or 1?
			.attr("index", (d) => d.index);
	
			beadElement.append("circle")
			.attr("r",  opt.beads.radius)
			.style("stroke-width", opt.beads.strokeWidth)
			.style("fill", opt.beads.color)
			.style("stroke", opt.beads.strokeColor);

		if (opt.beads.showIndex) {
			/* show bead index */
			beadElement.append("text")
				.attr("class", "bead-text")	
				.style("stroke-width", 0.2)
				.attr("stroke", opt.container.backgroundColor)
				.attr("fill", opt.container.backgroundColor)
				.attr("font-family", "sans-serif")
				.attr("font-size", "8px")
				.attr("y", "2px")
				.attr("text-anchor", "middle")
				.attr("pointer-events", "none")
				.text((d) => d.index);
		}

		/* update channel */
		if (this._opt.channels.showBalance) {
			this._channelElements.selectAll('.channel-text-path')
				.text((d) => `${d.sourceBalance}:${d.targetBalance}`);
		}

		/* update this._paths; needed in this._ticked */
		this._paths = this.channelContainer.selectAll(".channel .path");
		this.beadElements = this.channelContainer.selectAll(".channel .bead");

		return this._channelElements;
	}

	/**
	 * TODO:
	 * @param {*} channelInfos 
	 */
	_getUniqueChannelId(channelInfos) {
		const channelBalance = (channelInfos.sourceBalance || 0) + (channelInfos.targetBalance || 0);
		let nonce = 0;
		let id = `channel${channelInfos.source}${channelBalance}${channelInfos.target}${nonce}`;
		while (this._channels.filter((channel) => channel.id == id).length > 0) {
			nonce++;
			id = `channel${channelInfos.source}${channelBalance}${channelInfos.target}${nonce}`;
		}
		return id;
	}

	/**
	 * TODO: addChannel
	 * @param {Channel} channel 
	 */
	addChannel(channel) {		let source = this._getNodeById(channel.source);
		let target = this._getNodeById(channel.target);

		if (source.balance < channel.sourceBalance) {
			throw new Error("Insufficient Funds. The source node has not enough funds to open this channel");
		}
		if (target.balance < channel.targetBalance) {
			throw new Error("Insufficient Funds. The target node has not enough funds to open this channel");
		}

		source.balance -= channel.sourceBalance;
		target.balance -= channel.targetBalance;
		this._updateNodes();

		const id = this._getUniqueChannelId(channel);
		this._channels.push({
			id: id,
			source: source, 
			target: target,
			sourceBalance: channel.sourceBalance,
			targetBalance: channel.targetBalance
		});

		source.channelCount = source.channelCount + 1;
		target.channelCount = target.channelCount + 1;

		this._updateChannels();

		this.simulation.force("link").links(this._channels);
		
		this.simulation.alpha(1).restart();
	}

	/**
	 * TODO: 
	 * @param {*} channels 
	 * @returns TODO:
	 */
	addChannels(channels) {
		channels.forEach((channel) => this.addChannel(channel));
	}

		/**
	 * Create new nodes with random names.
	 * @param {Integer} [count=1] - how many nodes.
	 * @returns {Node}
	 */
	createRandomChannels(count, unique) {
		// if ((typeof count !== "undefined" && typeof count !== "number") || count < 0) {
		// 	throw new TypeError('parameter count must be a positive number');
		// }
		let channels = Array.from(new Array(count), (x) =>  {
			let source = this.getRandomNode();
			let target = this.getRandomNode();

			if (unique) {
				let killCounter = 0;
				while((source.id == target.id || this.getChannels(source.id, target.id).length > 0) && killCounter < this._channels.length) {
					source = this.getRandomNode();
					target = this.getRandomNode();
					killCounter++;
				}
			}
			let sourceBalance = getRandomNumber(6);
			let targetBalance = getRandomNumber(6);
			sourceBalance = (!sourceBalance && !targetBalance) ?  getRandomNumber(6)+1 : sourceBalance;

			let channel = {
				source: source.id, 
				target: target.id,
				sourceBalance: sourceBalance,
				targetBalance: targetBalance
			};
			channel.id = this._getUniqueChannelId(channel);
			return channel;
		});
		return channels;
	}

	/**
	* TODO:
	*/
	getRandomChannel() {
		return this._channels[getRandomNumber(this._channels.length)];
	}

	/**
	 * TODO:
	 */
	getChannelCount() {
		return this._channels.length;
	}

	/**
	 * Remove channel with the given source and target ids.
	 * @returns {Beatnet} beatnet
	 */
	removeChannel(sourceId, targetId) {
		this._channels = this._channels.filter((channel) => (
				(channel.source.id != sourceId) || (channel.target.id != targetId)
		));
		this._updateChannels();	
		
		return this;
	}

	/**
	 * TODO:
	 * @param {*} sourceId 
	 * @param {*} targetId 
	 */
	getChannels(sourceId, targetId) {
		return this._channels.filter((channel) => 
			(channel.source.id == sourceId && channel.target.id == targetId) ||
			(channel.target.id == sourceId && channel.source.id == targetId)
		);
	}

	/**
	 * TODO:
	 * @param {*} b 
	 */
	_positionBeat(b) {
		const bead = d3.select(b);
		const index = bead.attr("index");
		const state = bead.attr("channel-state"); // state 0=source, 1=target
		const channel = d3.select(bead.node().parentNode);
		const path = channel.select('path');
		const sourceBalance = +channel.attr("source-balance");
		const targetBalance = +channel.attr("target-balance");
		const balance = sourceBalance + targetBalance;
		const distanceBetweenBeads = this._opt.beads.distance + this._opt.beads.spacing;
		const channelPadding = this._opt.beads.firstPosition +  this._opt.beads.spacing;
	
		var startPosition = channelPadding + (index * distanceBetweenBeads);	
		var endPosition = channelPadding + ((balance-1-index) * distanceBetweenBeads);
		var totalDistance = path.node().getTotalLength() - startPosition - endPosition;
	
		const beadPosition = path.node().getPointAtLength(startPosition + state * totalDistance);
		return `translate(${beadPosition.x},${beadPosition.y})`;
	}

	/**
	 * TODO: 
	 * @private
	 */
	_ticked() {
		if (this._nodeElements) {
			this._nodeElements.attr("transform", (data) => `translate(${data.x},${data.y})`);
		}
		if (this._paths) {
			this._paths.attr("d", (d) => {
				// var count = this._channels.filter((c) => ((d.source.id === d.source.id) && (d.target.id === d.target.id))).length;

				// if (count <= 1) {
					return `M${d.source.x},${d.source.y} ${d.target.x},${d.target.y}`;
				// } else {
				// 	var dx = d.target.x - d.source.x;
				// 	var dy = d.target.y - d.source.y;
				// 	var dr = Math.sqrt((dx*dx+count) + (dy*dy+count));
				// 	return `M${d.source.x},${d.source.y}A${dr},${dr} 0 0,1 ${d.target.x},${d.target.y}`;
				// }
			});
		}
		this.tickedBeads();
	}

	/**
	 * TODO:
	 */
	tickedBeads() {
		var that = this;
		if (!this.beadElements || this.beadElements.length === 0|| this.beadElements.empty()) {
			return;
		}
		this.beadElements.attr("transform", function(d) {
			return that._positionBeat(this);
		});
	}
	
	/**
	 * TODO
	 * @param {*} bead 
	 * @param {*} direction 
	 * @param {*} delay 
	 */
	animateBead(bead, direction, delay) {
		var that = this;
		return bead
			.transition()
				.delay(delay)	
				//.ease(d3.easeLinear)
				.ease(d3.easeQuadInOut)
				.duration(1000)
				.attrTween("channel-state", function(a) { return function(t) { 
					that.tickedBeads();
					if (direction) {
						return  t;
					} else {
						return 1-t
					}
				}});
	}

	/**
	 * TODO:
	 * @param {*} sourceId 
	 * @param {*} targetId 
	 * @param {*} beadCount 
	 * @param {*} callback 
	 */
	moveBeads(sourceId, targetId, beadCount, callback) {
		const channels = this.getChannels(sourceId, targetId);

		const channel = channels[0];

		// TODO: get channel with source and target
		const channelElement = d3.select(`#${channel.id}`);

		const balance = channel.sourceBalance + channel.targetBalance;

		if (channel.source.id == sourceId) {

			var startIndex = channel.sourceBalance - beadCount;
			var endIndex = startIndex + beadCount-1;

			var transitionCounter = 0;
			for (let i=endIndex; i>=startIndex; i--) {
				var bead = channelElement.select(`.bead[index="${i}"]`);
				const delay = (endIndex-i)*100;
				transitionCounter++;
				this.animateBead(bead, true, delay).on("end", (channel, a, b) => {
					channel.sourceBalance--;
					channel.targetBalance++;

					channelElement
						.attr("source-balance", channel.sourceBalance)
						.attr("target-balance", channel.targetBalance);

					if (this._opt.channels.showBalance) {
						channelElement.select('.channel-text-path')
							.text(`${channel.sourceBalance}:${channel.targetBalance}`);
					}

					transitionCounter--;
					if (transitionCounter <= 0) {
						return callback && callback();
					}
				});
			}

		} else {
			var startIndex = balance - channel.targetBalance;
			var endIndex = startIndex + beadCount-1;

			var transitionCounter = 0;
			for (let i=endIndex; i>=startIndex; i--) {
				var bead = channelElement.select(`.bead[index="${i}"]`);
				const delay = (i-endIndex)*100;
				transitionCounter++;
				this.animateBead(bead, false, delay).on("end", (channel, a, b) => {
					channel.targetBalance--;
					channel.sourceBalance++;
					
					channelElement
						.attr("source-balance", channel.sourceBalance)
						.attr("target-balance", channel.targetBalance);

					if (this._opt.channels.showBalance) {
						channelElement.select('.channel-text-path')
							.text(`${channel.sourceBalance}:${channel.targetBalance}`);
					}

					transitionCounter--;
					if (transitionCounter <= 0) {
						return callback && callback();
					}
				});
			}
			
		}
	}

	/**
	 * TODO: 
	 * @private
	 */
	_onDragStart(d) {
		if (!d3.event.active) {
			this.simulation
				.alphaTarget(0.1)
				.restart();
		}
		d.fx = d.x;
		d.fy = d.y;
	}
	
	/**
	 * TODO: 
	 * @private
	 */
	_onDragged(d) {
		d.fx = d3.event.x; 
		d.fy = d3.event.y;
	}
	
	/**
	 * TODO: 
	 * @private
	 */
	_onDragendEnd(d) {
		if (!d3.event.active) { 
			this.simulation
				.alphaTarget(0);
		}
		d.fx = null;
		d.fy = null;
	}
}

export default Beadnet;
