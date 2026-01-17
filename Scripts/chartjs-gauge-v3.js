/*!
 * chartjs-gauge-v3 v3.0.0
 * https://uk-taniyama.github.io/chartjs-gauge/
 * (c) 2022 chartjs-gauge-v3 Contributors
 * Released under the MIT License
 */
(function (global, factory) {
typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('chart.js'), require('chart.js/helpers')) :
typeof define === 'function' && define.amd ? define(['exports', 'chart.js', 'chart.js/helpers'], factory) :
(global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.ChartGauge = {}, global.Chart, global.Chart.helpers));
})(this, (function (exports, chart_js, helpers) { 'use strict';

var version = "3.0.0";

/* eslint-disable class-methods-use-this */
const needleDefaults = {
    radius: '10%',
    width: '15%',
    length: '80%',
};
const valueLabelDefaults = {
    display: true,
    font: undefined,
    formatter: Math.round,
    // color: Chart.defaults.color as any,
    color: (() => '#FFF'),
    backgroundColor: chart_js.Chart.defaults.backgroundColor,
    borderColor: chart_js.Chart.defaults.borderColor,
    borderWidth: 0,
    borderRadius: 5,
    padding: {
        top: 5,
        right: 5,
        bottom: 5,
        left: 5,
    },
    offsetX: 0,
    offsetY: 0,
};
const defaults = {
    needle: needleDefaults,
    valueLabel: valueLabelDefaults,
    animation: {
        animateRotate: true,
        animateScale: false,
    },
    cutout: '50%',
    rotation: -90,
    circumference: 180,
    value: 0,
    minValue: 0,
};
class GaugeController extends chart_js.DoughnutController {
    constructor(chart, datasetIndex) {
        super(chart, datasetIndex);
        // center for needle.
        this.center = new chart_js.ArcElement({});
        this.values = [];
        this.valuePercent = 0;
        this.previous = 0;
        this.current = 0;
    }
    /** @internal */
    _updateMeta() {
        const meta = this._cachedMeta;
        const data = meta._parsed;
        this.values = [];
        this.valuePercent = 0;
        if (data.length === 0) {
            return meta;
        }
        const options = this.options;
        const { value = 0, minValue = 0 } = options;
        const maxValue = data.length > 0 ? data[data.length - 1] : minValue + 1;
        data.reduce((prev, curr) => {
            this.values.push(curr - prev);
            return curr;
        }, minValue);
        const length = maxValue - minValue;
        this.valuePercent = value / length;
        return meta;
    }
    /** @internal */
    _getTranslation() {
        const zero = this._cachedMeta.data[0];
        if (zero == null) {
            return { dx: 0, dy: 0 };
        }
        return { dx: zero.x, dy: zero.y };
    }
    /** @internal */
    _getAngle(valuePercent) {
        // NOTE options is private member......
        const options = this.options;
        const { rotation, circumference } = options;
        return helpers.toRadians(rotation + (circumference * valuePercent));
    }
    /** @internal */
    _getSize(value) {
        return helpers.toPercentage(value, this.outerRadius) * this.outerRadius;
    }
    /* TODO set min padding, not applied until chart.update() (also chartArea must have been set)
    setBottomPadding(chart) {
      const needleRadius = this.getNeedleRadius(chart);
      const padding = this.chart.config.options.layout.padding;
      if (needleRadius > padding.bottom) {
        padding.bottom = needleRadius;
        return true;
      }
      return false;
    },
    */
    drawNeedle() {
        // NOTE options is private member......
        const options = this.options;
        const { ctx } = this.chart;
        const { needle } = options;
        const { radius, width, length, } = needle;
        const { color } = needle;
        const needleRadius = this._getSize(radius);
        const needleWidth = this._getSize(width);
        const needleLength = this._getSize(length);
        // center
        const { dx, dy } = this._getTranslation();
        // interpolate
        const angle = this._getAngle(this.center.endAngle);
        // draw
        ctx.save();
        ctx.translate(dx, dy);
        ctx.rotate(angle);
        ctx.fillStyle = color;
        // draw circle
        ctx.beginPath();
        ctx.ellipse(0, 0, needleRadius, needleRadius, 0, 0, 2 * Math.PI);
        ctx.fill();
        // draw needle
        ctx.beginPath();
        ctx.moveTo(-needleWidth / 2, 0);
        ctx.lineTo(0, -needleLength);
        ctx.lineTo(needleWidth / 2, 0);
        ctx.fill();
        ctx.restore();
    }
    drawValueLabel() {
        // NOTE options is private member......
        const options = this.options;
        const { valueLabel } = options;
        if (!valueLabel.display) {
            return;
        }
        const { ctx } = this.chart;
        const { color, formatter, backgroundColor, borderColor, borderWidth, borderRadius, padding, offsetX, offsetY, } = valueLabel;
        const font = helpers.toFont(valueLabel.font);
        const { value } = options;
        const valueText = (formatter ? formatter(value) : value).toString();
        ctx.save();
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.font = font.string;
        // const { width: textWidth, actualBoundingBoxAscent, actualBoundingBoxDescent } = ctx.measureText(valueText);
        // const textHeight = actualBoundingBoxAscent + actualBoundingBoxDescent;
        const { width: textWidth } = ctx.measureText(valueText);
        const { lineHeight } = font;
        const textHeight = lineHeight * 1;
        const x = -(padding.left + textWidth / 2) - borderWidth;
        const y = -(padding.top + textHeight / 2) - borderWidth;
        const w = (padding.left + textWidth + padding.right) + 2 * borderWidth;
        const h = (padding.top + textHeight + padding.bottom) + 2 * borderWidth;
        // center
        let { dx, dy } = this._getTranslation();
        dx += this._getSize(offsetX);
        dy += this._getSize(offsetY);
        // draw
        ctx.translate(dx, dy);
        // draw background
        ctx.fillStyle = backgroundColor;
        ctx.beginPath();
        helpers.addRoundedRectPath(ctx, {
            x, y, w, h, radius: helpers.toTRBLCorners(borderRadius),
        });
        ctx.closePath();
        ctx.fill();
        if (borderWidth) {
            ctx.strokeStyle = borderColor;
            ctx.lineWidth = borderWidth;
            ctx.stroke();
        }
        // draw value text
        const magicNumber = 0.075; // manual testing
        helpers.renderText(ctx, valueText, 0, textHeight * magicNumber, font, {
            textAlign: 'center',
            textBaseline: 'middle',
            color,
        });
        ctx.restore();
    }
    // overrides
    update(mode) {
        const reset = mode === 'reset';
        const meta = this._updateMeta();
        // animations on will call update(reset) before update()
        if (reset) {
            this.previous = 0;
            this.current = 0;
        }
        else {
            this.previous = this.current || 0;
            this.current = this.valuePercent;
        }
        const parsed = meta._parsed;
        meta._parsed = this.values;
        super.update(mode);
        meta._parsed = parsed;
    }
    // overrides
    updateElements(elements, start, count, mode) {
        const meta = this._cachedMeta;
        const parsed = meta._parsed;
        meta._parsed = this.values;
        super.updateElements(elements, start, count, mode);
        meta._parsed = parsed;
        if (elements.length === 0) {
            return;
        }
        const zero = elements[0];
        // NOTE center:ArcElement as any.
        super.updateElement(this.center, undefined, {
            x: zero.x,
            y: zero.y,
            startAngle: this.previous,
            endAngle: this.current,
            circumference: 0,
            outerRadius: 100,
            innerRadius: 0,
            options: {},
        }, mode);
    }
    draw() {
        super.draw();
        if (this.values.length === 0) {
            return;
        }
        this.drawNeedle();
        this.drawValueLabel();
    }
}
GaugeController.id = 'gauge';
/** @internal */
GaugeController.version = version;
/** @internal */
GaugeController.defaults = defaults;
/** @internal */
GaugeController.descriptors = {
    _scriptable: (name) => name !== 'formatter',
    // needle: {
    //   _scriptable: true,
    // },
    // valueLabel: {
    //   _scriptable: true,
    // },
};
/** @internal */
GaugeController.overrides = {
    aspectRatio: false,
    layout: {
        padding: {
            top: 10,
            bottom: 80,
        },
    },
    plugins: {
        legend: {
            display: false,
        },
        tooltip: {
            enabled: false,
        },
    },
};

chart_js.Chart.register(GaugeController);
chart_js.Chart.register(chart_js.ArcElement);

exports.GaugeController = GaugeController;

Object.defineProperty(exports, '__esModule', { value: true });

}));
