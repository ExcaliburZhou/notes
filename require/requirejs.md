## RequireJS 源码分析 version 2.3.1

#### 这几日闲来无事, 想想自己也一直没看看require的源码, 便折腾了几下, 这一看耗损脑细胞数千, 各种跳转, 头疼不矣, 仅仅2000来行的代码却复杂得不行

### 代码结构

* 12-36: 变量声明
* 36-197: 各种工具函数声明, 如:类型判断, 迭代器, 对象深复制, 错误提示, 绑定this等
* 199-1745: newContext函数, 函数最主要的逻辑代码
* 1761-1830: 全局暴露require, 这便是整个代码的入口函数, 并为之添加一些全局方法
* 1833: 第一次调用入口函数, 执行newContext函数, 返回默认context, 存于req.contexts中
* 1836-2001: 加载script标签的代码, 绑在req上, 另有一些通用方法
* 2004-2049: 获取require引入标签, 若有data-main, 将其作为一个依赖放入cfg中
* 2058-2123: 全局暴露define函数, 主要是将后面的define获取的模块名, 依赖, 回调, 压入globalDefQueue中
* 2141: 第二次调用入口函数, 若设置了data-main, 则加载其值的路径js文件, 若未设置传入空对象

#### 如此看来, 就算我们什么事儿也不干, 引入了requirejs以后, 入口函数也会调用两次

### 调用代码
#### html

```
<script src="./bower_components/requirejs/require.js" data-main="main"></script>

```

#### main.js
```
require.config({
    //模块根路径
    baseUrl: './',
    /*
     *映射不在根路径下的
     *路径是相对于baseUrl的
     **/
    paths: {
        'name': 'name',
        'getName': 'getName'
    },
});

require(['getName', 'name'],function (getName, name) {
    getName(name)
});
```

#### getName.js
```
define([], function(){
    return function (name){
        console.log(name)
    }
})
```

#### name.js
```
define([], function(){
    return 'ExcaliburZhou'
})
```

### 运行步骤

#### 主要步骤
* 第一次运行req({})
* 获取script标签, 获取data-main的路径
* 第二次运行req(cfg), 开始载入main.js, 进入context.configure
* 运行context.require => context.makeRequire(), 进入localRequire
* 进入context.nextTick
* 进入module.init
* 进入module.enable
* 在each循环中, 进入context.enable, 再次进入module.enable
* 进入module.check()
* 进入module.fetch() => module.load() => context.load() => req.load(), 生成script, 载入main.js
* 载入后直接运行requrejs.config, require(), 又从第三步开始走一次

#### 详情

##### 1,第一次运行req
```
    //Create default context.
    req({});
```

这里config为空, 只是生成了一个默认的context, 放于contexts._中, context.configure和context.require其实并没干嘛

```
    req = requirejs = function (deps, callback, errback, optional) {

        //Find the right context, use default
        var context, config,
            contextName = defContextName;

        // Determine if have config object in the call.
        if (!isArray(deps) && typeof deps !== 'string') {
            // deps is a config object
            config = deps;
            if (isArray(callback)) {
                // Adjust args if there are dependencies
                deps = callback;
                callback = errback;
                errback = optional;
            } else {
                deps = [];
            }
        }

        if (config && config.context) {
            contextName = config.context;
        }

        context = getOwn(contexts, contextName);
        if (!context) {
            context = contexts[contextName] = req.s.newContext(contextName);
        }

        if (config) {
            context.configure(config);
        }

        return context.require(deps, callback, errback);
    };

```

#### 2,获取main路径

我们可以发现这段代码做了两件事:

    * 由data-main获取cfg.baseUrl
    * 获取data-main的值, 存入cfg.deps数组中;

后续require会将main.js当作一个模块载入
```
    //Look for a data-main script attribute, which could also adjust the baseUrl.
    if (isBrowser && !cfg.skipDataMain) {
        //Figure out baseUrl. Get it from the script tag with require.js in it.
        eachReverse(scripts(), function (script) {
            //Set the 'head' where we can append children by
            //using the script's parent.
            if (!head) {
                head = script.parentNode;
            }

            //Look for a data-main attribute to set main script for the page
            //to load. If it is there, the path to data main becomes the
            //baseUrl, if it is not already set.
            dataMain = script.getAttribute('data-main');
            if (dataMain) {
                //Preserve dataMain in case it is a path (i.e. contains '?')
                mainScript = dataMain;

                //Set final baseUrl if there is not already an explicit one,
                //but only do so if the data-main value is not a loader plugin
                //module ID.
                if (!cfg.baseUrl && mainScript.indexOf('!') === -1) {
                    //Pull off the directory of data-main for use as the
                    //baseUrl.
                    src = mainScript.split('/');
                    mainScript = src.pop();
                    subPath = src.length ? src.join('/')  + '/' : './';

                    cfg.baseUrl = subPath;
                }

                //Strip off any trailing .js since mainScript is now
                //like a module name.
                mainScript = mainScript.replace(jsSuffixRegExp, '');

                //If mainScript is still a path, fall back to dataMain
                if (req.jsExtRegExp.test(mainScript)) {
                    mainScript = dataMain;
                }

                //Put the data-main script in the files to load.
                cfg.deps = cfg.deps ? cfg.deps.concat(mainScript) : [mainScript];

                return true;
            }
        });
    }
```

