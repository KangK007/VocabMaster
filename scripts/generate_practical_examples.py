"""Generate practical, local example sentences for bundled word banks.

The bundled ECDICT word lists do not provide example sentences. This script
fills the example fields with short, daily-life sentences generated from each
word's part of speech and Chinese meaning. It intentionally does not copy from
an external corpus, so the generated text is reproducible and license-safe.
"""
import json
import re
from datetime import date
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
WORDS_DIR = ROOT / "src" / "words"
WORD_FILES = ("cet4.json", "cet6.json", "postgraduate.json", "ielts.json", "toefl.json")
PLACEHOLDER_EXAMPLE = "No example available in ECDICT."
PLACEHOLDER_TRANSLATION = "ECDICT 未提供例句。"

POS_GROUPS = {
    "verb": {"v", "vt", "vi"},
    "noun": {"n", "pl"},
    "adjective": {"a", "adj"},
    "adverb": {"adv"},
    "connector": {"prep", "conj", "pron", "num", "aux", "abbr", "int", "interj", "unknown"},
}

RULES = [
    ("verb", ("放弃", "抛弃"), "I decided to {word} the old plan and start again.", "我决定{gloss}旧计划，然后重新开始。"),
    ("verb", ("接受", "采用"), "I can {word} your suggestion after work.", "下班后我可以{gloss}你的建议。"),
    ("verb", ("缩写", "简略"), "Please {word} this long name in your note.", "请在笔记里缩写这个长名称。"),
    ("verb", ("完成", "结束"), "I want to {word} this task before dinner.", "我想在晚饭前{gloss}这项任务。"),
    ("verb", ("改变", "修改", "调整"), "We need to {word} the plan for tomorrow.", "我们需要{gloss}明天的计划。"),
    ("verb", ("使用", "利用"), "I often {word} this app to review words on the bus.", "我经常在公交车上{gloss}这个应用复习单词。"),
    ("verb", ("帮助", "协助"), "Small notes can {word} me remember new words.", "小便签可以{gloss}我记住新单词。"),
    ("verb", ("记得", "记住", "背诵"), "I try to {word} one new word before breakfast.", "我尽量在早餐前{gloss}一个新单词。"),
    ("verb", ("忘记",), "Please do not {word} your keys when you leave.", "离开时请不要{gloss}你的钥匙。"),
    ("verb", ("选择", "挑选"), "You can {word} the time that works for you.", "你可以{gloss}适合自己的时间。"),
    ("verb", ("决定", "确定"), "We will {word} after checking the schedule.", "查看日程后我们再{gloss}。"),
    ("verb", ("需要", "要求"), "This form may {word} your phone number.", "这张表格可能会{gloss}你的电话号码。"),
    ("verb", ("喜欢", "享受"), "I {word} a quiet walk after dinner.", "我{gloss}晚饭后安静地散步。"),
    ("verb", ("学习", "研究"), "I {word} for twenty minutes every night.", "我每天晚上{gloss}二十分钟。"),
    ("verb", ("提高", "改善", "改进"), "I want to {word} my English with short daily practice.", "我想通过每天短时间练习来{gloss}英语。"),
    ("verb", ("减少", "降低"), "I try to {word} screen time before bed.", "我尽量在睡前{gloss}看屏幕的时间。"),
    ("verb", ("增加", "增强"), "Drinking water can {word} my energy in the afternoon.", "喝水可以在下午{gloss}我的精力。"),
    ("verb", ("发送", "邮寄"), "Please {word} the file before lunch.", "请在午饭前{gloss}这个文件。"),
    ("verb", ("收到", "获得", "得到"), "I hope to {word} a reply today.", "我希望今天能{gloss}回复。"),
    ("verb", ("检查", "核对", "检验"), "Please {word} the address before you leave.", "离开前请{gloss}地址。"),
    ("verb", ("修理", "修复"), "I need to {word} my bike this weekend.", "这个周末我需要{gloss}我的自行车。"),
    ("verb", ("赔偿", "补偿"), "The company will {word} customers for the delay.", "公司会因延误向顾客{gloss}。"),
    ("verb", ("禁止", "排斥"), "The rules may {word} smoking in this area.", "这些规定可能会在这个区域{gloss}吸烟。"),
    ("verb", ("剥夺", "放逐"), "The old law could {word} people for political reasons.", "旧法律可能会因为政治原因{gloss}某些人。"),
    ("verb", ("击退", "供养"), "Warm clothes help {word} off the cold in winter.", "保暖衣物有助于在冬天抵御寒冷。"),
    ("verb", ("保护", "防护"), "A strong password can {word} your account.", "强密码可以{gloss}你的账号。"),
    ("verb", ("节省", "保存"), "Remember to {word} the file before closing the laptop.", "合上电脑前记得{gloss}文件。"),
    ("verb", ("分享",), "I like to {word} useful tips with friends.", "我喜欢和朋友{gloss}有用的小技巧。"),
    ("verb", ("解释", "说明"), "Can you {word} the rule in one simple sentence?", "你能用一句简单的话{gloss}这个规则吗？"),
    ("verb", ("讨论", "谈论"), "We can {word} the problem after class.", "下课后我们可以{gloss}这个问题。"),
    ("verb", ("安排",), "I will {word} a meeting for tomorrow morning.", "我会{gloss}明天上午的会议。"),
    ("verb", ("准备",), "I need to {word} lunch before going out.", "出门前我需要{gloss}午饭。"),
    ("verb", ("建议",), "I would {word} taking a short break.", "我会{gloss}短暂休息一下。"),
    ("verb", ("吸收",), "Plants can {word} water after rain.", "下雨后植物可以{gloss}水分。"),
    ("verb", ("废止", "废除", "取消"), "The school decided to {word} the old rule.", "学校决定{gloss}旧规定。"),
    ("verb", ("停留", "遵守"), "Please {word} by the quiet rule in the library.", "在图书馆请遵守安静规则。"),
    ("verb", ("加速", "促进"), "A clear plan can {word} our work.", "清晰的计划可以{gloss}我们的工作。"),
    ("verb", ("大量存在", "充满"), "Small shops {word} on this street.", "这条街上有很多小商店。"),
    ("verb", ("中止",), "The phone can {word} the download if the network fails.", "如果网络断开，手机可以中止下载。"),
    ("verb", ("购买",), "I plan to {word} groceries after work.", "下班后我打算{gloss}一些日用品。"),
    ("verb", ("支付", "付款"), "I can {word} with my phone at the store.", "我可以在商店用手机{gloss}。"),
    ("verb", ("借",), "Can I {word} your pen for a minute?", "我可以{gloss}你的笔用一分钟吗？"),
    ("verb", ("返回", "归还"), "Please {word} the book before Friday.", "请在周五前{gloss}这本书。"),
    ("verb", ("打开",), "Please {word} the window for fresh air.", "请{gloss}窗户透透气。"),
    ("verb", ("关闭",), "Please {word} the door when you leave.", "离开时请{gloss}门。"),
    ("verb", ("离开",), "We should {word} home before eight.", "我们应该八点前{gloss}家。"),
    ("verb", ("到达",), "I hope to {word} at the station on time.", "我希望能准时{gloss}车站。"),
    ("verb", ("等待",), "I can {word} here for ten minutes.", "我可以在这里{gloss}十分钟。"),
    ("verb", ("保持", "维持"), "Try to {word} your desk clean.", "尽量{gloss}你的书桌整洁。"),
    ("verb", ("发生",), "Accidents can {word} when people rush.", "人们着急时可能会{gloss}意外。"),
    ("verb", ("意识到", "认识到"), "I began to {word} the value of daily practice.", "我开始{gloss}每日练习的价值。"),
    ("verb", ("包括", "包含"), "The list can {word} milk, bread, and fruit.", "这份清单可以{gloss}牛奶、面包和水果。"),
    ("verb", ("描述",), "Please {word} the problem in simple words.", "请用简单的话{gloss}这个问题。"),
    ("verb", ("支持",), "My family will {word} my study plan.", "我的家人会{gloss}我的学习计划。"),
    ("verb", ("避免",), "I try to {word} noisy places when I study.", "学习时我尽量{gloss}嘈杂的地方。"),
    ("verb", ("比较",), "It helps to {word} prices before buying.", "购买前{gloss}价格会有帮助。"),
    ("verb", ("创造", "创建"), "We can {word} a simple plan together.", "我们可以一起{gloss}一个简单计划。"),
    ("verb", ("发展", "培养"), "Daily reading can {word} a good habit.", "每日阅读可以{gloss}一个好习惯。"),
    ("verb", ("允许",), "The app can {word} users to review offline.", "这个应用可以{gloss}用户离线复习。"),
    ("verb", ("提供",), "This shop can {word} a delivery service.", "这家商店可以{gloss}配送服务。"),
    ("verb", ("影响",), "Sleep can {word} your mood the next day.", "睡眠会{gloss}你第二天的心情。"),
    ("verb", ("证明",), "The receipt can {word} that you paid.", "收据可以{gloss}你已经付款。"),
    ("verb", ("处理",), "I will {word} this email after breakfast.", "早餐后我会{gloss}这封邮件。"),
    ("verb", ("连接",), "This cable can {word} the laptop to the screen.", "这根线可以把电脑{gloss}到屏幕上。"),
    ("verb", ("移动",), "Please {word} the chair closer to the table.", "请把椅子{gloss}到离桌子近一点。"),
    ("verb", ("建立",), "We should {word} a simple morning routine.", "我们应该{gloss}一个简单的晨间习惯。"),
    ("verb", ("控制",), "Try to {word} your spending this month.", "这个月尽量{gloss}你的开支。"),
    ("verb", ("参加",), "I will {word} the meeting after lunch.", "午饭后我会{gloss}会议。"),
    ("verb", ("回答", "答复"), "Please {word} the message when you have time.", "有时间时请{gloss}这条消息。"),
    ("verb", ("删除",), "Please {word} the old photo from your phone.", "请从手机里{gloss}那张旧照片。"),
    ("verb", ("寻找", "找"), "I need to {word} my keys before we go.", "出门前我需要{gloss}钥匙。"),

    ("noun", ("能力", "才能"), "Her {word} helped the team finish the task.", "她的{gloss}帮助团队完成了任务。"),
    ("noun", ("时间", "日期", "日程"), "I checked the {word} before leaving home.", "出门前我查看了{gloss}。"),
    ("noun", ("计划", "方案"), "The {word} made our morning easier.", "这个{gloss}让我们的早晨更轻松。"),
    ("noun", ("问题", "难题"), "We solved the {word} after a short talk.", "简短沟通后，我们解决了这个{gloss}。"),
    ("noun", ("机会",), "This {word} may help you learn something new.", "这个{gloss}也许能帮你学到新东西。"),
    ("noun", ("缩写词", "缩写"), "The {word} on the form was easy to understand.", "表格上的{gloss}很容易理解。"),
    ("noun", ("信息", "消息", "通路", "入口", "使用权"), "The {word} on the screen was easy to read.", "屏幕上的{gloss}很容易阅读。"),
    ("noun", ("方法", "方式"), "This {word} works well for daily review.", "这种{gloss}很适合每日复习。"),
    ("noun", ("生活",), "My {word} feels better when I sleep early.", "早睡会让我的{gloss}更好。"),
    ("noun", ("朋友", "家人", "家庭"), "My {word} called me after dinner.", "晚饭后我的{gloss}给我打了电话。"),
    ("noun", ("学校", "学院", "课程", "课堂"), "The {word} starts at nine in the morning.", "这个{gloss}早上九点开始。"),
    ("noun", ("会议",), "The {word} lasted only ten minutes.", "这场{gloss}只持续了十分钟。"),
    ("noun", ("服务",), "The {word} at the cafe was fast.", "这家咖啡店的{gloss}很快。"),
    ("noun", ("价格", "费用"), "The {word} was lower than I expected.", "这个{gloss}比我预想的低。"),
    ("noun", ("公司", "商店"), "The {word} is close to my home.", "这家{gloss}离我家很近。"),
    ("noun", ("经验", "经历"), "This {word} taught me to plan ahead.", "这次{gloss}让我学会提前计划。"),
    ("noun", ("结果",), "The {word} was better than expected.", "这个{gloss}比预期更好。"),
    ("noun", ("原因",), "The {word} was easy to understand.", "这个{gloss}很容易理解。"),
    ("noun", ("关系",), "Good {word} needs honest communication.", "好的{gloss}需要真诚沟通。"),
    ("noun", ("质量",), "The {word} of this bag is good for the price.", "按这个价格来说，这个包的{gloss}不错。"),
    ("noun", ("资源",), "The {word} helped me study at home.", "这个{gloss}帮助我在家学习。"),
    ("noun", ("安全",), "{Word} matters when you use a phone online.", "用手机上网时，{gloss}很重要。"),
    ("noun", ("健康",), "Daily walking is good for {word}.", "每天散步有利于{gloss}。"),
    ("noun", ("电脑", "计算机"), "I use my {word} to study at night.", "我晚上用{gloss}学习。"),
    ("noun", ("手机", "电话"), "My {word} is on the kitchen table.", "我的{gloss}在厨房桌上。"),
    ("noun", ("地址",), "Please write the {word} clearly on the form.", "请在表格上清楚写下{gloss}。"),
    ("noun", ("账户", "账号", "密码"), "Keep your {word} private and safe.", "请保护好你的{gloss}，不要随意公开。"),
    ("noun", ("交通",), "The {word} is busy on Monday morning.", "周一早上的{gloss}很繁忙。"),
    ("noun", ("食物", "水果", "饭"), "The {word} tasted good after work.", "下班后这份{gloss}吃起来很好。"),
    ("noun", ("清水", "饮用水"), "I keep a bottle of {word} on my desk.", "我在桌上放了一瓶{gloss}。"),
    ("noun", ("天气",), "The {word} is nice for a walk today.", "今天的{gloss}适合散步。"),
    ("noun", ("房间",), "Please clean the {word} before dinner.", "晚饭前请打扫这个{gloss}。"),
    ("noun", ("电影", "音乐", "图书", "新闻"), "I enjoyed the {word} on the way home.", "回家路上我很喜欢这个{gloss}。"),
    ("noun", ("习惯",), "This {word} helps me study every day.", "这个{gloss}帮助我每天学习。"),
    ("noun", ("选择",), "This {word} saves time in the morning.", "这个{gloss}能在早上节省时间。"),
    ("noun", ("决定",), "The {word} was hard but necessary.", "这个{gloss}很难，但有必要。"),
    ("noun", ("目标",), "My {word} is to review twenty words today.", "我的{gloss}是今天复习二十个单词。"),
    ("noun", ("规则",), "This {word} keeps the team organized.", "这个{gloss}让团队更有条理。"),
    ("noun", ("防卫", "防御"), "A good {word} keeps the account safe.", "良好的防护能保证账号安全。"),
    ("noun", ("停止",), "The bus came to a {word} near the station.", "公交车在车站附近停了下来。"),
    ("noun", ("变化",), "The {word} made the app easier to use.", "这个{gloss}让应用更容易使用。"),
    ("noun", ("差异",), "The {word} between the two plans is small.", "这两个计划之间的{gloss}很小。"),
    ("noun", ("优点",), "The main {word} is that it saves time.", "主要{gloss}是它能节省时间。"),
    ("noun", ("缺点",), "The only {word} is the long wait.", "唯一的{gloss}是等待时间较长。"),
    ("noun", ("声音",), "The {word} from the phone was clear.", "手机里的{gloss}很清楚。"),
    ("noun", ("图片", "图像", "照片"), "The {word} looks bright on the screen.", "屏幕上的{gloss}看起来很明亮。"),
    ("noun", ("能源", "能量"), "Breakfast gives me {word} for the morning.", "早餐给了我上午需要的{gloss}。"),
    ("noun", ("设备", "工具"), "This {word} is useful in the kitchen.", "这个{gloss}在厨房里很有用。"),
    ("noun", ("材料",), "The {word} feels soft and strong.", "这种{gloss}摸起来柔软又结实。"),
    ("noun", ("市场",), "The {word} is busy on weekends.", "周末这个{gloss}很热闹。"),
    ("noun", ("文化",), "Local {word} makes travel more interesting.", "当地{gloss}让旅行更有趣。"),
    ("noun", ("环境",), "A quiet {word} helps me focus.", "安静的{gloss}能帮助我集中注意力。"),
    ("noun", ("过程",), "The {word} is simple if you follow each step.", "如果按步骤来，这个{gloss}很简单。"),
    ("noun", ("系统",), "The {word} saves my progress automatically.", "这个{gloss}会自动保存我的进度。"),
    ("noun", ("数据",), "The {word} is stored on my computer.", "这些{gloss}保存在我的电脑上。"),
    ("noun", ("研究",), "The {word} helps us understand the problem.", "这项{gloss}帮助我们理解问题。"),
    ("noun", ("报告",), "I finished the {word} before the meeting.", "我在会议前完成了这份{gloss}。"),
    ("noun", ("清单", "名单"), "I checked the {word} before shopping.", "购物前我查看了{gloss}。"),
    ("noun", ("车票", "门票"), "I bought the {word} on my phone.", "我用手机买了这张{gloss}。"),
    ("noun", ("汽车",), "The {word} stopped near the station.", "这辆{gloss}停在车站附近。"),
    ("noun", ("钱", "现金", "银行"), "I keep some {word} for small purchases.", "我留一些{gloss}用于小额消费。"),
    ("noun", ("空气",), "Fresh {word} makes the room comfortable.", "新鲜{gloss}让房间更舒服。"),
    ("noun", ("灯光", "光线"), "The {word} in this room is soft.", "这个房间里的{gloss}很柔和。"),
    ("noun", ("颜色",), "The {word} matches my notebook.", "这个{gloss}和我的笔记本很配。"),
    ("noun", ("尺寸", "大小"), "The {word} fits in my bag.", "这个{gloss}适合放进我的包里。"),
    ("noun", ("位置", "地点"), "The {word} is easy to find on the map.", "这个{gloss}在地图上很容易找到。"),
    ("noun", ("姓名", "名字"), "Please write your {word} clearly.", "请清楚写下你的{gloss}。"),
    ("noun", ("数字", "号码"), "Please check the {word} before calling.", "打电话前请核对这个{gloss}。"),
    ("noun", ("温度",), "The {word} is comfortable today.", "今天的{gloss}很舒服。"),
    ("noun", ("压力",), "A short walk can reduce {word}.", "短暂散步可以减轻{gloss}。"),
    ("noun", ("风险",), "The {word} is low if you follow the instructions.", "如果按说明操作，{gloss}很低。"),
    ("noun", ("需求",), "The {word} is clear after we talk to users.", "和用户沟通后，{gloss}就清楚了。"),
    ("noun", ("状态", "情况", "条件", "情形"), "The {word} changed after a short rest.", "短暂休息后，{gloss}发生了变化。"),
    ("noun", ("行为", "活动", "动作"), "This {word} took only a few minutes.", "这个{gloss}只花了几分钟。"),
    ("noun", ("人员", "的人", "者", "师", "员"), "The {word} helped me at the front desk.", "前台的这位{gloss}帮助了我。"),
    ("noun", ("地方", "地区", "国家", "城市", "区域"), "This {word} is easy to find on the map.", "这个{gloss}在地图上很容易找到。"),
    ("noun", ("东西", "物品", "产品", "机器"), "I put the {word} on the table before leaving.", "离开前我把这个{gloss}放在桌上。"),
    ("noun", ("感觉", "情绪", "心情"), "A short walk improved my {word}.", "短暂散步改善了我的{gloss}。"),
    ("noun", ("水平", "程度", "数量", "速度", "距离", "长度", "重量", "比例"), "Please check the {word} before you write the answer.", "写答案前请核对这个{gloss}。"),
    ("noun", ("语言", "单词", "句子", "文字", "文章", "故事"), "I read the {word} on the bus this morning.", "今天早上我在公交车上读了这段{gloss}。"),
    ("noun", ("工作", "任务", "职业", "职责"), "The {word} took most of the morning.", "这项{gloss}花了上午大部分时间。"),
    ("noun", ("组织", "机构", "政府", "部门"), "The {word} sent a notice this morning.", "这个{gloss}今天早上发了一条通知。"),

    ("adjective", ("重要",), "This {word} note should stay at the top of the list.", "这条{gloss}的备注应该放在清单最上面。"),
    ("adjective", ("容易", "简单"), "This {word} recipe is good for busy nights.", "这个{gloss}的食谱适合忙碌的晚上。"),
    ("adjective", ("困难", "艰难"), "The {word} part is starting, so I do it first.", "{gloss}的部分是开始，所以我先做它。"),
    ("adjective", ("安全",), "This {word} route is better at night.", "晚上走这条{gloss}的路线更好。"),
    ("adjective", ("健康",), "A {word} breakfast helps me focus.", "{gloss}的早餐能帮助我集中注意力。"),
    ("adjective", ("便宜", "廉价"), "This {word} lunch still tastes good.", "这份{gloss}的午餐味道仍然不错。"),
    ("adjective", ("昂贵", "贵"), "The {word} option is not always the best.", "{gloss}的选择不一定总是最好的。"),
    ("adjective", ("干净",), "A {word} desk helps me study.", "{gloss}的书桌能帮助我学习。"),
    ("adjective", ("脏",), "Put the {word} clothes in the basket.", "把{gloss}的衣服放进篮子里。"),
    ("adjective", ("快", "迅速"), "A {word} reply saves time.", "{gloss}的回复能节省时间。"),
    ("adjective", ("慢",), "A {word} walk after dinner is relaxing.", "晚饭后{gloss}地散步很放松。"),
    ("adjective", ("学术", "学院"), "This {word} article is short and clear.", "这篇学术文章简短清楚。"),
    ("adjective", ("丰富", "充分", "大量"), "The park has {word} space for a walk.", "这个公园有{gloss}的散步空间。"),
    ("adjective", ("抽象",), "A simple drawing made the {word} idea easier to remember.", "一张简单图画让这个{gloss}的想法更容易记住。"),
    ("adjective", ("突然", "唐突"), "The {word} change surprised everyone in the room.", "这个{gloss}的变化让房间里每个人都很惊讶。"),
    ("adjective", ("荒谬", "可笑"), "The {word} excuse made everyone laugh.", "这个{gloss}的借口让大家都笑了。"),
    ("adjective", ("可接受",), "This {word} plan works for both of us.", "这个{gloss}的计划对我们两个人都合适。"),
    ("adjective", ("缺席", "不在"), "The {word} student asked for the notes later.", "{gloss}的学生后来要了笔记。"),
    ("adjective", ("新鲜", "新的"), "I bought a {word} notebook for class.", "我为上课买了一个{gloss}的笔记本。"),
    ("adjective", ("旧的",), "I keep my {word} phone as a backup.", "我把{gloss}的手机留作备用。"),
    ("adjective", ("安静",), "A {word} room helps me remember words.", "{gloss}的房间有助于我背单词。"),
    ("adjective", ("忙碌",), "I had a {word} morning at work.", "我今天上午工作很{gloss}。"),
    ("adjective", ("可用",), "This {word} feature works offline.", "这个{gloss}的功能可以离线使用。"),
    ("adjective", ("有用",), "This {word} tip saves me time.", "这个{gloss}的小技巧帮我节省时间。"),
    ("adjective", ("必要",), "A {word} break can help you focus.", "{gloss}的休息能帮助你集中注意力。"),
    ("adjective", ("相同",), "We chose the {word} answer.", "我们选择了{gloss}的答案。"),
    ("adjective", ("不同",), "Try a {word} method if this one is hard.", "如果这个方法难，就试试{gloss}的方法。"),
    ("adjective", ("明显",), "The {word} change made the text easier to read.", "这个{gloss}的变化让文字更容易阅读。"),
    ("adjective", ("可能",), "A {word} solution is to study ten minutes a day.", "一个{gloss}的办法是每天学习十分钟。"),
    ("adjective", ("普通", "常见"), "A {word} example is easier to remember.", "{gloss}的例子更容易记住。"),
    ("adjective", ("特别", "特殊"), "I wrote the {word} date on my calendar.", "我把这个{gloss}的日期写在日历上。"),
    ("adjective", ("正确",), "Choose the {word} answer before moving on.", "继续之前请选择{gloss}的答案。"),
    ("adjective", ("错误",), "The {word} address sent me to the wrong place.", "{gloss}的地址把我带到了错误的地方。"),
    ("adjective", ("完整",), "Please send the {word} file before noon.", "请在中午前发送{gloss}的文件。"),
    ("adjective", ("空的",), "The {word} cup is on the table.", "{gloss}的杯子在桌上。"),
    ("adjective", ("满的",), "The {word} bag is heavy.", "{gloss}的包很重。"),
    ("adjective", ("热的",), "A {word} drink feels good in winter.", "冬天喝一杯{gloss}的饮品很舒服。"),
    ("adjective", ("冷的",), "A {word} shower wakes me up.", "{gloss}的淋浴能让我清醒。"),
    ("adjective", ("高的",), "The {word} price made me wait.", "{gloss}的价格让我决定先等等。"),
    ("adjective", ("低的",), "The {word} battery warning appeared on my phone.", "手机出现了电量{gloss}的提醒。"),
    ("adjective", ("大的",), "A {word} screen is easier to read.", "{gloss}的屏幕更容易阅读。"),
    ("adjective", ("小的",), "A {word} bag is enough for today.", "{gloss}的包今天就够用了。"),
    ("adjective", ("反常", "异常", "不正常", "畸形"), "The {word} noise made me check the machine.", "这个{gloss}的声音让我检查了机器。"),
    ("adjective", ("年度", "每年"), "The {word} report arrived this morning.", "这份{gloss}报告今天早上到了。"),
    ("adjective", ("正式",), "Please use a {word} tone in the email.", "请在邮件中使用{gloss}的语气。"),
    ("adjective", ("私人的", "个人"), "Keep your {word} notes in a safe place.", "把你的{gloss}笔记放在安全的地方。"),
    ("adjective", ("公共",), "This {word} room is open until nine.", "这个{gloss}房间开放到九点。"),

    ("adverb", ("完全", "绝对"), "I {word} agree with your plan.", "我{gloss}同意你的计划。"),
    ("adverb", ("快速", "迅速"), "She answered {word} and went back to work.", "她{gloss}回答后又回去工作了。"),
    ("adverb", ("慢慢", "缓慢"), "Walk {word} on the wet floor.", "地板湿的时候要{gloss}走。"),
    ("adverb", ("经常", "常常"), "I {word} review words before bed.", "我{gloss}在睡前复习单词。"),
    ("adverb", ("有时",), "I {word} study at a cafe.", "我{gloss}在咖啡馆学习。"),
    ("adverb", ("从不",), "I {word} share my password.", "我{gloss}分享自己的密码。"),
    ("adverb", ("已经",), "I have {word} finished today's review.", "我{gloss}完成了今天的复习。"),
    ("adverb", ("几乎",), "I {word} missed the bus this morning.", "今天早上我{gloss}错过公交车。"),
    ("adverb", ("立即", "马上"), "Please reply {word} if it is urgent.", "如果事情紧急，请{gloss}回复。"),
    ("adverb", ("最近",), "I have {word} started reading in English.", "我{gloss}开始读英文材料。"),
    ("adverb", ("一起",), "We cooked dinner {word} after work.", "下班后我们{gloss}做晚饭。"),
]

