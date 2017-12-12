import { select as d3Select, event as d3CurrentEvent } from "d3-selection";
import { timeFormat } from "d3-time-format";
import { timeYear, timeMonth } from "d3-time";
import { scaleTime as d3ScaleTime, scaleBand as d3ScaleBand } from "d3-scale";
import { axisTop as d3AxisTop } from "d3-axis";
import { timeout as d3Timeout } from "d3-timer";
import { zoom as d3Zoom } from "d3-zoom";
import { transition as d3Transition } from "d3-transition";
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
        this.holder = d3Select(holder);
        this.placeTypes = places;
        this.skillsToShow = initialSkills;

        this.dims = {
            minWidth: 300,
            minPlacesHight: 65,
            margin: { top: 40, right: 15, bottom: 10, left: 15, padding: 10 },
            place: { height: 30, gap: 3, textMaxSize: 18, textAdjMinSize: 9, radius: 5 },
            skill: { rowHeight: 22, rectHeight: 20, radius: 2 },
        };

        this.options = {
            skillMaxOpacity: 0.8,
            defaultNumberOfSkillLines: 10,
            yearlySkillSortCoef: 0.5,
            extraSkillEquilibrationExp: 0.12,
            monthsDisplayMargin: 4,
        };

        this.initPlaceAndSkillData();

        this.initChart();
    }

    initPlaceAndSkillData() {
        this.places = [];
        this.placesMap = new Map();
        this.placeTypesMap = new Map();
        this.skills = [];
        this.skillStrengths = {};
        this.fromDate = Date.now();
        this.toDate = Date.now();
        var now = Date.now();

        this.placeTypes.forEach(pt => {
            this.placeTypesMap.set(pt.id, pt);
            pt.items.forEach((p, i) => {
                p.type = pt.id;
                p.typeNum = i;
                if (p.name) {
                    this.places.push(p);
                    this.placesMap.set(p.id, p);
                }
                p.skills.forEach(s => {
                    this.skills.push(s);
                    var period = timeMonth.count(s.from, s.to) + 1;
                    var yearsAgo = Math.max(0, timeMonth.count(s.to, now)) / 12.0;
                    this.skillStrengths[s.name] =
                        (this.skillStrengths[s.name] || 0) +
                        period * s.strength * Math.pow(this.options.yearlySkillSortCoef, yearsAgo);
                });
                if (p.from && p.from < this.fromDate) {
                    this.fromDate = p.from;
                }
                if (p.to && p.to > this.toDate) {
                    this.toDate = p.to;
                }
            });
        });
        this.skillNames = Object.getOwnPropertyNames(this.skillStrengths);

        this.places.sort((a, b) => a.from - b.from || a.typeNum - b.typeNum);
        this.skills.sort((a, b) => b.to - b.from - (a.to - a.from));
        this.skillNames.sort((a, b) => this.skillStrengths[b] - this.skillStrengths[a]);

        if (!this.skillsToShow) {
            this.skillsToShow = this.skillNames.slice(0, this.options.defaultNumberOfSkillLines);
        }

        this.skillsToShowSet = new Set();
        this.skillsToShow.forEach(s => this.skillsToShowSet.add(s));
    }

    chartAddPlaceTypeCheckboxes() {
        this.placeCheckboxes = this.sidepane
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
                this.chartUpdateExtraSkills();
                this.chartUpdateSkills();
                this.yResize();
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
        this.dims.placesHeight = Math.max(
            this.dims.minPlacesHight,
            lastAtPos.length * (this.dims.place.height + this.dims.place.gap)
        );

        var t = d3Transition();

        var chartPlaces = this.placesHolderSvg.selectAll("g.place").data(visiblePlaces, d => d.id);
        chartPlaces.exit().remove();

        var chartPlacesEnter = chartPlaces
            .enter()
            .append("g")
            .attr("class", d => "place " + d.type);

        chartPlacesEnter
            .append("rect")
            .attr("class", d => "tlp_" + d.id)
            .attr("x", d => this.xScale(d.from))
            .attr("rx", this.dims.place.radius)
            .attr("width", d => Math.max(0, this.xScale(d.to) - this.xScale(d.from)))
            .attr("height", this.dims.place.height)
            .on("mouseover", d => this.holder.selectAll(".tlinp_" + d.id).classed("selected", true))
            .on("mouseout", d =>
                this.holder.selectAll(".tlinp_" + d.id).classed("selected", false)
            );

        chartPlacesEnter
            .append("title")
            .text(d => d.name + (d.where ? " (" + d.where + ")" : "") + "\n\n" + d.description);

        chartPlacesEnter
            .append("text")
            .classed("place-label", true)
            .text(d => d.label)
            .attr("x", d => (this.xScale(d.from) + this.xScale(d.to)) / 2)
            .style("font-size", this.dims.place.textMaxSize + "px")
            .attr("y", this.dims.place.height / 2)
            .attr("dy", ".35em") // dominant-baseline is not supported in IE/Edge...
            .attr("text-anchor", "middle")
            .styles(this.placeTextResizer.bind(this));

        chartPlaces
            .merge(chartPlacesEnter)
            .transition(t)
            .attr("transform", d =>
                svgT(0, d.pos * (this.dims.place.height + this.dims.place.gap))
            );
    }

    chartUpdateSkills() {
        this.dims.skillsHeight = this.skillsToShow.length * this.dims.skill.rowHeight;
        this.ySkillScale.domain(this.skillsToShow).range([0, this.dims.skillsHeight]);
        var bandwidth = this.ySkillScale.bandwidth();

        // Left axis skill names
        var chartSkillNames = this.skillnameHolder
            .selectAll("div.y_axis_skill")
            .data(this.skillsToShow, d => d);
        var chartSkillNamesEnter = chartSkillNames
            .enter()
            .append("div")
            .attr("class", "y_axis_skill")
            .attr("title", d => d)
            .text(d => d)
            .styles({
                top: d => this.ySkillScale(d) - bandwidth + "px",
                "line-height": bandwidth + "px",
            })
            .on("click", s => {
                this.skillsToShow = this.skillsToShow.filter(d => d != s);
                this.skillsToShowSet.delete(s);
                this.chartUpdateExtraSkills();
                this.chartUpdateSkills();
                this.yResize();
            });
        chartSkillNames
            .merge(chartSkillNamesEnter)
            .transition()
            .style("top", d => this.ySkillScale(d) + "px");
        chartSkillNames.exit().remove();

        // Skill bars
        var chartSkills = this.skillsHolderSvg
            .selectAll("rect")
            .data(this.skills.filter(s => this.skillsToShowSet.has(s.name)), d =>
                [d.used_in.id, d.name, d.from].join("/")
            );

        var chartSkillsEnter = chartSkills
            .enter()
            .append("rect")
            .attr("x", d => this.xScale(d.from))
            .attr("y", d => this.ySkillScale(d.name) - bandwidth)
            .attr("fill-opacity", d => this.options.skillMaxOpacity * d.strength)
            .attr("rx", this.dims.skill.radius)
            .attr("width", d => Math.max(0, this.xScale(d.to) - this.xScale(d.from)))
            .attr("height", this.dims.skill.rectHeight);

        chartSkillsEnter.append("title").text(d => d.description);

        chartSkillsEnter
            .merge(chartSkills)
            .transition()
            .attr(
                "y",
                d => this.ySkillScale(d.name) + (bandwidth - this.dims.skill.rectHeight) / 2
            );
        chartSkills.exit().remove();
    }

    initChart() {
        this.sidepane = this.holder.append("div").attr("id", "sidepane");
        this.svg = this.holder.append("svg");

        this.clipPath = this.svg
            .append("defs")
            .append("clipPath")
            .attr("id", "clip")
            .append("rect");

        this.extraSkillsDiv = this.holder
            .append("div")
            .attr("class", "extra_skills timeline_skills");

        this.chartUpdateExtraSkills();

        this.xScaleAll = d3ScaleTime().domain([
            timeMonth.offset(this.fromDate, -this.options.monthsDisplayMargin),
            timeMonth.offset(this.toDate, this.options.monthsDisplayMargin),
        ]);
        this.xScale = this.xScaleAll;

        this.xAxis = d3AxisTop(this.xScale).tickFormat(multiFormat);

        this.xAxisSvg = this.svg
            .append("g")
            .attr("id", "timeline")
            .attr("transform", new svgT(this.dims.margin.left, this.dims.margin.top));

        this.timelineElements = this.svg
            .append("g")
            .attr("class", "timeline_elements")
            .attr("transform", new svgT(this.dims.margin.left, this.dims.margin.top))
            .style("clip-path", "url(#clip)");

        this.chartBackground = this.timelineElements
            .append("rect")
            .attr("class", "rect_background")
            .attr("width", 0)
            .attr("height", 0)
            .attr("fill", "white")
            .attr("rx", this.dims.place.radius);

        this.placesHolderSvg = this.timelineElements
            .append("g")
            .attr("id", "places")
            .attr("transform", svgT(0, this.dims.margin.padding));

        this.ySkillScale = d3ScaleBand();

        this.skillnameHolder = this.sidepane.append("div").attr("id", "skillnames");
        this.skillsHolderSvg = this.timelineElements.append("g").attr("id", "skills");

        this.chartUpdatePlaces();
        this.chartUpdateSkills();
        this.chartAddPlaceTypeCheckboxes();

        this.zoom = d3Zoom()
            .scaleExtent([0.8, 5])
            //TODO: fix this; disable mouse wheel zoom? add buttons for reset and zoom?
            .translateExtent([[0, 0], [Infinity, 0]])
            .on("zoom", () => {
                //console.log(d3CurrentEvent);
                this.xScale = d3CurrentEvent.transform.rescaleX(this.xScaleAll);
                this.xAxis.scale(this.xScale);
                //TODO: do not resize everything when not zooming, just pan
                this.xResizeDelayed();
            });
        this.timelineElements.call(this.zoom);

        this.yResize();
        this.xResize();
    }

    yResize() {
        var toSkillsHeight = this.dims.placesHeight + 2 * this.dims.margin.padding;
        var elementsHeight = toSkillsHeight + this.dims.skillsHeight;
        var totalHeight =
            this.dims.margin.top +
            elementsHeight +
            this.dims.margin.bottom +
            this.dims.margin.padding;

        var t = d3Transition();

        this.svg.transition(t).attr("height", totalHeight);
        this.clipPath.transition(t).attr("height", totalHeight);
        this.chartBackground
            .transition(t)
            .attr("height", elementsHeight + this.dims.margin.padding);
        this.skillnameHolder
            .transition(t)
            .style("top", this.dims.margin.top + toSkillsHeight + "px");

        this.skillsHolderSvg.transition(t).attr("transform", svgT(0, toSkillsHeight));
    }

    placeTextResizer(d, e, t) {
        let currentFontSize = parseFloat(t[e].style["font-size"]);
        // This may be 0 if svg is not displayed
        let currentTextWidth = t[e].getBoundingClientRect().width;
        let newFontSize = Math.min(
            this.dims.place.textMaxSize,
            currentFontSize * (this.xScale(d.to) - this.xScale(d.from) - 5) / currentTextWidth
        );

        if (
            !currentTextWidth ||
            newFontSize < this.dims.place.textAdjMinSize / window.devicePixelRatio
        ) {
            return {
                visibility: "hidden",
            };
        }
        if (Math.abs(currentFontSize - newFontSize) < 0.2) {
            return { visibility: "visible" };
        }
        return {
            visibility: "visible",
            "font-size": newFontSize.toFixed(2) + "px",
        };
    }

    xResize() {
        //console.log("xResize");
        this.dims.width = Math.max(
            this.dims.minWidth,
            this.svg.node().getBoundingClientRect().width
        );

        var width = this.dims.width - this.dims.margin.left - this.dims.margin.right;
        // var height = svg.node().getBoundingClientRect().height - this.dims.margin.top - this.dims.margin.bottom;

        this.clipPath.attr("width", Math.max(0, width));

        //TODO: fix this - part of chart is hidden after zooming and resizing
        //this.zoom.translateExtent([[-100, 0]]);

        this.xScale.range([0, width]);
        this.xAxis.ticks(
            width / this.xScale.ticks().length > 80 ? width / 80 : this.xScale.ticks().length
        );

        var widthPerTick = width / this.xScale.ticks().length;
        // Sigmoidal between 1 (no space) and 0 (a lot of space)
        var squashed = Math.pow(1 / (1 + Math.pow(Math.E, (widthPerTick - 42) / 5)), 3);

        this.chartBackground.attr("width", width);

        this.xAxisSvg
            .call(this.xAxis)
            .selectAll("text")
            .style("font-size", 0.2 + 0.8 * Math.pow(1 - squashed, 0.3) + "em")
            .attr("dx", Math.sin(squashed * Math.PI / 2) * 20 + "px")
            .attr("dy", Math.sin(squashed * Math.PI / 2) * 14 - 4 + "px")
            .attr("transform", "rotate(-" + (90 * squashed).toFixed(5) + ")");

        this.svg
            .selectAll("#places rect, #skills rect")
            .attr("x", d => this.xScale(d.from))
            .attr("width", d => Math.max(0, this.xScale(d.to) - this.xScale(d.from)));

        this.placesHolderSvg
            .selectAll("text")
            .attr("x", d => (this.xScale(d.from) + this.xScale(d.to)) / 2)
            .styles(this.placeTextResizer.bind(this));
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
