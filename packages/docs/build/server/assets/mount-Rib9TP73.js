/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
let s$4 = class s extends Event{constructor(s,t,e,o){super("context-request",{bubbles:true,composed:true}),this.context=s,this.contextTarget=t,this.callback=e,this.subscribe=o??false;}};

/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
function n$3(n){return n}

/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
let s$3 = class s{get value(){return this.o}set value(s){this.setValue(s);}setValue(s,t=false){const i=t||!Object.is(s,this.o);this.o=s,i&&this.updateObservers();}constructor(s){this.subscriptions=new Map,this.updateObservers=()=>{for(const[s,{disposer:t}]of this.subscriptions)s(this.o,t);},void 0!==s&&(this.value=s);}addCallback(s,t,i){if(!i)return void s(this.value);this.subscriptions.has(s)||this.subscriptions.set(s,{disposer:()=>{this.subscriptions.delete(s);},consumerHost:t});const{disposer:h}=this.subscriptions.get(s);s(this.value,h);}clearCallbacks(){this.subscriptions.clear();}};

/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */let e$2 = class e extends Event{constructor(t,s){super("context-provider",{bubbles:true,composed:true}),this.context=t,this.contextTarget=s;}};let i$2 = class i extends s$3{constructor(s,e,i){super(void 0!==e.context?e.initialValue:i),this.onContextRequest=t=>{if(t.context!==this.context)return;const s=t.contextTarget??t.composedPath()[0];s!==this.host&&(t.stopPropagation(),this.addCallback(t.callback,s,t.subscribe));},this.onProviderRequest=s=>{if(s.context!==this.context)return;if((s.contextTarget??s.composedPath()[0])===this.host)return;const e=new Set;for(const[s,{consumerHost:i}]of this.subscriptions)e.has(s)||(e.add(s),i.dispatchEvent(new s$4(this.context,i,s,true)));s.stopPropagation();},this.host=s,void 0!==e.context?this.context=e.context:this.context=e,this.attachListeners(),this.host.addController?.(this);}attachListeners(){this.host.addEventListener("context-request",this.onContextRequest),this.host.addEventListener("context-provider",this.onProviderRequest);}hostConnected(){this.host.dispatchEvent(new e$2(this.context,this.host));}};

/**
 * Context token carrying the {@link PlayerApi}. `<km-player>` is the provider;
 * descendant controls may consume it with `@lit/context`'s `ContextConsumer`.
 * In light DOM the underlying `context-request` event bubbles through ordinary
 * DOM ancestors, so no shadow boundary is needed. Controls in this package use
 * the simpler {@link getPlayerApi} (`closest`) lookup, which also works when a
 * control is used without a context consumer.
 */
const playerContext = n$3(Symbol("km-player"));
/** Resolve the nearest ancestor `<km-player>` as a {@link PlayerApi}. */
function getPlayerApi(el) {
    return el.closest("km-player");
}

/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
/**
 * Map of ARIAMixin properties to attributes
 */
// Shim the global element internals object
// Methods should be fine as noops and properties can generally
// be while on the server.
const ElementInternalsShim = class ElementInternals {
    get shadowRoot() {
        // Grab the shadow root instance from the Element shim
        // to ensure that the shadow root is always available
        // to the internals instance even if the mode is 'closed'
        return this.__host
            .__shadowRoot;
    }
    constructor(_host) {
        this.ariaActiveDescendantElement = null;
        this.ariaAtomic = '';
        this.ariaAutoComplete = '';
        this.ariaBrailleLabel = '';
        this.ariaBrailleRoleDescription = '';
        this.ariaBusy = '';
        this.ariaChecked = '';
        this.ariaColCount = '';
        this.ariaColIndex = '';
        this.ariaColIndexText = '';
        this.ariaColSpan = '';
        this.ariaControlsElements = null;
        this.ariaCurrent = '';
        this.ariaDescribedByElements = null;
        this.ariaDescription = '';
        this.ariaDetailsElements = null;
        this.ariaDisabled = '';
        this.ariaErrorMessageElements = null;
        this.ariaExpanded = '';
        this.ariaFlowToElements = null;
        this.ariaHasPopup = '';
        this.ariaHidden = '';
        this.ariaInvalid = '';
        this.ariaKeyShortcuts = '';
        this.ariaLabel = '';
        this.ariaLabelledByElements = null;
        this.ariaLevel = '';
        this.ariaLive = '';
        this.ariaModal = '';
        this.ariaMultiLine = '';
        this.ariaMultiSelectable = '';
        this.ariaOrientation = '';
        this.ariaOwnsElements = null;
        this.ariaPlaceholder = '';
        this.ariaPosInSet = '';
        this.ariaPressed = '';
        this.ariaReadOnly = '';
        this.ariaRelevant = '';
        this.ariaRequired = '';
        this.ariaRoleDescription = '';
        this.ariaRowCount = '';
        this.ariaRowIndex = '';
        this.ariaRowIndexText = '';
        this.ariaRowSpan = '';
        this.ariaSelected = '';
        this.ariaSetSize = '';
        this.ariaSort = '';
        this.ariaValueMax = '';
        this.ariaValueMin = '';
        this.ariaValueNow = '';
        this.ariaValueText = '';
        this.role = '';
        this.form = null;
        this.labels = [];
        this.states = new Set();
        this.validationMessage = '';
        this.validity = {};
        this.willValidate = true;
        this.__host = _host;
    }
    checkValidity() {
        // TODO(augustjk) Consider actually implementing logic.
        // See https://github.com/lit/lit/issues/3740
        console.warn('`ElementInternals.checkValidity()` was called on the server.' +
            'This method always returns true.');
        return true;
    }
    reportValidity() {
        return true;
    }
    setFormValue() { }
    setValidity() { }
};

