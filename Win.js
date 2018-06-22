const { remote, ipcRenderer } = require('electron')
const WindowsBox = remote.require('electron-vue-windows')
const events = require('events')

class Win {
    constructor() {
        this.win = remote.getCurrentWindow()
        this.WindowsBox = null
        this.Event = new events.EventEmitter()
    }

    /*
     * 通用弹窗函数
     */
    openWin(option, isWin) {
        let win = isWin ? option : this.createWin(option)
        win.show()
        // 防止对象被销毁
        let winId = win.id
        this.Event.removeAllListeners('_openWindowMsg' + winId)
        return new Promise((resolve, reject) => {
            this.Event.once('_openWindowMsg' + winId, (data) => {
                resolve(data.data)
            })
        })
    }

    /*
     * 关闭弹窗并且发送数据
     */
    closeWin(data) {
        // 判断是否是复用窗口
        let _windowInfo = this.WindowsBox.getWindowInfo(this.win.id)
        _windowInfo.isUse = false
        if (data) {
          _windowInfo.backMsg = data  
        }
        this.WindowsBox.setWindowInfo(_windowInfo, this.win.id)
        if (_windowInfo.reuse) {
            // 复用窗口隐藏hide
            if (_windowInfo.fromId) {
                // 先发送数据
                let sendData = {
                    toWinId: _windowInfo.fromId,
                    fromWinName: _windowInfo.name,
                    fromWinId: _windowInfo.id,
                    data: data
                }
                remote.BrowserWindow.fromId(_windowInfo.fromId).webContents.send('_openWindowMsg', sendData)
            }
            this.win.hide()  
        } else {
            this.win.close()
        }
    }

    /*
     * 复用窗口的关闭
     */
    exitWin (data) {
        let _windowInfo = this.WindowsBox.getWindowInfo(this.win.id)
        _windowInfo.reuse = false
        this.WindowsBox.setWindowInfo(_windowInfo, this.win.id)
        this.closeWin(data)
    }

    /*
     * 创建新的窗口并返回窗口对象（不显示用于绑定事件）
     */
    createWin (option) {
        option.fromWinId = this.win.id
        // 如果复用窗口必须有name参数
        if (option.reuse && !option.name) {
            throw new Error('复用窗口必须定义窗口name')
        }
        // 暂时只能允许传递字符串
        return this.WindowsBox.getFreeWindow(JSON.stringify(option))
    }

    /*
     * 获取当前页面传递过来的参数
     */
    getParameter() {
        return this.WindowsBox.getWindowInfo(this.win.id).sendMsg
    }

    /*
     * 监听路由跳转
     */
    changePath (vm) {
        ipcRenderer.on('_changeModelPath', (event, arg) => {
            vm.$router.push({path: arg.router})
        })
    }

    /*
     * 初始化
     */
    init (config) {
        if (!this.WindowsBox) {
            this.WindowsBox = WindowsBox.init(config)
            this.WindowsBox.checkFreeWindow()
        }
        this.addEventListenerForWindow()
    }