#### 3,再次运行req(cfg);

这次是将刚刚设置的cfg传入, 若script标签无data-main,则还是传入空对象{},和第一步一样,由于contexts._已经存在,所以不会进行任何操作

若有data-main:

context.configure(config);

#### 4,进入localRequire

由先进入context.configure, 由于无其它信息,只有baseUrl和deps:['main'],于是直接到最后:
```
if (cfg.deps || cfg.callback) {
    context.require(cfg.deps || [], cfg.callback);
}
```

这里可以看到, require是makeRequire的返回值;
```
context.require = context.makeRequire();
```

其中relMap, options均为undefined
```
makeRequire: function (relMap, options) {
    options = options || {};

    function localRequire(deps, callback, errback) {
        var id, map, requireMod;

        if (options.enableBuildCallback && callback && isFunction(callback)) {
            callback.__requireJsBuild = true;
        }

        if (typeof deps === 'string') {
            if (isFunction(callback)) {
                //Invalid call
                return onError(makeError('requireargs', 'Invalid require call'), errback);
            }

            //If require|exports|module are requested, get the
            //value for them from the special handlers. Caveat:
            //this only works while module is being defined.
            if (relMap && hasProp(handlers, deps)) {
                return handlers[deps](registry[relMap.id]);
            }

            //Synchronous access to one module. If require.get is
            //available (as in the Node adapter), prefer that.
            if (req.get) {
                return req.get(context, deps, relMap, localRequire);
            }

            //Normalize module name, if it contains . or ..
            map = makeModuleMap(deps, relMap, false, true);
            id = map.id;

            if (!hasProp(defined, id)) {
                return onError(makeError('notloaded', 'Module name "' +
                    id +
                    '" has not been loaded yet for context: ' +
                    contextName +
                    (relMap ? '' : '. Use require([])')));
            }
            return defined[id];
        }

        //Grab defines waiting in the global queue.
        intakeDefines();

        //Mark all the dependencies as needing to be loaded.
        context.nextTick(function () {
            //Some defines could have been added since the
            //require call, collect them.
            intakeDefines();

            requireMod = getModule(makeModuleMap(null, relMap));

            //Store if map config should be applied to this require
            //call for dependencies.
            requireMod.skipMap = options.skipMap;

            requireMod.init(deps, callback, errback, {
                enabled: true
            });

            checkLoaded();
        });

        return localRequire;
    }

    mixin(localRequire, {
        isBrowser: isBrowser,

        /**
         * Converts a module name + .extension into an URL path.
         * *Requires* the use of a module name. It does not support using
         * plain URLs like nameToUrl.
         */
        toUrl: function (moduleNamePlusExt) {
            var ext,
                index = moduleNamePlusExt.lastIndexOf('.'),
                segment = moduleNamePlusExt.split('/')[0],
                isRelative = segment === '.' || segment === '..';

            //Have a file extension alias, and it is not the
            //dots from a relative path.
            if (index !== -1 && (!isRelative || index > 1)) {
                ext = moduleNamePlusExt.substring(index, moduleNamePlusExt.length);
                moduleNamePlusExt = moduleNamePlusExt.substring(0, index);
            }

            return context.nameToUrl(normalize(moduleNamePlusExt,
                relMap && relMap.id, true), ext,  true);
        },

        defined: function (id) {
            return hasProp(defined, makeModuleMap(id, relMap, false, true).id);
        },

        specified: function (id) {
            id = makeModuleMap(id, relMap, false, true).id;
            return hasProp(defined, id) || hasProp(registry, id);
        }
    });

    //Only allow undef on top level require calls
    if (!relMap) {
        localRequire.undef = function (id) {
            //Bind any waiting define() calls to this context,
            //fix for #408
            takeGlobalQueue();

            var map = makeModuleMap(id, relMap, true),
                mod = getOwn(registry, id);

            mod.undefed = true;
            removeScript(id);

            delete defined[id];
            delete urlFetched[map.url];
            delete undefEvents[id];

            //Clean queued defines too. Go backwards
            //in array so that the splices do not
            //mess up the iteration.
            eachReverse(defQueue, function(args, i) {
                if (args[0] === id) {
                    defQueue.splice(i, 1);
                }
            });
            delete context.defQueueMap[id];

            if (mod) {
                //Hold on to listeners in case the
                //module will be attempted to be reloaded
                //using a different config.
                if (mod.events.defined) {
                    undefEvents[id] = mod.events;
                }

                cleanRegistry(id);
            }
        };
    }

    return localRequire;
}

```
其中 intakeDefines();是将globalDefQueue中的值取出来,压入defQueue中,由于前者为空数组,所以啥也没干;

