
//define basic visualization parameters
var startYear = 1900; //1400 is a good early start
	endYear = 2010;
	timeStep = 100;
	year = startYear;
	noDataColor = "#cccccc"
	maxColor = "red"
	minColor = "#8798b2"
	
//define map size based on screen		
var mapWidth = mapBox.clientWidth;
	mapHeight = mapBox.clientHeight;

//define global variable to track which country is selected
var selectionID = null;


var map = d3.select("#map")
	.append("g")

/*Create a new projection using mercator (geoMercator)
and center it (translate)*/
var projection = d3.geoMercator()
	.translate([mapWidth/2, mapHeight/1.65])	/*center in our visual*/
	.scale(mapWidth/6.3)					/*initial scale factor for the geojson map I'm using*/

//create a path using (geoPath) using the projection
var path = d3.geoPath()
	.projection(projection)
	
	
//Define MoveToFront function
d3.selection.prototype.moveToFront = function() {
  return this.each(function(){
    this.parentNode.appendChild(this);
  });
};

//Prep the tooltip bits, initial display is hidden (copied from http://bl.ocks.org/mstanaland/6100713)
var tooltip = d3.select("#map")
	.append("g")
	.attr("class", "tooltip")
	.style("display", "none");
    
tooltip.append("rect")
  .attr("height", 20)
  .attr("fill", "white")
  .style("opacity", 0.5);

tooltip.append("text")
  .attr("x", 5)
  .attr("dy", "1.2em")
  .style("text-anchor", "left")
  .attr("font-size", "12px")
  .attr("font-weight", "bold");
  

/*Read in our data:
	1. our topojson world definitions
	2. record counts that have been smoothed over a 5 year window
	3. a lookup table for country names (they weren't included in our topojson data) */
d3.queue()
	.defer(d3.json, "data/world.json")
	.defer(d3.csv, "data/location_by_year_smooth.csv")
	.defer(d3.csv, "data/countries.csv")
	.defer(d3.csv, "data/year_count.csv")
	.await(ready);
	
/*Once map and LoC data are loaded, do the following*/
function ready (error, data, LoC, countryLookup, yearCount) {
	//convert counts to integers
	LoC.forEach(function(d){
		d.smooth5 = +d.smooth5;
	})
	
	//Define color scale function
	var maxCount = d3.max(LoC, function(d) { return d.smooth5; });	
	var countryColor = d3.scalePow()
		.exponent(.2)
		.domain([0,maxCount])
		.range([minColor, maxColor])
		.clamp(true);
	
	//build LoCData data object	
	var LoCData = {};
	LoC.forEach( function(d){
					if (LoCData[d.ISOnumeric3] == undefined){
						LoCData[d.ISOnumeric3] = {}
					}
					LoCData[d.ISOnumeric3][parseInt(d.pubDate)]= {}
					LoCData[d.ISOnumeric3][parseInt(d.pubDate)]["color"] = countryColor(d.count)
					LoCData[d.ISOnumeric3][parseInt(d.pubDate)]["count"] = parseInt(d.count)
		}
	)

	//build country lookup table
	var country = {};
	countryLookup.forEach( function(d){
		if (LoCData[d.ISOnumeric3] == undefined){
			LoCData[d.ISOnumeric3] = {}
		}
		country[d.ISOnumeric3] = d.countryName
		}
	)
	
	//build year_count lookup table
	var year_count = {};
	yearCount.forEach( function(d){
		year_count[d.year] = d.recordCount
	}
	)

	//extract country features and draw initial country shapes
	var countries = topojson.feature(data, data.objects.countries).features	
	countrySelection = map.selectAll(".country")
		.data(countries)
		.enter().append("path")
		.attr("class", "country")
		.attr("d", path)
		.attr("fill", null)
		.attr("fill", noDataColor)
		

		//Define hover and click behavior - highlighting and tooltip
		
		//add the class 'highlighted' on mouseover
		.on('mouseover', function(d) {
			d3.select(this)
				//	==HIGHLIGHT==
				.classed("highlighted", true)
				.moveToFront();
			d3.selectAll(".selected")	//bring selected country to the front
				.moveToFront();
			tooltip
				.style("display", null) //let default display style show
				.moveToFront()
				.select("text").text(country[parseInt(d.id)]);
			var dim = tooltip.select("text").node().getBBox();
			tooltip.select("rect").attr("width", dim.width+10);
		})
		
		//remove the class 'highlighted' on mouseout
		.on('mouseout', function(d) {
			d3.select(this)
				.classed("highlighted", false);
			tooltip.style("display", "none"); //hide tooltip on mousout
		})
		
		//move tooltip to follow mouse
		.on('mousemove', function(d) {
			var xPosition = d3.mouse(this)[0] + 10;
			var yPosition = d3.mouse(this)[1] - 25;
			tooltip.attr("transform", "translate(" + xPosition + "," + yPosition + ")");

		})

		//add the class 'selected' on click
		.on('click', function(d){
			selectionID = null;
			var clickSelection = d3.select(this)
			clickSelection.classed("selected", function(d){
				if (clickSelection.classed("selected")){
					return false	//if already selected, unselect it
				} else {
					selectionID = parseInt(d.id);
					selectionName = country[parseInt(d.id)];
					d3.selectAll(".selected").classed("selected", false);	//clear previous selection
					clickSelection.moveToFront()	//bring selected country to front of draw order
					return true}
			});
			tooltip.moveToFront();
			//header.textContent = selectionName;
		})
		
	//updates the graphic periodically
	function updateDraw(elapsed){
	//draw countries
		year = (( (year  % startYear) + 1 ) % (endYear - startYear)) + startYear
		//year = (Math.floor(elapsed/timeStep) % (endYear - startYear)) +startYear
		
		yearBox.textContent = year
		
		//change header to display count of records of selected country
		if (selectionID == null){
			header.textContent = "Global LoC book records with subject location metadata: " 
				+ parseInt(year_count[year])
					.toLocaleString();
			} else { 
			if (LoCData[selectionID][year] != undefined){ 
				var selectionCount = LoCData[selectionID][year]["count"];
			}	else { var selectionCount = 0 }
			header.textContent = "LoC book records about " 
				+ country[selectionID] + ": " 
				+ selectionCount.toLocaleString()
			}
				
			//change fill color to scale with count
			countrySelection.transition().attr("fill", function(d){
				if (LoCData[parseInt(d.id)] != undefined){
					if (LoCData[parseInt(d.id)][year] != undefined){
						return LoCData[parseInt(d.id)][year]["color"];
					} else {return noDataColor}
				} else {return noDataColor}
			})
			
	}

	//run updateDraw after every timeStep milliseconds
	d3.interval(updateDraw,timeStep);		
	}
	