/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
var __classPrivateFieldSet = (undefined && undefined.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (undefined && undefined.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _Event_cancelable, _Event_bubbles, _Event_composed, _Event_defaultPrevented, _Event_timestamp, _Event_propagationStopped, _Event_type, _Event_target, _Event_isBeingDispatched, _a$1, _CustomEvent_detail, _b;
// Event phases
const NONE = 0;
const CAPTURING_PHASE = 1;
const AT_TARGET = 2;
const BUBBLING_PHASE = 3;
const enumerableProperty$1 = { __proto__: null };
enumerableProperty$1.enumerable = true;
Object.freeze(enumerableProperty$1);
// TODO: Remove this when we remove support for vm modules (--experimental-vm-modules).
const EventShim = (_a$1 = class Event {
        constructor(type, options = {}) {
            _Event_cancelable.set(this, false);
            _Event_bubbles.set(this, false);
            _Event_composed.set(this, false);
            _Event_defaultPrevented.set(this, false);
            _Event_timestamp.set(this, Date.now());
            _Event_propagationStopped.set(this, false);
            _Event_type.set(this, void 0);
            _Event_target.set(this, void 0);
            _Event_isBeingDispatched.set(this, void 0);
            this.NONE = NONE;
            this.CAPTURING_PHASE = CAPTURING_PHASE;
            this.AT_TARGET = AT_TARGET;
            this.BUBBLING_PHASE = BUBBLING_PHASE;
            if (arguments.length === 0)
                throw new Error(`The type argument must be specified`);
            if (typeof options !== 'object' || !options) {
                throw new Error(`The "options" argument must be an object`);
            }
            const { bubbles, cancelable, composed } = options;
            __classPrivateFieldSet(this, _Event_cancelable, !!cancelable, "f");
            __classPrivateFieldSet(this, _Event_bubbles, !!bubbles, "f");
            __classPrivateFieldSet(this, _Event_composed, !!composed, "f");
            __classPrivateFieldSet(this, _Event_type, `${type}`, "f");
            __classPrivateFieldSet(this, _Event_target, null, "f");
            __classPrivateFieldSet(this, _Event_isBeingDispatched, false, "f");
        }
        initEvent(_type, _bubbles, _cancelable) {
            throw new Error('Method not implemented.');
        }
        stopImmediatePropagation() {
            this.stopPropagation();
        }
        preventDefault() {
            __classPrivateFieldSet(this, _Event_defaultPrevented, true, "f");
        }
        get target() {
            return __classPrivateFieldGet(this, _Event_target, "f");
        }
        get currentTarget() {
            return __classPrivateFieldGet(this, _Event_target, "f");
        }
        get srcElement() {
            return __classPrivateFieldGet(this, _Event_target, "f");
        }
        get type() {
            return __classPrivateFieldGet(this, _Event_type, "f");
        }
        get cancelable() {
            return __classPrivateFieldGet(this, _Event_cancelable, "f");
        }
        get defaultPrevented() {
            return __classPrivateFieldGet(this, _Event_cancelable, "f") && __classPrivateFieldGet(this, _Event_defaultPrevented, "f");
        }
        get timeStamp() {
            return __classPrivateFieldGet(this, _Event_timestamp, "f");
        }
        composedPath() {
            return __classPrivateFieldGet(this, _Event_isBeingDispatched, "f") ? [__classPrivateFieldGet(this, _Event_target, "f")] : [];
        }
        get returnValue() {
            return !__classPrivateFieldGet(this, _Event_cancelable, "f") || !__classPrivateFieldGet(this, _Event_defaultPrevented, "f");
        }
        get bubbles() {
            return __classPrivateFieldGet(this, _Event_bubbles, "f");
        }
        get composed() {
            return __classPrivateFieldGet(this, _Event_composed, "f");
        }
        get eventPhase() {
            return __classPrivateFieldGet(this, _Event_isBeingDispatched, "f") ? _a$1.AT_TARGET : _a$1.NONE;
        }
        get cancelBubble() {
            return __classPrivateFieldGet(this, _Event_propagationStopped, "f");
        }
        set cancelBubble(value) {
            if (value) {
                __classPrivateFieldSet(this, _Event_propagationStopped, true, "f");
            }
        }
        stopPropagation() {
            __classPrivateFieldSet(this, _Event_propagationStopped, true, "f");
        }
        get isTrusted() {
            return false;
        }
    },
    _Event_cancelable = new WeakMap(),
    _Event_bubbles = new WeakMap(),
    _Event_composed = new WeakMap(),
    _Event_defaultPrevented = new WeakMap(),
    _Event_timestamp = new WeakMap(),
    _Event_propagationStopped = new WeakMap(),
    _Event_type = new WeakMap(),
    _Event_target = new WeakMap(),
    _Event_isBeingDispatched = new WeakMap(),
    _a$1.NONE = NONE,
    _a$1.CAPTURING_PHASE = CAPTURING_PHASE,
    _a$1.AT_TARGET = AT_TARGET,
    _a$1.BUBBLING_PHASE = BUBBLING_PHASE,
    _a$1);
Object.defineProperties(EventShim.prototype, {
    initEvent: enumerableProperty$1,
    stopImmediatePropagation: enumerableProperty$1,
    preventDefault: enumerableProperty$1,
    target: enumerableProperty$1,
    currentTarget: enumerableProperty$1,
    srcElement: enumerableProperty$1,
    type: enumerableProperty$1,
    cancelable: enumerableProperty$1,
    defaultPrevented: enumerableProperty$1,
    timeStamp: enumerableProperty$1,
    composedPath: enumerableProperty$1,
    returnValue: enumerableProperty$1,
    bubbles: enumerableProperty$1,
    composed: enumerableProperty$1,
    eventPhase: enumerableProperty$1,
    cancelBubble: enumerableProperty$1,
    stopPropagation: enumerableProperty$1,
    isTrusted: enumerableProperty$1,
});
// TODO: Remove this when we remove support for vm modules (--experimental-vm-modules).
const CustomEventShim = (_b = class CustomEvent extends EventShim {
        constructor(type, options = {}) {
            super(type, options);
            _CustomEvent_detail.set(this, void 0);
            __classPrivateFieldSet(this, _CustomEvent_detail, options?.detail ?? null, "f");
        }
        initCustomEvent(_type, _bubbles, _cancelable, _detail) {
            throw new Error('Method not implemented.');
        }
        get detail() {
            return __classPrivateFieldGet(this, _CustomEvent_detail, "f");
        }
    },
    _CustomEvent_detail = new WeakMap(),
    _b);
Object.defineProperties(CustomEventShim.prototype, {
    detail: enumerableProperty$1,
});
const EventShimWithRealType = EventShim;
const CustomEventShimWithRealType = CustomEventShim;

/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
var _a;
(_a = class CSSRule {
        constructor() {
            this.STYLE_RULE = 1;
            this.CHARSET_RULE = 2;
            this.IMPORT_RULE = 3;
            this.MEDIA_RULE = 4;
            this.FONT_FACE_RULE = 5;
            this.PAGE_RULE = 6;
            this.NAMESPACE_RULE = 10;
            this.KEYFRAMES_RULE = 7;
            this.KEYFRAME_RULE = 8;
            this.SUPPORTS_RULE = 12;
            this.COUNTER_STYLE_RULE = 11;
            this.FONT_FEATURE_VALUES_RULE = 14;
            this.MARGIN_RULE = 9;
            this.__parentStyleSheet = null;
            this.cssText = '';
        }
        get parentRule() {
            return null;
        }
        get parentStyleSheet() {
            return this.__parentStyleSheet;
        }
        get type() {
            return 0;
        }
    },
    _a.STYLE_RULE = 1,
    _a.CHARSET_RULE = 2,
    _a.IMPORT_RULE = 3,
    _a.MEDIA_RULE = 4,
    _a.FONT_FACE_RULE = 5,
    _a.PAGE_RULE = 6,
    _a.NAMESPACE_RULE = 10,
    _a.KEYFRAMES_RULE = 7,
    _a.KEYFRAME_RULE = 8,
    _a.SUPPORTS_RULE = 12,
    _a.COUNTER_STYLE_RULE = 11,
    _a.FONT_FEATURE_VALUES_RULE = 14,
    _a.MARGIN_RULE = 9,
    _a);

/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
// In an empty Node.js vm, we need to patch the global context.
// TODO: Remove these globalThis assignments when we remove support
// for vm modules (--experimental-vm-modules).
globalThis.Event ??= EventShimWithRealType;
globalThis.CustomEvent ??= CustomEventShimWithRealType;
const constructionToken = Symbol();
const isCaptureEventListener = (options) => (typeof options === 'boolean' ? options : (options?.capture ?? false));
const enumerableProperty = { __proto__: null };
enumerableProperty.enumerable = true;
Object.freeze(enumerableProperty);
/**
 * This is a basic implementation of an EventTarget.
 *
 * This is not fully spec compliant (e.g. validation),
 * but should work well enough for our use cases.
 *
 * @see https://dom.spec.whatwg.org/#eventtarget
 *
 * Example Event Path
 * ------------------
 *
 * Note that this depends on the logic in `packages/labs/ssr/src/lib/render-value.ts`.
 * Any element that is not a custom element or a slot element is skipped in the chain.
 *
 * <main>
 *   <my-el1>
 *     #shadow-dom (open)
 *       <div>
 *         <slot></slot>
 *         <my-el2>
 *           #shadow-dom (closed)
 *             <slot></slot>
 *             <event-dispatcher3></event-dispatcher3>
 *           <slot name="nested"></slot>
 *         </my-el2>
 *       </div>
 *     <event-dispatcher1></event-dispatcher1>
 *     <event-dispatcher2 slot="nested"></event-dispatcher2>
 *   </my-el1>
 * </main>
 *
 * Given the previous structure, the event path of this shim would be as follows,
 * for the given dispatcher with an event that bubbles (document-fragment
 * represents a ShadowRoot/#shadow-dom instance):
 *
 * <event-dispatcher1>:
 * [event-dispatcher1, slot{my-el1}, document-fragment{my-el1}, my-el1, document]
 *
 * <event-dispatcher2>:
 * [
 *   event-dispatcher2,
 *   slot[name="nested"]{my-el1},
 *   slot{my-el2},
 *   document-fragment{my-el2},
 *   my-el2,
 *   document-fragment{my-el1},
 *   my-el1,
 *   document
 * ]
 *
 * <event-dispatcher3> (without composed):
 * [event-dispatcher3, document-fragment{my-el2}]
 *
 * <event-dispatcher3> (composed):
 * [
 *   event-dispatcher3,
 *   document-fragment{my-el2},
 *   my-el2,
 *   document-fragment{my-el1},
 *   my-el1,
 *   document
 * ]
 */
class EventTarget {
    constructor() {
        this.__eventListeners = new Map();
        this.__captureEventListeners = new Map();
    }
    addEventListener(type, callback, options) {
        if (callback === undefined || callback === null) {
            return;
        }
        const eventListenersMap = isCaptureEventListener(options)
            ? this.__captureEventListeners
            : this.__eventListeners;
        let eventListeners = eventListenersMap.get(type);
        if (eventListeners === undefined) {
            eventListeners = new Map();
            eventListenersMap.set(type, eventListeners);
        }
        else if (eventListeners.has(callback)) {
            return;
        }
        const normalizedOptions = typeof options === 'object' && options ? options : {};
        normalizedOptions.signal?.addEventListener('abort', () => this.removeEventListener(type, callback, options));
        eventListeners.set(callback, normalizedOptions ?? {});
    }
    removeEventListener(type, callback, options) {
        if (callback === undefined || callback === null) {
            return;
        }
        const eventListenersMap = isCaptureEventListener(options)
            ? this.__captureEventListeners
            : this.__eventListeners;
        const eventListeners = eventListenersMap.get(type);
        if (eventListeners !== undefined) {
            eventListeners.delete(callback);
            if (!eventListeners.size) {
                eventListenersMap.delete(type);
            }
        }
    }
    dispatchEvent(event) {
        let composedPath = this.__resolveFullEventPath();
        if (!event.composed && this.__host) {
            // If the event is not composed and the event was dispatched inside
            // shadow DOM, we need to stop the event chain before the host of the
            // shadow DOM.
            composedPath = composedPath.slice(0, composedPath.indexOf(this.__host));
        }
        // We need to patch various properties that would either be empty or wrong
        // in this scenario.
        let stopPropagation = false;
        let stopImmediatePropagation = false;
        let eventPhase = EventShimWithRealType.NONE;
        let target = null;
        let tmpTarget = null;
        let currentTarget = null;
        const originalStopPropagation = event.stopPropagation;
        const originalStopImmediatePropagation = event.stopImmediatePropagation;
        Object.defineProperties(event, {
            target: {
                get() {
                    return target ?? tmpTarget;
                },
                ...enumerableProperty,
            },
            srcElement: {
                get() {
                    return event.target;
                },
                ...enumerableProperty,
            },
            currentTarget: {
                get() {
                    return currentTarget;
                },
                ...enumerableProperty,
            },
            eventPhase: {
                get() {
                    return eventPhase;
                },
                ...enumerableProperty,
            },
            composedPath: {
                value: () => composedPath,
                ...enumerableProperty,
            },
            stopPropagation: {
                value: () => {
                    stopPropagation = true;
                    originalStopPropagation.call(event);
                },
                ...enumerableProperty,
            },
            stopImmediatePropagation: {
                value: () => {
                    stopImmediatePropagation = true;
                    originalStopImmediatePropagation.call(event);
                },
                ...enumerableProperty,
            },
        });
        // An event handler can either be a function, an object with a handleEvent
        // method or null. This function takes care to call the event handler
        // correctly.
        const invokeEventListener = (listener, options, eventListenerMap) => {
            if (typeof listener === 'function') {
                listener(event);
            }
            else if (typeof listener?.handleEvent === 'function') {
                listener.handleEvent(event);
            }
            if (options.once) {
                eventListenerMap.delete(listener);
            }
        };
        // When an event is finished being dispatched, which can be after the event
        // tree has been traversed or stopPropagation/stopImmediatePropagation has
        // been called. Once that is the case, the currentTarget and eventPhase
        // need to be reset and a value, representing whether the event has not
        // been prevented, needs to be returned.
        const finishDispatch = () => {
            currentTarget = null;
            eventPhase = EventShimWithRealType.NONE;
            return !event.defaultPrevented;
        };
        // An event starts with the capture order, where it starts from the top.
        // This is done even if bubbles is set to false, which is the default.
        const captureEventPath = composedPath.slice().reverse();
        // If the event target, which dispatches the event, is either in the light DOM
        // or the event is not composed, the target is always itself. If that is not
        // the case, the target needs to be retargeted: https://dom.spec.whatwg.org/#retarget
        target = !this.__host || !event.composed ? this : null;
        const retarget = (eventTargets) => {
            // eslint-disable-next-line @typescript-eslint/no-this-alias
            tmpTarget = this;
            while (tmpTarget.__host && eventTargets.includes(tmpTarget.__host)) {
                tmpTarget = tmpTarget.__host;
            }
        };
        for (const eventTarget of captureEventPath) {
            if (!target && (!tmpTarget || tmpTarget === eventTarget.__host)) {
                retarget(captureEventPath.slice(captureEventPath.indexOf(eventTarget)));
            }
            currentTarget = eventTarget;
            eventPhase =
                eventTarget === event.target
                    ? EventShimWithRealType.AT_TARGET
                    : EventShimWithRealType.CAPTURING_PHASE;
            const captureEventListeners = eventTarget.__captureEventListeners.get(event.type);
            if (captureEventListeners) {
                for (const [listener, options] of captureEventListeners) {
                    invokeEventListener(listener, options, captureEventListeners);
                    if (stopImmediatePropagation) {
                        // Event.stopImmediatePropagation() stops any following invocation
                        // of an event handler even on the same event target.
                        return finishDispatch();
                    }
                }
            }
            if (stopPropagation) {
                // Event.stopPropagation() stops any following invocation
                // of an event handler for any following event targets.
                return finishDispatch();
            }
        }
        const bubbleEventPath = event.bubbles ? composedPath : [this];
        tmpTarget = null;
        for (const eventTarget of bubbleEventPath) {
            if (!target &&
                (!tmpTarget || eventTarget === tmpTarget.__host)) {
                retarget(bubbleEventPath.slice(0, bubbleEventPath.indexOf(eventTarget) + 1));
            }
            currentTarget = eventTarget;
            eventPhase =
                eventTarget === event.target
                    ? EventShimWithRealType.AT_TARGET
                    : EventShimWithRealType.BUBBLING_PHASE;
            const eventListeners = eventTarget.__eventListeners.get(event.type);
            if (eventListeners) {
                for (const [listener, options] of eventListeners) {
                    invokeEventListener(listener, options, eventListeners);
                    if (stopImmediatePropagation) {
                        // Event.stopImmediatePropagation() stops any following invocation
                        // of an event handler even on the same event target.
                        return finishDispatch();
                    }
                }
            }
            if (stopPropagation) {
                // Event.stopPropagation() stops any following invocation
                // of an event handler for any following event targets.
                return finishDispatch();
            }
        }
        return finishDispatch();
    }
    __resolveFullEventPath() {
        if (this.__eventPathCache) {
            return this.__eventPathCache;
        }
        else if (!this.__eventTargetParent) {
            return (this.__eventPathCache = [this, documentShim, windowShim]);
        }
        else {
            return (this.__eventPathCache = [
                this,
                ...this.__eventTargetParent.__resolveFullEventPath(),
            ]);
        }
    }
}
const attributes = new WeakMap();
const attributesForElement = (element) => {
    let attrs = attributes.get(element);
    if (attrs === undefined) {
        attributes.set(element, (attrs = new Map()));
    }
    return attrs;
};
// The typings around the exports below are a little funky:
//
// 1. We want the `name` of the shim classes to match the real ones at runtime,
//    hence e.g. `class Element`.
// 2. We can't shadow the global types with a simple class declaration, because
//    then we can't reference the global types for casting, hence e.g.
//    `const ElementShim = class Element`.
// 3. We want to export the classes typed as the real ones, hence e.g.
//    `const ElementShimWithRealType = ElementShim as object as typeof Element;`.
// 4. We want the exported names to match the real ones, hence e.g.
//    `export {ElementShimWithRealType as Element}`.
const NodeShim = class Node extends EventTarget {
    getRootNode(options) {
        if (options?.composed) {
            return document$1;
        }
        // getRootNode returns the containing ShadowRoot instance, even if that was
        // created in closed mode.
        const host = this.__host;
        return (host?.__shadowRoot ?? document$1);
    }
};
const DocumentShim = class Document extends NodeShim {
    get adoptedStyleSheets() {
        return [];
    }
    createTreeWalker() {
        return {};
    }
    createTextNode() {
        return {};
    }
    createElement() {
        return {};
    }
};
const documentShim = new DocumentShim();
const document$1 = documentShim;
const WindowShim = class Window extends NodeShim {
    constructor(token) {
        super();
        if (token !== constructionToken) {
            throw new TypeError('Illegal constructor');
        }
        Object.assign(this, globalThis, {
            CustomElementRegistry,
            customElements: customElements$1,
            document: document$1,
            Document: DocumentShim,
            Element: ElementShim,
            EventTarget,
            HTMLElement: HTMLElementShim,
            Node: NodeShim,
            ShadowRoot: ShadowRootShim,
            window: this,
            Window: WindowShim,
        });
    }
};
const ElementShim = class Element extends NodeShim {
    constructor() {
        super(...arguments);
        this.__shadowRootMode = null;
        this.__shadowRoot = null;
        this.__internals = null;
    }
    get attributes() {
        return Array.from(attributesForElement(this)).map(([name, value]) => ({
            name,
            value,
        }));
    }
    get shadowRoot() {
        if (this.__shadowRootMode === 'closed') {
            return null;
        }
        return this.__shadowRoot;
    }
    get localName() {
        return this.constructor.__localName;
    }
    get tagName() {
        return this.localName?.toUpperCase();
    }
    setAttribute(name, value) {
        // Emulate browser behavior that silently casts all values to string. E.g.
        // `42` becomes `"42"` and `{}` becomes `"[object Object]""`.
        attributesForElement(this).set(name, String(value));
    }
    removeAttribute(name) {
        attributesForElement(this).delete(name);
    }
    toggleAttribute(name, force) {
        // Steps reference https://dom.spec.whatwg.org/#dom-element-toggleattribute
        if (this.hasAttribute(name)) {
            // Step 5
            if (force === undefined || !force) {
                this.removeAttribute(name);
                return false;
            }
        }
        else {
            // Step 4
            if (force === undefined || force) {
                // Step 4.1
                this.setAttribute(name, '');
                return true;
            }
            else {
                // Step 4.2
                return false;
            }
        }
        // Step 6
        return true;
    }
    hasAttribute(name) {
        return attributesForElement(this).has(name);
    }
    attachShadow(init) {
        this.__shadowRootMode = init.mode;
        const shadowRoot = new ShadowRootShim(constructionToken, init);
        shadowRoot.__eventTargetParent = this;
        shadowRoot.__host = this;
        return (this.__shadowRoot = shadowRoot);
    }
    attachInternals() {
        if (this.__internals !== null) {
            throw new Error(`Failed to execute 'attachInternals' on 'HTMLElement': ` +
                `ElementInternals for the specified element was already attached.`);
        }
        const internals = new ElementInternalsShim(this);
        this.__internals = internals;
        return internals;
    }
    getAttribute(name) {
        const value = attributesForElement(this).get(name);
        return value ?? null;
    }
};
const HTMLElementShim = class HTMLElement extends ElementShim {
};
const HTMLElementShimWithRealType = HTMLElementShim;
const ShadowRootShim = class ShadowRoot extends NodeShim {
    get host() {
        return this.__host;
    }
    constructor(constructionToken, init) {
        super();
        if (constructionToken !== constructionToken) {
            throw new TypeError('Illegal constructor');
        }
        this.mode = init.mode;
    }
};
// For convenience, we provide a global instance of a HTMLElement as an event
// target. This facilitates registering global event handlers
// (e.g. for @lit/context ContextProvider).
// We use this in in the SSR render function.
// Note, this is a bespoke element and not simply `document` or `window` since
// user code relies on these being undefined in the server environment.
globalThis.litServerRoot ??= Object.defineProperty(new HTMLElementShimWithRealType(), 'localName', {
    // Patch localName (and tagName) to return a unique name.
    get() {
        return 'lit-server-root';
    },
});
function promiseWithResolvers() {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve: resolve, reject: reject };
}
class CustomElementRegistry {
    constructor() {
        this.__definitions = new Map();
        this.__reverseDefinitions = new Map();
        this.__pendingWhenDefineds = new Map();
    }
    define(name, ctor) {
        if (this.__definitions.has(name)) {
            if (process.env.NODE_ENV === 'development') {
                console.warn(`'CustomElementRegistry' already has "${name}" defined. ` +
                    `This may have been caused by live reload or hot module ` +
                    `replacement in which case it can be safely ignored.\n` +
                    `Make sure to test your application with a production build as ` +
                    `repeat registrations will throw in production.`);
            }
            else {
                throw new Error(`Failed to execute 'define' on 'CustomElementRegistry': ` +
                    `the name "${name}" has already been used with this registry`);
            }
        }
        if (this.__reverseDefinitions.has(ctor)) {
            throw new Error(`Failed to execute 'define' on 'CustomElementRegistry': ` +
                `the constructor has already been used with this registry for the ` +
                `tag name ${this.__reverseDefinitions.get(ctor)}`);
        }
        // Provide tagName and localName for the component.
        ctor.__localName = name;
        this.__definitions.set(name, {
            ctor,
            // Note it's important we read `observedAttributes` in case it is a getter
            // with side-effects, as is the case in Lit, where it triggers class
            // finalization.
            //
            // TODO(aomarks) To be spec compliant, we should also capture the
            // registration-time lifecycle methods like `connectedCallback`. For them
            // to be actually accessible to e.g. the Lit SSR element renderer, though,
            // we'd need to introduce a new API for accessing them (since `get` only
            // returns the constructor).
            observedAttributes: ctor.observedAttributes ?? [],
        });
        this.__reverseDefinitions.set(ctor, name);
        this.__pendingWhenDefineds.get(name)?.resolve(ctor);
        this.__pendingWhenDefineds.delete(name);
    }
    get(name) {
        const definition = this.__definitions.get(name);
        return definition?.ctor;
    }
    getName(ctor) {
        return this.__reverseDefinitions.get(ctor) ?? null;
    }
    initialize(_root) {
        throw new Error(`customElements.initialize is not currently supported in SSR. ` +
            `Please file a bug if you need it.`);
    }
    upgrade(_element) {
        // In SSR this doesn't make a lot of sense, so we do nothing.
        throw new Error(`customElements.upgrade is not currently supported in SSR. ` +
            `Please file a bug if you need it.`);
    }
    async whenDefined(name) {
        const definition = this.__definitions.get(name);
        if (definition) {
            return definition.ctor;
        }
        let withResolvers = this.__pendingWhenDefineds.get(name);
        if (!withResolvers) {
            withResolvers = promiseWithResolvers();
            this.__pendingWhenDefineds.set(name, withResolvers);
        }
        return withResolvers.promise;
    }
}
const CustomElementRegistryShimWithRealType = CustomElementRegistry;
const customElements$1 = new CustomElementRegistryShimWithRealType();
// The window variable instantiation must happen after all shims
// have been declared, as they will be included in the window instance.
const windowShim = new WindowShim(constructionToken);

/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const t$1=globalThis,e$1=t$1.ShadowRoot&&(void 0===t$1.ShadyCSS||t$1.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,s$2=Symbol(),o$3=new WeakMap;let n$2 = class n{constructor(t,e,o){if(this._$cssResult$=true,o!==s$2)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=t,this.t=e;}get styleSheet(){let t=this.o;const s=this.t;if(e$1&&void 0===t){const e=void 0!==s&&1===s.length;e&&(t=o$3.get(s)),void 0===t&&((this.o=t=new CSSStyleSheet).replaceSync(this.cssText),e&&o$3.set(s,t));}return t}toString(){return this.cssText}};const r$2=t=>new n$2("string"==typeof t?t:t+"",void 0,s$2),S$1=(s,o)=>{if(e$1)s.adoptedStyleSheets=o.map(t=>t instanceof CSSStyleSheet?t:t.styleSheet);else for(const e of o){const o=document.createElement("style"),n=t$1.litNonce;void 0!==n&&o.setAttribute("nonce",n),o.textContent=e.cssText,s.appendChild(o);}},c$2=e$1||void 0===t$1.CSSStyleSheet?t=>t:t=>t instanceof CSSStyleSheet?(t=>{let e="";for(const s of t.cssRules)e+=s.cssText;return r$2(e)})(t):t;

const{is:h$1,defineProperty:r$1,getOwnPropertyDescriptor:o$2,getOwnPropertyNames:n$1,getOwnPropertySymbols:a$1,getPrototypeOf:c$1}=Object,l$1=globalThis;l$1.customElements??=customElements$1;const p$1=l$1.trustedTypes,d$1=p$1?p$1.emptyScript:"",u$1=l$1.reactiveElementPolyfillSupport,f$1=(t,s)=>t,b$1={toAttribute(t,s){switch(s){case Boolean:t=t?d$1:null;break;case Object:case Array:t=null==t?t:JSON.stringify(t);}return t},fromAttribute(t,s){let i=t;switch(s){case Boolean:i=null!==t;break;case Number:i=null===t?null:Number(t);break;case Object:case Array:try{i=JSON.parse(t);}catch(t){i=null;}}return i}},m$1=(t,s)=>!h$1(t,s),y$1={attribute:true,type:String,converter:b$1,reflect:false,useDefault:false,hasChanged:m$1};Symbol.metadata??=Symbol("metadata"),l$1.litPropertyMetadata??=new WeakMap;let g$1 = class g extends(globalThis.HTMLElement??HTMLElementShimWithRealType){static addInitializer(t){this._$Ei(),(this.l??=[]).push(t);}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(t,s=y$1){if(s.state&&(s.attribute=false),this._$Ei(),this.prototype.hasOwnProperty(t)&&((s=Object.create(s)).wrapped=true),this.elementProperties.set(t,s),!s.noAccessor){const i=Symbol(),e=this.getPropertyDescriptor(t,i,s);void 0!==e&&r$1(this.prototype,t,e);}}static getPropertyDescriptor(t,s,i){const{get:e,set:h}=o$2(this.prototype,t)??{get(){return this[s]},set(t){this[s]=t;}};return {get:e,set(s){const r=e?.call(this);h?.call(this,s),this.requestUpdate(t,r,i);},configurable:true,enumerable:true}}static getPropertyOptions(t){return this.elementProperties.get(t)??y$1}static _$Ei(){if(this.hasOwnProperty(f$1("elementProperties")))return;const t=c$1(this);t.finalize(),void 0!==t.l&&(this.l=[...t.l]),this.elementProperties=new Map(t.elementProperties);}static finalize(){if(this.hasOwnProperty(f$1("finalized")))return;if(this.finalized=true,this._$Ei(),this.hasOwnProperty(f$1("properties"))){const t=this.properties,s=[...n$1(t),...a$1(t)];for(const i of s)this.createProperty(i,t[i]);}const t=this[Symbol.metadata];if(null!==t){const s=litPropertyMetadata.get(t);if(void 0!==s)for(const[t,i]of s)this.elementProperties.set(t,i);}this._$Eh=new Map;for(const[t,s]of this.elementProperties){const i=this._$Eu(t,s);void 0!==i&&this._$Eh.set(i,t);}this.elementStyles=this.finalizeStyles(this.styles);}static finalizeStyles(t){const s=[];if(Array.isArray(t)){const e=new Set(t.flat(1/0).reverse());for(const t of e)s.unshift(c$2(t));}else void 0!==t&&s.push(c$2(t));return s}static _$Eu(t,s){const i=s.attribute;return  false===i?void 0:"string"==typeof i?i:"string"==typeof t?t.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=false,this.hasUpdated=false,this._$Em=null,this._$Ev();}_$Ev(){this._$ES=new Promise(t=>this.enableUpdating=t),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(t=>t(this));}addController(t){(this._$EO??=new Set).add(t),void 0!==this.renderRoot&&this.isConnected&&t.hostConnected?.();}removeController(t){this._$EO?.delete(t);}_$E_(){const t=new Map,s=this.constructor.elementProperties;for(const i of s.keys())this.hasOwnProperty(i)&&(t.set(i,this[i]),delete this[i]);t.size>0&&(this._$Ep=t);}createRenderRoot(){const t=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return S$1(t,this.constructor.elementStyles),t}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(true),this._$EO?.forEach(t=>t.hostConnected?.());}enableUpdating(t){}disconnectedCallback(){this._$EO?.forEach(t=>t.hostDisconnected?.());}attributeChangedCallback(t,s,i){this._$AK(t,i);}_$ET(t,s){const i=this.constructor.elementProperties.get(t),e=this.constructor._$Eu(t,i);if(void 0!==e&&true===i.reflect){const h=(void 0!==i.converter?.toAttribute?i.converter:b$1).toAttribute(s,i.type);this._$Em=t,null==h?this.removeAttribute(e):this.setAttribute(e,h),this._$Em=null;}}_$AK(t,s){const i=this.constructor,e=i._$Eh.get(t);if(void 0!==e&&this._$Em!==e){const t=i.getPropertyOptions(e),h="function"==typeof t.converter?{fromAttribute:t.converter}:void 0!==t.converter?.fromAttribute?t.converter:b$1;this._$Em=e;const r=h.fromAttribute(s,t.type);this[e]=r??this._$Ej?.get(e)??r,this._$Em=null;}}requestUpdate(t,s,i,e=false,h){if(void 0!==t){const r=this.constructor;if(false===e&&(h=this[t]),i??=r.getPropertyOptions(t),!((i.hasChanged??m$1)(h,s)||i.useDefault&&i.reflect&&h===this._$Ej?.get(t)&&!this.hasAttribute(r._$Eu(t,i))))return;this.C(t,s,i);} false===this.isUpdatePending&&(this._$ES=this._$EP());}C(t,s,{useDefault:i,reflect:e,wrapped:h},r){i&&!(this._$Ej??=new Map).has(t)&&(this._$Ej.set(t,r??s??this[t]),true!==h||void 0!==r)||(this._$AL.has(t)||(this.hasUpdated||i||(s=void 0),this._$AL.set(t,s)),true===e&&this._$Em!==t&&(this._$Eq??=new Set).add(t));}async _$EP(){this.isUpdatePending=true;try{await this._$ES;}catch(t){Promise.reject(t);}const t=this.scheduleUpdate();return null!=t&&await t,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(const[t,s]of this._$Ep)this[t]=s;this._$Ep=void 0;}const t=this.constructor.elementProperties;if(t.size>0)for(const[s,i]of t){const{wrapped:t}=i,e=this[s];true!==t||this._$AL.has(s)||void 0===e||this.C(s,void 0,i,e);}}let t=false;const s=this._$AL;try{t=this.shouldUpdate(s),t?(this.willUpdate(s),this._$EO?.forEach(t=>t.hostUpdate?.()),this.update(s)):this._$EM();}catch(s){throw t=false,this._$EM(),s}t&&this._$AE(s);}willUpdate(t){}_$AE(t){this._$EO?.forEach(t=>t.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=true,this.firstUpdated(t)),this.updated(t);}_$EM(){this._$AL=new Map,this.isUpdatePending=false;}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(t){return  true}update(t){this._$Eq&&=this._$Eq.forEach(t=>this._$ET(t,this[t])),this._$EM();}updated(t){}firstUpdated(t){}};g$1.elementStyles=[],g$1.shadowRootOptions={mode:"open"},g$1[f$1("elementProperties")]=new Map,g$1[f$1("finalized")]=new Map,u$1?.({ReactiveElement:g$1}),(l$1.reactiveElementVersions??=[]).push("2.1.2");

