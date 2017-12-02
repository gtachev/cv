import { select as d3Select, event as d3CurrentEvent } from "d3-selection";
import { timeFormat } from "d3-time-format";
import { timeYear, timeMonth } from "d3-time";
import { scaleTime as d3ScaleTime, scaleBand as d3ScaleBand } from "d3-scale";
import { axisLeft as d3AxisLeft, axisTop as d3AxisTop } from "d3-axis";
import { timeout as d3Timeout } from "d3-timer";
import { zoom as d3Zoom } from "d3-zoom";
import "d3-selection-multi";

function multiFormat(date) {
    return (timeYear(date) < date
        ? timeMonth(date) < date ? timeFormat("%d %b") : timeFormat("%b")
        : timeFormat("%Y"))(date);
}

// Helper function for SVG translate expressions
function svgT(left, top, from) {
    var o = {
        left: left,
        top: top,
    };
    if (from) {
        o.left += from.left;
        o.top += from.top;
    }
    o.toString = function() {
        return "translate(" + this.left + "," + this.top + ")";
    };
    return o;
}

export class MutiTimeline {
    constructor(holder, places, initialSkills) {
        this.holder = holder;
        this.placeTypes = places;
        this.skillsToShow = initialSkills;

        this.dims = {
            margin: { top: 35, right: 20, bottom: 25, left: 85 },
            place: { height: 20, gap: 3, textMaxSize: 15, textAdjMinSize: 10, radius: 5 },
        };

        this.initPlaceAndSkillData();

        this.initPlaceTypeCheckboxes();
        this.initChart();
    }

    initPlaceAndSkillData() {
        this.places = [];
        this.placesMap = new Map();
        this.placeTypesMap = new Map();
        this.skills = [];
        this.skillsMap = {};

        this.placeTypes.forEach(pt => {
            this.placeTypesMap.set(pt.id, pt);
            pt.items.forEach(p => {
                p.type = pt.id;
                this.places.push(p);
                this.placesMap.set(p.id, p);
                p.skills.forEach(s => {
                    this.skillsMap[s.name] = true;
                    this.skills.push(s);
                    //TODO: calculate total skill strength
                });
            });
        });
        this.places.sort((a, b) => a.from - b.from);
        this.skills.sort((a, b) => {
            return b.to - b.from - (a.to - a.from);
        });

        this.skillNames = Object.getOwnPropertyNames(this.skillsMap);

        console.log(this);
    }

    initPlaceTypeCheckboxes() {
        this.placeCheckboxes = d3Select(this.holder)
            .append("div")
            .attr("class", "place_checkboxes")
            .selectAll(".place_checkbox_holder")
            .data(this.placeTypes, d => d.id);

        var checkboxEnter = this.placeCheckboxes
            .enter()
            .append("div")
            .attr("class", "place_checkbox_holder");
        checkboxEnter
            .append("input")
            .attr("type", "checkbox")
            .attr("id", d => "place_" + d.id)
            .property("checked", d => d.enabled)
            .on("change", d => {
                d.enabled = d3CurrentEvent.target.checked;
                this.updatePlaces();
                this.redraw(); //TODO: use something like this.updatePlacesX();
            });
        checkboxEnter
            .append("label")
            .attr("for", d => "place_" + d.id)
            .append("span")
            .text(d => d.name);
    }

    updatePlaces() {
        // Calculate the position for all visible places
        var visiblePlaces = this.places.filter(p => this.placeTypesMap.get(p.type).enabled);
        var lastAtPos = [];
        visiblePlaces.forEach(p => {
            var pos = 0;
            while (lastAtPos[pos] > p.from) {
                pos++;
            }
            lastAtPos[pos] = p.to;
            p.pos = pos;
        });

        var chartPlaces = this.placesHolderSvg.selectAll("g.place").data(visiblePlaces, d => d.id);
        chartPlaces.exit().remove(); //TODO: fade transition

        var chartPlacesEnter = chartPlaces
            .enter()
            .append("g")
            .attr("class", d => "place " + d.type)
            .attr("id", d => d.id);

        chartPlacesEnter
            .append("rect")
            .attr("x", 0)
            .attr("rx", this.dims.place.radius)
            .attr("width", 0)
            .attr("height", this.dims.place.height);

        chartPlacesEnter.append("title").text(d => d.description);

        chartPlacesEnter
            .append("text")
            .classed("place-label", true)
            .text(d => d.label)
            .attr("x", 0)
            .attr("font-size", this.dims.place.textMaxSize)
            .attr("y", this.dims.place.height / 2)
            .attr("dy", ".35em") // dominant-baseline is not supported in IE/Edge...
            .attr("text-anchor", "middle")
            .attr("visibility", "hidden");

        chartPlaces
            .merge(chartPlacesEnter)
            .attr("transform", d =>
                svgT(0, d.pos * (this.dims.place.height + this.dims.place.gap))
            );
    }

