"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Button = void 0;
var lit_1 = require("lit");
var decorators_js_1 = require("lit/decorators.js");
/**
 * Button element.
 *
 * @slot - Default slot for button content
 * @csspart button - The button
 */
var Button = function () {
    var _classDecorators = [(0, decorators_js_1.customElement)('ls-button')];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var _classSuper = lit_1.LitElement;
    var _size_decorators;
    var _size_initializers = [];
    var _size_extraInitializers = [];
    var Button = _classThis = /** @class */ (function (_super) {
        __extends(Button_1, _super);
        function Button_1() {
            var _this = _super !== null && _super.apply(this, arguments) || this;
            /**
             * The size of the button.
             */
            _this.size = __runInitializers(_this, _size_initializers, 'sm');
            __runInitializers(_this, _size_extraInitializers);
            return _this;
        }
        Button_1.prototype.render = function () {
            return (0, lit_1.html)(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      <button part=\"button\" class=\"", "\">\n        <slot></slot>\n      </button>\n    "], ["\n      <button part=\"button\" class=\"", "\">\n        <slot></slot>\n      </button>\n    "])), this.size);
        };
        return Button_1;
    }(_classSuper));
    __setFunctionName(_classThis, "Button");
    (function () {
        var _a;
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create((_a = _classSuper[Symbol.metadata]) !== null && _a !== void 0 ? _a : null) : void 0;
        _size_decorators = [(0, decorators_js_1.property)({ type: String })];
        __esDecorate(null, null, _size_decorators, { kind: "field", name: "size", static: false, private: false, access: { has: function (obj) { return "size" in obj; }, get: function (obj) { return obj.size; }, set: function (obj, value) { obj.size = value; } }, metadata: _metadata }, _size_initializers, _size_extraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        Button = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
    })();
    _classThis.styles = (0, lit_1.css)(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    button {\n      background: var(--color-orange-300);\n      border-radius: 0.5rem;\n      border: none;\n      color: var(--color-black);\n      cursor: pointer;\n      font-weight: 500;\n      padding: 0.5rem 1rem;\n      transition: background var(--transition-duration-medium, 0.3s);\n\n      &.sm {\n        font-size: 0.75rem;\n        padding: 0.25rem 0.5rem;\n      }\n\n      &.lg {\n        font-size: 1.25rem;\n        padding: 0.75rem 1.25rem;\n      }\n    }\n\n    button:hover {\n      background: var(--color-orange-400);\n    }\n  "], ["\n    button {\n      background: var(--color-orange-300);\n      border-radius: 0.5rem;\n      border: none;\n      color: var(--color-black);\n      cursor: pointer;\n      font-weight: 500;\n      padding: 0.5rem 1rem;\n      transition: background var(--transition-duration-medium, 0.3s);\n\n      &.sm {\n        font-size: 0.75rem;\n        padding: 0.25rem 0.5rem;\n      }\n\n      &.lg {\n        font-size: 1.25rem;\n        padding: 0.75rem 1.25rem;\n      }\n    }\n\n    button:hover {\n      background: var(--color-orange-400);\n    }\n  "])));
    (function () {
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return Button = _classThis;
}();
exports.Button = Button;
var templateObject_1, templateObject_2;