/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const t=globalThis,i$1=t=>t,s$1=t.trustedTypes,e=s$1?s$1.createPolicy("lit-html",{createHTML:t=>t}):void 0,h="$lit$",o$1=`lit$${Math.random().toFixed(9).slice(2)}$`,n="?"+o$1,r=`<${n}>`,l=void 0===t.document?{createTreeWalker:()=>({})}:document,c=()=>l.createComment(""),a=t=>null===t||"object"!=typeof t&&"function"!=typeof t,u=Array.isArray,d=t=>u(t)||"function"==typeof t?.[Symbol.iterator],f="[ \t\n\f\r]",v=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,_=/-->/g,m=/>/g,p=RegExp(`>|${f}(?:([^\\s"'>=/]+)(${f}*=${f}*(?:[^ \t\n\f\r"'\`<>=]|("|')|))|$)`,"g"),g=/'/g,$=/"/g,y=/^(?:script|style|textarea|title)$/i,x=t=>(i,...s)=>({_$litType$:t,strings:i,values:s}),T=x(1),b=x(2),E=Symbol.for("lit-noChange"),A=Symbol.for("lit-nothing"),C=new WeakMap,P=l.createTreeWalker(l,129);function V(t,i){if(!u(t)||!t.hasOwnProperty("raw"))throw Error("invalid template strings array");return void 0!==e?e.createHTML(i):i}const N=(t,i)=>{const s=t.length-1,e=[];let n,l=2===i?"<svg>":3===i?"<math>":"",c=v;for(let i=0;i<s;i++){const s=t[i];let a,u,d=-1,f=0;for(;f<s.length&&(c.lastIndex=f,u=c.exec(s),null!==u);)f=c.lastIndex,c===v?"!--"===u[1]?c=_:void 0!==u[1]?c=m:void 0!==u[2]?(y.test(u[2])&&(n=RegExp("</"+u[2],"g")),c=p):void 0!==u[3]&&(c=p):c===p?">"===u[0]?(c=n??v,d=-1):void 0===u[1]?d=-2:(d=c.lastIndex-u[2].length,a=u[1],c=void 0===u[3]?p:'"'===u[3]?$:g):c===$||c===g?c=p:c===_||c===m?c=v:(c=p,n=void 0);const x=c===p&&t[i+1].startsWith("/>")?" ":"";l+=c===v?s+r:d>=0?(e.push(a),s.slice(0,d)+h+s.slice(d)+o$1+x):s+o$1+(-2===d?i:x);}return [V(t,l+(t[s]||"<?>")+(2===i?"</svg>":3===i?"</math>":"")),e]};class S{constructor({strings:t,_$litType$:i},e){let r;this.parts=[];let l=0,a=0;const u=t.length-1,d=this.parts,[f,v]=N(t,i);if(this.el=S.createElement(f,e),P.currentNode=this.el.content,2===i||3===i){const t=this.el.content.firstChild;t.replaceWith(...t.childNodes);}for(;null!==(r=P.nextNode())&&d.length<u;){if(1===r.nodeType){if(r.hasAttributes())for(const t of r.getAttributeNames())if(t.endsWith(h)){const i=v[a++],s=r.getAttribute(t).split(o$1),e=/([.?@])?(.*)/.exec(i);d.push({type:1,index:l,name:e[2],strings:s,ctor:"."===e[1]?I:"?"===e[1]?L:"@"===e[1]?z:H}),r.removeAttribute(t);}else t.startsWith(o$1)&&(d.push({type:6,index:l}),r.removeAttribute(t));if(y.test(r.tagName)){const t=r.textContent.split(o$1),i=t.length-1;if(i>0){r.textContent=s$1?s$1.emptyScript:"";for(let s=0;s<i;s++)r.append(t[s],c()),P.nextNode(),d.push({type:2,index:++l});r.append(t[i],c());}}}else if(8===r.nodeType)if(r.data===n)d.push({type:2,index:l});else {let t=-1;for(;-1!==(t=r.data.indexOf(o$1,t+1));)d.push({type:7,index:l}),t+=o$1.length-1;}l++;}}static createElement(t,i){const s=l.createElement("template");return s.innerHTML=t,s}}function M(t,i,s=t,e){if(i===E)return i;let h=void 0!==e?s._$Co?.[e]:s._$Cl;const o=a(i)?void 0:i._$litDirective$;return h?.constructor!==o&&(h?._$AO?.(false),void 0===o?h=void 0:(h=new o(t),h._$AT(t,s,e)),void 0!==e?(s._$Co??=[])[e]=h:s._$Cl=h),void 0!==h&&(i=M(t,h._$AS(t,i.values),h,e)),i}class k{constructor(t,i){this._$AV=[],this._$AN=void 0,this._$AD=t,this._$AM=i;}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(t){const{el:{content:i},parts:s}=this._$AD,e=(t?.creationScope??l).importNode(i,true);P.currentNode=e;let h=P.nextNode(),o=0,n=0,r=s[0];for(;void 0!==r;){if(o===r.index){let i;2===r.type?i=new R(h,h.nextSibling,this,t):1===r.type?i=new r.ctor(h,r.name,r.strings,this,t):6===r.type&&(i=new W(h,this,t)),this._$AV.push(i),r=s[++n];}o!==r?.index&&(h=P.nextNode(),o++);}return P.currentNode=l,e}p(t){let i=0;for(const s of this._$AV) void 0!==s&&(void 0!==s.strings?(s._$AI(t,s,i),i+=s.strings.length-2):s._$AI(t[i])),i++;}}class R{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(t,i,s,e){this.type=2,this._$AH=A,this._$AN=void 0,this._$AA=t,this._$AB=i,this._$AM=s,this.options=e,this._$Cv=e?.isConnected??true;}get parentNode(){let t=this._$AA.parentNode;const i=this._$AM;return void 0!==i&&11===t?.nodeType&&(t=i.parentNode),t}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(t,i=this){t=M(this,t,i),a(t)?t===A||null==t||""===t?(this._$AH!==A&&this._$AR(),this._$AH=A):t!==this._$AH&&t!==E&&this._(t):void 0!==t._$litType$?this.$(t):void 0!==t.nodeType?this.T(t):d(t)?this.k(t):this._(t);}O(t){return this._$AA.parentNode.insertBefore(t,this._$AB)}T(t){this._$AH!==t&&(this._$AR(),this._$AH=this.O(t));}_(t){this._$AH!==A&&a(this._$AH)?this._$AA.nextSibling.data=t:this.T(l.createTextNode(t)),this._$AH=t;}$(t){const{values:i,_$litType$:s}=t,e="number"==typeof s?this._$AC(t):(void 0===s.el&&(s.el=S.createElement(V(s.h,s.h[0]),this.options)),s);if(this._$AH?._$AD===e)this._$AH.p(i);else {const t=new k(e,this),s=t.u(this.options);t.p(i),this.T(s),this._$AH=t;}}_$AC(t){let i=C.get(t.strings);return void 0===i&&C.set(t.strings,i=new S(t)),i}k(t){u(this._$AH)||(this._$AH=[],this._$AR());const i=this._$AH;let s,e=0;for(const h of t)e===i.length?i.push(s=new R(this.O(c()),this.O(c()),this,this.options)):s=i[e],s._$AI(h),e++;e<i.length&&(this._$AR(s&&s._$AB.nextSibling,e),i.length=e);}_$AR(t=this._$AA.nextSibling,s){for(this._$AP?.(false,true,s);t!==this._$AB;){const s=i$1(t).nextSibling;i$1(t).remove(),t=s;}}setConnected(t){ void 0===this._$AM&&(this._$Cv=t,this._$AP?.(t));}}class H{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(t,i,s,e,h){this.type=1,this._$AH=A,this._$AN=void 0,this.element=t,this.name=i,this._$AM=e,this.options=h,s.length>2||""!==s[0]||""!==s[1]?(this._$AH=Array(s.length-1).fill(new String),this.strings=s):this._$AH=A;}_$AI(t,i=this,s,e){const h=this.strings;let o=false;if(void 0===h)t=M(this,t,i,0),o=!a(t)||t!==this._$AH&&t!==E,o&&(this._$AH=t);else {const e=t;let n,r;for(t=h[0],n=0;n<h.length-1;n++)r=M(this,e[s+n],i,n),r===E&&(r=this._$AH[n]),o||=!a(r)||r!==this._$AH[n],r===A?t=A:t!==A&&(t+=(r??"")+h[n+1]),this._$AH[n]=r;}o&&!e&&this.j(t);}j(t){t===A?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,t??"");}}class I extends H{constructor(){super(...arguments),this.type=3;}j(t){this.element[this.name]=t===A?void 0:t;}}class L extends H{constructor(){super(...arguments),this.type=4;}j(t){this.element.toggleAttribute(this.name,!!t&&t!==A);}}class z extends H{constructor(t,i,s,e,h){super(t,i,s,e,h),this.type=5;}_$AI(t,i=this){if((t=M(this,t,i,0)??A)===E)return;const s=this._$AH,e=t===A&&s!==A||t.capture!==s.capture||t.once!==s.once||t.passive!==s.passive,h=t!==A&&(s===A||e);e&&this.element.removeEventListener(this.name,this,s),h&&this.element.addEventListener(this.name,this,t),this._$AH=t;}handleEvent(t){"function"==typeof this._$AH?this._$AH.call(this.options?.host??this.element,t):this._$AH.handleEvent(t);}}class W{constructor(t,i,s){this.element=t,this.type=6,this._$AN=void 0,this._$AM=i,this.options=s;}get _$AU(){return this._$AM._$AU}_$AI(t){M(this,t);}}const j=t.litHtmlPolyfillSupport;j?.(S,R),(t.litHtmlVersions??=[]).push("3.3.3");const B=(t,i,s)=>{const e=s?.renderBefore??i;let h=e._$litPart$;if(void 0===h){const t=s?.renderBefore??null;e._$litPart$=h=new R(i.insertBefore(c(),t),t,void 0,s??{});}return h._$AI(t),h};

