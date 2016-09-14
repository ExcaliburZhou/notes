## RequireJS 源码分析 version 2.3.1

#### 这几日闲来无事, 想想自己也一直没看看require的源码, 便折腾了几下, 这一看耗损脑细胞数千, 各种跳转, 头疼不矣

### 代码结构

* 12-36: 变量声明
* 36-197: 各种工具函数声明, 如:类型判断, 迭代器, 对象深复制, 错误提示, 绑定this等
* 199-1745: newContext函数, 函数最主要的逻辑代码
* 1761-1830: 全局暴露require, 这便是整个代码的入口函数, 并为之添加一些全局方法
* 1833: 第一次调用入口函数, 执行newContext函数, 返回默认context, 存于req.contexts中
* 1836-2001: 加载script标签的代码, 绑在req上, 另有一些通用方法
* 2004-2049: 获取require引入标签, 若有data-main, 将其作为一个依赖放入cfg中
* 2058-2123: 全局暴露define函数, 主要是将后面的define获取的模块名, 依赖, 回调, 压入globalDefQueue中
* 2141: 第二次调用入口函数, 若有data-main, 则加载之, 若传入空对象

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









