## 阅你不知道的JavaScript(上卷).pdf笔记

这本书深入讲解了js的一些比较容易让人忽略的运行机制,前几章只要工作经验足的人应该都会了解,真正比较深入的应该算第二部分的5.6章,个人感觉是本书的精华所在,颠覆了长久以来的认知...

前几章节就随意做做笔记吧,重点在于后面对"类","继承"到"委托"的思维转变.


## 第一部分
### 1作用域

#### 1.1编译原理

编译时间: 代码执行前的少量时间(几微秒)

* 分词/词法分析: 解析文本字符为代码块, 如:["var", "a", "=", "2"]
* 解析/语法分析: 将代码单元转换为树结构
* 代码生成: 生成引擎可执行代码

还包括一些优化步骤等.

#### 1.2作用域

* 分为引擎,编译器,作用域三部分
* 编译器编译完成后,引擎执行操作,变量存在于作用域中;
* 分清LHS(查找存储地址)和RHS(查找存储值);

请分析例子:
```
function foo(a) {
    var b = a;
    return a + b;
}
var c = foo( 2 );
```

LHS(3), RHS(4)

#### 1.3作用域嵌套
引擎会延着作用域链查找变量,直到找到或查到全局变量为止,若未找到,LHS非严格模式会创建全局变量给引擎,否则报错ReferenceError

### 2词法作用域

在编译的时候生成的作用域,由声明的代码块位置决定.而有两种方式可以修改词法作用域:
* eval: 将字符串改为代码,类似的有setTimeout, setInterval, new Function等
* with: 创建一个新的作用域

以上两种方式不推荐使用

### 3函数作用域,块级作用域

#### 3.1函数作用域
* 内部作用域可以访问外部的,外部的无法访问内部作用域
* 最小暴露原则
* 立执行函数
    1 匿名函数坏处1,调试困难 2,引用自身只能用arguments.callee 3,可读性差

    2 传global,避免修改undefined等

#### 3.2块级作用域
在ES5.1中其实并没有块级概念, 在{}的声明也会污染作用域, 生成块作用域的方法如下:
* with
* try{}catch(eee){}
* let--此处分隐式和显式
* const

### 4 声明提升
* 变量声明和函数声明,会在预编译时声明在作用域内
* 函数优先
* 避免块作用域中声明函数

分析下例:
```
foo(); // 3

function foo() {
    console.log( 1 );
}

var foo = function() {
    console.log( 2 );
};

function foo() {
    console.log( 3 );
}
```

### 5 作用域和闭包
<font style="color: #f20"> 内部函数能在外部函数中调用 </font>

```
var fn;
function foo() {
    var a = 2;
    function baz() {
        console.log( a );
    }
    fn = baz; // 将 baz 分配给全局变量
}

function bar() {
    fn(); // 闭包!
}
foo();
bar(); // 2
```
闭包在foo()执行以后,由于baz被fn引用,垃圾回收机制无法回收foo的内部运行环境,形成闭包;简单来说需要先了解JS的垃圾回收机制,foo的内部作用域按理来说在foo()执行完毕就会消失,
但是由于内部的函数baz被外部fn引用了,所以没法回收;由于这里fn是全局的,这个作用域将一直不会被回收(除非手动在某处设置fn = null解除引用关系),而且只有baz能访问到这个作用域中的其它变量,形成闭包;

个人理解:准确来说,由于内部变量被引用而无法被回收的作用域,为闭包;

来看几个例子:
```
function wait(message) {
    setTimeout( function timer() {
         console.log( message );
    }, 1000 );
}
wait( "Hello, closure!" );
```
这里也形成了一个闭包, wait作用域下有个message变量,由于timer有对message的引用,所以wait的内部作用域一直没法释放, 除非setTimeout被clear;

```
function bind(){
    var a = 1;

    dom.addEventListener('click', function() {console.log(a)}, false);
}
```

由于事件绑定, a永远得不到释放(除非解绑), bind内部其实也是个闭包环境;

## 第二部分

### 1 关于this

省去书写时显示的上下文参数,定义的时候不关心,调用的时候才传入即可

### 2 this解析

#### this到底是指向哪个对象,和期的调用位置相关,而和声明位置无关

#### 绑定规则

* 默认绑定
```
    var a = 2;
    function foo() {
        console.log( this.a ); //2
    }
    foo();
```
this没有明确的指向的时候,this为window;在use strict严格模式下, 此this没有指明是谁,会报错

* 隐式绑定
```
function foo() {
    console.log( this.a );
}
var obj = {
    a: 2,
    foo: foo
};
obj.foo(); // 2
```
函数有引用上下文对象时,this绑定到此对象; this.a === obj.a;
若有另一个对象为obj2,且obj2.anotherObj.foo = obj.foo,那么obj2.anotherObj.foo()执行时,this绑定到最近的obj2.anotherObj上,
this.a === obj2.anotherObj.a

<font style="color: #f20"> 隐式丢失: </font>
```
var fn = obj.foo;
fn();
```
此时fn调用时的this不会指向obj,而使用默认绑定

* 显示绑定
```
function foo() {
    console.log( this.a );
}
var obj = {
    a:2
};
foo.call( obj ); // 2
```
.call, .apply使函数调用时this指向第一参数, .bind有类似作用

* new绑定
```
function foo(a) {
    this.a = a;
}
var bar = new foo(2);
console.log( bar.a ); // 2
```
foo会将this对象返回,于是bar 即为 this;

#### 优先级
* 是否在new中,若是this则为新创建对象
* 是否显式绑定
* 是否隐式绑定
* 默认绑定


<font style="color: #f20"> this词法: </font>
在箭头函数中,this不绑定到特定对象,而是随着环境中的this绑定,类似"继承"了上级作用域的this绑定

### 3 对象
#### 声明
#### 类型
#### 内容(ES6声明时属性名可计算)
#### 属性描述符
```
var myObject = {};
Object.defineProperty( myObject, "a", {
    value: 2,
    writable: true,
    configurable: true,
    enumerable: true
});
myObject.a; // 2
```
* writable是否是可修改属性
* configurable是否可配置
* enumerable是否可枚举

#### 不变性
* 常量:结合 writable:false 和 configurable:false 就可以创建一个真正的常量属性
* 禁止扩展: 禁止对象添加新属性(可修改已有的)
```
    var myObject = { a:2};
    Object.preventExtensions( myObject );
    myObject.b = 3;
    myObject.b; // undefined
```
* 密封: Object.seal(obj);不能添加也不能删除现有属性
* 冻结: Object.freeze(obj); 不能添加,不能删除,不能修改


#### getter 和setter

有setter和getter时会忽略对象的value和writable的值;