/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const s=globalThis;class i extends g$1{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0;}createRenderRoot(){const t=super.createRenderRoot();return this.renderOptions.renderBefore??=t.firstChild,t}update(t){const r=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(t),this._$Do=B(r,this.renderRoot,this.renderOptions);}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(true);}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(false);}render(){return E}}i._$litElement$=true,i["finalized"]=true,s.litElementHydrateSupport?.({LitElement:i});const o=s.litElementPolyfillSupport;o?.({LitElement:i});(s.litElementVersions??=[]).push("4.2.2");

/**
 * Base class for **leaf** controls (play button, time, volume, …). Renders its
 * own markup into light DOM (it has no user children, so rendering into `this`
 * is safe and lets users style with plain selectors). Resolves the ancestor
 * `<km-player>` on connect and offers {@link watch} to re-render when a player
 * signal changes.
 */
class KmControl extends i {
    /** The resolved player, or `null` if used outside a `<km-player>`. */
    api = null;
    _unsubs = [];
    // Light DOM — no shadow root, so all styling is overridable with plain CSS.
    createRenderRoot() {
        return this;
    }
    connectedCallback() {
        super.connectedCallback();
        this.api = getPlayerApi(this);
        if (this.api)
            this.bind(this.api);
    }
    disconnectedCallback() {
        super.disconnectedCallback();
        for (const u of this._unsubs)
            u();
        this._unsubs = [];
        this.api = null;
    }
    /** Subscribe to a player signal and re-render this control on every change. */
    watch(sig) {
        this._unsubs.push(sig.subscribe(() => this.requestUpdate()));
    }
    /**
     * Declare reactive subscriptions here using {@link watch}. Called once on
     * connect with the resolved {@link PlayerApi}.
     */
    bind(_api) { }
}
/**
 * Base class for **layout containers** (overlay, controls, rows, spacer). These
 * wrap user-authored children, so they must never let a framework re-render
 * wipe that content — they are bare custom elements that only exist for
 * semantics + CSS targeting. All styling lives in the opt-in stylesheet.
 */