FALLBACKS = {
    "verb": (
        ("I tried to {word} the idea in a simple sentence.", "我试着用一个简单句子{gloss}这个想法。"),
        ("Please {word} it once during today's review.", "请在今天复习时练习一次如何{gloss}。"),
        ("I wrote a short note to remember how to {word}.", "我写了一条短笔记来记住如何{gloss}。"),
    ),
    "noun": (
        ("I wrote {word} next to its meaning in my notebook.", "我把表示{gloss}的词写在笔记本释义旁边。"),
        ("The word {word} appeared in my reading this morning.", "今天早上的阅读里出现了表示{gloss}的这个词。"),
        ("I made a short card for {word} before lunch.", "午饭前我为表示{gloss}的这个词做了一张小卡片。"),
    ),
    "adjective": (
        ("I wrote a {word} note in my daily review.", "我在每日复习里写下了一个表示{gloss}的短句。"),
        ("The {word} word was easier to remember with a simple example.", "这个表示{gloss}的词配上简单例子后更容易记住。"),
        ("I used {word} to describe a small detail today.", "我今天用这个词描述了一个{gloss}的小细节。"),
    ),
    "adverb": (
        ("I used {word} in a short message to a friend.", "我在给朋友的短消息中用了这个表示{gloss}的词。"),
        ("Please read the sentence {word} during review.", "复习时请用表示{gloss}的方式读这个句子。"),
        ("I added {word} to a simple sentence in my notebook.", "我把这个表示{gloss}的词加进了笔记本里的简单句。"),
    ),
    "connector": (
        ("I noticed {word} while reading a short message.", "我读一条短消息时注意到了这个词。"),
        ("The word {word} helped connect two simple ideas.", "这个词帮助连接了两个简单想法。"),
        ("I copied a sentence with {word} into my notebook.", "我把含有这个词的句子抄进了笔记本。"),
    ),
}

