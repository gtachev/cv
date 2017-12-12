import { utcParse } from "d3-time-format";
import { utcDay, utcMonth } from "d3-time";

//TODO: this should not be part of the library, move it wtih the example?
// date helpers could probably stay in the lib, if properly parametrized

if (typeof NodeList.prototype.forEach !== "function") {
    NodeList.prototype.forEach = Array.prototype.forEach;
}

export var parseDate = utcParse("%b %Y");

export function fromDate(dateStr) {
    return parseDate(dateStr);
}

export function toDate(dateStr) {
    return utcDay.offset(utcMonth.offset(parseDate(dateStr), 1), -2);
}

export function getText(el, selector) {
    var subel = el.querySelector(selector);
    if (subel) {
        return subel.textContent.trim();
    }
    return null;
}

export function getItemsData(rootel, selector) {
    var results = [];

    rootel.querySelectorAll(selector).forEach(el => {
        var item = {
            id: el.getAttribute("id"),
            from: fromDate(getText(el, ".fromdate")),
            to: toDate(getText(el, ".todate")),
            label: el.getAttribute("data-label"),
            name: getText(el, ".place_name, .project_name"),
            where: getText(el, ".where"),
            place: el.querySelector(".place_link")
                ? el.querySelector(".place_link").getAttribute("data-item-id")
                : null,
            description: getText(el, ".timeline_description"),
            skills: [],
            el: el,
        };

        el.querySelectorAll(".own_skills>.skill").forEach(sel => {
            item.skills.push({
                name: getText(sel, ".skill_name"),
                used_in: item,
                from: sel.hasAttribute("data-from")
                    ? fromDate(sel.getAttribute("data-from"))
                    : item.from,
                to: sel.hasAttribute("data-to") ? toDate(sel.getAttribute("data-to")) : item.to,
                strength: sel.hasAttribute("data-strength")
                    ? sel.getAttribute("data-strength")
                    : 1.0,
                description: getText(sel, ".tooltip_content"),
                el: sel,
            });
        });
        results.push(item);
    });

    return results;
}