class KmContainer extends HTMLElement {
}

/**
 * Layout containers. Each is a bare custom element that preserves its
 * user-authored children and is styled entirely by the opt-in stylesheet.
 *
 * - `<km-player-overlay>`   — centered overlay layer above the video.
 * - `<km-player-controls>`  — the control bar (one or more rows).
 * - `<km-player-controls-row>` — a flex row of controls.
 * - `<km-player-space grow>` — a spacer; `grow` makes it consume free space.
 */
class KmPlayerOverlay extends KmContainer {
}
class KmPlayerControls extends KmContainer {
}
class KmPlayerControlsRow extends KmContainer {
}
class KmPlayerSpace extends KmContainer {
}
const REGISTRY = [
    ["km-player-overlay", KmPlayerOverlay],
    ["km-player-controls", KmPlayerControls],
    ["km-player-controls-row", KmPlayerControlsRow],
    ["km-player-space", KmPlayerSpace],
];
for (const [tag, ctor] of REGISTRY) {
    if (!customElements.get(tag))
        customElements.define(tag, ctor);
}

const clamp01 = (x) => Math.max(0, Math.min(1, x));
/**
 * Draggable seek bar. Mirrors the demo studio's scrubber UX: grabbing pauses
 * playback and resumes on release, dragging seeks live.
 */
class KmPlayerProgress extends KmControl {
    _dragging = false;
    _wasPlaying = false;
    bind(api) {
        this.watch(api.state.frame);
        this.watch(api.state.duration);
    }
    disconnectedCallback() {
        super.disconnectedCallback();
        this._teardownDrag();
    }
    _pct() {
        const total = this.api?.state.duration.get() ?? 0;
        const frame = this.api?.state.frame.get() ?? 0;
        return total > 1 ? clamp01(frame / (total - 1)) : 0;
    }
    _posFromEvent(e) {
        const track = this.querySelector(".km-player__track") ?? this;
        const r = track.getBoundingClientRect();
        return r.width > 0 ? clamp01((e.clientX - r.left) / r.width) : 0;
    }
    _seek(p) {
        const total = this.api?.state.duration.get() ?? 0;
        if (total > 1)
            this.api?.seekTo(Math.round(p * (total - 1)));
    }
    _onMove = (e) => {
        if (this._dragging)
            this._seek(this._posFromEvent(e));
    };
    _onUp = () => {
        if (!this._dragging)
            return;
        this._dragging = false;
        this._teardownDrag();
        if (this._wasPlaying)
            this.api?.play();
    };
    _teardownDrag() {
        window.removeEventListener("pointermove", this._onMove);
        window.removeEventListener("pointerup", this._onUp);
    }
    _onDown(e) {
        if (!this.api)
            return;
        e.preventDefault();
        this._dragging = true;
        this._wasPlaying = this.api.isPlaying();
        this.api.pause();
        this._seek(this._posFromEvent(e));
        window.addEventListener("pointermove", this._onMove);
        window.addEventListener("pointerup", this._onUp);
    }
    render() {
        const pct = this._pct() * 100;
        return T `<div
      class="km-player__progress${this._dragging ? " is-dragging" : ""}"
      @pointerdown=${(e) => this._onDown(e)}
    >
      <div class="km-player__track">
        <div class="km-player__fill" style=${`width:${pct}%`}></div>
        <div class="km-player__knob" style=${`left:${pct}%`}></div>
      </div>
    </div>`;
    }
}
if (!customElements.get("km-player-progress")) {
    customElements.define("km-player-progress", KmPlayerProgress);
}

/**
 * Inline-SVG icon set, ported from the demo studio's icon sheet. Each entry is
 * the inner markup of an 18×18 viewBox; {@link icon} wraps it in an `<svg>`.
 * No icon dependency — controls render `${icon("play")}` directly.
 */