    initChart() {
        this.svg = d3Select(this.holder).append("svg");
        this.clipPath = this.svg
            .append("defs")
            .append("clipPath")
            .attr("id", "clip")
            .append("rect");
        this.clipPath.attr("width", 400).attr("height", 1400); //TODO: move?

        this.xScaleAll = d3ScaleTime().domain([new Date(2002, 9, 1), new Date(2017, 12, 1)]); //TODO: make dynamic
        this.xScale = this.xScaleAll;

        this.xAxis = d3AxisTop(this.xScale).tickFormat(multiFormat);

        this.xAxisSvg = this.svg
            .append("g")
            .attr("id", "timeline")
            .attr("transform", new svgT(this.dims.margin.left, this.dims.margin.top));

        this.placesHolderSvg = this.svg
            .append("g")
            .attr("id", "places")
            .style("clip-path", "url(#clip)")
            .attr("transform", new svgT(this.dims.margin.left, 40));

        this.updatePlaces();

        this.ySkillScale = d3ScaleBand()
            .domain(Array.from(this.skillNames))
            .range([0, this.skillNames.length * 15]);

        this.ySkillAxis = d3AxisLeft(this.ySkillScale);
        //.tickFormat(d => d.replace("/", '\n'));

        this.svg
            .append("g")
            .attr("id", "skillnames")
            .attr("transform", svgT(this.dims.margin.left - 20, 150))
            .call(this.ySkillAxis);

        this.skillsHolderSvg = this.svg
            .append("g")
            .attr("id", "skills")
            .style("clip-path", "url(#clip)")
            .attr("transform", svgT(this.dims.margin.left, 150));

        this.skillsSvg = this.skillsHolderSvg
            .selectAll("rect")
            .data(this.skills, d => d.used_in.id + "/" + d.name);

        var bandwidth = this.ySkillScale.bandwidth();

        this.skillsSvg
            .enter()
            .append("rect")
            .attr("x", 0)
            .attr("y", d => this.ySkillScale(d.name) + 0.1 * bandwidth)
            .attr("fill-opacity", d => 0.8 * d.strength)
            .attr("rx", 2)
            .attr("yx", 2)
            .attr("width", 0)
            .attr("height", 0.8 * bandwidth);

        this.zoom = d3Zoom()
            .scaleExtent([0.8, 5])
            //TODO: disable mouse wheel zoom? add buttons for reset and zoom?
            .translateExtent([[-100, 0], [100, 0]])
            .on("zoom", () => {
                //console.log(d3CurrentEvent);
                this.xScale = d3CurrentEvent.transform.rescaleX(this.xScaleAll);
                this.xAxis.scale(this.xScale);
                //TODO: do not redraw everything when not zooming, just pan
                this.redrawDelayed();
            });
        this.svg.call(this.zoom);

        this.redraw();
    }

    redraw() {
        //console.log("redraw");
        this.width = this.svg.node().getBoundingClientRect().width;

        var width = this.width - this.dims.margin.left - this.dims.margin.right;
        // var height = svg.node().getBoundingClientRect().height - this.dims.margin.top - this.dims.margin.bottom;

        this.clipPath.attr("width", width);

        //TODO: fix this - part of chart is hidden after zooming and resizing
        this.zoom.translateExtent([[-100, 0], [width + 100, 0]]);

        this.xScale.range([0, width]);
        this.xAxis.ticks(
            width / this.xScale.ticks().length > 70 ? width / 70 : this.xScale.ticks().length
        );

        var widthPerTick = width / this.xScale.ticks().length;
        // Sigmoidal between 1 (no space) and 0 (a lot of space)
        var squashed = Math.pow(1 / (1 + Math.pow(Math.E, (widthPerTick - 30) / 5)), 3);

        this.xAxisSvg
            .call(this.xAxis)
            .selectAll("text")
            //.style("text-anchor", "start")
            .attr("font-size", 0.5 + 0.8 * Math.pow(1 - squashed, 0.3) + "em")
            .attr("dx", Math.sin(squashed * Math.PI / 2) * 20 + "px")
            .attr("dy", Math.sin(squashed * Math.PI / 2) * 14 - 4 + "px")
            .attr("transform", "rotate(-" + 90 * squashed + ")");

        this.svg
            .selectAll("#places rect, #skills rect")
            .attr("x", d => this.xScale(d.from))
            .attr("width", d => this.xScale(d.to) - this.xScale(d.from));

        this.placesHolderSvg
            .selectAll("text")
            .attr("x", d => (this.xScale(d.from) + this.xScale(d.to)) / 2)
            .attrs((d, e, t) => {
                let newFontSize = Math.min(
                    this.dims.place.textMaxSize,
                    parseFloat(t[e].getAttribute("font-size")) *
                        (this.xScale(d.to) - this.xScale(d.from) - 5) /
                        t[e].getBoundingClientRect().width
                );

                if (newFontSize < this.dims.place.textAdjMinSize / window.devicePixelRatio) {
                    return {
                        visibility: "hidden",
                    };
                }
                return {
                    visibility: "visible",
                    "font-size": newFontSize + "px",
                };
            });
    }

    redrawDelayed() {
        if (!this.requested) {
            this.requested = true;
            d3Timeout(() => {
                this.requested = false;
                this.redraw();
            });
        }
    }
}
