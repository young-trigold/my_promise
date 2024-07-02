/**
 * @link https://tc39.es/ecma262/#sec-promise-objects
 * @enum {number}
 */
var MyPromiseState = {
    PENDING: 0,
    FULFILLED: 1,
    REJECTED: -1,
};

/**
 * @link https://tc39.es/ecma262/#sec-promisecapability-records
 * @typedef MyPromiseCapability
 * @property {MyPromise} myPromise
 * @property {Function} resolve
 * @property {Function} reject 
 */

/**
 * @link https://tc39.es/ecma262/#sec-promisereaction-records
 * @typedef MyPromiseReaction
 * @property {MyPromiseCapability} capability
 * @property {'FULFILL' | 'REJECT'} type
 * @property {(...args: any[]) => void} [handler]
 */

/**
 * @link https://tc39.es/ecma262/#sec-newpromisereactionjob
 * @param {MyPromiseReaction} reaction 
 * @param {any} arg 
 */
function newMyPromiseReactionJob(reaction, arg) {
    return function () {
        var myPromiseCapability = reaction.capability;
        if (myPromiseCapability === undefined) {
            return;
        }
        var type = reaction.type;
        var handler = reaction.handler;
        if (handler === undefined) {
            if (type === 'FULFILL') {
                myPromiseCapability.resolve.call(undefined, arg);
            } else {
                myPromiseCapability.reject.call(undefined, arg);
            }
        } else {
            try {
                var handleResult = handler(arg);
                myPromiseCapability.resolve.call(undefined, handleResult);
            } catch (error) {
                myPromiseCapability.reject.call(undefined, handleResult);
            }
        }
    };
}

/**
 * @link https://tc39.es/ecma262/#sec-triggerpromisereactions
 * @param {MyPromiseReaction[]} reactions 
 * @param {any} args 
 */
function triggerMyPromiseReactions(reactions, arg) {
    reactions.forEach(function (reaction) {
        const job = newMyPromiseReactionJob(reaction, arg);
        window.queueMicrotask(job);
    });
};

/**
 * @todo
 * @link https://tc39.es/ecma262/#sec-host-promise-rejection-tracker
 * @param {MyPromise} myPromise 
 * @param {'reject' | 'handle'} operation 
 */
function hostMyPromiseRejectionTracker(myPromise, operation) {

};

/**
 * @link https://tc39.es/ecma262/#sec-rejectpromise
 * @param {MyPromise} myPromise 
 * @param {any} reason 
 */
function rejectMyPromise(myPromise, reason) {
    var reactions = myPromise._rejectReactions;
    myPromise._result = reason;
    myPromise._rejectReactions = undefined;
    myPromise._fulfillReactions = undefined;
    myPromise._state = MyPromiseState.REJECTED;
    if (myPromise._isHandled === false) {
        hostPromiseRejectionTracker(myPromise, 'reject');
    }
    triggerMyPromiseReactions(reactions, reason);
};

/**
 * @link https://tc39.es/ecma262/#sec-fulfillpromise
 * @param {MyPromise} myPromise 
 * @param {any} value 
 */
function fulfillMyPromise(myPromise, value) {
    var reactions = myPromise._fulfillReactions;
    myPromise._result = value;
    myPromise._fulfillReactions = undefined;
    myPromise._rejectReactions = undefined;
    myPromise._state = MyPromiseState.FULFILLED;
    triggerMyPromiseReactions(reactions, value);
}

/**
 * @link https://tc39.es/ecma262/#sec-newpromiseresolvethenablejob
 * @param {MyPromise} myPromiseToResolve 
 * @param {object} thenable 
 * @param {Function} then 
 */
function newMyPromiseResolveThenableJob(myPromiseToResolve, thenable, then) {
    return function () {
        var resolvingFunctions = createResolvingFunctions(myPromiseToResolve);
        try {
            var thenCallResult = then.call(thenable, resolvingFunctions.resolve, resolvingFunctions.reject);
            return thenCallResult;
        } catch (error) {
            return resolvingFunctions.reject.call(undefined, error);
        }
    };
}

