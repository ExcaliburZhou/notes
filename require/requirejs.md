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
* 进入module.fetch()
* 进入module.load() => context.load() => req.load()
* 生成script, 载入main.js
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





