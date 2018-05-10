const path = require('path')
const winPath = path.join(__dirname, 'WindowsBox.js')
const WindowsBox = require('electron').remote.require(winPath)
const { remote, ipcRenderer } = require('electron')
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
    openWin(option) {
        option.fromWinId = this.win.id
        let win = this.WindowsBox.getFreeWindow(option)
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
        if (data) {
            let _windowInfo = this.WindowsBox.getWindowInfo(this.win.id)
            _windowInfo.backMsg = data
            this.WindowsBox.setWindowInfo(_windowInfo, this.win.id)
        }
        this.win.close()
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
            for (var i = allWindows.length - 1; i >= 0; i--) {
                if (allWindows[i].id != this.win.id && _windowList.indexOf(allWindows[i].id) < 0) appShouldQuit = false
            }
            if (appShouldQuit) remote.app.quit()
            this.win = null
        }
        
        window.addEventListener('beforeunload', () => {
            this.win.removeListener('close', closeWinInfo)
        })
        this.win.on('close', closeWinInfo)
        // 监听接收数据
        ipcRenderer.on('_windowToMsg', (event, data) => {
            this.Event.emit('_windowToMsg', data)
        })
        ipcRenderer.on('_openWindowMsg', (event, data) => {
            this.Event.emit('_openWindowMsg' + data.fromWinId, data)
        })
    }

    /*
     * 接收无状态立即响应数据
     * 无name接受所有
     */
    getMsg(fun, name) {
        this.Event.on('_windowToMsg', (data) => {
            if (name) {
                if (data.fromWinName == name) {
                    fun(data.data)
                }
            } else {
                fun(data.data)
            }
        })
    }

    /*
     * 发送无状态立即响应的数据
     * {fromWinName: '',fromWinId: '', toWinName: '', toWinId: '', data: {}}
     */
    sendMsg(data) {   
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
}


module.exports = new Win()