SPECIAL_EXAMPLES = {
    "i.e.": ("I wrote a short note, i.e. a reminder for myself.", "我写了一张简短便条，也就是给自己的提醒。"),
    "b.c.": ("The museum label said the cup was made in 200 B.C.", "博物馆标签上写着这个杯子制作于公元前200年。"),
    "abnormal": ("The abnormal sound made me stop the machine.", "异常的声音让我停下了机器。"),
    "aboard": ("We went aboard the train just before it left.", "火车开走前，我们刚好上了车。"),
    "absence": ("Her absence from the meeting was easy to notice.", "她缺席会议很容易被注意到。"),
    "defend": ("She learned to defend her opinion calmly.", "她学会了冷静地为自己的观点辩护。"),
    "fend": ("A warm coat can help fend off the cold wind.", "一件暖和的外套可以帮助抵御冷风。"),
    "indemnify": ("The insurance policy may indemnify you for the loss.", "这份保险可能会赔偿你的损失。"),
    "proscribe": ("The school rules proscribe smoking on campus.", "学校规定禁止在校园内吸烟。"),
}


def first_pos(meaning):
    match = re.match(r"\s*([a-z]+)\.", meaning.lower())
    return match.group(1) if match else "unknown"


def pos_group(pos):
    for group, values in POS_GROUPS.items():
        if pos in values:
            return group
    return "connector"


