/*
 * 窗口容器
 * @author： 黄
 * 2018.4.21
 */
const { app, BrowserWindow, webContents } = require('electron')
const path = require('path')
const electronVibrancy = require('@hxkuc/electron-vibrancy')
const TWEEN = require('@tweenjs/tween.js')

/*
 * 简单说一下这个窗口的实现思路
 * 实现窗口容器思考了两种方式，第一种方式是通过在主进程中设置一个容器来存放对应的窗口，子进程通过electron自带的通讯方式和主进程容器进行通讯创建窗口
 * 优点：窗口统一归主进程创建，不依赖于外部浏览器，缺点：进程通讯异步创建窗口响应速度有待商榷
 * 第二种方式是把容器设置在浏览器localsrorage中，通过localstroage的同步属性来调用容器和保存窗口间传参
 * 优点：简单易用，同步方式，窗口间通讯方便，缺点：依赖于localstorage，主进程中不能使用
 * 目前先采用第二种方式，如果你有更好的方式可以联系我
 * 2374266244@qq.com
 */

/*
 * 修正现在开始在主进程创建
 * 并且窗口容器用以数字id为对象属性的对象来实现
 * 数组在多进程下会出问题
 */

class WindowsBox {
  constructor (config) {
    config = config || {}
    this.freeWindowNum = config.freeWindowNum || 1 // 允许空闲的窗口数量
    this.port = config.port || 9080
    this.router = '/__BACKGROUND__'
    this._windowList = [] // 窗口容器
    this.baseWindowConfig = {
      webPreferences: { webSecurity: this.isPackaged() },
      show: false,
      transparent: true,
      frame: false,
      width: 0,
      height: 0
    }
    // 单例模式
    if (WindowsBox.prototype.__Instance === undefined) {
      WindowsBox.prototype.__Instance = this
      this.checkFreeWindow()
    }
    return WindowsBox.prototype.__Instance
  }

  /*
   * 打开新的空白窗口等待加载
   */
  creatFreeWindow () {
    let win = new BrowserWindow(this.baseWindowConfig)
    // 设置传参
    this._windowList.push({
      id: win.id,
      name: '',
      isUse: false,
      router: this.router,
      sendMsg: {},
      backMsg: {},
      fromId: '',
      reuse: false
    })
    let winId = win.id

    win.on('closed', () => {
      setTimeout(() => {
        // 先push出数组
        this._windowList = this._windowList.filter(row => row.id !== winId)
        // 如果只剩下空白的窗口就关掉应用
        let allWindows = BrowserWindow.getAllWindows()
        let _windowList = this._windowList.map(row => row.id)
        let appShouldQuit = true
        for (var i = allWindows.length - 1; i >= 0; i--) {
          let key = _windowList.indexOf(allWindows[i].id)
          if (allWindows[i].id != winId && (key < 0 || (key > -1 && this.getWindowInfoById(_windowList[key]).isUse))) appShouldQuit = false
        }
        if (appShouldQuit) app.quit()
        win = null
      }, 100)
    })

    win.on('resize', () => {
      const [width, height] = win.getContentSize()
      for (let wc of webContents.getAllWebContents()) {
        // Check if `wc` belongs to a webview in the `win` window.
        if (wc.hostWebContents &&
          wc.hostWebContents.id === win.webContents.id) {
          wc.setSize({
            normal: {
              width: width,
              height: height
            }
          })
        }
      }
    })

    let modalPath = this.isPackaged()
      ? path.join('file://', __dirname, '../../dist/electron/') + 'index.html#' + this.router
      : 'http:localhost:' + this.port + '/index.html#' + this.router
    win.loadURL(modalPath)
    return win
  }

  /*
   * 平衡空白窗口数量
   */
  checkFreeWindow () {
    // 如果有缓存，查找空余窗口是否足够，不足的话创建到给定水平（同时删掉可能多出来的窗口）
    let notUseWindowNum = 0
    this._windowList.forEach(row => {
      if (!row.isUse) notUseWindowNum++
    })
    let num = this.freeWindowNum - notUseWindowNum
    if (num > 0) {
      for (var i = num; i > 0; i--) {
        this.creatFreeWindow() // 暂时循环调用，后期用延时
      }
    }
  }

