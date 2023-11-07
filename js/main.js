//import {gsap} from '../lib/gsap/src/gsap-core.js';
import F from './fraction.js';
import {fractionsInInterval} from './fraction.js';

const svg = document.getElementById('svg');
let viewBox = {
    x: 0,
    y: 0,
    width: F.fromNumber(svg.width.baseVal.value),
    height: F.fromNumber(svg.height.baseVal.value)
};
svg.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.width.valueOf()} ${viewBox.height.valueOf()}`);
let isDragging = false;
let barStart = 0;
const start = {};
const firstCircle = F.unsafeFraction(-1n, 0n);
const lastCircle = F.unsafeFraction(1n, 0n);
let isResizing = false;
let startWidth;
let highlighted = null;
lastCircle.next = null;
firstCircle.next = lastCircle;
let selectedRational = null;

const htmlNominator = document.getElementById("nominator");
const htmlDenominator = document.getElementById("denominator");
const htmlMinusSign = document.getElementById("minus-sign");
const htmlDecimalValue = document.getElementById("decimalValue");
const htmlMoreDigits = document.getElementById("moreDigits");
const htmlPixelDrift = document.getElementById('pixelDrift');
const htmlCircleRadiusThreshold = document.getElementById('circleRadiusThreshold');

// parameters
let pixelDrift = F.fromString(htmlPixelDrift.value);
let circleRadiusThreshold = F.fromString(htmlCircleRadiusThreshold.value); // draw circles with radius > circleRadiusThreshold in pixels
let scale = F.fromNumber(svg.getBoundingClientRect().height * 0.8);
// where the top left corner of the drawing space is in the normal coordinates:
let offset = {
    x: F.unsafeFraction(0n, 1n),
    y: viewBox.height.div(scale).mul(F.fromString("0.1")).add(F.unsafeFraction(1n, 1n)).rationalApproximation(scale.inverse()).fraction
};

function circleX(rational) {
    return rational.unsafeSub(offset.x).unsafeMul(scale).valueOf();
}

function circleY(rational) {
    return offset.y.unsafeSub(F.unsafeFraction(1n, 2n * rational.q * rational.q)).unsafeMul(scale).valueOf();
}

function circleR(rational) {
    return F.unsafeFraction(1n, 2n * rational.q * rational.q).unsafeMul(scale).valueOf();
}

function withinPixelPrecision(rational) {
    return rational.rationalApproximation(scale.inverse().mul(pixelDrift)).fraction;
}

function decimalToString(decimal) {
    let str = (decimal.sign < 0 ? "-" : "") + decimal.nonzeroPart.toString();
    if (decimal.fp !== "") {
        str += "." + decimal.fp;
    }
    if (decimal.exponent !== 0n) {
        str += "e" + decimal.exponent.toString();
    }
    return str;
}

function drawCircle(r) {
    const displayRadius = circleR(r);
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', circleX(r));
    circle.setAttribute('cy', circleY(r));
    circle.setAttribute('r', displayRadius);
    circle.setAttribute('stroke', 'none');
    circle.setAttribute('fill', 'black');
    if (displayRadius > Math.max(viewBox.width.valueOf(), viewBox.height.valueOf())) {
        circle.setAttribute('shape-rendering', 'geometricPrecision');
    }
    circle.addEventListener('mouseover', () => {
        if (highlighted !== null) {
            highlighted.setAttribute('fill', 'black');
        }
        highlighted = circle;
        circle.setAttribute('fill', 'red');
        if (selectedRational === null || selectedRational.compare(r) !== 0) {
            selectedRational = r;
            htmlNominator.textContent = r.p < 0n ? (-r.p).toString() : r.p.toString();
            htmlDenominator.textContent = r.q.toString();
            htmlMinusSign.style.backgroundColor = r.p < 0n ? "black" : "white";
            selectedRational.decimal = r.toDecimal();
            selectedRational.decimal.fp = "";
            let nextDigit;
            if (r.compare(F.ZERO) !== 0n) {
                for (let digits = 0; digits < 10; digits++) {
                    nextDigit = selectedRational.decimal.fractionalPart.next();
                    if (nextDigit.done)
                        break;
                    selectedRational.decimal.fp += nextDigit.value.toString();
                }
            } else
                nextDigit = {done: true};
            htmlDecimalValue.textContent = decimalToString(selectedRational.decimal);
            htmlMoreDigits.disabled = nextDigit.done;
        }
    });
    svg.appendChild(circle);
    return circle;
}

function closestPoint(x, y, w, h, xp, yp) {
    const xClosest = x.max(x.add(w).min(xp));
    const yClosest = y.sub(h).max(y.min(yp));

    return {x: xClosest, y: yClosest};
}

function isCircleVisible(rational, viewbox) {
    const x = rational;
    const y = F.unsafeFraction(1n, 2n * rational.q * rational.q);
    const cp = closestPoint(viewbox.offset.x, viewbox.offset.y, viewbox.size.x, viewbox.size.y, x, y);
    return (cp.x.sub(x).ipow(2n).add(cp.y.sub(y).ipow(2n)).compare(y.ipow(2n)) <= 0);
}

function iSqrt(value) {
    if (value < 0n) {
        throw 'square root of negative numbers is not supported'
    }

    if (value < 2n) {
        return value;
    }

    function newtonIteration(n, x0) {
        const x1 = ((n / x0) + x0) >> 1n;
        if (x0 === x1 || x0 === (x1 - 1n)) {
            return x0;
        }
        return newtonIteration(n, x1);
    }

    return newtonIteration(value, 1n);
}

function viewboxUnion(vb1, vb2) {
    const offset = {x: vb1.offset.x.min(vb2.offset.x), y: vb1.offset.y.max(vb2.offset.y)};
    return {
        offset: offset,
        size: {
            x: vb1.offset.x.add(vb1.size.x).max(vb2.offset.x.add(vb2.size.x)).sub(offset.x),
            y: vb1.offset.y.add(vb1.size.y).min(vb2.offset.y.add(vb2.size.y)).sub(offset.y)
        }
    };
}

function updateCircles(oldOffset, newOffset, oldScale, newScale) {
    const oldViewbox = {
        offset: offset,
        size: {x: oldScale.inverse().mul(viewBox.width), y: oldScale.inverse().mul(viewBox.height)}
    };
    const newViewbox = {
        offset: newOffset,
        size: {x: newScale.inverse().mul(viewBox.width), y: newScale.inverse().mul(viewBox.height)}
    };
    const u = viewboxUnion(oldViewbox, newViewbox);
    const lb = u.offset.x;
    const ub = u.offset.x.add(u.size.x);
    const ms = oldScale.compare(newScale) < 0 ? newScale : oldScale;
    const qMax = iSqrt(ms.mul(F.TWO).div(circleRadiusThreshold).ceil()) + 1n;

    // circles that touch in the interval
    const touching = fractionsInInterval(lb, ub, qMax);
    // "big" circles that touch left of interval
    let pre = [];
    {
        let prev = {p: 1n, q: 0n};
        let prevPrev = {p: 0n, q: 1n};
        let n = 0;
        for (const a of lb.toContinued()) {
            let curr = {p: prev.p * a + prevPrev.p, q: prev.q * a + prevPrev.q};
            if (curr.q > qMax)
                break;
            //if (n % 2 === 0 && isCircleVisible(F.unsafeFraction(curr.p, curr.q), u)) {
            if (n % 2 === 0) {
                pre.push(F.unsafeFraction(curr.p, curr.q));
            }
            n++;
            prevPrev = prev;
            prev = curr;
        }
        if (pre.length > 0 && pre[pre.length - 1].equals(lb))
            pre.pop();
    }
    // "big" circles that touch right of interval
    let post = [];
    {
        let prev = {p: 1n, q: 0n};
        let prevPrev = {p: 0n, q: 1n};

        let n = 0;
        for (const a of ub.toContinued()) {
            let curr = {p: prev.p * a + prevPrev.p, q: prev.q * a + prevPrev.q};
            if (curr.q > qMax)
                break;
            //if (n % 2 === 1 && isCircleVisible(F.unsafeFraction(curr.p, curr.q), u)) {
            if (n % 2 === 1) {
                post.push(F.unsafeFraction(curr.p, curr.q));
            }
            n++;
            prevPrev = prev;
            prev = curr;
        }
        if (post.length > 0 && post[0].equals(ub))
            post.shift();
    }
    const drawableRationals = pre.concat(touching).concat(post);
    let circleIt = firstCircle;
    for (const rational of drawableRationals) {
        while (circleIt.next.compare(rational) < 0) {
            circleIt.next.circle.remove();
            circleIt.next = circleIt.next.next;
        }
        if (circleIt.next.compare(rational) > 0) {
            rational.circle = drawCircle(rational);
            rational.next = circleIt.next;
            circleIt.next = rational;
        }
        circleIt = circleIt.next;
    }
    while (circleIt.next !== lastCircle) {
        circleIt.next.circle.remove();
        circleIt.next = circleIt.next.next;
    }
}


svg.addEventListener('wheel', (event) => {
    event.preventDefault();
    let newScale = scale.mul(F.fromNumber(Math.pow(1.1, -event.deltaY / 100)));

    // here viewBox.width is used as something proportional to the size of the viewbox
    // technically a better estimate would be length of the diagonal of the viewbox
    newScale = newScale.rationalApproximation(scale.mul(pixelDrift).div(F.fromNumber(viewBox.width))).fraction;

    const newOffset = {};
    const c = newScale.inverse().sub(scale.inverse());
    newOffset.x = withinPixelPrecision(offset.x.sub(c.mul(F.fromNumber(event.clientX - svg.getBoundingClientRect().left))));
    newOffset.y = withinPixelPrecision(offset.y.add(c.mul(F.fromNumber(event.clientY - svg.getBoundingClientRect().top))));
    updateCircles(offset, newOffset, scale, newScale);
    offset = newOffset;
    scale = newScale;
    for (let rational = firstCircle.next; rational !== lastCircle; rational = rational.next) {
        // we have to complete the previous animation, otherwise the circles will jump around
        // For the moment we don't do any animation
        // gsap.to(rational.circle, {
        //     attr: {
        //         cx: circleX(rational),
        //         cy: circleY(rational),
        //         r: circleR(rational)
        //     },
        //     duration: 0.1,
        //     ease: 'none'
        // });
        rational.circle.setAttribute('cx', circleX(rational));
        rational.circle.setAttribute('cy', circleY(rational));
        rational.circle.setAttribute('r', circleR(rational));
    }
});


svg.addEventListener('mousedown', (event) => {
    isDragging = true;
    start.x = event.clientX;
    start.y = event.clientY;
});

svg.addEventListener('mousemove', (event) => {
    if (isDragging) {
        let newOffset = {};
        newOffset.x = withinPixelPrecision(offset.x.sub(F.fromNumber(event.clientX - start.x).div(scale)));
        newOffset.y = withinPixelPrecision(offset.y.add(F.fromNumber(event.clientY - start.y).div(scale)));
        start.x = event.clientX;
        start.y = event.clientY;
        updateCircles(offset, newOffset, scale, scale);
        offset = newOffset;
        for (let rational = firstCircle.next; rational !== lastCircle; rational = rational.next) {
            rational.circle.setAttribute('cx', circleX(rational));
            rational.circle.setAttribute('cy', circleY(rational));
        }
    }
});

svg.addEventListener('mouseup', () => {
    isDragging = false;
});

document.getElementById('draggableBar').addEventListener('mousedown', (e) => {
    isResizing = true;
    barStart = e.clientX;
    startWidth = document.getElementById('panel').offsetWidth;
});

document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    let panel = document.getElementById('panel');
    let panelWidth = startWidth - e.clientX + barStart;
    panel.style.width = panelWidth + 'px';
    // resize SVG viewBox
    viewBox.width = F.fromNumber(svg.getBoundingClientRect().width);
    svg.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.width.valueOf()} ${viewBox.height.valueOf()}`);
    updateCircles(offset, offset, scale, scale);

});

document.addEventListener('mouseup', () => {
    isResizing = false;
});


htmlPixelDrift.addEventListener('change', function () {
    pixelDrift = F.fromString(htmlPixelDrift.value);
});

htmlCircleRadiusThreshold.addEventListener('change', function () {
    circleRadiusThreshold = F.fromString(htmlCircleRadiusThreshold.value);
    updateCircles(offset, offset, scale, scale);
});

htmlMoreDigits.addEventListener('click', function () {
    let digitsSoFar = selectedRational.decimal.fp.length;
    let next;
    for (let digits = 0; digits < digitsSoFar; digits++) {
        next = selectedRational.decimal.fractionalPart.next();
        if (next.done)
            break;
        selectedRational.decimal.fp += next.value.toString();
    }
    htmlDecimalValue.textContent = decimalToString(selectedRational.decimal);
    htmlMoreDigits.disabled = next.done;
});

updateCircles(offset, offset, scale, scale);