/**
 * @link https://tc39.es/ecma262/#sec-createresolvingfunctions
 * @type {MyPromise} myPromise
 */
function createResolvingFunctions(myPromise) {
    /**
     * @link https://tc39.es/ecma262/#sec-promise-resolve-functions
     */
    var resolve = function (resolution) {
        var myPromise = resolve.myPromise;
        if (resolve.alreadyResolved.value === true) return;
        resolve.alreadyResolved.value = true;
        if (resolution === myPromise) {
            rejectMyPromise(myPromise, new TypeError('can not resolve myPromise it self'));
            return;
        }
        if (!(resolution instanceof Object)) {
            fulfillMyPromise(myPromise, resolution);
            return;
        }
        var then;
        try {
            then = resolution.then;
            if (!(then instanceof Function)) {
                fulfillMyPromise(myPromise, resolution);
                return;
            }
        } catch (error) {
            rejectMyPromise(myPromise, error);
            return;
        }
        var job = new newMyPromiseResolveThenableJob(myPromise, resolution, then);
        window.queueMicrotask(job);
    };
    resolve.myPromise = myPromise;
    resolve.alreadyResolved = { value: false };

    /**
     * @link https://tc39.es/ecma262/#sec-promise-reject-functions
     */
    var reject = function (resolution) {
        if (reject.alreadyResolved.value === true) return;
        reject.alreadyResolved.value = true;
        rejectMyPromise(myPromise, resolution);
        return;
    };
    reject.myPromise = myPromise;
    reject.alreadyResolved = { value: false };
    return { resolve: resolve, reject: reject };
};

/**
 * @link https://tc39.es/ecma262/#sec-promise-executor
 * @param {*} executor 
 */
function MyPromise(executor) {
    var MyPromiseName = MyPromise.name;
    // 如果 MyPromise 以非构造函数的方式调用则抛出 TypeError
    if (!(this instanceof MyPromise)) throw new TypeError(MyPromiseName + '不能以普通函数的方式调用！');
    if (!(executor instanceof Function)) throw new TypeError('传给' + MyPromiseName + '的参数不是一个函数类型！');

    this._state = MyPromiseState.PENDING;
    this._fulfillReactions = [];
    this._rejectReactions = [];
    this._isHandled = false;
    this._result = undefined;
    var myPromise = this;
    var resolvingFunctions = createResolvingFunctions(myPromise);
    try {
        executor(resolvingFunctions.resolve, resolvingFunctions.reject);
    } catch (error) {
        resolvingFunctions.reject.call();
    }

    return myPromise;
}

/**
 * @link https://tc39.es/ecma262/#sec-promise-resolve
 * @param {Function} C 
 * @param {any} x 
 */
function myPromiseResolve(C, x) {
    if(isMyPromise(x)) {
        var xConstructor = x.constructor;
        if(xConstructor === C) return x;
    }
    var  myPromiseCapability = newMyPromiseCapability(C);
    myPromiseCapability.resolve.call(undefined, x);
    return myPromiseCapability.myPromise;
}

/**
 * @link https://tc39.es/ecma262/#sec-promise.resolve
 * @param {any} x 
 */
MyPromise.resolve = function (x) {
    var C = this;
    if(!(C instanceof Object)) {
        throw new TypeError(MyPromise.name + '.resolve的 this 不是' + MyPromise.name)
    }
    return myPromiseResolve(C, x);
};

/**
 * @link https://tc39.es/ecma262/#sec-promise.reject
 * @param {any} r 
 */
MyPromise.reject = function (r) {
    var C = this;
    var myPromiseCapability = newMyPromiseCapability(C);
    myPromiseCapability.reject.call(undefined, r);
    return myPromiseCapability.myPromise;
};