def clean_gloss(meaning):
    text = re.sub(r"\[[^\]]+\]", "", meaning)
    text = re.sub(r"\b(vt|vi|v|n|pl|a|adj|adv|prep|conj|pron|num|aux|abbr|int|interj)\.", "", text, flags=re.I)
    text = text.replace("\\n", "\n").replace("\\", "")
    parts = re.split(r"[,，;；\n]", text)
    for part in parts:
        value = re.sub(r"[A-Za-z0-9.()'\-/]+", "", part).strip()
        value = value.strip(" 的，。；;、")
        if re.search(r"[\u4e00-\u9fff]", value):
            return value[:16]
    return "这个词"


def render(template, word, gloss):
    rendered = template.format(word=word, Word=word[:1].upper() + word[1:], gloss=gloss)
    return re.sub(r"\bA ([aeiouAEIOU])", r"An \1", rendered)


def choose_fallback(group, word):
    variants = FALLBACKS[group]
    index = sum(ord(char) for char in word.lower()) % len(variants)
    return variants[index]


def choose_example(item):
    word = item["word"].strip()
    lower_word = word.lower()
    if lower_word in SPECIAL_EXAMPLES:
        return (*SPECIAL_EXAMPLES[lower_word], "special")

    meaning = item.get("meaning", "")
    group = pos_group(first_pos(meaning))
    gloss = clean_gloss(meaning)
    for rule_group, keywords, example_template, translation_template in RULES:
        if rule_group == group and any(keyword in meaning for keyword in keywords):
            return render(example_template, word, gloss), render(translation_template, word, gloss), "rule"

    example_template, translation_template = choose_fallback(group, word)
    return render(example_template, word, gloss), render(translation_template, word, gloss), "fallback"