const PATHS = {
    play: b `<path d="M6 4.5l9 5.5-9 5.5z" fill="currentColor" stroke="none" />`,
    pause: b `<g fill="currentColor" stroke="none">
      <rect x="5" y="4" width="3.2" height="12" rx="1" />
      <rect x="11.8" y="4" width="3.2" height="12" rx="1" />
    </g>`,
    prev: b `<g fill="currentColor" stroke="none">
      <path d="M14 5v10l-7-5z" />
      <rect x="4.5" y="5" width="2.2" height="10" rx="1" />
    </g>`,
    next: b `<g fill="currentColor" stroke="none">
      <path d="M6 5v10l7-5z" />
      <rect x="13.3" y="5" width="2.2" height="10" rx="1" />
    </g>`,
    volume: b `<g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 8v4h2.5L11 15.5v-11L6.5 8z" fill="currentColor" stroke="none" />
      <path d="M13.2 7.2a3.6 3.6 0 010 5.6M15 5.4a6 6 0 010 9.2" />
    </g>`,
    mute: b `<g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 8v4h2.5L11 15.5v-11L6.5 8z" fill="currentColor" stroke="none" />
      <path d="M13.5 8l3 4M16.5 8l-3 4" />
    </g>`,
    loop: b `<g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
      <path d="M5 7h7a3 3 0 013 3M15 13H8a3 3 0 01-3-3" />
      <path d="M13 5l2 2-2 2M7 15l-2-2 2-2" />
    </g>`,
    fullscreen: b `<path d="M4 7V4h3M16 7V4h-3M4 13v3h3M16 13v3h-3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />`,
    fullscreenExit: b `<path d="M7 4v3H4M13 4v3h3M7 16v-3H4M13 16v-3h3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />`,
};
/** Render a named icon as an `<svg>` of the given pixel size. */
function icon(name, size = 18) {
    return b `<svg
    width=${size}
    height=${size}
    viewBox="0 0 18 18"
    aria-hidden="true"
    style="display:block;flex:0 0 auto"
  >${PATHS[name] ?? null}</svg>`;
}

/** A play/pause toggle button reflecting and driving playback state. */
class KmPlayerPlayToggleButton extends KmControl {
    bind(api) {
        this.watch(api.state.playing);
    }
    render() {
        const playing = this.api?.state.playing.get() ?? false;
        const label = playing ? "Pause" : "Play";
        return T `<button
      type="button"
      class="km-player__btn"
      aria-label=${label}
      title=${label}
      @click=${() => this.api?.toggle()}
    >${icon(playing ? "pause" : "play")}</button>`;
    }
}
if (!customElements.get("km-player-play-toggle-button")) {
    customElements.define("km-player-play-toggle-button", KmPlayerPlayToggleButton);
}

/**
 * Mute toggle + volume slider. With the `collapsed` attribute the slider is
 * hidden until the control is hovered/focused (styled by the stylesheet).
 */
class KmPlayerSoundControl extends KmControl {
    static properties = {
        collapsed: { type: Boolean, reflect: true },
    };
    bind(api) {
        this.watch(api.state.volume);
        this.watch(api.state.muted);
    }
    _onInput(e) {
        const v = Number(e.target.value);
        this.api?.setVolume(v);
        this.api?.setMuted(v === 0);
    }
    render() {
        const muted = this.api?.state.muted.get() ?? false;
        const volume = this.api?.state.volume.get() ?? 1;
        const off = muted || volume === 0;
        const label = off ? "Unmute" : "Mute";
        return T `<div class="km-player__sound">
      <button
        type="button"
        class="km-player__btn"
        aria-label=${label}
        title=${label}
        @click=${() => this.api?.toggleMute()}
      >${icon(off ? "mute" : "volume")}</button>
      <input
        class="km-player__volume"
        type="range"
        min="0"
        max="1"
        step="0.01"
        aria-label="Volume"
        .value=${String(off ? 0 : volume)}
        @input=${(e) => this._onInput(e)}
      />
    </div>`;
    }
}
if (!customElements.get("km-player-sound-control")) {
    customElements.define("km-player-sound-control", KmPlayerSoundControl);
}

const fmt = (seconds) => {
    const t = Math.max(0, seconds);
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
};
/** Current time / total duration readout (`m:ss / m:ss`). */
class KmPlayerTime extends KmControl {
    bind(api) {
        this.watch(api.state.frame);
        this.watch(api.state.duration);
    }
    render() {
        const fps = this.api?.fps ?? 0;
        const frame = this.api?.state.frame.get() ?? 0;
        const total = this.api?.state.duration.get() ?? 0;
        const cur = fps > 0 ? frame / fps : 0;
        const dur = fps > 0 ? total / fps : 0;
        return T `<span class="km-player__time"
      ><span class="km-player__time-cur">${fmt(cur)}</span
      ><span class="km-player__time-sep">/</span
      ><span class="km-player__time-dur">${fmt(dur)}</span></span
    >`;
    }
}
if (!customElements.get("km-player-time")) {
    customElements.define("km-player-time", KmPlayerTime);
}

/** Toggles loop playback. Reflects an `on` attribute when looping. */
class KmPlayerLoopButton extends KmControl {
    static properties = { on: { type: Boolean, reflect: true } };
    bind(api) {
        this.watch(api.state.loop);
    }
    willUpdate(_changed) {
        this.on = this.api?.state.loop.get() ?? false;
    }
    render() {
        return T `<button
      type="button"
      class="km-player__btn"
      aria-label="Loop"
      title="Loop"
      aria-pressed=${this.api?.state.loop.get() ? "true" : "false"}
      @click=${() => this.api?.toggleLoop()}
    >${icon("loop")}</button>`;
    }
}
if (!customElements.get("km-player-loop-button")) {
    customElements.define("km-player-loop-button", KmPlayerLoopButton);
}

/** Toggles the player in and out of fullscreen. */
class KmPlayerFullscreenButton extends KmControl {
    bind(api) {
        this.watch(api.state.fullscreen);
    }
    render() {
        const fs = this.api?.state.fullscreen.get() ?? false;
        const label = fs ? "Exit fullscreen" : "Fullscreen";
        return T `<button
      type="button"
      class="km-player__btn"
      aria-label=${label}
      title=${label}
      @click=${() => this.api?.toggleFullscreen()}
    >${icon(fs ? "fullscreenExit" : "fullscreen")}</button>`;
    }
}
if (!customElements.get("km-player-fullscreen-button")) {
    customElements.define("km-player-fullscreen-button", KmPlayerFullscreenButton);
}

// Importing the control modules ensures their custom elements are defined
// before the default bar instantiates them.
/**
 * Build the default control bar used when `<km-player controls>` has no
 * user-supplied `<km-player-controls>`. It is composed from the same public
 * sub-components, so it inherits the player context and the opt-in styling.
 * Tagged `data-km-default` so the player can swap it out if the user later
 * provides their own controls.
 */
function createDefaultControls() {
    const controls = document.createElement("km-player-controls");
    controls.setAttribute("data-km-default", "");
    const progressRow = document.createElement("km-player-controls-row");
    progressRow.appendChild(document.createElement("km-player-progress"));
    const row = document.createElement("km-player-controls-row");
    row.appendChild(document.createElement("km-player-play-toggle-button"));
    const sound = document.createElement("km-player-sound-control");
    sound.setAttribute("collapsed", "");
    row.appendChild(sound);
    row.appendChild(document.createElement("km-player-time"));
    const space = document.createElement("km-player-space");
    space.setAttribute("grow", "");
    row.appendChild(space);
    row.appendChild(document.createElement("km-player-loop-button"));
    row.appendChild(document.createElement("km-player-fullscreen-button"));
    controls.appendChild(progressRow);
    controls.appendChild(row);
    return controls;
}

/**
 * Minimal reactive value, shape-compatible with core's `ReadonlySignal`.
 * The player owns its own stable signals (frame, playing, fullscreen, scale,
 * …) so descendant components can subscribe once and keep working even as the
 * underlying `Composition` is swapped in or out.
 */