/**
 * @link https://tc39.es/ecma262/#sec-ispromise
 * @param {any} x 
 */
function isMyPromise(x) {
    if (!(x instanceof Object)) return false;
    if (!(x.then instanceof Function)) return false;
    return true;
}

/**
 * @link https://tc39.es/ecma262/#sec-isconstructor
 * @param {any} arg 
 */
function isConstructor(arg) {
    if ((arg instanceof Function)) return true;
    return false;
}

/**
 * @link https://tc39.es/ecma262/#sec-newpromisecapability
 * @param {Function} C 
 * @returns {{myPromise: MyPromise, resolve: (value: any) => void, reject: (reason: any) => void}}
 */
function newMyPromiseCapability(C) {
    if (!isConstructor(C)) throw new TypeError('newMyPromiseCapability: 不是一个构造函数！');
    var resolvingFunctions = { resolve: undefined, reject: undefined };
    var executor = function (resolve, reject) {
        if (resolvingFunctions.resolve || resolvingFunctions.reject) {
            throw new TypeError('resolvingFunctions 的属性已被覆盖!');
        }
        resolvingFunctions.resolve = resolve;
        resolvingFunctions.reject = reject;
    };
    var myPromise = new C(executor);
    if (!((resolvingFunctions.resolve instanceof Function) && (resolvingFunctions.reject instanceof Function))) {
        throw new TypeError('resolvingFunctions 的属性不是函数！');
    }
    return { myPromise: myPromise, resolve: resolvingFunctions.resolve, reject: resolvingFunctions.reject };
}

/**
 * @link https://tc39.es/ecma262/#sec-performpromisethen
 * @param {MyPromise} myPromise 
 * @param {any} onFulfilled 
 * @param {any} onRejected 
 * @param {MyPromiseCapability} [resultCapability] 
 */
function performMyPromiseThen(myPromise, onFulfilled, onRejected, resultCapability) {
    var onFulfilledJobCallback = onFulfilled instanceof Function ? onFulfilled : undefined;
    var onRejectedJobCallback = onRejected instanceof Function ? onRejected : undefined;
    /**
     * @type {MyPromiseReaction}
     */
    var fulfillReaction = {
        capability: resultCapability,
        type: 'FULFILL',
        handler: onFulfilledJobCallback,
    };
    /**
     * @type {MyPromiseReaction}
     */
    var rejectReaction = {
        capability: resultCapability,
        type: 'REJECT',
        handler: onRejectedJobCallback,
    };
    if(myPromise._state === MyPromiseState.PENDING) {
        myPromise._fulfillReactions.push(fulfillReaction);
        myPromise._rejectReactions.push(rejectReaction);
    } else if(myPromise._state === MyPromiseState.FULFILLED) {
        var value = myPromise._result;
        var fulfillJob = newMyPromiseReactionJob(fulfillReaction, value);
        window.queueMicrotask(fulfillJob);
    } else {
        var reason = myPromise._result;;
        if(myPromise._isHandled === false) {
            hostMyPromiseRejectionTracker(myPromise, 'handle');
        }
        var rejectJob = newMyPromiseReactionJob(rejectReaction, reason);
        window.queueMicrotask(rejectJob);
    }
    myPromise._isHandled = true;
    if(resultCapability === undefined) return;
    return resultCapability.myPromise;
}

/**
 * @link https://tc39.es/ecma262/#sec-promise.prototype.then
 * @param {any} onFulfilled 
 * @param {any} onRejected 
 */
MyPromise.prototype.then = function (onFulfilled, onRejected) {
    var myPromise = this;
    if (!isMyPromise(myPromise)) {
        throw new TypeError('then 方法的调用者必须符合 myPromise 接口');
    }
    var resultCapability = newMyPromiseCapability(MyPromise);
    return performMyPromiseThen(myPromise, onFulfilled, onRejected, resultCapability);
};