然后,进入context.nextTick;

#### 5,context.nextTick

```
//Mark all the dependencies as needing to be loaded.
context.nextTick(function () {
    //Some defines could have been added since the
    //require call, collect them.
    intakeDefines();

    requireMod = getModule(makeModuleMap(null, relMap));

    //Store if map config should be applied to this require
    //call for dependencies.
    requireMod.skipMap = options.skipMap;

    requireMod.init(deps, callback, errback, {
        enabled: true
    });

    checkLoaded();
});


function getModule(depMap) {
    var id = depMap.id,
        mod = getOwn(registry, id);

    if (!mod) {
        mod = registry[id] = new context.Module(depMap);
    }

    return mod;
}
```
这里makeModuleMap会为module生成一些基本属性和一个唯一标识id, 如"_@r2",

getModule则返回一个单例, 未生成的时候new一个, 有了就直接返回

context.Module是一个构造函数, 这里new的时候会给返回的mod一些属性, prototype加一些方法, 但是constructor中并未直接调用这些方法

然后进入init函数, 传入deps: ["main"];

#### 6,module.init

模块的初使化, 会做一些简单的判断, 赋值一些属性如factory, errback等到module的this上, 如:
```
//Do a copy of the dependency array, so that
//source inputs are not modified. For example
//"shim" deps are passed in here directly, and
//doing a direct modification of the depMaps array
//would affect that config.
this.depMaps = depMaps && depMaps.slice(0);

this.errback = errback;

//Indicate this module has be initialized
this.inited = true;

this.ignore = options.ignore;
```

然后, 执行this.enable();

#### 7,this.enable()

这里进入each循环,直接跳到最后

```
//Skip special modules like 'require', 'exports', 'module'
//Also, don't call enable if it is already enabled,
//important in circular dependency cases.
if (!hasProp(handlers, id) && mod && !mod.enabled) {
    context.enable(depMap, this);
}
```
如下是context.enable
```
enable: function (depMap) {
    var mod = getOwn(registry, depMap.id);
    if (mod) {
        getModule(depMap).enable();
    }
}
```
于是再次进入module.enable, 不过需要注意的是, 这里的module和之前的不一样, id为"main", 而非makeModuleMap制造出来的"_@rx"

回到开头, 这里main无依赖, this.depMaps为空数组, 到达最后的this.check();

#### 8,this.load()

this.check()直接进入this.fetch(), 再进入this.load() => context.load() => req.load();