function createSignal(initial) {
    let value = initial;
    const listeners = new Set();
    return {
        get: () => value,
        set(next) {
            if (Object.is(next, value))
                return;
            value = next;
            for (const fn of listeners)
                fn(value);
        },
        subscribe(listener) {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
    };
}

const TIMEUPDATE_INTERVAL_MS = 250;
const now = () => (typeof performance?.now === "function" ? performance.now() : Date.now());
/**
 * Duck-typed `Composition` check — avoids a runtime dependency on `core`
 * (it stays a type-only import). A Composition is a `Konva.Stage`
 * (`setContainer`) that also exposes the engine's `refresh()`.
 */
function isComposition(v) {
    return (typeof v === "object" &&
        v !== null &&
        typeof v.setContainer === "function" &&
        typeof v.refresh === "function");
}
/**
 * Resolve a remote module's default export to a live {@link Composition},
 * unwrapping factories (sync/async) and `{ default }` nesting along the way.
 */
async function resolveComposition(input) {
    let value = input;
    for (let i = 0; i < 5; i++) {
        value = await value;
        if (isComposition(value))
            return value;
        if (typeof value === "function") {
            value = value();
            continue;
        }
        if (typeof value === "object" && value !== null && "default" in value) {
            value = value.default;
            continue;
        }
        break;
    }
    throw new Error("[konva-motion] remote src did not resolve to a Composition — expected a default export of a Composition or a factory returning one");
}
/**
 * `<km-player>` — the host element. Wraps a {@link Composition} and plays it
 * like an HTML5 `<video>`: letterbox-scales the stage to its box, supports
 * fullscreen and keyboard control, auto-renders a default control bar, and
 * exposes a Remotion-style imperative + event API.
 *
 * It is a plain custom element (not a `LitElement`) so it never re-renders over
 * its user-authored children (overlay / controls). Chrome is injected
 * imperatively; descendant controls read state through {@link PlayerApi}.
 *
 * `composition` is a property (an object), e.g. `el.composition = comp`.
 */
class KmPlayer extends HTMLElement {
    static get observedAttributes() {
        return ["loop", "controls", "muted", "volume", "playbackrate", "src"];
    }
    // --- stable, player-owned reactive state -----------------------------------
    _frame = createSignal(0);
    _playing = createSignal(false);
    _duration = createSignal(1);
    _loop = createSignal(false);
    _rate = createSignal(1);
    _volume = createSignal(1);
    _muted = createSignal(false);
    _fullscreen = createSignal(false);
    _scale = createSignal(1);
    state = {
        frame: this._frame,
        playing: this._playing,
        duration: this._duration,
        loop: this._loop,
        rate: this._rate,
        volume: this._volume,
        muted: this._muted,
        fullscreen: this._fullscreen,
        scale: this._scale,
    };
    _comp = null;
    _unsubs = [];
    // Monotonic token guarding async `src` loads: a stale import resolving late
    // must not clobber a composition assigned by a newer `src` (or imperatively).
    _loadSeq = 0;
    _prevPlaying = false;
    _lastTimeupdate = 0;
    _stage = null;
    _scaleEl = null;
    _canvasEl = null;
    _resizeObserver = null;
    _mutationObserver = null;
    _provider = null;
    // --- public reactive accessors (PlayerApi) ---------------------------------
    get composition() {
        return this._comp;
    }
    set composition(c) {
        // An explicit assignment wins over any in-flight `src` load — invalidate it.
        this._loadSeq++;
        if (c === this._comp)
            return;
        // Halt the outgoing composition so it stops ticking + playing audio in the
        // background — it's a long-lived instance the consumer may reuse, so we
        // reset it to a clean stopped state (frame 0) rather than leave it running.
        this._comp?.stop();
        this._unbind();
        this._comp = c ?? null;
        if (this.isConnected && this._comp)
            this._mount();
    }
    get fps() {
        return this._comp?.fps ?? 0;
    }
    // --- convenience attribute-backed properties -------------------------------
    get loop() {
        return this.hasAttribute("loop");
    }
    set loop(v) {
        this.toggleAttribute("loop", v);
    }
    get controls() {
        return this.hasAttribute("controls");
    }
    set controls(v) {
        this.toggleAttribute("controls", v);
    }
    get autoPlay() {
        return this.hasAttribute("autoplay");
    }
    set autoPlay(v) {
        this.toggleAttribute("autoplay", v);
    }
    get clickToPlay() {
        return !this.hasAttribute("no-click-to-play");
    }
    get spaceKey() {
        return !this.hasAttribute("no-space-key");
    }
    get keyboard() {
        return !this.hasAttribute("no-keyboard");
    }
    get doubleClickFullscreen() {
        return this.hasAttribute("double-click-fullscreen");
    }
    get initialFrame() {
        const a = this.getAttribute("initialframe");
        return a == null ? 0 : Number(a);
    }
    get src() {
        return this.getAttribute("src");
    }
    set src(v) {
        if (v == null)
            this.removeAttribute("src");
        else
            this.setAttribute("src", v);
    }
    // --- lifecycle -------------------------------------------------------------
    connectedCallback() {
        if (!this.hasAttribute("tabindex"))
            this.setAttribute("tabindex", "0");
        this._ensureChrome();
        this._provider ??= new i$2(this, {
            context: playerContext,
            initialValue: this,
        });
        this._resizeObserver ??= new ResizeObserver(() => this._layout());
        this._resizeObserver.observe(this);
        this._mutationObserver ??= new MutationObserver(() => this._reconcileControls());
        this._mutationObserver.observe(this, { childList: true });
        document.addEventListener("fullscreenchange", this._onFullscreenChange);
        this.addEventListener("keydown", this._onKeyDown);
        if (this._comp)
            this._mount();
        // A composition assigned imperatively before connect wins; otherwise honor
        // a declarative `src`.
        else if (this.src)
            this._loadFromSrc(this.src);
        this._reconcileControls();
    }
    disconnectedCallback() {
        this._unbind();
        this._resizeObserver?.disconnect();
        this._mutationObserver?.disconnect();
        document.removeEventListener("fullscreenchange", this._onFullscreenChange);
        this.removeEventListener("keydown", this._onKeyDown);
        // Intentionally NOT destroying the composition — the consumer owns it.
    }
    attributeChangedCallback(name, _old, value) {
        // `src` is handled before the early-return below: it loads a composition
        // rather than configuring an existing one, so it must run even when none is
        // mounted yet.
        if (name === "src") {
            if (this.isConnected && value)
                this._loadFromSrc(value);
            return;
        }
        const comp = this._comp;
        if (!comp)
            return;
        switch (name) {
            case "loop":
                comp.setLoop(this.loop);
                break;
            case "muted":
                comp.mixer.setMuted(this.hasAttribute("muted"));
                break;
            case "volume":
                if (this.hasAttribute("volume"))
                    comp.mixer.setVolume(Number(this.getAttribute("volume")));
                break;
            case "playbackrate":
                if (this.hasAttribute("playbackrate"))
                    comp.setPlaybackRate(Number(this.getAttribute("playbackrate")));
                break;
            case "controls":
                this._reconcileControls();
                break;
        }
    }
    // --- chrome / mounting -----------------------------------------------------
    _ensureChrome() {
        if (this._stage)
            return;
        // Essential structural styles are applied inline so the player works with
        // zero CSS imported (headless). The opt-in stylesheet only adds cosmetics
        // (control bar, colors, overlay). The host needs a positioning context for
        // the absolutely-positioned stage; only set it if the page hasn't.
        if (getComputedStyle(this).position === "static")
            this.style.position = "relative";
        const stage = document.createElement("div");
        stage.className = "km-player__stage";
        stage.style.cssText = "position:absolute;inset:0;overflow:hidden";
        const scale = document.createElement("div");
        scale.className = "km-player__scale";
        scale.style.cssText = "position:absolute;top:0;left:0;transform-origin:top left";
        const canvas = document.createElement("div");
        canvas.className = "km-player__canvas";
        canvas.style.cssText = "width:100%;height:100%";
        scale.appendChild(canvas);
        stage.appendChild(scale);
        this.insertBefore(stage, this.firstChild);
        this._stage = stage;
        this._scaleEl = scale;
        this._canvasEl = canvas;
        stage.addEventListener("click", this._onStageClick);
        stage.addEventListener("dblclick", this._onStageDblClick);
    }
    _mount() {
        const comp = this._comp;
        if (!comp)
            return;
        this._ensureChrome();
        if (!this._canvasEl)
            return;
        this._canvasEl.replaceChildren();
        comp.setContainer(this._canvasEl);
        // apply element config onto the composition
        if (this.hasAttribute("loop"))
            comp.setLoop(true);
        if (this.hasAttribute("muted"))
            comp.mixer.setMuted(true);
        if (this.hasAttribute("volume"))
            comp.mixer.setVolume(Number(this.getAttribute("volume")));
        if (this.hasAttribute("playbackrate"))
            comp.setPlaybackRate(Number(this.getAttribute("playbackrate")));
        // seed stable signals from the live composition
        this._frame.set(comp.frame.get());
        this._playing.set(comp.isPlaying.get());
        this._duration.set(comp.durationInFrames.get());
        this._loop.set(comp.loop.get());
        this._rate.set(comp.playbackRate.get());
        this._volume.set(comp.mixer.volume.get());
        this._muted.set(comp.mixer.muted.get());
        this._prevPlaying = comp.isPlaying.get();
        this._bind(comp);
        // Load at the start (or an explicit `initialframe`) — a reused composition
        // instance may carry a playhead from a previous mount.
        comp.setFrame(this.initialFrame);
        comp.refresh();
        this._layout();
        if (this.autoPlay) {
            try {
                this.play();
            }
            catch (error) {
                this._emit("error", { error });
            }
        }
    }
    _bind(comp) {
        this._unsubs.push(comp.frame.subscribe((frame) => {
            this._frame.set(frame);
            this._emit("frameupdate", { frame });
            const t = now();
            const last = comp.durationInFrames.get() - 1;
            if (t - this._lastTimeupdate >= TIMEUPDATE_INTERVAL_MS || frame >= last || frame <= 0) {
                this._lastTimeupdate = t;
                const fps = comp.fps;
                const total = comp.durationInFrames.get();
                this._emit("timeupdate", {
                    frame,
                    time: fps > 0 ? frame / fps : 0,
                    durationInFrames: total,
                    durationInSeconds: fps > 0 ? total / fps : 0,
                });
            }
        }), comp.isPlaying.subscribe((playing) => {
            this._playing.set(playing);
            const frame = comp.frame.get();
            if (playing && !this._prevPlaying) {
                this._emit("play", { frame });
            }
            else if (!playing && this._prevPlaying) {
                const last = comp.durationInFrames.get() - 1;
                const rate = comp.playbackRate.get();
                const ended = !comp.loop.get() && ((rate > 0 && frame >= last) || (rate < 0 && frame <= 0));
                this._emit(ended ? "ended" : "pause", { frame });
            }
            this._prevPlaying = playing;
        }), comp.durationInFrames.subscribe((d) => this._duration.set(d)), comp.loop.subscribe((l) => this._loop.set(l)), comp.playbackRate.subscribe((rate) => {
            this._rate.set(rate);
            this._emit("ratechange", { playbackRate: rate });
        }), comp.mixer.volume.subscribe((volume) => {
            this._volume.set(volume);
            this._emit("volumechange", { volume });
        }), comp.mixer.muted.subscribe((muted) => {
            this._muted.set(muted);
            this._emit("mutechange", { muted });
        }));
    }
    _unbind() {
        for (const u of this._unsubs)
            u();
        this._unsubs = [];
    }
    // --- remote loading --------------------------------------------------------
    /**
     * Dynamically import a remote ESM module and mount its default export. The
     * default export may be a {@link Composition}, a factory returning one (sync
     * or async), or a factory resolving to `{ default: Composition }`.
     *
     * Loads are race-guarded with {@link _loadSeq}: a stale import resolving after
     * a newer `src` — or an imperative `composition =` — is discarded.
     */
    async _loadFromSrc(rawSrc) {
        const seq = ++this._loadSeq;
        let url;
        try {
            // Resolve against the document base so consumer-relative URLs behave like
            // `<video src>` (a bare dynamic import resolves relative to this module).
            url = new URL(rawSrc, document.baseURI).href;
        }
        catch (error) {
            this._emit("error", { error });
            return;
        }
        this.toggleAttribute("loading", true);
        this._emit("loadstart", { src: url });
        try {
            const mod = (await import(/* @vite-ignore */ url));
            const comp = await resolveComposition("default" in mod ? mod.default : mod);
            if (seq !== this._loadSeq)
                return; // superseded by a newer load/assignment
            this.toggleAttribute("loading", false);
            this.composition = comp;
            this._emit("loaded", { src: url, composition: comp });
        }
        catch (error) {
            if (seq !== this._loadSeq)
                return;
            this.toggleAttribute("loading", false);
            this._emit("error", { error });
        }
    }
    // --- layout / fullscreen ---------------------------------------------------
    _layout() {
        const comp = this._comp;
        if (!comp || !this._scaleEl)
            return;
        const boxW = this.clientWidth;
        const boxH = this.clientHeight;
        const compW = comp.width() || 1;
        const compH = comp.height() || 1;
        if (boxW <= 0 || boxH <= 0)
            return;
        const scale = Math.min(boxW / compW, boxH / compH);
        const offX = (boxW - compW * scale) / 2;
        const offY = (boxH - compH * scale) / 2;
        this._scaleEl.style.width = `${compW}px`;
        this._scaleEl.style.height = `${compH}px`;
        this._scaleEl.style.transform = `translate(${offX}px, ${offY}px) scale(${scale})`;
        if (scale !== this._scale.get()) {
            this._scale.set(scale);
            this._emit("scalechange", { scale });
        }
    }
    _onFullscreenChange = () => {
        const fs = document.fullscreenElement === this;
        this._fullscreen.set(fs);
        this.toggleAttribute("fullscreen", fs);
        this._emit("fullscreenchange", { isFullscreen: fs });
        this._layout();
    };
    // --- interaction -----------------------------------------------------------
    _onStageClick = () => {
        if (this.clickToPlay)
            this.toggle();
    };
    _onStageDblClick = () => {
        if (this.doubleClickFullscreen)
            this.toggleFullscreen();
    };
    _onKeyDown = (e) => {
        if (!this.keyboard)
            return;
        const target = e.target;
        if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
            return;
        switch (e.key) {
            case " ":
                if (this.spaceKey) {
                    e.preventDefault();
                    this.toggle();
                }
                break;
            case "ArrowLeft":
                e.preventDefault();
                this.stepBy(-1);
                break;
            case "ArrowRight":
                e.preventDefault();
                this.stepBy(1);
                break;
            case "f":
            case "F":
                this.toggleFullscreen();
                break;
            case "l":
            case "L":
                this.toggleLoop();
                break;
        }
    };
    _reconcileControls() {
        if (!this.isConnected)
            return;
        const hasUserControls = Array.from(this.children).some((c) => c.tagName === "KM-PLAYER-CONTROLS" && !c.hasAttribute("data-km-default"));
        const existingDefault = this.querySelector(":scope > km-player-controls[data-km-default]");
        if (this.controls && !hasUserControls) {
            if (!existingDefault)
                this.appendChild(createDefaultControls());
        }
        else if (existingDefault) {
            existingDefault.remove();
        }
    }
    _emit(type, detail) {
        this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
    }
    // --- imperative API (PlayerApi) --------------------------------------------
    play() {
        const comp = this._comp;
        if (!comp)
            return;
        // Reverse playback from the start would immediately stop — jump to the end.
        if (comp.playbackRate.get() < 0 && comp.frame.get() <= 0) {
            comp.setFrame(comp.durationInFrames.get() - 1);
        }
        try {
            comp.play();
        }
        catch (error) {
            this._emit("error", { error });
        }
    }
    pause() {
        this._comp?.pause();
    }
    toggle() {
        if (this.isPlaying())
            this.pause();
        else
            this.play();
    }
    stop() {
        this._comp?.stop();
    }
    seekTo(frame) {
        const comp = this._comp;
        if (!comp)
            return;
        comp.setFrame(frame);
        this._emit("seeked", { frame: comp.frame.get() });
    }
    stepBy(delta) {
        const comp = this._comp;
        if (!comp)
            return;
        this.seekTo(comp.frame.get() + delta);
    }
    setProps(props) {
        this._comp?.setProps(props);
    }
    getCurrentFrame() {
        return this._comp?.frame.get() ?? 0;
    }
    isPlaying() {
        return this._comp?.isPlaying.get() ?? false;
    }
    setVolume(volume) {
        this._comp?.mixer.setVolume(volume);
    }
    getVolume() {
        return this._comp?.mixer.volume.get() ?? this._volume.get();
    }
    mute() {
        this._comp?.mixer.setMuted(true);
    }
    unmute() {
        this._comp?.mixer.setMuted(false);
    }
    setMuted(muted) {
        this._comp?.mixer.setMuted(muted);
    }
    toggleMute() {
        this._comp?.mixer.setMuted(!this.isMuted());
    }
    isMuted() {
        return this._comp?.mixer.muted.get() ?? this._muted.get();
    }
    setLoop(loop) {
        this.loop = loop;
        this._comp?.setLoop(loop);
    }
    toggleLoop() {
        this.setLoop(!this.isLooping());
    }
    isLooping() {
        return this._comp?.loop.get() ?? this._loop.get();
    }
    setPlaybackRate(rate) {
        this._comp?.setPlaybackRate(rate);
    }
    getPlaybackRate() {
        return this._comp?.playbackRate.get() ?? this._rate.get();
    }
    requestFullscreen(options) {
        return HTMLElement.prototype.requestFullscreen.call(this, options);
    }
    exitFullscreen() {
        return this.isFullscreen() ? document.exitFullscreen() : Promise.resolve();
    }
    toggleFullscreen() {
        if (this.isFullscreen())
            void this.exitFullscreen();
        else
            void this.requestFullscreen();
    }
    isFullscreen() {
        return document.fullscreenElement === this;
    }
    getScale() {
        return this._scale.get();
    }
}
if (!customElements.get("km-player")) {
    customElements.define("km-player", KmPlayer);
}

const SIZES = { small: 28, medium: 44, large: 72 };
/**
 * A large, centered play affordance (for use inside `<km-player-overlay>`).
 * `size` is `small | medium | large`. Reflects a `playing` attribute so the
 * stylesheet can fade it out during playback.
 */
class KmPlayerPlayButton extends KmControl {
    static properties = {
        size: { type: String, reflect: true },
        playing: { type: Boolean, reflect: true },
    };
    bind(api) {
        this.watch(api.state.playing);
    }
    willUpdate(_changed) {
        this.playing = this.api?.state.playing.get() ?? false;
    }
    render() {
        const playing = this.api?.state.playing.get() ?? false;
        const size = SIZES[this.size ?? "medium"] ?? SIZES.medium;
        const label = playing ? "Pause" : "Play";
        return T `<button
      type="button"
      class="km-player__overlay-play"
      aria-label=${label}
      title=${label}
      @click=${() => this.api?.toggle()}
    >${icon(playing ? "pause" : "play", size)}</button>`;
    }
}
if (!customElements.get("km-player-play-button")) {
    customElements.define("km-player-play-button", KmPlayerPlayButton);
}

const orbitUrl = "data:video/mp2t;base64,aW1wb3J0IHsgQ29tcG9zaXRpb24sIFNlcXVlbmNlIH0gZnJvbSAiQGtvbnZhLW1vdGlvbi9jb3JlIjsKaW1wb3J0IEtvbnZhIGZyb20gImtvbnZhIjsKCi8qKgogKiBBIHNlbGYtY29udGFpbmVkIGRlbW8gY29tcG9zaXRpb24gc2VydmVkIGFzIGl0cyBvd24gRVNNIG1vZHVsZS4gVGhlIGRvY3MgbG9hZAogKiBpdCBpbnRvIGA8a20tcGxheWVyIHNyYz3igKY+YCB2aWEgVml0ZSdzIGA/dXJsYCBpbXBvcnQgKHNlZSBgLi9yZWdpc3RyeS50c2ApIOKAlAogKiB0aGUgcGxheWVyIGR5bmFtaWNhbGx5IGBpbXBvcnQoKWBzIHRoaXMgZmlsZSBhdCBydW50aW1lLCBleGFjdGx5IGFzIGl0IHdvdWxkIGEKICogcmVtb3RlIGNvbXBvc2l0aW9uIGhvc3RlZCBlbHNld2hlcmUuIEl0cyBkZWZhdWx0IGV4cG9ydCBpcyBhIGBDb21wb3NpdGlvbmAuCiAqLwpjb25zdCB3aWR0aCA9IDEyODA7CmNvbnN0IGhlaWdodCA9IDcyMDsKY29uc3QgZHVyYXRpb25JbkZyYW1lcyA9IDE4MDsKCmNvbnN0IGNvbXAgPSBuZXcgQ29tcG9zaXRpb24oewogIGlkOiAib3JiaXQiLAogIGZwczogNjAsCiAgZHVyYXRpb25JbkZyYW1lcywKICBsb29wOiB0cnVlLAogIHdpZHRoLAogIGhlaWdodCwKfSk7Cgpjb25zdCBtYWluID0gbmV3IFNlcXVlbmNlKHsgZnJvbTogMCwgZHVyYXRpb25JbkZyYW1lcyB9KTsKbWFpbi5hZGQobmV3IEtvbnZhLlJlY3QoeyB4OiAwLCB5OiAwLCB3aWR0aCwgaGVpZ2h0LCBmaWxsOiAiIzBkMTExNyIgfSkpOwoKY29uc3QgY3ggPSB3aWR0aCAvIDI7CmNvbnN0IGN5ID0gaGVpZ2h0IC8gMjsKCi8vIFB1bHNpbmcgY29yZS4KY29uc3QgY29yZSA9IG5ldyBLb252YS5DaXJjbGUoewogIHg6IGN4LAogIHk6IGN5LAogIHJhZGl1czogMjYsCiAgZmlsbDogIiNmZmQxNjYiLAogIHNoYWRvd0NvbG9yOiAiI2ZmZDE2NiIsCiAgc2hhZG93Qmx1cjogNDAsCiAgc2hhZG93T3BhY2l0eTogMC44LAp9KTsKbWFpbi5hZGQoY29yZSk7CgovLyBPcmJpdGluZyBzYXRlbGxpdGVzOiByYWRpdXMsIGNvbG9yLCB0dXJucy1wZXItbG9vcCwgc2l6ZS4KY29uc3Qgc2F0ZWxsaXRlcyA9IFsKICB7IHI6IDExMCwgY29sb3I6ICIjNGNjOWYwIiwgdHVybnM6IDEsIHNpemU6IDEyIH0sCiAgeyByOiAxODAsIGNvbG9yOiAiI2I1MTc5ZSIsIHR1cm5zOiAtMSwgc2l6ZTogMTYgfSwKICB7IHI6IDI1MCwgY29sb3I6ICIjODBmZmRiIiwgdHVybnM6IDIsIHNpemU6IDkgfSwKXS5tYXAoKGNmZykgPT4gewogIC8vIEEgZmFpbnQgb3JiaXQgcmluZyBzbyB0aGUgcGF0aCByZWFkcyBldmVuIG9uIHRoZSBmaXJzdCBmcmFtZS4KICBtYWluLmFkZChuZXcgS29udmEuQ2lyY2xlKHsgeDogY3gsIHk6IGN5LCByYWRpdXM6IGNmZy5yLCBzdHJva2U6ICIjMWYyNjMwIiwgc3Ryb2tlV2lkdGg6IDIgfSkpOwogIGNvbnN0IGRvdCA9IG5ldyBLb252YS5DaXJjbGUoewogICAgeDogY3ggKyBjZmcuciwKICAgIHk6IGN5LAogICAgcmFkaXVzOiBjZmcuc2l6ZSwKICAgIGZpbGw6IGNmZy5jb2xvciwKICAgIHNoYWRvd0NvbG9yOiBjZmcuY29sb3IsCiAgICBzaGFkb3dCbHVyOiAyNCwKICAgIHNoYWRvd09wYWNpdHk6IDAuOSwKICB9KTsKICBtYWluLmFkZChkb3QpOwogIHJldHVybiB7IC4uLmNmZywgZG90IH07Cn0pOwoKY29tcC5hZGQobWFpbik7Cgpjb25zdCBUQVUgPSBNYXRoLlBJICogMjsKCm1haW4ucmVnaXN0ZXIoKGZyYW1lKSA9PiB7CiAgY29uc3QgdCA9IGZyYW1lIC8gZHVyYXRpb25JbkZyYW1lczsgLy8gMC4uMSBvdmVyIG9uZSBsb29wCgogIC8vIENvcmUgYnJlYXRoZXMgdHdpY2UgcGVyIGxvb3AuCiAgY29yZS5yYWRpdXMoMjYgKyA4ICogTWF0aC5zaW4odCAqIFRBVSAqIDIpKTsKCiAgZm9yIChjb25zdCBzYXQgb2Ygc2F0ZWxsaXRlcykgewogICAgY29uc3QgYW5nbGUgPSB0ICogVEFVICogc2F0LnR1cm5zOwogICAgc2F0LmRvdC54KGN4ICsgTWF0aC5jb3MoYW5nbGUpICogc2F0LnIpOwogICAgc2F0LmRvdC55KGN5ICsgTWF0aC5zaW4oYW5nbGUpICogc2F0LnIpOwogIH0KfSk7CgpleHBvcnQgZGVmYXVsdCBjb21wOwo=";

const DEMO_URLS = {
  orbit: orbitUrl
};

function mountDemos(root = document) {
  const stages = root.querySelectorAll(".demo-slot__stage[data-km-demo]");
  for (const stage of Array.from(stages)) {
    const id = stage.getAttribute("data-km-demo");
    const url = id ? DEMO_URLS[id] : void 0;
    if (!url || stage.querySelector("km-player")) continue;
    stage.replaceChildren();
    const player = document.createElement("km-player");
    player.setAttribute("controls", "");
    player.setAttribute("loop", "");
    player.setAttribute("src", url);
    stage.appendChild(player);
  }
}

export { mountDemos };
