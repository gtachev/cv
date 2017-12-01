import { select as d3Select, event as d3CurrentEvent } from "d3-selection";
import { timeFormat } from "d3-time-format";
import { timeYear, timeMonth } from "d3-time";
import { scaleTime as d3ScaleTime, scaleBand as d3ScaleBand } from "d3-scale";
import { axisLeft as d3AxisLeft, axisTop as d3AxisTop } from "d3-axis";
import { transition as d3Transition } from "d3-transition";
import { zoom as d3Zoom } from "d3-zoom";
import "d3-selection-multi";

d3Transition(); // TODO: fix this; needed so rollup does not throw out d3-selection-multi for transition...

function multiFormat(date) {
    return (timeYear(date) < date
        ? timeMonth(date) < date ? timeFormat("%d %b") : timeFormat("%b")
        : timeFormat("%Y"))(date);
}

function svgTranslate(left, top) {
    return "translate(" + left + "," + top + ")";
}

export class MutiTimeline {
    constructor(holder, places, skills, skillNames) {
        this.holder = holder;
        //TODO: use separate setters?
        this.places = places;
        this.skills = skills;
        this.skillNames = skillNames;

        this.dims = {
            margin: { top: 35, right: 20, bottom: 25, left: 85 },
            place: { height: 20, gap: 3, textMaxSize: 15, textAdjMinSize: 10, radius: 5 },
        };

        this.svg = d3Select(holder).append("svg");
        this.redrawCounter = 0;
    }

    draw() {
        this.xScaleAll = d3ScaleTime().domain([new Date(2002, 9, 1), new Date(2017, 12, 1)]); //TODO: make dynamic
        this.xScale = this.xScaleAll;

        this.xAxis = d3AxisTop(this.xScale).tickFormat(multiFormat);

        this.xAxisSvg = this.svg
            .append("g")
            .attr("id", "timeline")
            .attr("transform", svgTranslate(this.dims.margin.left, this.dims.margin.top));

        this.placesHolderSvg = this.svg
            .append("g")
            .attr("id", "places")
            .attr("transform", svgTranslate(this.dims.margin.left, 40));

        this.placesSvg = this.placesHolderSvg.selectAll("rect").data(this.places, d => d.id);

        var placesSvgEnter = this.placesSvg
            .enter()
            .append("g")
            .attr("class", "place")
            .attr("id", d => d.id);

        placesSvgEnter
            .append("rect")
            .attr("class", d => d.type)
            .attr("x", 0)
            .attr("rx", this.dims.place.radius)
            .attr("y", d => d.pos * (this.dims.place.height + this.dims.place.gap))
            .attr("width", 0)
            .attr("height", this.dims.place.height);

        placesSvgEnter.append("title").text(d => d.description);

        placesSvgEnter
            .append("text")
            .classed("place-label", true)
            .text(d => d.label)
            .attr("x", 0)
            .attr("font-size", this.dims.place.textMaxSize)
            .attr(
                "y",
                d =>
                    d.pos * (this.dims.place.height + this.dims.place.gap) +
                    this.dims.place.height / 2
            )
            .attr("dy", ".35em") // dominant-baseline is not supported in IE/Edge...
            .attr("text-anchor", "middle")
            .attr("visibility", "hidden");

        this.ySkillScale = d3ScaleBand()
            .domain(Array.from(this.skillNames.values()))
            .range([0, this.skillNames.size * 15]);

        this.ySkillAxis = d3AxisLeft(this.ySkillScale);
        //.tickFormat(d => d.replace("/", '\n'));

        this.svg
            .append("g")
            .attr("id", "skillnames")
            .attr("transform", svgTranslate(this.dims.margin.left - 20, 150))
            .call(this.ySkillAxis);

        this.skillsHolderSvg = this.svg
            .append("g")
            .attr("id", "skills")
            .attr("transform", svgTranslate(this.dims.margin.left, 150));

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
            .on("zoom", () => {
                console.log(d3CurrentEvent);
                this.xScale = d3CurrentEvent.transform.rescaleX(this.xScaleAll);
                this.xAxis.scale(this.xScale);
                this.redraw();
            });
        this.svg.call(this.zoom);

        this.redraw();
    }

    redraw() {
        console.log("redraw " + this.redrawCounter++);
        var width =
            this.svg.node().getBoundingClientRect().width -
            this.dims.margin.left -
            this.dims.margin.right;
        // var height = svg.node().getBoundingClientRect().height - this.dims.margin.top - this.dims.margin.bottom;

        this.xScale.range([0, width]);
        this.xAxis.ticks(
            width / this.xScale.ticks().length > 70 ? width / 70 : this.xScale.ticks().length
        );

        var widthPerTick = width / this.xScale.ticks().length;
        // Sigmoidal between 1 (no space) and 0 (a lot of space)
        var squashed = Math.pow(1 / (1 + Math.pow(Math.E, (widthPerTick - 30) / 5)), 3);

        this.xAxisSvg
            .transition()
            .call(this.xAxis)
            .selectAll("text")
            //.style("text-anchor", "start")
            .attr("font-size", 0.5 + 0.8 * Math.pow(1 - squashed, 0.3) + "em")
            .attr("dx", Math.sin(squashed * Math.PI / 2) * 20 + "px")
            .attr("dy", Math.sin(squashed * Math.PI / 2) * 14 - 4 + "px")
            .attr("transform", "rotate(-" + 90 * squashed + ")");

        this.svg
            .selectAll("#places rect, #skills rect")
            .transition()
            .attr("x", d => this.xScale(d.from))
            .attr("width", d => this.xScale(d.to) - this.xScale(d.from));

        this.placesHolderSvg
            .selectAll("text")
            .transition()
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
        clearTimeout(this.redrawTimer);
        this.redrawTimer = setTimeout(this.redraw.bind(this), 100);
    }
}