  /*
   * 使用一个空白窗口
   * 暂时支持初始几个参数
   * {width,height,model,router}
   */
  getFreeWindow (option) {
    // 怎么配置参数
    // 怎么绑定事件
    // 暂时支持简单的参数（width，height，frame, transform等）
    // 判断参数是否有name和refresh属性（如果有name属性查找该name窗口是否存在，存在显示不存在新建）
    option = option ? JSON.parse(option) : {}
    let freeWindow, freeWindowInfo
    if (option.windowConfig.name) {
      // 查询是否有该name窗口存在
      let winInfo = this.getWindowInfoByName(option.windowConfig.name)
      if (winInfo) {
        freeWindow = this.getWinById(winInfo.id)
        freeWindowInfo = winInfo
        if (freeWindowInfo.reuse) {
          if (freeWindowInfo.isUse) {
            if (option.windowConfig.reload) {
              this.windowRouterChange(freeWindow, option.windowConfig.router)
              this.refreshFreeWindowInfo(freeWindowInfo, option)
            }
          } else {
            // 路由跳转
            this.windowRouterChange(freeWindow, option.windowConfig.router)
            // 窗口基础状态
            this.setWindowConfig(this.getBaseConfig(option, freeWindow), freeWindow)
            // 如果有动画生成动画后状态
            if (option.windowConfig.animation || option.windowConfig.customAnimation) {
              this.animation({
                win: freeWindow,
                to: this.getToConfig(option),
                time: (option.windowConfig.customAnimation && option.windowConfig.customAnimation.time) || 1000,
                graphs: (option.windowConfig.customAnimation && option.windowConfig.customAnimation.graphs) || 'Exponential.Out'
              })
            }
            // 更新队列
            this.refreshFreeWindowInfo(freeWindowInfo, option)
          }
        } else {
          if (option.windowConfig.reload) {
            this.windowRouterChange(freeWindow, option.windowConfig.router)
            this.refreshFreeWindowInfo(freeWindowInfo, option)
          }
        }
      } else {
        freeWindowInfo = this.getNewWindow()
        freeWindow = BrowserWindow.fromId(freeWindowInfo.id)
        // 路由跳转
        this.windowRouterChange(freeWindow, option.windowConfig.router)
        // 窗口基础状态
        this.setWindowConfig(this.getBaseConfig(option, freeWindow), freeWindow)
        // 如果有动画生成动画后状态
        if (option.windowConfig.animation || option.windowConfig.customAnimation) {
          this.animation({
            win: freeWindow,
            to: this.getToConfig(option),
            time: (option.windowConfig.customAnimation && option.windowConfig.customAnimation.time) || 1000,
            graphs: (option.windowConfig.customAnimation && option.windowConfig.customAnimation.graphs) || 'Exponential.Out'
          })
        }
        // 更新队列
        this.refreshFreeWindowInfo(freeWindowInfo, option)
        this.checkFreeWindow()
      }
    } else {
      // 拉出窗口
      freeWindowInfo = this.getNewWindow()
      freeWindow = BrowserWindow.fromId(freeWindowInfo.id)
      // 路由跳转
      this.windowRouterChange(freeWindow, option.windowConfig.router)
      // 窗口基础状态
      this.setWindowConfig(this.getBaseConfig(option, freeWindow), freeWindow)
      // 如果有动画生成动画后状态
      if (option.windowConfig.animation || option.windowConfig.customAnimation) {
        this.animation({
          win: freeWindow,
          to: this.getToConfig(option),
          time: (option.windowConfig.customAnimation && option.windowConfig.customAnimation.time) || 1000,
          graphs: (option.windowConfig.customAnimation && option.windowConfig.customAnimation.graphs) || 'Exponential.Out'
        })
      }
      // 更新队列
      this.refreshFreeWindowInfo(freeWindowInfo, option)
      this.checkFreeWindow()
    }
    return freeWindow
  }