window.MyPromise = MyPromise;
/**
 * @link https://tc39.es/ecma262/#sec-promise-objects
 * @enum {number}
 */
var MyPromiseState = {
    PENDING: 0,
    FULFILLED: 1,
    REJECTED: -1,
};

/**
 * @link https://tc39.es/ecma262/#sec-promisecapability-records
 * @typedef MyPromiseCapability
 * @property {MyPromise} myPromise
 * @property {Function} resolve
 * @property {Function} reject 
 */

/**
 * @link https://tc39.es/ecma262/#sec-promisereaction-records
 * @typedef MyPromiseReaction
 * @property {MyPromiseCapability} capability
 * @property {'FULFILL' | 'REJECT'} type
 * @property {(...args: any[]) => void} [handler]
 */

/**
 * @link https://tc39.es/ecma262/#sec-newpromisereactionjob
 * @param {MyPromiseReaction} reaction 
 * @param {any} arg 
 */
function newMyPromiseReactionJob(reaction, arg) {
    return function () {
        var myPromiseCapability = reaction.capability;
        if (myPromiseCapability === undefined) {
            return;
        }
        var type = reaction.type;
        var handler = reaction.handler;
        if (handler === undefined) {
            if (type === 'FULFILL') {
                myPromiseCapability.resolve.call(undefined, arg);
            } else {
                myPromiseCapability.reject.call(undefined, arg);
            }
        } else {
            try {
                var handleResult = handler(arg);
                myPromiseCapability.resolve.call(undefined, handleResult);
            } catch (error) {
                myPromiseCapability.reject.call(undefined, handleResult);
            }
        }
    };
}

/**
 * @link https://tc39.es/ecma262/#sec-triggerpromisereactions
 * @param {MyPromiseReaction[]} reactions 
 * @param {any} args 
 */
function triggerMyPromiseReactions(reactions, arg) {
    reactions.forEach(function (reaction) {
        const job = newMyPromiseReactionJob(reaction, arg);
        window.queueMicrotask(job);
    });
};

/**
 * @todo
 * @link https://tc39.es/ecma262/#sec-host-promise-rejection-tracker
 * @param {MyPromise} myPromise 
 * @param {'reject' | 'handle'} operation 
 */
function hostMyPromiseRejectionTracker(myPromise, operation) {

};

/**
 * @link https://tc39.es/ecma262/#sec-rejectpromise
 * @param {MyPromise} myPromise 
 * @param {any} reason 
 */
function rejectMyPromise(myPromise, reason) {
    var reactions = myPromise._rejectReactions;
    myPromise._result = reason;
    myPromise._rejectReactions = undefined;
    myPromise._fulfillReactions = undefined;
    myPromise._state = MyPromiseState.REJECTED;
    if (myPromise._isHandled === false) {
        hostPromiseRejectionTracker(myPromise, 'reject');
    }
    triggerMyPromiseReactions(reactions, reason);
};

/**
 * @link https://tc39.es/ecma262/#sec-fulfillpromise
 * @param {MyPromise} myPromise 
 * @param {any} value 
 */
function fulfillMyPromise(myPromise, value) {
    var reactions = myPromise._fulfillReactions;
    myPromise._result = value;
    myPromise._fulfillReactions = undefined;
    myPromise._rejectReactions = undefined;
    myPromise._state = MyPromiseState.FULFILLED;
    triggerMyPromiseReactions(reactions, value);
}

/**
 * @link https://tc39.es/ecma262/#sec-newpromiseresolvethenablejob
 * @param {MyPromise} myPromiseToResolve 
 * @param {object} thenable 
 * @param {Function} then 
 */
function newMyPromiseResolveThenableJob(myPromiseToResolve, thenable, then) {
    return function () {
        var resolvingFunctions = createResolvingFunctions(myPromiseToResolve);
        try {
            var thenCallResult = then.call(thenable, resolvingFunctions.resolve, resolvingFunctions.reject);
            return thenCallResult;
        } catch (error) {
            return resolvingFunctions.reject.call(undefined, error);
        }
    };
}

