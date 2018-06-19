/*
 * 窗口容器
 * @author： 黄
 * 2018.4.21
 */
const { app, BrowserWindow, webContents } =require('electron')
const path = require('path')

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
    constructor(config) {
        config = config || {}
        this.freeWindowNum = config.freeWindowNum || 1 // 允许空闲的窗口数量
        // 初始化页面
        this.freePage = {
            model: (config.freePage && config.freePage.model) || 'index',
            router: (config.freePage && config.freePage.router) || '/backGround'
        }
        this.domain = config.domain || 'http://localhost:9080/'
        // 基本的配置参数
        this.baseWindowConfig = {
            show: false,
            transparent: true,
            frame: false,
            width: 0,
            height: 0
        } 
        this._windowList = [] // 窗口容器
        this.WIN = null
    }

    /*
     * 打开新的空白窗口等待加载
     */
    creatFreeWindow() {
        let win = new BrowserWindow(this.getWindowConfig())
        // 设置传参
        this._windowList.push({
            id: win.id,
            name: '',
            isUse: false,
            model: this.freePage.model,
            router: this.freePage.router,
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
                    if (allWindows[i].id != winId && (key < 0 || (key > -1 && this.getWindowInfo(_windowList[key]).isUse))) appShouldQuit = false
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

        let modalPath = process.env.NODE_ENV === 'development' ?
            this.domain + this.freePage.model + '.html#' + this.freePage.router :
            path.join('file://', __dirname, '../../dist/electron', this.freePage.model) + '.html#' + this.freePage.router 
        win.loadURL(modalPath)
        return win
    }

    /*
     * 适配窗口参数
     */
    getWindowConfig() {
        if (process.env.NODE_ENV === 'development') {
            this.baseWindowConfig.webPreferences = { webSecurity: false }
        }
        return this.baseWindowConfig
    }

    /*
     * 平衡空白窗口数量
     */
    checkFreeWindow() {
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

    static init(config) {
        if (!this.WIN) {
            this.WIN = new WindowsBox(config)
        }
        return this.WIN  
    }


    /*
     * 使用一个空白窗口
     * 暂时支持初始几个参数
     * {width,height,model,router}
     */
    getFreeWindow(option) {
        // 怎么配置参数
        // 怎么绑定事件
        // 暂时支持简单的参数（width，height，frame, transform等）
        // 判断参数是否有name和refresh属性（如果有name属性查找该name窗口是否存在，存在显示不存在新建）
        option = option || {}
        let freeWindow, freeWindowInfo
        if (option.name) {
            let winInfo = this._windowList.find(row => row.name === option.name)
            if (winInfo) {
                if (!option.reload) {
                    return BrowserWindow.fromId(winInfo.id)
                } else {
                    freeWindow = BrowserWindow.fromId(winInfo.id)
                    freeWindowInfo = winInfo
                }
            } else {
                freeWindowInfo = this._getFreeWindow()
                freeWindow = BrowserWindow.fromId(freeWindowInfo.id)
            }
        } else {
            freeWindowInfo = this._getFreeWindow()
            freeWindow = BrowserWindow.fromId(freeWindowInfo.id)
            option.name = freeWindowInfo.id
        }

        // 更新参数
        freeWindowInfo.router = option.router
        freeWindowInfo.sendMsg = option.data || {}
        freeWindowInfo.isUse = true
        freeWindowInfo.name = option.name
        freeWindowInfo.fromId = option.fromWinId
        freeWindowInfo.reuse = option.reuse || false
        // 重置窗口大小
        freeWindow.setSize(option.width || 800, option.height || 600)
        freeWindow.center()
        // 检查窗口是否允许最大化最小化（maximizable，minimizable）
        if (false === option.minimizable) {
            freeWindow.setMinimizable(false)
        }
        if (false === option.maximizable) {
            freeWindow.setMaximizable(false)
        }
        if (false === option.resizable) {
            freeWindow.setResizable(false)
        }
        // 重置当前位置
        if (option.x && option.y) {
            freeWindow.setPosition(option.x, option.y)
        }
        // 是否置顶窗口
        if (option.alwaysOnTop) {
            freeWindow.setAlwaysOnTop(true)
        }
        // 是否在任务栏中显示
        if (option.skipTaskbar) {
            freeWindow.setSkipTaskbar(true)
        }
        
        this.setUseWindow(freeWindowInfo)
        this.checkFreeWindow()
        // 发送监听事件页面内跳转（放在设置和检查窗口后面防止多进程重复问题）
        // 背景窗口还没初始化完成会导致信息无法被获取
        // 解决方案是判断窗口是否加载完成如果加载完成直接发送，如果未完成等待完成再发送
        if (freeWindow.webContents.isLoading()) {
            freeWindow.webContents.once('did-finish-load', function() {
                freeWindow.webContents.send('_changeModelPath', {
                    router: option.router,
                    windowInfo: freeWindowInfo
                })
            })
        } else {
            freeWindow.webContents.send('_changeModelPath', {
                router: option.router,
                windowInfo: freeWindowInfo
            })
        }
        return freeWindow
    }


    /*
     * 取出一个空白窗口并且返回（仅仅取出对象）
     */
    _getFreeWindow() {
        // 没有使用的窗口并且不是复用的窗口
        let winInfo = this._windowList.find(row => row.isUse === false && !row.reuse)
        if (!winInfo) {
        	let win = this.creatFreeWindow()
        	return this._windowList.find(row => row.id === win.id)
        }
        return winInfo
    }

    /*
     * 根据窗口id设置某一窗口为已使用
     */
    setUseWindow(freeWindowInfo) {
        this._windowList = this._windowList.map(row => {
        	return row.id === freeWindowInfo.id ? freeWindowInfo : row
        })
    }


    /*
     * 获取窗口的数据
     */
    getWindowInfo (id) {
        return this._windowList.find(row => row.id === id)
    }

    /*
     * 设置窗口的数据
     */
    setWindowInfo (data, id) {
    	this._windowList = this._windowList.map(row => {
    		return row.id === id ? data : row
    	})
    }

    /*
     * 获取windowList对象
     */
    getWindowList () {
        return this._windowList
    }

}

module.exports = WindowsBox