  /*
   * @desc 更新队列
   */
  refreshFreeWindowInfo (freeWindowInfo, option) {
    freeWindowInfo.router = option.windowConfig.router
    freeWindowInfo.sendMsg = option.windowConfig.data || {}
    freeWindowInfo.isUse = true
    freeWindowInfo.name = option.windowConfig.name
    freeWindowInfo.fromId = option.windowConfig.fromWinId
    freeWindowInfo.reuse = option.windowConfig.reuse || false
    this.setWindowInfo(freeWindowInfo)
  }

  /*
   * @desc 获取基础配置
   * {vibrancy, width, height, minimizable, maximizable, resizable, x, y, center, alwaysOnTop, skipTaskbar}
   */
  getBaseConfig (option, freeWindow) {
    let config = {}
    // 判断配置中是否有动画
    let noAnimation = !option.windowConfig.animation && !option.windowConfig.customAnimation
    if (noAnimation) {
      if (option.x && option.y) {
        config.x = option.x || ''
        config.y = option.y || ''
      } else {
        config.center = true
      }
    } else {
      if (option.windowConfig.animation) {
        option.width = option.width || 800
        option.height = option.height || 600
        if (!option.x || !option.y) {
          let position = freeWindow.getPosition()
          option.x = position[0] - option.width / 2
          option.y = position[1] - option.height / 2
        }
        switch (option.windowConfig.animation) {
          case 'fromRight':
            config.x = option.x + option.width
            config.y = option.y
            break
          case 'fromLeft':
            config.x = option.x - option.width
            config.y = option.y
            break
          case 'fromTop':
            config.x = option.x
            config.y = option.y - option.height
            break
          case 'fromBottom':
            config.x = option.x
            config.y = option.y + option.height
            break
        }
      }
      if (option.windowConfig.customAnimation && option.windowConfig.customAnimation.fromPosition) {
        config.x = option.windowConfig.customAnimation.fromPosition.x
        config.y = option.windowConfig.customAnimation.fromPosition.y
      }
    }
    config.vibrancy = option.windowConfig.vibrancy || false
    config.vibrancyOptions = option.windowConfig.vibrancyOptions || {}
    config.width = option.width
    config.height = option.height
    config.minimizable = option.minimizable || false
    config.maximizable = option.maximizable || false
    config.resizable = option.resizable || false
    config.alwaysOnTop = option.alwaysOnTop || false
    config.skipTaskbar = option.skipTaskbar || false
    return config
  }

  /*
   * @desc 获取结束动画配置
   *
   */
  getToConfig (option) {
    let config = {}
    config.x = option.x
    config.y = option.y
    config.width = option.width || 800
    config.height = option.height || 800
    return config
  }

  /*
   * @desc 新窗口路由跳转option
   * @parame option {object} {win: win, name: '', data: {}, router: ''}
   */
  windowRouterChange (win, router) {
    if (win.webContents.isLoading()) {
      win.webContents.once('did-finish-load', function () {
        win.webContents.send('_changeModelPath', router)
      })
    } else {
      win.webContents.send('_changeModelPath', router)
    }
  }

  /*
   * @desc 跳转动画
     @param {win: win, from: {}, to:{}, time: 1000, graphs: ''}
   */
  animation (option) {
    if (!option.win) {
      return
    }
    if (!option.from) {
      let position = option.win.getPosition()
      let size = option.win.getSize()
      let opacity = option.win.getOpacity()
      option.from = {
        x: position[0],
        y: position[1],
        width: size[0],
        height: size[1],
        opacity: opacity
      }
    }
    console.log(option)
    let animateId
    TWEEN.removeAll()
    let tween = new TWEEN.Tween(option.from)
      .to( option.to, option.time)
      .onUpdate(function (a) {
        option.win.setPosition(parseInt(a.x), parseInt(a.y))
        option.win.setOpacity(a.opacity)
      }).onComplete(function () {
        clearInterval(animateId);
      }).start()
    let graphs = option.graphs.split('.')
    tween.easing(TWEEN.Easing[graphs[0]][graphs[1]])
    animateId = setInterval(function () {
      TWEEN.update()
    }, 17)
  }

