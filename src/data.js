import { utcParse } from "d3-time-format";
import { utcDay, utcMonth } from "d3-time";

// TODO: use something like moment?
export var parseDate = utcParse("%B %Y");

export function fromDate(dateStr) {
    return utcDay.offset(parseDate(dateStr), 3);
}

export function toDate(dateStr) {
    return utcDay.offset(utcMonth.offset(parseDate(dateStr), 1), -3);
}

export function getText(el, selector) {
    var subel = el.querySelector(selector);
    if (subel) {
        return subel.textContent;
    }
    return null;
}

export function sortAndPosition(elements) {
    elements.sort((a, b) => a.from > b.from);

    var lastAtPos = [];
    elements.forEach(function(el) {
        var pos = 0;
        while (lastAtPos[pos] > el.from) {
            pos++;
        }
        lastAtPos[pos] = el.to;
        el.pos = pos;
    });
}

export function getItemsData(rootel, selector, callback) {
    var results = [];

    rootel.querySelectorAll(selector).forEach(el => {
        var item = {
            id: el.getAttribute("id"),
            title: getText(el, ".title"),
            where: el.getAttribute("data-where"),
            class: el.parentElement.getAttribute("id"),
            type: getText(el, ".type"),
            description: getText(el, ".description"),
            from: fromDate(getText(el, ".fromdate")),
            to: toDate(getText(el, ".todate")),
            skills: [],
            el: el
        };

        el.querySelectorAll(".skills>li").forEach(sel => {
            item.skills.push({
                name: sel.textContent,
                used_in: item,
                from: sel.hasAttribute("data-from")
                    ? fromDate(sel.getAttribute("data-from"))
                    : item.from,
                to: sel.hasAttribute("data-to") ? toDate(sel.getAttribute("data-to")) : item.to,
                el: sel
            });
        });
        if (callback) {
            callback(item);
        }
        results.push(item);
    });

    sortAndPosition(results);
    return results;
}
