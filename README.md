
## 功能介绍

主要针对electron-vue做的插件，必在electron-vue的基础上使用，针对electron-vue中打开新的无边框窗口缓慢、传参困难等问题做的优化，安装方式简单、使用简单, 点击[这里](https://github.com/hxkuc/electron-vue-windows-demo)可以查看简单的demo

## 安装步骤

首先安装electron-vue
然后安装此插件执行如下操作
```
npm i -S electron-vue-windows
```
在renderer/main.js里初始化加入以下代码（注意本插件依赖于vue和vue-router需要在vue和vue-router初始化完毕再加载）
```
import Vue from 'vue'
import router from './router' // 此处router文件为你的路由配置文件
import Win from 'electron-vue-windows'
// 初始化插件，要传入实例化的路由
Win.init(router)
Vue.prototype.$Win = Win
```
## 使用插件

index.vue
```
let data = await this.$Win.openWin({
  // browserwindow原生属性
  width: 700, // 窗口宽
  height: 600, // 窗口高
  
  // electron-vue-windows自定义的属性
  windowConfig: {
    router: '/user', // 路由 *必填
    data: {id: 1}, // 传送数据 
    name: 'user' // 窗口名称
  }
})
console.log(data) // 新窗口返回的数据 {value: 2}
```
user.vue
- 获取传入的参数
```
let data = this.$Win.getParameter()
console.log(data) // {id: 1}
```
- 返回数据并关闭当前窗口
```
let data = {value: 2}
this.$Win.closeWin(data)
```

## 注意事项
- 因为electron-vue默认打开开发者调试工具，如果在调试工具和窗口分离的情况下隐藏窗口的调试工具会展现出来，如果想隐藏掉可以修改main/index.dev.js文件如下
```
// Install `electron-debug` with `devtron`
require('electron-debug')({ showDevTools: true }) // 把true改成false即可（在页面上按f12一样可以调出开发者工具）
```
- 本插件主要适用于无边框窗口的优化，致力于用electron制作

## API介绍

在子进程中使用

openWin(option)

作用：打开一个新窗口，并等待返回数据
参数：本函数和browserwindow类似，但是只支持部分browserwindow的参数，支持的有，width, height, minimizable, maximizable, resizable, x, y, alwaysOnTop, skipTaskbar，以及新增加的参数windowConfig,windowConfig为一个对象有以下参数
animation: '', // 选填 打开窗口动画，目前有fromRight,fromLeft,fromTop,fromBottom四种
customAnimation: {
    fromPosition: {}, // 窗口动画起点
    time: 1000, // 动画时间
    graphs: '' // 动画过度曲线
}, // 选填 自定义动画，如果有此属性animation属性会失效
name: '', // 选填 窗口名称
router: '', // 必填 窗口路由
reuse: '', // 选填 是否复用窗口
reload: '', // 是否重新加载窗口
vibrancy: '', // 选填 是否开启模糊透明
data: '', // 要发送的基础数据
fromWinId: '' // 来自id

说明：为什么不支持browserwindow的其他参数，因为openWin函数调用的窗口是已经初始化了的窗口，所以只能动态的改变窗口的属性，如果browserwindow没有提供动态改变的接口，或者有些属性需要重载窗口的是不能使用的，这里增加的windowConfig配置是自定义的属性就是原browserwindow没有的所以单独放到一个对象里面便于区分，事实上大部分的功能都是依赖于这个对象的属性，
用法：

打开一个窗口


附录：
动画线条