  /*
   * @desc 重新设置窗口的基础属性
   * 目前需要手动调整的后期根据需求加入
   * @param {object} config:{vibrancy, width, height, minimizable, maximizable, resizable, x, y, center, alwaysOnTop, skipTaskbar}
   */
  setWindowConfig (config, freeWindow) {
    // 是否开启背景模糊
    if (config.vibrancy) {
      freeWindow.on('resize', () => {
        electronVibrancy.AddView(freeWindow, {
          Material: 0,
          Width: config.width || 800,
          Height: config.height || 600,
          X: config.vibrancyOptions.padding || 5,
          Y: config.vibrancyOptions.padding || 5,
          borderRadius: config.vibrancyOptions.borderRadius || 5,
          ResizeMask: 2
        })
      })
    }
    // 重置窗口大小
    freeWindow.setSize(config.width || 800, config.height || 600)
    // 检查窗口是否允许最大化最小化（maximizable，minimizable）
    if (config.minimizable === false) {
      freeWindow.setMinimizable(false)
    }
    if (config.maximizable === false) {
      freeWindow.setMaximizable(false)
    }
    if (config.resizable === false) {
      freeWindow.setResizable(false)
    }
    // 重置当前位置
    if (config.x && config.y) {
      freeWindow.setPosition(config.x, config.y)
    }

    if (config.center) {
      freeWindow.center()
    }

    // 是否置顶窗口
    if (config.alwaysOnTop) {
      freeWindow.setAlwaysOnTop(true)
    }
    // 是否在任务栏中显示
    if (config.skipTaskbar) {
      freeWindow.setSkipTaskbar(true)
    }
  }

  /*
   * 取出一个空白窗口并且返回（仅仅取出对象）
   */
  getNewWindow () {
    // 没有使用的窗口并且不是复用的窗口
    let winInfo = this._windowList.find(row => row.isUse === false && !row.reuse)
    if (!winInfo) {
      let win = this.creatFreeWindow()
      return this.getWindowInfoById(win.id)
    }
    return winInfo
  }

  /*
   * 获取windowList对象
   */
  getWindowList () {
    return this._windowList
  }

  isPackaged () {
    const execFile = path.basename(process.execPath).toLowerCase()
    if (process.platform === 'win32') {
      return execFile !== 'electron.exe'
    }
    return execFile !== 'electron'
  }

  /*
   * 路由跳转
   * @parame option {object} {win: win, name: '', data: {}, router: ''}
   */
  routerPush (option) {
    // 先跳转路由，然后重新设置基础数据
    // 如果没有win和name直接返回
    if (!option.win && !option.name) return
    let windowInfo
    if (option.name) {
      windowInfo = this.getWindowInfoByName(option.name)
    } else {
      windowInfo = this.getWindowInfoById(option.win.id)
    }
    if (!windowInfo) return
    let win = this.getWinById(windowInfo.id)
    this.windowRouterChange(win, option.router)
    // 设置队列信息
    windowInfo.router = option.router
    windowInfo.data = option.data
    this.setWindowInfo(windowInfo)
  }

  getWindowInfoById (id) {
    return this._windowList.find(row => row.id === id)
  }

  getWindowInfoByName (name) {
    return this._windowList.find(row => row.name === name)
  }

  getWinById (id) {
    return BrowserWindow.fromId(id)
  }

  getWinByName (name) {
    let windowInfo = this.getWindowInfoByName(name)
    if (!windowInfo) return
    return this.getWinById(windowInfo.id)
  }

  /*
   * 设置窗口的数据
   */
  setWindowInfo (data) {
    this._windowList = this._windowList.map(row => row.id === data.id ? data : row)
  }
}

module.exports = WindowsBox
