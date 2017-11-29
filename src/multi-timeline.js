import { select as d3Select } from "d3-selection";
import { timeFormat } from "d3-time-format";
import { timeYear } from "d3-time";
import { scaleTime as d3ScaleTime, scaleBand as d3ScaleBand } from "d3-scale";
import { axisLeft as d3AxisLeft, axisTop as d3AxisTop } from "d3-axis";
import "d3-transition";

function multiFormat(date) {
    return (timeYear(date) < date ? timeFormat("%b") : timeFormat("%Y"))(date);
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

        this.svg = d3Select(holder).append("svg");
        this.dims = {
            margin: { top: 35, right: 20, bottom: 25, left: 75 },
        };
    }

    draw() {
        this.xScale = d3ScaleTime().domain([new Date(2002, 9, 1), new Date(2017, 12, 1)]); //TODO: make dynamic

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

        this.placesSvg
            .enter()
            .append("rect")
            .attr("class", d => d.type)
            .attr("x", 0)
            .attr("rx", 4)
            .attr("yx", 4)
            .attr("y", d => d.pos * 23)
            .attr("width", 0)
            .attr("height", 20);

        this.placesSvg
            .enter()
            .append("text")
            .classed("place-label", true)
            .text(d => d.label)
            .attr("x", 0)
            .attr("font-size", 15)
            .attr("y", d => d.pos * 23 + 15)
            .attr("alignment-baseline", "middle")
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
            .attr("transform", svgTranslate(this.dims.margin.left, 100))
            .call(this.ySkillAxis);

        this.skillsHolderSvg = this.svg
            .append("g")
            .attr("id", "skills")
            .attr("transform", svgTranslate(this.dims.margin.left, 100));

        this.skillsSvg = this.skillsHolderSvg
            .selectAll("rect")
            .data(this.skills, d => d.used_in.id + "/" + d.name);

        var bandwidth = this.ySkillScale.bandwidth();

        this.skillsSvg
            .enter()
            .append("rect")
            .attr("x", 0)
            .attr("y", d => this.ySkillScale(d.name) + 0.1 * bandwidth)
            .attr("rx", 4)
            .attr("yx", 4)
            .attr("width", 0)
            .attr("height", 0.8 * bandwidth);

        this.redraw();
    }

    redraw() {
        console.log(this);

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
            .attr(
                "visibility",
                (d, e, t) =>
                    this.xScale(d.to) - this.xScale(d.from) > t[e].getBoundingClientRect().width
                        ? "visible"
                        : "hidden"
            );
    }
}