/**
 * @link https://tc39.es/ecma262/#sec-createresolvingfunctions
 * @type {MyPromise} myPromise
 */
function createResolvingFunctions(myPromise) {
    /**
     * @link https://tc39.es/ecma262/#sec-promise-resolve-functions
     */
    var resolve = function (resolution) {
        var myPromise = resolve.myPromise;
        if (resolve.alreadyResolved.value === true) return;
        resolve.alreadyResolved.value = true;
        if (resolution === myPromise) {
            rejectMyPromise(myPromise, new TypeError('can not resolve myPromise it self'));
            return;
        }
        if (!(resolution instanceof Object)) {
            fulfillMyPromise(myPromise, resolution);
            return;
        }
        var then;
        try {
            then = resolution.then;
            if (!(then instanceof Function)) {
                fulfillMyPromise(myPromise, resolution);
                return;
            }
        } catch (error) {
            rejectMyPromise(myPromise, error);
            return;
        }
        var job = new newMyPromiseResolveThenableJob(myPromise, resolution, then);
        window.queueMicrotask(job);
    };
    resolve.myPromise = myPromise;
    resolve.alreadyResolved = { value: false };

    /**
     * @link https://tc39.es/ecma262/#sec-promise-reject-functions
     */
    var reject = function (resolution) {
        if (reject.alreadyResolved.value === true) return;
        reject.alreadyResolved.value = true;
        rejectMyPromise(myPromise, resolution);
        return;
    };
    reject.myPromise = myPromise;
    reject.alreadyResolved = { value: false };
    return { resolve: resolve, reject: reject };
};

/**
 * @link https://tc39.es/ecma262/#sec-promise-executor
 * @param {*} executor 
 */
function MyPromise(executor) {
    var MyPromiseName = MyPromise.name;
    // 如果 MyPromise 以非构造函数的方式调用则抛出 TypeError
    if (!(this instanceof MyPromise)) throw new TypeError(MyPromiseName + '不能以普通函数的方式调用！');
    if (!(executor instanceof Function)) throw new TypeError('传给' + MyPromiseName + '的参数不是一个函数类型！');

    this._state = MyPromiseState.PENDING;
    this._fulfillReactions = [];
    this._rejectReactions = [];
    this._isHandled = false;
    this._result = undefined;
    var myPromise = this;
    var resolvingFunctions = createResolvingFunctions(myPromise);
    try {
        executor(resolvingFunctions.resolve, resolvingFunctions.reject);
    } catch (error) {
        resolvingFunctions.reject.call();
    }

    return myPromise;
}

/**
 * @link https://tc39.es/ecma262/#sec-promise-resolve
 * @param {Function} C 
 * @param {any} x 
 */
function myPromiseResolve(C, x) {
    if(isMyPromise(x)) {
        var xConstructor = x.constructor;
        if(xConstructor === C) return x;
    }
    var  myPromiseCapability = newMyPromiseCapability(C);
    myPromiseCapability.resolve.call(undefined, x);
    return myPromiseCapability.myPromise;
}

/**
 * @link https://tc39.es/ecma262/#sec-promise.resolve
 * @param {any} x 
 */
MyPromise.resolve = function (x) {
    var C = this;
    if(!(C instanceof Object)) {
        throw new TypeError(MyPromise.name + '.resolve的 this 不是' + MyPromise.name)
    }
    return myPromiseResolve(C, x);
};

/**
 * @link https://tc39.es/ecma262/#sec-promise.reject
 * @param {any} r 
 */
MyPromise.reject = function (r) {
    var C = this;
    var myPromiseCapability = newMyPromiseCapability(C);
    myPromiseCapability.reject.call(undefined, r);
    return myPromiseCapability.myPromise;
};