    /*
     * 给新窗口绑定close和resize事件（如果页面刷新要手动解除之前的监听事件）
     */
    addEventListenerForWindow() {
        let eventFun = (event, arg) => {
            this.Event.emit('_windowToMsg', arg)
        }
        let closeWinInfo = () => {
            let _windowInfo = this.WindowsBox.getWindowInfo(this.win.id)
            if (_windowInfo && _windowInfo.fromId) {
                // 先发送数据
                let data = {
                    toWinId: _windowInfo.fromId,
                    fromWinName: _windowInfo.name,
                    fromWinId: _windowInfo.id,
                    data: _windowInfo.backMsg
                }
                remote.BrowserWindow.fromId(_windowInfo.fromId).webContents.send('_openWindowMsg', data)
            }

            // 如果只剩下空白的窗口就关掉应用
            let allWindows = remote.BrowserWindow.getAllWindows()
            let _windowList = this.WindowsBox.getWindowList().map(row => row.id)
            let appShouldQuit = true
            // all是所有的窗口，list是储存的窗口
            // 什么情况下应该关闭应用--all中只剩空窗和当前窗口才关闭
            for (var i = allWindows.length - 1; i >= 0; i--) {
                let key = _windowList.indexOf(allWindows[i].id)
                if (allWindows[i].id != this.win.id && (key < 0 || (key > -1 && this.WindowsBox.getWindowInfo(_windowList[key]).isUse))) appShouldQuit = false
            }
            if (appShouldQuit) remote.app.quit()
            // 删除主进程监听
            remote.ipcMain.removeListener('_windowToMsg', eventFun)
            this.win = null
        }
        
        window.addEventListener('beforeunload', () => {
            this.win.removeListener('close', closeWinInfo)
            remote.ipcMain.removeListener('_windowToMsg', eventFun)
        })
        this.win.on('close', closeWinInfo)
        // 监听接收数据
        /*ipcRenderer.on('_windowToMsg', (event, data) => {
            this.Event.emit('_windowToMsg', data)
        })*/
        remote.ipcMain.on('_windowToMsg', eventFun)
        ipcRenderer.on('_openWindowMsg', (event, data) => {
            this.Event.emit('_openWindowMsg' + data.fromWinId, data)
        })
    }

    /*
     * 接收无状态立即响应数据
     * 无name接受所有
     */
    getMsg(fun, winList) {
        this.Event.on('_windowToMsg', (data) => {
            //  先判断是否有该窗口的信息
            if (data.winList.length) {
                let name = this.getThisWindowName()
                // 有该窗口信息，并且接收发送窗口的数据
                if (data.winList.indexOf(name) > -1 && (!winList || winList.indexOf(data.fromWinName) > -1)) {
                    fun(data)
                }
            } else {
                // 判断是否接受发送窗口的信息
                if (winList) {
                    if (winList.indexOf(data.fromWinName) > -1) {
                        fun(data)
                    }
                } else {
                    fun(data)
                } 
            }
        })
    }

    /*
     * 发送无状态立即响应的数据
     * {fromWinName: '',fromWinId: '', toWinName: '', toWinId: '', data: {}}
     */
    /*sendMsg(data) {   
        if (!data.toWinId && !data.toWinName) {
            return false
        }
        if (!data.toWinId) {
            let _windowList = this.WindowsBox.getWindowList()
            let key = this.inArray({name: data.toWinName}, _windowList)
            if (key > -1) {
                data.toWinId = _windowList[key].id
            } else {
                console.log('无此窗口...') // 暂时先这么着
            }
        }
        let _windowInfo = this.WindowsBox.getWindowInfo(this.win.id)
        if (_windowInfo) {
            data.fromWinName = _windowInfo.name
            data.fromWinId = _windowInfo.id
        } else {
            data.fromWinName = this.win.id
            data.fromWinId = this.win.id
        }
        remote.BrowserWindow.fromId(data.toWinId).webContents.send('_windowToMsg', data)
    }*/

    /*
     * 发送无状态立即响应的数据
     * {fromWinName: '',fromWinId: '', toWinName: '', toWinId: '', data: {}}
     */
    sendMsg(data, winList) {   
        let _data = {
            data: data,
            winList: winList ? winList : []
        }
        let _windowInfo = this.WindowsBox.getWindowInfo(this.win.id)
        if (_windowInfo) {
            _data.fromWinName = _windowInfo.name
            _data.fromWinId = _windowInfo.id
        } else {
            _data.fromWinName = this.win.id
            _data.fromWinId = this.win.id
        }
        ipcRenderer.send('_windowToMsg', _data)
    }

    /*
     * 判断是否在数组中存在
     * @author: huang
     * 支持多个属性判断
     */
    inArray(obj, array) {
        let key = -1
        array.forEach((row, index) => {
            let ishave = true
            for (let i in obj) {
                if (row[i] != obj[i]) {
                    ishave = false
                }
            }
            if (ishave) key = index
        })
        return key
    }

    /*
     * 获取窗口的名字
     */
    getThisWindowName () {
        return this.WindowsBox.getWindowInfo(this.win.id).name
    }
}


module.exports = new Win()