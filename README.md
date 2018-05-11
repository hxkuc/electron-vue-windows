
## 功能介绍

主要针对electron-vue做的插件，必在electron-vue的基础上使用，针对electron-vue中打开新的无边框窗口缓慢、传参困难等问题做的优化，安装方式简单、使用简单, 点击[这里](https://github.com/hxkuc/electron-vue-windows-demo)可以查看简单的demo

## 安装步骤

首先安装electron-vue
然后安装此插件执行如下操作
```
npm i -S electron-vue-windows
```
在renderer/main.js里初始化加入以下代码
```
import Win from 'electron-vue-windows'
Win.init()
Vue.prototype.$Win = Win
```
然后新建一个backGround.vue文件，内容如下
```
<template>
    <div></div>
</template>
<script>
export default {
  name: 'backGround',
  data () {
    return {
    }
  },
  methods: {
  },
  mounted: function () {
    this.$Win.changePath(this)
  }
}
</script>
<style>
</style>
```
把该vue文件加入根路由下
```
export default new Router({
  routes: [
    {
      path: '/backGround',
      name: 'backGround',
      component: require('@/components/backGround').default
    }
  ]
})
```
## 使用插件

index.vue
```
let data = await this.$Win.openWin({
	width: 700, // 窗口宽
    height: 600, // 窗口高
    router: '/user', // 路由
    data: {id: 1}, // 传送数据 
    name: 'user' // 窗口名称
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

## API介绍