/**
 * @link https://tc39.es/ecma262/#sec-ispromise
 * @param {any} x 
 */
function isMyPromise(x) {
    if (!(x instanceof Object)) return false;
    if (!(x.then instanceof Function)) return false;
    return true;
}

/**
 * @link https://tc39.es/ecma262/#sec-isconstructor
 * @param {any} arg 
 */
function isConstructor(arg) {
    if ((arg instanceof Function)) return true;
    return false;
}

/**
 * @link https://tc39.es/ecma262/#sec-newpromisecapability
 * @param {Function} C 
 * @returns {{myPromise: MyPromise, resolve: (value: any) => void, reject: (reason: any) => void}}
 */
function newMyPromiseCapability(C) {
    if (!isConstructor(C)) throw new TypeError('newMyPromiseCapability: 不是一个构造函数！');
    var resolvingFunctions = { resolve: undefined, reject: undefined };
    var executor = function (resolve, reject) {
        if (resolvingFunctions.resolve || resolvingFunctions.reject) {
            throw new TypeError('resolvingFunctions 的属性已被覆盖!');
        }
        resolvingFunctions.resolve = resolve;
        resolvingFunctions.reject = reject;
    };
    var myPromise = new C(executor);
    if (!((resolvingFunctions.resolve instanceof Function) && (resolvingFunctions.reject instanceof Function))) {
        throw new TypeError('resolvingFunctions 的属性不是函数！');
    }
    return { myPromise: myPromise, resolve: resolvingFunctions.resolve, reject: resolvingFunctions.reject };
}

/**
 * @link https://tc39.es/ecma262/#sec-performpromisethen
 * @param {MyPromise} myPromise 
 * @param {any} onFulfilled 
 * @param {any} onRejected 
 * @param {MyPromiseCapability} [resultCapability] 
 */
function performMyPromiseThen(myPromise, onFulfilled, onRejected, resultCapability) {
    var onFulfilledJobCallback = onFulfilled instanceof Function ? onFulfilled : undefined;
    var onRejectedJobCallback = onRejected instanceof Function ? onRejected : undefined;
    /**
     * @type {MyPromiseReaction}
     */
    var fulfillReaction = {
        capability: resultCapability,
        type: 'FULFILL',
        handler: onFulfilledJobCallback,
    };
    /**
     * @type {MyPromiseReaction}
     */
    var rejectReaction = {
        capability: resultCapability,
        type: 'REJECT',
        handler: onRejectedJobCallback,
    };
    if(myPromise._state === MyPromiseState.PENDING) {
        myPromise._fulfillReactions.push(fulfillReaction);
        myPromise._rejectReactions.push(rejectReaction);
    } else if(myPromise._state === MyPromiseState.FULFILLED) {
        var value = myPromise._result;
        var fulfillJob = newMyPromiseReactionJob(fulfillReaction, value);
        window.queueMicrotask(fulfillJob);
    } else {
        var reason = myPromise._result;;
        if(myPromise._isHandled === false) {
            hostMyPromiseRejectionTracker(myPromise, 'handle');
        }
        var rejectJob = newMyPromiseReactionJob(rejectReaction, reason);
        window.queueMicrotask(rejectJob);
    }
    myPromise._isHandled = true;
    if(resultCapability === undefined) return;
    return resultCapability.myPromise;
}

/**
 * @link https://tc39.es/ecma262/#sec-promise.prototype.then
 * @param {any} onFulfilled 
 * @param {any} onRejected 
 */
MyPromise.prototype.then = function (onFulfilled, onRejected) {
    var myPromise = this;
    if (!isMyPromise(myPromise)) {
        throw new TypeError('then 方法的调用者必须符合 myPromise 接口');
    }
    var resultCapability = newMyPromiseCapability(MyPromise);
    return performMyPromiseThen(myPromise, onFulfilled, onRejected, resultCapability);
};

window.MyPromise = MyPromise;
