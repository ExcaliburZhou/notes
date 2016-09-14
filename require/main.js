/**
 * Created by Excalibur on 16/9/14.
 */

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