import { select as d3Select, event as d3CurrentEvent } from "d3-selection";
import { timeFormat } from "d3-time-format";
import { timeYear, timeMonth } from "d3-time";
import { scaleTime as d3ScaleTime, scaleBand as d3ScaleBand } from "d3-scale";
import { axisLeft as d3AxisLeft, axisTop as d3AxisTop } from "d3-axis";
import { timeout as d3Timeout } from "d3-timer";
import { zoom as d3Zoom } from "d3-zoom";
import "d3-transition";
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
            minWidth: 350,
            minHeight: 200,
            margin: { top: 35, right: 20, bottom: 25, left: 150, between: 10 },
            place: { height: 30, gap: 3, textMaxSize: 18, textAdjMinSize: 12, radius: 5 },
            skill: { rowHeight: 22, rectHeight: 20, radius: 2 },
        };

        this.options = {
            skillMaxOpacity: 0.8,
            defaultNumberOfSkillLines: 10,
            yearlySkillSortCoef: 0.5,
            extraSkillEquilibrationExp: 0.12,
        };

        this.initPlaceAndSkillData();

        this.chartAddPlaceTypeCheckboxes();
        this.initChart();
    }

    initPlaceAndSkillData() {
        this.places = [];
        this.placesMap = new Map();
        this.placeTypesMap = new Map();
        this.skills = [];
        this.skillStrengths = {};
        var now = Date.now();

        this.placeTypes.forEach(pt => {
            this.placeTypesMap.set(pt.id, pt);
            pt.items.forEach((p, i) => {
                p.type = pt.id;
                p.typeNum = i;
                this.places.push(p);
                this.placesMap.set(p.id, p);
                p.skills.forEach(s => {
                    this.skills.push(s);
                    var period = timeMonth.count(s.from, s.to) + 1;
                    var yearsAgo = Math.max(0, timeMonth.count(s.to, now)) / 12.0;
                    this.skillStrengths[s.name] =
                        (this.skillStrengths[s.name] || 0) +
                        period * s.strength * Math.pow(this.options.yearlySkillSortCoef, yearsAgo);
                });
            });
        });
        this.skillNames = Object.getOwnPropertyNames(this.skillStrengths);

        this.places.sort((a, b) => a.from - b.from || a.typeNum - b.typeNum);
        this.skills.sort((a, b) => b.to - b.from - (a.to - a.from));
        this.skillNames.sort((a, b) => this.skillStrengths[b] - this.skillStrengths[a]);

        if (!this.skillsToShow) {
            this.skillsToShow = this.skillNames.slice(0, this.options.defaultNumberOfSkillLines);
        }
        this.skillsToShowSet = new Set(this.skillsToShow);
    }

    chartAddPlaceTypeCheckboxes() {
        this.placeCheckboxes = d3Select(this.holder)
            .append("div")
            .attr("class", "place_checkboxes")
            .selectAll(".place_checkbox_holder")
            .data(this.placeTypes, d => d.id);

        var checkboxEnter = this.placeCheckboxes
            .enter()
            .append("div")
            .attr("class", "place_checkbox_holder")
            .attr("data-toggle-type", d => d.id);
        checkboxEnter
            .append("input")
            .attr("type", "checkbox")
            .attr("id", d => "place_" + d.id)
            .property("checked", d => d.enabled)
            .on("change", d => {
                d.enabled = d3CurrentEvent.target.checked;
                this.chartUpdatePlaces();
                this.yResize();
                this.xResize(); //TODO: remove
            });
        var label = checkboxEnter.append("label").attr("for", d => "place_" + d.id);
        label.append("span").attr("class", "checkbox_icon");
        label
            .append("span")
            .attr("class", "checkbox_label")
            .text(d => d.name);
    }

    chartUpdateExtraSkills() {
        var maxStrength = Math.pow(
            this.skillStrengths[this.skillNames[0]],
            this.options.extraSkillEquilibrationExp
        );
        var extraSkills = this.skillNames.filter(s => !this.skillsToShowSet.has(s));

        var chartExtraSkills = this.extraSkillsDiv.selectAll("div.skill").data(extraSkills, d => d);
        chartExtraSkills
            .enter()
            .append("div")
            .attr("class", "skill")
            .attr("data-strength", d =>
                Math.max(
                    0.1,
                    Math.pow(this.skillStrengths[d], this.options.extraSkillEquilibrationExp) /
                        maxStrength
                ).toFixed(1)
            )
            .text(d => d)
            .on("click", d => {
                this.skillsToShow.push(d);
                this.skillsToShowSet.add(d);
                //TODO: animate/fade out
                this.chartUpdateExtraSkills();
                this.chartUpdateSkills();
                this.yResize();
                this.xResize(); //TODO: don't use this
            });
        chartExtraSkills.exit().remove();
    }

    chartUpdatePlaces() {
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
        this.dims.placesHeight = lastAtPos.length * (this.dims.place.height + this.dims.place.gap);

        var chartPlaces = this.placesHolderSvg.selectAll("g.place").data(visiblePlaces, d => d.id);
        chartPlaces.exit().remove(); //TODO: fade transition

        var chartPlacesEnter = chartPlaces
            .enter()
            .append("g")
            .attr("class", d => "place " + d.type);

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

    chartUpdateSkills() {
        var shownSkills = this.skills.filter(s => this.skillsToShowSet.has(s.name));

        this.dims.skillsHeight = this.skillsToShow.length * this.dims.skill.rowHeight;
        this.ySkillScale.domain(this.skillsToShow).range([0, this.dims.skillsHeight]);

        var customAxis = g => {
            g.call(this.ySkillAxis);
            g.select(".domain").remove();
            g.selectAll(".tick text").on("click", s => {
                this.skillsToShow = this.skillsToShow.filter(d => d != s);
                this.skillsToShowSet.delete(s);
                //TODO: animate/fade out
                this.chartUpdateExtraSkills();
                this.chartUpdateSkills();
                this.yResize();
                this.xResize(); //TODO: don't use this
            });
        };

        this.skillnameHolder.call(customAxis);

        var bandwidth = this.ySkillScale.bandwidth();

        var chartSkills = this.skillsHolderSvg
            .selectAll("rect")
            .data(shownSkills, d => [d.used_in.id, d.name, d.from].join("/"));

        var chartSkillsEnter = chartSkills
            .enter()
            .append("rect")
            .attr("x", 0)

            .attr("fill-opacity", d => this.options.skillMaxOpacity * d.strength)
            .attr("rx", this.dims.skill.radius)
            .attr("width", 0)
            .attr("height", this.dims.skill.rectHeight);

        chartSkillsEnter.append("title").text(d => d.description);

        chartSkillsEnter
            .merge(chartSkills)
            .attr(
                "y",
                d => this.ySkillScale(d.name) + (bandwidth - this.dims.skill.rectHeight) / 2
            );
        chartSkills.exit().remove(); //TODO: fade transition
    }

    initChart() {
        this.svg = d3Select(this.holder).append("svg");
        this.dims.width = Math.max(
            this.dims.minWidth,
            this.svg.node().getBoundingClientRect().width
        );

        this.clipPath = this.svg
            .append("defs")
            .append("clipPath")
            .attr("id", "clip")
            .append("rect");
        this.clipPath.attr(
            "width",
            this.dims.width - this.dims.margin.left - this.dims.margin.right
        ); //TODO: move?

        this.extraSkillsDiv = d3Select(this.holder)
            .append("div")
            .attr("class", "extra_skills timeline_skills");

        this.chartUpdateExtraSkills();

        this.xScaleAll = d3ScaleTime().domain([new Date(2002, 9, 1), new Date(2017, 12, 1)]); //TODO: make dynamic
        this.xScale = this.xScaleAll;

        this.xAxis = d3AxisTop(this.xScale).tickFormat(multiFormat);

        //TODO: create a g with margin top and left preset for all elements

        this.chartBackground = this.svg
            .append("rect")
            .attr("class", "rect_background")
            .attr("width", 0)
            .attr("height", 0)
            .attr("rx", this.dims.place.radius)
            .attr("transform", new svgT(this.dims.margin.left, this.dims.margin.top));

        this.xAxisSvg = this.svg
            .append("g")
            .attr("id", "timeline")
            .attr("transform", new svgT(this.dims.margin.left, this.dims.margin.top));

        this.placesHolderSvg = this.svg
            .append("g")
            .attr("id", "places")
            .style("clip-path", "url(#clip)")
            .attr("transform", new svgT(this.dims.margin.left, 40));

        this.ySkillScale = d3ScaleBand();
        this.ySkillAxis = d3AxisLeft(this.ySkillScale);
        //.tickFormat(d => d.replace("/", '\n'));

        this.skillnameHolder = this.svg.append("g").attr("id", "skillnames");


        this.skillsHolderSvg = this.svg
            .append("g")
            .attr("id", "skills")
            .style("clip-path", "url(#clip)");


        this.chartUpdatePlaces();
        this.chartUpdateSkills();

        this.zoom = d3Zoom()
            .scaleExtent([0.8, 5])
            //TODO: disable mouse wheel zoom? add buttons for reset and zoom?
            .translateExtent([[-100, 0], [100, 0]])
            .on("zoom", () => {
                //console.log(d3CurrentEvent);
                this.xScale = d3CurrentEvent.transform.rescaleX(this.xScaleAll);
                this.xAxis.scale(this.xScale);
                //TODO: do not resize everything when not zooming, just pan
                this.xResizeDelayed();
            });
        this.chartBackground.call(this.zoom);

        this.yResize();
        this.xResize();
    }

    yResize() {
        var toSkillsHeight =
            this.dims.margin.top + this.dims.placesHeight + this.dims.margin.between;

        var totalHeight = toSkillsHeight + this.dims.skillsHeight + this.dims.margin.bottom;

        this.svg.attr("height", totalHeight);
        this.chartBackground.attr("height", totalHeight);
        this.clipPath.attr("height", totalHeight);

        this.skillnameHolder.attr("transform", svgT(this.dims.margin.left - 20, toSkillsHeight));

        this.skillsHolderSvg.attr("transform", svgT(this.dims.margin.left, toSkillsHeight));
    }

    xResize() {
        this.dims.width = Math.max(
            this.dims.minWidth,
            this.svg.node().getBoundingClientRect().width
        );

        var width = this.dims.width - this.dims.margin.left - this.dims.margin.right;
        // var height = svg.node().getBoundingClientRect().height - this.dims.margin.top - this.dims.margin.bottom;

        this.clipPath.attr("width", Math.max(0, width));

        //TODO: fix this - part of chart is hidden after zooming and resizing
        this.zoom.translateExtent([[-100, 0], [width + 100, 0]]);

        this.xScale.range([0, width]);
        this.xAxis.ticks(
            width / this.xScale.ticks().length > 70 ? width / 70 : this.xScale.ticks().length
        );

        var widthPerTick = width / this.xScale.ticks().length;
        // Sigmoidal between 1 (no space) and 0 (a lot of space)
        var squashed = Math.pow(1 / (1 + Math.pow(Math.E, (widthPerTick - 30) / 5)), 3);

        this.chartBackground.attr("width", width);

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
            .attr("width", d => Math.max(0, this.xScale(d.to) - this.xScale(d.from)));

        this.placesHolderSvg
            .selectAll("text")
            .attr("x", d => (this.xScale(d.from) + this.xScale(d.to)) / 2)
            .attrs((d, e, t) => {
                let currentFontSize = parseFloat(t[e].getAttribute("font-size"));
                let newFontSize = Math.min(
                    this.dims.place.textMaxSize,
                    currentFontSize *
                        (this.xScale(d.to) - this.xScale(d.from) - 5) /
                        t[e].getBoundingClientRect().width
                );

                if (newFontSize < this.dims.place.textAdjMinSize / window.devicePixelRatio) {
                    return {
                        visibility: "hidden",
                    };
                }
                if (Math.abs(currentFontSize - newFontSize) < 0.1) {
                    return { visibility: "visible" };
                }
                return {
                    visibility: "visible",
                    "font-size": newFontSize + "px",
                };
            });
    }

    xResizeDelayed() {
        if (!this.requested) {
            this.requested = true;
            d3Timeout(() => {
                this.requested = false;
                this.xResize();
            });
        }
    }
}
