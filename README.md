## 功能介绍

主要针对electron-vue做的插件，必在electron-vue的基础上使用，针对electron-vue中打开新的无边框窗口缓慢、传参困难等问题做的优化，安装方式简单、使用简单, 点击[这里](https://github.com/hxkuc/electron-ui)可以查看简单的demo

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

## 可能遇到的问题
由于使用了c++原生模块，所以在安装本插件时可能会遇到已下的问题，大概说下解决方案

1.没有安装python导致的报错
![image.png](https://upload-images.jianshu.io/upload_images/13048954-de877bc79c767fad.png?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)
解决办法：安装python，具体方法可以参考node-gyp的文档 https://github.com/nodejs/node-gyp

2.
![image.png](https://upload-images.jianshu.io/upload_images/13048954-1984ebec59bac82b.png?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)

解决办法： 安装electron-rebuild参考文档：https://electronjs.org/docs/tutorial/using-native-node-modules

3.
![image.png](https://upload-images.jianshu.io/upload_images/13048954-e277b87e7c1c7cc1.png?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)

解决方法：和第一个报错一样，如果还报错看看是不是没有设置环境变量，或者python版本不对引起的

4.
![image.png](https://upload-images.jianshu.io/upload_images/13048954-f481b4fc629adcf1.png?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)

解决办法： 使用electron-rebuild重新rebuild，`npm install --save-dev electron-rebuild` 然后`.\node_modules\.bin\electron-rebuild.cmd`，具体可参考https://electronjs.org/docs/tutorial/using-native-node-modules
5.
![image.png](https://upload-images.jianshu.io/upload_images/13048954-7db28d7b5d9cac22.png?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)

解决办法： 网络原因，重新执行rebuild


## API介绍

在子进程中使用

## createWin(option)
- 作用： 创建一个窗口
- 参数： `option: {object}`
- 返回： `BrowserWindow`实例
```
option = {
  // 以下为暂时支持的原生属性
  width: '',
  height: '',
  minimizable: '',
  maximizable: '',
  resizable: '',
  x: '',
  y: '',
  alwaysOnTop: '',
  skipTaskbar: '',
  // electron-vue-windows新增的属性
  windowConfig: {
    animation: '' // 窗口打开动画    （fromRight，fromLeft，fromTop，fromBottom）
    customAnimation: {
      fromPosition: {}, // 窗口动画起点
      time: 1000, // 动画时间
      graphs: '' // 动画过度曲线
    }, // 选填 自定义动画，如果有此属性animation属性会失效
    name: '', // 选填 窗口名称
    router: '', // 必填 窗口路由
    reuse: '', // 选填 是否复用窗口（如果选此选项使用closeWin方法不会销毁窗口，应该使用exitWin销毁窗口）
    reload: '', // 是否重新加载窗口（指重新加载窗口路由）
    vibrancy: '', // 选填 是否开启模糊透明
    data: '', // 要发送的基础数据
    fromWinId: '' // 来自id
  }
}
```
- 用法： 
创建一个普通窗口
```
// 创建窗口
let win = this.$Win.createWin({
  width: 800,
  height: 600,
  windowConfig: {
    router: '/index', // 路由
  }
})
win.on('closed', () => {
  win = null
})
win.show()
// 关闭窗口（注：最好调用electron-vue-windows的关闭api）
this.$Win.closeWin()
win.close() // 不推荐
```
创建透明窗口（vibrancy属性设置为false）
```
let win = this.$Win.createWin({
  width: 800,
  height: 600,  
  windowConfig: {
    router: '/index',
    name: 'index', // 窗口名字，如果该name窗口存在会直接显示，不会重新创建    
    vibrancy: false  
  }
})
win.show()

```
创建窗口从左侧划入并发送数据
```
 let win = this.$Win.createWin({
  width: 800,
  height: 600,   
  windowConfig: {
    router: '/index',
    name: 'index', // 窗口名字，如果该name窗口存在会直接显示，不会重新创建    
    animation: 'fromLeft',
    data: {index: 1}
  }
})
win.show()
```
自定义动画--创建一个窗口从左上角滑到中间
```
let win = this.$Win.createWin({
  width: 800,
  height: 600,   
  windowConfig: {
    router: '/index',
    name: 'index', // 窗口名字，如果该name窗口存在会直接显示，不会重新创建    
    customAnimation: {
      fromPosition: {x: 0, y: 0}, // 窗口动画起点
      time: 1000, // 动画时间
      graphs: 'Quartic.InOut' // 动画过度曲线
    }, 
    data: {index: 1}
  }
})
win.show()
```
动画曲线`graphs`参考： http://tweenjs.github.io/tween.js/examples/03_graphs.html

- 说明： 为什么不支持browserwindow的其他参数，因为createWin函数调用的窗口是已经初始化了的窗口，所以只能动态的改变窗口的属性，如果browserwindow没有提供动态改变的接口，或者有些属性需要重载窗口的是不能使用的，这里增加的windowConfig配置是自定义的属性就是原browserwindow没有的所以单独放到一个对象里面便于区分，事实上大部分的功能都是依赖于这个对象的属性

## openWin(option)

- 作用：打开一个新窗口，并等待返回数据
- 参数：`option: {object}` 同`createWin`
- 返回：`return {promise}` 窗口回调过来的数据
- 用法：
打开一个窗口并等待数据返回
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
## getParameter()
- 作用： 获取窗口传参
- 返回： `data: {object}`
- 用法： 
```
let data = this.$Win.getParameter()
console.log(data) // {id: 1}
```

## closeWin(data, win)
- 作用： 关闭一个窗口
- 参数：data:{object}要传回的数据，win: {browserwindow}窗口实例
- 用法：
关闭当前窗口并发送数据
```
this.$Win.closeWin({value:1})
```
关闭name为'name'窗口
```
let win = this.$Win.getWinByName('name')
this.$Win.closeWin({value:1}, win)
```
## exitWin(data, win)
- 作用：复用窗口的退出，只用在复用窗口上，用于关闭后台窗口进程
- 参数： 同closeWin
- 用法： 同closeWin