```
if (isBrowser) {
    //In the browser so use a script tag
    node = req.createNode(config, moduleName, url);

    node.setAttribute('data-requirecontext', context.contextName);
    node.setAttribute('data-requiremodule', moduleName);

    //Set up load listener. Test attachEvent first because IE9 has
    //a subtle issue in its addEventListener and script onload firings
    //that do not match the behavior of all other browsers with
    //addEventListener support, which fire the onload event for a
    //script right after the script execution. See:
    //https://connect.microsoft.com/IE/feedback/details/648057/script-onload-event-is-not-fired-immediately-after-script-execution
    //UNFORTUNATELY Opera implements attachEvent but does not follow the script
    //script execution mode.
    if (node.attachEvent &&
            //Check if node.attachEvent is artificially added by custom script or
            //natively supported by browser
            //read https://github.com/requirejs/requirejs/issues/187
            //if we can NOT find [native code] then it must NOT natively supported.
            //in IE8, node.attachEvent does not have toString()
            //Note the test for "[native code" with no closing brace, see:
            //https://github.com/requirejs/requirejs/issues/273
        !(node.attachEvent.toString && node.attachEvent.toString().indexOf('[native code') < 0) &&
        !isOpera) {
        //Probably IE. IE (at least 6-8) do not fire
        //script onload right after executing the script, so
        //we cannot tie the anonymous define call to a name.
        //However, IE reports the script as being in 'interactive'
        //readyState at the time of the define call.
        useInteractive = true;

        node.attachEvent('onreadystatechange', context.onScriptLoad);
        //It would be great to add an error handler here to catch
        //404s in IE9+. However, onreadystatechange will fire before
        //the error handler, so that does not help. If addEventListener
        //is used, then IE will fire error before load, but we cannot
        //use that pathway given the connect.microsoft.com issue
        //mentioned above about not doing the 'script execute,
        //then fire the script load event listener before execute
        //next script' that other browsers do.
        //Best hope: IE10 fixes the issues,
        //and then destroys all installs of IE 6-9.
        //node.attachEvent('onerror', context.onScriptError);
    } else {
        node.addEventListener('load', context.onScriptLoad, false);
        node.addEventListener('error', context.onScriptError, false);
    }
    node.src = url;

    //Calling onNodeCreated after all properties on the node have been
    //set, but before it is placed in the DOM.
    if (config.onNodeCreated) {
        config.onNodeCreated(node, config, moduleName, url);
    }

    //For some cache cases in IE 6-8, the script executes before the end
    //of the appendChild execution, so to tie an anonymous define
    //call to the module name (which is stored on the node), hold on
    //to a reference to this node, but clear after the DOM insertion.
    currentlyAddingScript = node;
    if (baseElement) {
        head.insertBefore(node, baseElement);
    } else {
        head.appendChild(node);
    }
    currentlyAddingScript = null;

    return node;
}
```

也可以看到这里注释较多, 代码其实没几行, 就是生成一个script标签, 把contextName等一些信息加在data上, 为script加上onScriptLoad函数, 最后, 将script标签插入head中

至此, data-main中的路径js终于加载完毕, 然后each循环结束, 到"_@rx"的this.check(), 完毕;


#### 9, main.js

main.js加载会自动执行requrejs.config(), 若有deps或callback, 像刚刚加载main一样加载之, 若无, 则只配置全局的路径啥的

再执行
```
require(['getName', 'name'],function (getName, name) {
    getName(name)
});
```

#### 10, 加载其它依赖

如上, 代码进入req中的context.require => context.makeRequire => localRequire => context.nextTick => ...

和加载main.js一样的流程加载好getName和name

#### 11, getName(name)模块执行

getName加载后, 插入head中, 执行define函数, globalDefQueue.push([name, deps, callback]);

执行完毕以后, 在上述中第8步的onScriptLoad函数执行(之前main也会执行), 过程和前面的类似, 也会把deps中的模块加载完

context.onScriptLoad() => context.completeLoad() => callGetModule(args) => getModule(makeModuleMap(args[0], null, true)).init(args[1], args[2]) =>

this.enable() => this.check() => context.execCb(id, factory, depExports, exports)

前面都和加载main时一致, 最后一步会将deps的返回值收集成exports数组, 作为factory的实参;

```
/**
 * Executes a module callback function. Broken out as a separate function
 * solely to allow the build system to sequence the files in the built
 * layer in the right sequence.
 *
 * @private
 */
execCb: function (name, callback, args, exports) {
    return callback.apply(exports, args);
},
```

### 总结

从全篇可以看出, requirejs的加载流程, 首先通过req({})生成默认context, 再读取main路径并加载之

然后执行main文件, define函数将各参数压入globalDefQueue, 然后执行onScriptLoad函数

取出queue, 加载其中的deps依赖, 加载完成后得到其返回值, 执行callback, 并将依赖的返回值当参数传入


以下为抽出来的核心代码:
```
var MyModules = (function Manager() {
    var modules = {};

    function define(name, deps, impl) {
        for (var i=0; i<deps.length; i++) {
            deps[i] = modules[deps[i]];
        }
        modules[name] = impl.apply( impl, deps );
    }

    function getName(name) {
        return modules[name];
    }

    return {
        define: define,
        get: getName
    };
})();
```
调用方式:
```
MyModules.define( "bar", [], function() {
    function hello(who) {
        return "Let me introduce: " + who;
    }
    return {
        hello: hello
    };
});
MyModules.define( "foo", ["bar"], function(bar) {
    var name = "Excalibur";

    function awesome() {
        console.log( bar.hello( name ).toUpperCase() );
    }

    return {
        awesome: awesome
    };
} );
var bar = MyModules.get( "bar" );
var foo = MyModules.get( "foo" );

console.log(bar.hello( "Excalibur" ))
foo.awesome()
```