def update_word_file(path):
    data = json.loads(path.read_text(encoding="utf-8-sig"))
    counts = {"rule": 0, "fallback": 0, "special": 0}
    for item in data:
        example, translation, source = choose_example(item)
        item["example"] = example
        item["exampleTranslation"] = translation
        counts[source] += 1
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return len(data), counts


def update_metadata():
    path = WORDS_DIR / "metadata.json"
    metadata = json.loads(path.read_text(encoding="utf-8-sig"))
    metadata["currentStatus"] = "ecdict-exam-tagged-wordbanks-with-generated-examples"
    metadata["exampleGeneratedFrom"] = "scripts/generate_practical_examples.py"
    metadata["exampleGeneratedDate"] = date.today().isoformat()
    metadata["fieldNotes"]["example"] = (
        "Generated locally from each word's part of speech and Chinese meaning; "
        "not copied from an external example corpus."
    )
    metadata["fieldNotes"]["exampleTranslation"] = "Generated Chinese translation paired with the local example sentence."
    path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main():
    totals = {"entries": 0, "rule": 0, "fallback": 0, "special": 0}
    for filename in WORD_FILES:
        count, counts = update_word_file(WORDS_DIR / filename)
        totals["entries"] += count
        for key, value in counts.items():
            totals[key] += value
        print(f"{filename}: {count} entries, rule={counts['rule']}, fallback={counts['fallback']}, special={counts['special']}")
    update_metadata()
    print(
        "Total: {entries} entries, rule={rule}, fallback={fallback}, special={special}".format(**totals)
    )


if __name__ == "__main__":
    main()
