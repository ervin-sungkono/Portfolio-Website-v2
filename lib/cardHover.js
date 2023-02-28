const directions  = ['top','right','bottom','left'];
let classNames = ['in', 'out'].map((p) => Object.values(directions).map((d) => p + '-' + d)).reduce((a, b) => a.concat(b));

export class Card {
    constructor(element, ratio = 1) {
        this.element = element;
        this.ratio = ratio;
        this.element.addEventListener('mouseenter', (ev) => this.update(ev, 'in'));
        this.element.addEventListener('mouseleave', (ev) => this.update(ev, 'out'));
    }
    
    update(ev, prefix) {
        this.element.classList.remove(...classNames);
        var x = ev.pageX - this.element.offsetLeft;
        var y = ev.pageY - this.element.offsetTop;
        this.element.classList.add(`${prefix}-${closestEdge(x,y,this.element, this.ratio)}`);
    }
}

function closestEdge(x,y,obj,ratio) {
    const w = obj.offsetWidth;
    const h = obj.offsetHeight;
    const topEdgeDist = distMetric(x,y,w/2,0,ratio);
    const bottomEdgeDist = distMetric(x,y,w/2,h,ratio);
    const leftEdgeDist = distMetric(x,y,0,h/2,ratio);
    const rightEdgeDist = distMetric(x,y,w,h/2,ratio);
    const min = Math.min(topEdgeDist,bottomEdgeDist,leftEdgeDist,rightEdgeDist);
    switch (min) {
        case leftEdgeDist:
            return 'left';
        case rightEdgeDist:
            return 'right';
        case topEdgeDist:
            return 'top';
        case bottomEdgeDist:
            return 'bottom';
    }
}

function distMetric(x,y,x2,y2, ratio) {
    const xDiff = (x - x2) * ratio;
    const yDiff = y - y2;
    return (xDiff * xDiff) + (yDiff * yDiff);
}