import { utcParse } from "d3-time-format";
import { utcDay, utcMonth } from "d3-time";

if (typeof NodeList.prototype.forEach !== "function") {
    NodeList.prototype.forEach = Array.prototype.forEach;
}

// TODO: use something like moment?
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
        return subel.textContent;
    }
    return null;
}

export function getItemsData(rootel, selector, callback) {
    var results = [];

    rootel.querySelectorAll(selector).forEach(el => {
        var item = {
            id: el.getAttribute("id"),
            from: fromDate(getText(el, ".fromdate")),
            to: toDate(getText(el, ".todate")),
            label: getText(el, ".label"),
            name: getText(el, ".name"),
            description: getText(el, ".description"),
            skills: [],
            where: el.getAttribute("data-where"),
            el: el,
        };

        el.querySelectorAll(".skills>li").forEach(sel => {
            item.skills.push({
                name: sel.textContent,
                used_in: item,
                from: sel.hasAttribute("data-from")
                    ? fromDate(sel.getAttribute("data-from"))
                    : item.from,
                to: sel.hasAttribute("data-to") ? toDate(sel.getAttribute("data-to")) : item.to,
                strength: sel.hasAttribute("data-strength")
                    ? sel.getAttribute("data-strength")
                    : 1.0,
                description: sel.getAttribute("data-description"),
                el: sel,
            });
        });
        if (callback) {
            callback(item);
        }
        results.push(item);
    });

    return results;
}
