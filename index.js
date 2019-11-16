const axios = require('axios');
const querystring = require("querystring"); //序列化对象，用qs也行，都一样
const cheerio = require('cheerio');
const schedule = require('node-schedule');
const fs = require('fs');
const path = require('path');
const fsPath = path.join(__dirname, './1.txt');

const obj = {
    data: {
      lineId: 16807, //路线id
      vehTime: 0620, //发车时间，
      startTime: 0620, //预计上车时间
      onStationId: 23692, //预定的站点id
      offStationId: 21626,//到站id
    //   onStationName: '宝安交通运输局③',  //预定的站点名称
    //   offStationName: "深港产学研基地",//预定到站名称
      tradePrice: 0,//总金额
      saleDates: '17',//车票日期
      beginDate: '',//订票时间，滞空，用于抓取到余票后填入数据
    },
    cookie: 'JSESSIONID=888', // 抓取到的cookie
    day: "" //定20号的票，这个主要是用于抢指定日期的票，滞空则为抢当月所有余票
  }
  
class QueryTicket{
    /**
    *Creates an instance of QueryTicket.
    * @param {Object} { data, cookie, day }
    * @param data {Object} 请求余票接口的requery参数
    * @param cookie {String} cookie信息
    * @params day {String} 某日的票，如'18'
    * @memberof QueryTicket 请求余票接口
    */
    constructor({ data, cookie, day }) {
        this.data = data 
        this.cookie = cookie
        this.day = day
        this.postData = querystring.stringify(data)
        this.times = 0;   //记录次数
        let stop = false //通过特定接口才能修改stop值，防止外部随意串改
        this.getStop = function () { //获取是否停止
            return stop 
        }
        this.setStop = function (ifStop) { //设置是否停止
            stop = ifStop
        }
    }
    // 初始化,因为涉及到异步请求，所以我们使用`async await`
    async init(){
        let ticketList = await this.handleQueryTicket() //返回查询到的余票数组
        ticketList.length && this.handleInfoUser(ticketList);
    }

    // 查询余票的逻辑
    async handleQueryTicket(){ 
        let ticketList = [] //余票数组
        let res = await this.requestTicket()
        fs.writeFileSync(fsPath, res.data);
        this.times++ //计数器，记录请求查询多少次
        let str = res.data.replace(/\\/g, "") //格式化返回值
        let $ = cheerio.load(`<div class="main">${str}</div>`) // cheerio载入查询接口response的html节点数据
        let list = $(".main").find(".b") //查找是否有余票的dom节点
        // 如果没有余票，打印出请求多少次,然后返回，不执行下面的代码
        if (!list.length) {
            console.log(`无票: 已进行${this.times}次`)
            return
        }
        // 如果有余票
        list.each((idx, item) => {
            let str = $(item).html() //str这时格式是<span>21</span><span>&$x4F59;0</span>
            //最后一个span 的内容其实"余0"，也就是无票，只不过是被转码了而已
            //因此要在下一步对其进行格式化
            // idx === 0 && console.log(str);
            // idx === 0 && console.log(str.split(/<span>|<\/span>|\&\#x4F59\;/));
            const [day, tickets] = str.split(/<span>|<\/span>|\&\#x4F59\;/).filter(item => !!item) 
            const data = {day, tickets};
            //如果是要抢指定日期的票
            if (this.day) {
                //如果有指定日期的余票
                if (+this.day === +day) {
                    ticketList.push(data)
                }
            } else {
                //如果不是，则返回查询到的所有余票
                ticketList.push(data)
            }
        })
        return ticketList
    }

    // 调用查询余票接口
    requestTicket(){
        return axios.post('http://weixin.xx.net/ebus/front/wxQueryController.do?BcTicketCalendar', this.postData, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': "Mozilla/5.0 (iPhone; CPU iPhone OS 8_0 like Mac OS X) AppleWebKit/600.1.4 (KHTML, like Gecko) Mobile/12A365 MicroMessenger/5.4.1 NetType/WIFI",
                "Cookie": this.cookie
            }
        })   
    }

    // 购票相关逻辑
    handleBuyTicket(){}

    //调用购票接口
    requestOrder(){}

    // //通知用户的逻辑
    handleInfoUser(data){
        const ticket = data.map(item => `${item.day}号余票:${item.tickets}张`).join(', ');
        const text = 'Fiddler + node 抓包结果';
        const desp = `你好，票务信息如下：${ticket}, 请及时进行购票，后续会自动添加购票功能`;
        const url = encodeURI(`https://sc.ftqq.com/SCU66461Ta71cb6b9249e25ee8f796e1ffe18f6825dcdf84f76066.send?text=${text}&desp=${desp}`)
        axios.get(url)
        .then(res => {
            console.log('消息发送成功');
        })
        .catch(err => {
            throw err;
        });
    };
    sendMSg(){} //发短信接口
  }
  
  const ticket = new QueryTicket(obj);
  ticket.init();