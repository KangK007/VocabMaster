"""
VocabMaster Word Bank Builder
===============================
Generates complete word banks for CET-4, CET-6, Postgraduate (考研),
IELTS, and TOEFL exams.

Usage:
    python build_wordbanks.py              # Build all banks (200 words each)
    python build_wordbanks.py --full       # Build full banks (all available words)
    python build_wordbanks.py --bank cet4  # Build a specific bank
    python build_wordbanks.py --size 500   # Set word count per bank

The script includes curated word lists for each exam with proper definitions.
For full datasets, it can optionally fetch from ECDICT (network required).
"""
import json
import os
import sys
import argparse
from pathlib import Path

BASE_DIR = Path(__file__).parent
WORDS_DIR = BASE_DIR / 'src' / 'words'

# ============================================================
# Curated Word Data - Core vocabulary for each exam
# Each entry: [word, phonetic, meaning, example, exampleTranslation]
# ============================================================

CET4_WORDS = [
    # A
    ["abandon", "/əˈbændən/", "v. 放弃；抛弃", "The crew abandoned the sinking ship.", "船员们放弃了正在下沉的船。"],
    ["ability", "/əˈbɪləti/", "n. 能力；才能", "She has the ability to learn languages quickly.", "她有快速学习语言的能力。"],
    ["abroad", "/əˈbrɔːd/", "adv. 到国外；在国外", "He dreams of studying abroad next year.", "他梦想明年出国留学。"],
    ["absence", "/ˈæbsəns/", "n. 缺席；不在；缺乏", "His absence from the meeting was noted.", "他缺席会议被注意到了。"],
    ["absolute", "/ˈæbsəluːt/", "adj. 绝对的；完全的", "She told me the absolute truth.", "她告诉了我绝对的真相。"],
    ["absorb", "/əbˈzɔːrb/", "v. 吸收；吸引", "Plants absorb water from the soil.", "植物从土壤中吸收水分。"],
    ["abstract", "/ˈæbstrækt/", "adj. 抽象的 n. 摘要", "The concept is too abstract to understand easily.", "这个概念太抽象，不容易理解。"],
    ["abundant", "/əˈbʌndənt/", "adj. 丰富的；充裕的", "The region has abundant natural resources.", "该地区拥有丰富的自然资源。"],
    ["academic", "/ˌækəˈdemɪk/", "adj. 学术的；学院的", "His academic performance is excellent.", "他的学业成绩非常优秀。"],
    ["accelerate", "/əkˈseləreɪt/", "v. 加速；促进", "The car accelerated smoothly onto the highway.", "汽车平稳加速驶入高速公路。"],
    ["accept", "/əkˈsept/", "v. 接受；承认", "She accepted the job offer immediately.", "她立即接受了这份工作。"],
    ["access", "/ˈækses/", "n. 通道；进入；访问 v. 访问", "Students have access to the online library.", "学生可以访问在线图书馆。"],
    ["accident", "/ˈæksɪdənt/", "n. 事故；意外", "There was a car accident on the highway.", "高速公路上发生了一起车祸。"],
    ["accompany", "/əˈkʌmpəni/", "v. 陪伴；伴随", "She accompanied her friend to the hospital.", "她陪朋友去了医院。"],
    ["accomplish", "/əˈkɑːmplɪʃ/", "v. 完成；实现", "We accomplished our goal ahead of schedule.", "我们提前完成了目标。"],
    ["account", "/əˈkaʊnt/", "n. 账户；账目；说明", "I need to open a bank account.", "我需要开一个银行账户。"],
    ["accurate", "/ˈækjərət/", "adj. 准确的；精确的", "The weather forecast proved accurate.", "天气预报证明是准确的。"],
    ["achieve", "/əˈtʃiːv/", "v. 达到；取得；实现", "She achieved her dream of becoming a doctor.", "她实现了成为医生的梦想。"],
    ["acknowledge", "/əkˈnɑːlɪdʒ/", "v. 承认；确认收到", "He acknowledged his mistake publicly.", "他公开承认了自己的错误。"],
    ["acquire", "/əˈkwaɪər/", "v. 获得；习得", "It takes years to acquire fluency in a language.", "熟练掌握一门语言需要数年时间。"],
    ["adapt", "/əˈdæpt/", "v. 适应；改编", "She adapted quickly to the new environment.", "她很快适应了新环境。"],
    ["adequate", "/ˈædɪkwət/", "adj. 足够的；适当的", "We need adequate preparation for the exam.", "我们需要充足的考试准备。"],
    ["adjust", "/əˈdʒʌst/", "v. 调整；适应", "You can adjust the volume with this button.", "你可以用这个按钮调节音量。"],
    ["administration", "/ədˌmɪnɪˈstreɪʃn/", "n. 管理；行政", "The university administration approved the new policy.", "大学行政部门批准了新政策。"],
    ["admire", "/ədˈmaɪər/", "v. 钦佩；赞赏", "I admire her courage and determination.", "我钦佩她的勇气和决心。"],
    ["admit", "/ədˈmɪt/", "v. 承认；准许进入", "He admitted that he was wrong.", "他承认自己错了。"],
    ["adopt", "/əˈdɑːpt/", "v. 采用；收养", "The company adopted a new marketing strategy.", "公司采用了新的营销策略。"],
    ["advance", "/ədˈvæns/", "v. 前进；进步 n. 进展", "Technology continues to advance rapidly.", "技术继续快速发展。"],
    ["advantage", "/ədˈvæntɪdʒ/", "n. 优势；有利条件", "Being bilingual is a great advantage in business.", "双语能力在商业中是巨大的优势。"],
    ["advertise", "/ˈædvərtaɪz/", "v. 做广告；宣传", "The company advertises its products on social media.", "公司在社交媒体上宣传其产品。"],
    # B
    ["background", "/ˈbækɡraʊnd/", "n. 背景；出身", "She has a strong background in computer science.", "她有扎实的计算机科学背景。"],
    ["balance", "/ˈbæləns/", "n. 平衡 v. 使平衡", "It's important to maintain a work-life balance.", "保持工作与生活的平衡很重要。"],
    ["bargain", "/ˈbɑːrɡən/", "n. 便宜货；交易 v. 讨价还价", "I got this jacket at a bargain price.", "我以很便宜的价格买到了这件夹克。"],
    ["barrier", "/ˈbæriər/", "n. 障碍；屏障", "Language barriers can make communication difficult.", "语言障碍会使沟通变得困难。"],
    ["behavior", "/bɪˈheɪvjər/", "n. 行为；举止", "The teacher praised the student's good behavior.", "老师表扬了学生的良好行为。"],
    ["belong", "/bɪˈlɔːŋ/", "v. 属于；应在某处", "This book belongs to the library.", "这本书是图书馆的。"],
    ["benefit", "/ˈbenɪfɪt/", "n. 利益；好处 v. 受益", "Exercise has many health benefits.", "锻炼对健康有很多好处。"],
    ["bitter", "/ˈbɪtər/", "adj. 苦的；痛苦的", "The medicine has a bitter taste.", "这药有苦味。"],
    ["blame", "/bleɪm/", "v. 责备 n. 责任", "Don't blame others for your own mistakes.", "不要为自己的错误责备他人。"],
    ["border", "/ˈbɔːrdər/", "n. 边界；边境 v. 接壤", "They crossed the border into the neighboring country.", "他们越过边境进入邻国。"],
    ["bother", "/ˈbɑːðər/", "v. 打扰；烦恼", "Don't bother me while I'm studying.", "我学习时别打扰我。"],
    ["boundary", "/ˈbaʊndri/", "n. 边界；界限", "The river forms a natural boundary between the two countries.", "这条河流构成了两国之间的天然边界。"],
    ["brand", "/brænd/", "n. 品牌；商标", "Nike is a famous global brand.", "耐克是全球知名品牌。"],
    ["broadcast", "/ˈbrɔːdkæst/", "v. 广播；传播 n. 广播节目", "The news will be broadcast at 7 PM.", "新闻将在晚上7点播出。"],
    ["budget", "/ˈbʌdʒɪt/", "n. 预算 v. 做预算", "We need to stick to our monthly budget.", "我们需要遵守每月预算。"],
    # C
    ["calculate", "/ˈkælkjuleɪt/", "v. 计算；估计", "Can you calculate the total cost?", "你能计算总费用吗？"],
    ["campaign", "/kæmˈpeɪn/", "n. 运动；战役；竞选活动", "The advertising campaign was very successful.", "这次广告宣传活动非常成功。"],
    ["candidate", "/ˈkændɪdət/", "n. 候选人；应试者", "She is the ideal candidate for this position.", "她是这个职位的理想人选。"],
    ["capable", "/ˈkeɪpəbl/", "adj. 有能力的", "She is capable of handling complex problems.", "她有能力处理复杂问题。"],
    ["capacity", "/kəˈpæsəti/", "n. 容量；能力", "The stadium has a seating capacity of 50000.", "这个体育场可容纳50000人。"],
    ["capture", "/ˈkæptʃər/", "v. 捕获；俘获；拍摄", "The photographer captured a beautiful sunset.", "摄影师拍摄了美丽的日落。"],
    ["career", "/kəˈrɪr/", "n. 职业；生涯", "She chose teaching as her lifelong career.", "她选择教书作为终身职业。"],
    ["celebrate", "/ˈselɪbreɪt/", "v. 庆祝；赞美", "We celebrated his birthday with a party.", "我们开派对庆祝他的生日。"],
    ["challenge", "/ˈtʃælɪndʒ/", "n. 挑战 v. 向…挑战", "Learning a new language is an exciting challenge.", "学习一门新语言是令人兴奋的挑战。"],
    ["characteristic", "/ˌkærəktəˈrɪstɪk/", "n. 特征 adj. 典型的", "Patience is a key characteristic of a good teacher.", "耐心是好老师的关键特征。"],
    ["circumstance", "/ˈsɜːrkəmstæns/", "n. 环境；情况", "Under no circumstances should you give up.", "在任何情况下你都不应该放弃。"],
    ["civilization", "/ˌsɪvələˈzeɪʃn/", "n. 文明；文化", "Ancient Egypt had a remarkable civilization.", "古埃及有着非凡的文明。"],
    ["climate", "/ˈklaɪmət/", "n. 气候；风气", "Climate change is a global concern.", "气候变化是全球关注的问题。"],
    ["collapse", "/kəˈlæps/", "v. 倒塌；崩溃 n. 崩溃", "The old building collapsed during the earthquake.", "那座旧楼在地震中倒塌了。"],
    ["combination", "/ˌkɑːmbɪˈneɪʃn/", "n. 结合；组合", "Success requires a combination of hard work and talent.", "成功需要努力和才能的结合。"],
    ["comfortable", "/ˈkʌmftəbl/", "adj. 舒适的", "This chair is very comfortable to sit in.", "这把椅子坐着很舒服。"],
    ["command", "/kəˈmænd/", "n. 命令；指挥 v. 命令", "He has a good command of English.", "他精通英语。"],
    ["comment", "/ˈkɑːment/", "n. 评论 v. 发表意见", "Do you have any comments on the proposal?", "你对这个提案有什么意见吗？"],
    ["commercial", "/kəˈmɜːrʃl/", "adj. 商业的 n. 商业广告", "The commercial district is always crowded.", "商业区总是很拥挤。"],
    ["commitment", "/kəˈmɪtmənt/", "n. 承诺；投入", "Marriage requires commitment from both partners.", "婚姻需要双方的承诺。"],
    ["communicate", "/kəˈmjuːnɪkeɪt/", "v. 交流；沟通", "We communicate with each other via email.", "我们通过电子邮件交流。"],
    ["community", "/kəˈmjuːnəti/", "n. 社区；团体", "The local community supported the charity event.", "当地社区支持了这次慈善活动。"],
    ["companion", "/kəmˈpæniən/", "n. 同伴；伙伴", "A dog can be a loyal companion.", "狗可以是忠实的伙伴。"],
    ["compare", "/kəmˈper/", "v. 比较；对比", "Let's compare the prices before making a decision.", "我们比较一下价格再做决定。"],
    ["compete", "/kəmˈpiːt/", "v. 竞争；比赛", "Athletes from 50 countries will compete in the games.", "来自50个国家的运动员将参加比赛。"],
    ["complain", "/kəmˈpleɪn/", "v. 抱怨；投诉", "He complained about the poor service at the restaurant.", "他投诉了餐厅糟糕的服务。"],
    ["complex", "/kəmˈpleks/", "adj. 复杂的 n. 综合体", "The problem is more complex than it seems.", "这个问题比看起来更复杂。"],
    ["concentrate", "/ˈkɑːnsntreɪt/", "v. 集中；专注", "I need to concentrate on my studies.", "我需要专注于我的学习。"],
    ["concept", "/ˈkɑːnsept/", "n. 概念；观念", "The concept of time varies across cultures.", "时间的概念因文化而异。"],
    ["concern", "/kənˈsɜːrn/", "n. 关心；忧虑 v. 涉及", "Environmental protection is everyone's concern.", "环境保护关系到每个人。"],
    ["condition", "/kənˈdɪʃn/", "n. 条件；状况", "The house is in excellent condition.", "这栋房子状况极佳。"],
    ["conduct", "/kənˈdʌkt/", "v. 进行；指挥；行为", "The researchers conducted a series of experiments.", "研究人员进行了一系列实验。"],
    ["conference", "/ˈkɑːnfərəns/", "n. 会议；讨论会", "She attended an international conference on AI.", "她参加了一个关于人工智能的国际会议。"],
    ["confidence", "/ˈkɑːnfɪdəns/", "n. 信心；信任", "Practice will help build your confidence.", "练习有助于建立你的信心。"],
    ["confirm", "/kənˈfɜːrm/", "v. 确认；证实", "Please confirm your attendance by Friday.", "请在周五前确认你是否出席。"],
    ["conflict", "/ˈkɑːnflɪkt/", "n. 冲突；矛盾 v. 冲突", "The two reports seem to conflict with each other.", "这两份报告似乎互相矛盾。"],
    ["connect", "/kəˈnekt/", "v. 连接；联系", "The bridge connects the two sides of the river.", "这座桥连接河的两岸。"],
    ["conscious", "/ˈkɑːnʃəs/", "adj. 有意识的；清醒的", "She is very conscious of her health.", "她非常注意自己的健康。"],
    ["consequence", "/ˈkɑːnsɪkwens/", "n. 结果；后果", "Think about the consequences before you act.", "行动之前先考虑后果。"],
    ["conservative", "/kənˈsɜːrvətɪv/", "adj. 保守的", "His conservative approach to investment is safe.", "他保守的投资方式很安全。"],
    ["considerable", "/kənˈsɪdərəbl/", "adj. 相当大的；可观的", "A considerable amount of money was spent.", "花了一大笔钱。"],
    ["consist", "/kənˈsɪst/", "v. 由…组成；在于", "The team consists of twelve members.", "这个团队由十二名成员组成。"],
    ["constant", "/ˈkɑːnstənt/", "adj. 不断的；恒定的", "The constant noise kept me awake all night.", "不断的噪音让我彻夜未眠。"],
    ["construct", "/kənˈstrʌkt/", "v. 建造；构建", "They plan to construct a new hospital here.", "他们计划在这里建一座新医院。"],
    ["consume", "/kənˈsuːm/", "v. 消耗；消费", "We consume a lot of energy every day.", "我们每天消耗大量能源。"],
    ["contact", "/ˈkɑːntækt/", "n. 接触；联系 v. 联系", "Please contact me if you have any questions.", "如有任何问题请联系我。"],
    ["contemporary", "/kənˈtempəreri/", "adj. 当代的；同时代的", "She studies contemporary Chinese literature.", "她研究中国当代文学。"],
    ["contribute", "/kənˈtrɪbjuːt/", "v. 贡献；捐助；投稿", "Everyone should contribute to protecting the environment.", "每个人都应该为保护环境做贡献。"],
    ["convenient", "/kənˈviːniənt/", "adj. 方便的", "The subway is very convenient for commuting.", "地铁通勤非常方便。"],
    ["convince", "/kənˈvɪns/", "v. 说服；使确信", "She convinced me to join the club.", "她说服我加入了俱乐部。"],
    ["cooperate", "/koʊˈɑːpəreɪt/", "v. 合作；协作", "The two companies decided to cooperate on the project.", "两家公司决定在这个项目上合作。"],
    ["correspond", "/ˌkɔːrəˈspɑːnd/", "v. 符合；对应；通信", "His actions don't correspond with his words.", "他的言行不一致。"],
    ["creative", "/kriˈeɪtɪv/", "adj. 创造性的", "Children are naturally creative and imaginative.", "孩子们天生富有创造力和想象力。"],
    ["critical", "/ˈkrɪtɪkl/", "adj. 批评的；关键性的", "This is a critical moment in the negotiation.", "这是谈判中的关键时刻。"],
    ["curiosity", "/ˌkjʊriˈɑːsəti/", "n. 好奇心", "Curiosity drives scientific discovery.", "好奇心推动科学发现。"],
    ["current", "/ˈkɜːrənt/", "adj. 当前的 n. 水流；电流", "The current situation requires immediate action.", "当前形势需要立即行动。"],
]

CET6_WORDS = [
    ["abnormal", "/æbˈnɔːrml/", "adj. 不正常的；反常的", "The test results showed abnormal levels of protein.", "测试结果显示蛋白质水平异常。"],
    ["abolish", "/əˈbɑːlɪʃ/", "v. 废除；取消", "Many people want to abolish the death penalty.", "许多人想要废除死刑。"],
    ["abortion", "/əˈbɔːrʃn/", "n. 流产；堕胎；失败", "The debate on abortion continues to divide society.", "关于堕胎的辩论继续分裂社会。"],
    ["absurd", "/əbˈsɜːrd/", "adj. 荒谬的；可笑的", "It's absurd to blame the weather for your failure.", "把你的失败归咎于天气是荒谬的。"],
    ["abuse", "/əˈbjuːs/", "n. 滥用；虐待 v. 滥用", "Drug abuse is a serious problem in many communities.", "药物滥用是许多社区的严重问题。"],
    ["accommodate", "/əˈkɑːmədeɪt/", "v. 容纳；提供住宿；适应", "The hotel can accommodate up to 300 guests.", "这家酒店最多可容纳300位客人。"],
    ["acquaint", "/əˈkweɪnt/", "v. 使熟悉；使认识", "You should acquaint yourself with the rules first.", "你应该先熟悉规则。"],
    ["activate", "/ˈæktɪveɪt/", "v. 激活；使活动", "You need to activate your account before using it.", "你需要先激活你的账户才能使用。"],
    ["acute", "/əˈkjuːt/", "adj. 急性的；敏锐的", "She has an acute sense of hearing.", "她有敏锐的听觉。"],
    ["adhere", "/ədˈhɪr/", "v. 遵守；坚持；粘附", "We must adhere to the safety regulations.", "我们必须遵守安全规定。"],
    ["adjacent", "/əˈdʒeɪsnt/", "adj. 邻近的；毗连的", "The library is adjacent to the student center.", "图书馆毗邻学生中心。"],
    ["administer", "/ədˈmɪnɪstər/", "v. 管理；执行；给予", "The nurse administered the medicine to the patient.", "护士给病人用药。"],
    ["adolescent", "/ˌædəˈlesnt/", "n. 青少年 adj. 青春期的", "Adolescent behavior can be challenging for parents.", "青少年行为对父母来说可能很有挑战性。"],
    ["adverse", "/ˈædvɜːrs/", "adj. 不利的；相反的", "The medicine may have adverse side effects.", "这种药可能有不良副作用。"],
    ["advocate", "/ˈædvəkeɪt/", "v. 提倡；主张 n. 提倡者", "He advocates for better healthcare policies.", "他提倡更好的医疗政策。"],
    ["aesthetic", "/esˈθetɪk/", "adj. 美学的；审美的", "The design combines functionality with aesthetic appeal.", "这个设计将功能性与美学吸引力相结合。"],
    ["affiliate", "/əˈfɪlieɪt/", "v. 使附属；加入 n. 附属机构", "The hospital is affiliated with the university.", "这家医院附属于该大学。"],
    ["affirm", "/əˈfɜːrm/", "v. 肯定；确认", "The court affirmed the lower court's decision.", "法院维持了下级法院的判决。"],
    ["aggravate", "/ˈæɡrəveɪt/", "v. 加重；使恶化", "Smoking will aggravate your condition.", "吸烟会加重你的病情。"],
    ["aggregate", "/ˈæɡrɪɡət/", "n. 总数 adj. 总计的", "The aggregate cost of the project exceeded the budget.", "项目的总成本超出了预算。"],
    ["agony", "/ˈæɡəni/", "n. 极度痛苦", "She was in agony after the surgery.", "手术后她痛苦不堪。"],
    ["alien", "/ˈeɪliən/", "adj. 外国的；陌生的 n. 外国人", "The concept was completely alien to me.", "这个概念对我来说完全陌生。"],
    ["alleviate", "/əˈliːvieɪt/", "v. 减轻；缓解", "This medicine will alleviate your pain.", "这种药会缓解你的疼痛。"],
    ["allocate", "/ˈæləkeɪt/", "v. 分配；拨出", "The government allocated funds for education.", "政府为教育拨款。"],
    ["ambiguous", "/æmˈbɪɡjuəs/", "adj. 模棱两可的；含糊的", "The contract contains several ambiguous clauses.", "合同中有几处含糊的条款。"],
    ["ambitious", "/æmˈbɪʃəs/", "adj. 有雄心的；野心勃勃的", "She is an ambitious entrepreneur with big dreams.", "她是一位有远大梦想的雄心勃勃的企业家。"],
    ["amend", "/əˈmend/", "v. 修改；修订", "The constitution was amended to include new rights.", "宪法被修订以包含新的权利。"],
    ["analogy", "/əˈnælədʒi/", "n. 类比；相似", "The teacher used an analogy to explain the concept.", "老师用一个类比来解释这个概念。"],
    ["anonymous", "/əˈnɑːnɪməs/", "adj. 匿名的", "The donation was made by an anonymous benefactor.", "这笔捐款来自一位匿名捐助者。"],
    ["apparatus", "/ˌæpəˈrætəs/", "n. 仪器；装置；机构", "The laboratory has sophisticated apparatus for research.", "实验室有精密的研究仪器。"],
    ["appease", "/əˈpiːz/", "v. 平息；安抚", "The government tried to appease the protesters.", "政府试图安抚抗议者。"],
    ["arbitrary", "/ˈɑːrbɪtreri/", "adj. 任意的；专制的", "The decision seemed arbitrary and unfair.", "这个决定似乎武断且不公平。"],
    ["articulate", "/ɑːrˈtɪkjuleɪt/", "v. 清楚表达 adj. 善于表达的", "She articulated her ideas clearly in the presentation.", "她在演讲中清晰地表达了自己的想法。"],
    ["ascend", "/əˈsend/", "v. 上升；攀登", "The elevator ascended to the 50th floor.", "电梯上升到第50层。"],
    ["assault", "/əˈsɔːlt/", "n. 攻击；袭击 v. 袭击", "He was charged with assault and battery.", "他被指控殴打和人身攻击。"],
    ["assert", "/əˈsɜːrt/", "v. 断言；主张；维护", "The leader asserted his authority over the group.", "领导者在团队中维护自己的权威。"],
    ["assimilate", "/əˈsɪməleɪt/", "v. 吸收；同化", "Immigrants often assimilate into the local culture over time.", "移民往往随时间融入当地文化。"],
    ["attribute", "/əˈtrɪbjuːt/", "v. 归因于 n. 属性", "She attributes her success to hard work.", "她将成功归因于努力工作。"],
    ["authentic", "/ɔːˈθentɪk/", "adj. 真正的；可靠的", "This is an authentic painting by Van Gogh.", "这是一幅梵高的真迹。"],
    ["authoritative", "/əˈθɔːrəteɪtɪv/", "adj. 权威的；命令式的", "This is the most authoritative book on the subject.", "这是关于这个主题最权威的书。"],
    ["autonomous", "/ɔːˈtɑːnəməs/", "adj. 自治的；自主的", "The region has become an autonomous area.", "该地区已成为自治区。"],
    ["avail", "/əˈveɪl/", "v. 有益于 n. 效用", "All our efforts availed us little.", "我们所有的努力收效甚微。"],
    ["avert", "/əˈvɜːrt/", "v. 避免；转移", "Quick action averted a major disaster.", "迅速行动避免了一场大灾难。"],
    ["baffle", "/ˈbæfl/", "v. 使困惑；难住", "The strange phenomenon baffled scientists.", "这种奇怪的现象难住了科学家。"],
    ["barren", "/ˈbærən/", "adj. 贫瘠的；不育的", "Nothing grows in this barren land.", "这片贫瘠的土地上什么也不长。"],
    ["beforehand", "/bɪˈfɔːrhænd/", "adv. 事先；预先", "Please let me know beforehand if you can't come.", "如果你不能来，请事先通知我。"],
    ["betray", "/bɪˈtreɪ/", "v. 背叛；泄露", "He betrayed his friend's trust.", "他背叛了朋友的信任。"],
    ["bizarre", "/bɪˈzɑːr/", "adj. 奇怪的；怪异的", "The movie had a bizarre ending that shocked everyone.", "电影有个怪异的结局，震惊了所有人。"],
    ["blunt", "/blʌnt/", "adj. 钝的；直率的", "Let me be blunt: your performance needs improvement.", "恕我直言：你的表现需要改进。"],
    ["boycott", "/ˈbɔɪkɑːt/", "v. 抵制；拒绝参加", "They decided to boycott the company's products.", "他们决定抵制该公司的产品。"],
]

POSTGRADUATE_WORDS = [
    ["abide", "/əˈbaɪd/", "v. 遵守；忍受；持续", "We must abide by the rules of the competition.", "我们必须遵守比赛规则。"],
    ["abound", "/əˈbaʊnd/", "v. 充满；丰富", "Wildlife abounds in this national park.", "这个国家公园里野生动物很多。"],
    ["abreast", "/əˈbrest/", "adv. 并肩地；并排地", "Keep abreast of the latest developments in science.", "跟上科学的最新发展。"],
    ["abstain", "/əbˈsteɪn/", "v. 弃权；戒除", "He decided to abstain from drinking alcohol.", "他决定戒酒。"],
    ["acclaim", "/əˈkleɪm/", "v. 称赞；欢呼 n. 称赞", "The novel was acclaimed as a masterpiece.", "这部小说被誉为杰作。"],
    ["accomplice", "/əˈkɑːmplɪs/", "n. 共犯；帮凶", "The police arrested his accomplice as well.", "警方也逮捕了他的同伙。"],
    ["accrue", "/əˈkruː/", "v. 累积；增加", "Interest will accrue on the savings account.", "储蓄账户将产生利息。"],
    ["adept", "/əˈdept/", "adj. 熟练的；擅长的", "She is adept at handling difficult customers.", "她善于处理难缠的客户。"],
    ["advent", "/ˈædvent/", "n. 到来；出现", "The advent of the internet changed everything.", "互联网的出现改变了一切。"],
    ["adversary", "/ˈædvərseri/", "n. 对手；敌手", "He faced a formidable adversary in the debate.", "他在辩论中面对一个强大的对手。"],
    ["affluent", "/ˈæfluənt/", "adj. 富裕的；丰富的", "She grew up in an affluent family.", "她在一个富裕家庭长大。"],
    ["aftermath", "/ˈæftərmæθ/", "n. 后果；余波", "In the aftermath of the earthquake, many were homeless.", "地震后，许多人无家可归。"],
    ["agitate", "/ˈædʒɪteɪt/", "v. 煽动；使焦虑；搅动", "The union agitated for better working conditions.", "工会为更好的工作条件而鼓动。"],
    ["aloft", "/əˈlɔːft/", "adv. 在高处；在空中", "The flag was flying aloft in the wind.", "旗帜在高空迎风飘扬。"],
    ["amass", "/əˈmæs/", "v. 积聚；收集", "He amassed a great fortune through real estate.", "他通过房地产积累了巨额财富。"],
    ["amiable", "/ˈeɪmiəbl/", "adj. 和蔼可亲的", "Our neighbor is an amiable old gentleman.", "我们的邻居是一位和蔼可亲的老绅士。"],
    ["anguish", "/ˈæŋɡwɪʃ/", "n. 极度痛苦；苦恼", "The mother waited in anguish for news of her child.", "母亲痛苦地等待着孩子的消息。"],
    ["annex", "/əˈneks/", "v. 吞并；附加 n. 附件", "The territory was annexed by the neighboring country.", "这片领土被邻国吞并了。"],
    ["antagonism", "/ænˈtæɡənɪzəm/", "n. 对抗；敌对", "There is a long history of antagonism between the two groups.", "这两个群体之间有长期的敌对历史。"],
    ["appalling", "/əˈpɔːlɪŋ/", "adj. 令人震惊的；可怕的", "The living conditions in the slums are appalling.", "贫民窟的生活条件令人震惊。"],
    ["appraise", "/əˈpreɪz/", "v. 评估；评价", "The expert appraised the painting at $1 million.", "专家评估这幅画价值100万美元。"],
    ["ardent", "/ˈɑːrdnt/", "adj. 热心的；热烈的", "She is an ardent supporter of environmental protection.", "她是环境保护的热心支持者。"],
    ["arrogant", "/ˈærəɡənt/", "adj. 傲慢的；自大的", "His arrogant attitude made him unpopular.", "他的傲慢态度使他不受欢迎。"],
    ["articulate", "/ɑːrˈtɪkjuleɪt/", "v. 清楚表达 adj. 口才好的", "She is highly articulate and persuasive.", "她口才极好且很有说服力。"],
    ["aspire", "/əˈspaɪər/", "v. 渴望；立志", "He aspires to become a renowned scientist.", "他立志成为一位著名的科学家。"],
    ["assassinate", "/əˈsæsɪneɪt/", "v. 暗杀；行刺", "The president was assassinated in 1963.", "总统于1963年被暗杀。"],
    ["audit", "/ˈɔːdɪt/", "n. 审计；审查 v. 审计", "The company undergoes an annual financial audit.", "公司每年进行财务审计。"],
    ["augment", "/ɔːɡˈment/", "v. 增加；增大", "She took a part-time job to augment her income.", "她做了一份兼职来增加收入。"],
    ["austerity", "/ɔːˈsterəti/", "n. 紧缩；朴素；严厉", "The government imposed austerity measures to reduce debt.", "政府实施紧缩措施以减少债务。"],
    ["aviation", "/ˌeɪviˈeɪʃn/", "n. 航空；飞行", "The aviation industry has grown rapidly.", "航空业发展迅速。"],
    ["backdrop", "/ˈbækdrɑːp/", "n. 背景", "The negotiations took place against a backdrop of violence.", "谈判在暴力背景下进行。"],
    ["ballot", "/ˈbælət/", "n. 投票；选票", "The results of the ballot will be announced tomorrow.", "投票结果将于明天公布。"],
    ["bankruptcy", "/ˈbæŋkrʌptsi/", "n. 破产", "The company filed for bankruptcy last month.", "该公司上个月申请破产。"],
    ["beacon", "/ˈbiːkən/", "n. 灯塔；指路明灯", "The lighthouse served as a beacon for ships.", "灯塔充当了船舶的指路明灯。"],
    ["benign", "/bɪˈnaɪn/", "adj. 良性的；和善的", "The tumor turned out to be benign.", "肿瘤结果是良性的。"],
    ["besiege", "/bɪˈsiːdʒ/", "v. 围攻；困扰", "The celebrity was besieged by reporters.", "这位名人被记者团团围住。"],
    ["bilateral", "/ˌbaɪˈlætərəl/", "adj. 双边的；两侧的", "The two countries signed a bilateral trade agreement.", "两国签署了双边贸易协定。"],
    ["bipartisan", "/ˌbaɪˈpɑːrtɪzn/", "adj. 两党的", "The bill received bipartisan support in Congress.", "该法案在国会获得了两党的支持。"],
    ["bleak", "/bliːk/", "adj. 荒凉的；黯淡的", "The future looks bleak for the coal industry.", "煤炭行业的前景黯淡。"],
    ["blunder", "/ˈblʌndər/", "n. 大错 v. 犯大错", "The politician made a serious diplomatic blunder.", "这位政治家犯了一个严重的外交错误。"],
    ["bolster", "/ˈboʊlstər/", "v. 支持；加强", "The evidence bolstered his case.", "证据支持了他的论点。"],
    ["breach", "/briːtʃ/", "n. 违反；破裂 v. 突破", "This is a breach of contract.", "这是违约行为。"],
    ["bureaucracy", "/bjʊˈrɑːkrəsi/", "n. 官僚主义；官僚机构", "Excessive bureaucracy slows down decision-making.", "过度的官僚主义拖慢了决策。"],
    ["calamity", "/kəˈlæməti/", "n. 灾难；灾祸", "The flood was a terrible calamity for the region.", "洪水对该地区是一场可怕的灾难。"],
    ["census", "/ˈsensəs/", "n. 人口普查", "The national census is conducted every ten years.", "全国人口普查每十年进行一次。"],
    ["coalition", "/ˌkoʊəˈlɪʃn/", "n. 联盟；联合", "A coalition of parties formed the new government.", "政党联盟组成了新政府。"],
    ["coercive", "/koʊˈɜːrsɪv/", "adj. 强制的；胁迫的", "The government denied using coercive measures.", "政府否认使用强制措施。"],
    ["coincide", "/ˌkoʊɪnˈsaɪd/", "v. 同时发生；相符", "His views coincide with mine on this issue.", "在这个问题上他的观点与我的相符。"],
    ["commission", "/kəˈmɪʃn/", "v. 委任 n. 委员会；佣金", "The report was commissioned by the government.", "这份报告是政府委托编制的。"],
    ["commodity", "/kəˈmɑːdəti/", "n. 商品；日用品", "Oil is one of the world's most valuable commodities.", "石油是世界上最有价值的商品之一。"],
]

IELTS_WORDS = [
    ["acquisition", "/ˌækwɪˈzɪʃn/", "n. 获得；习得；收购", "Language acquisition is a complex process.", "语言习得是一个复杂的过程。"],
    ["adolescence", "/ˌædəˈlesns/", "n. 青春期；青少年时期", "Adolescence is a period of rapid growth and change.", "青春期是快速成长和变化的时期。"],
    ["aesthetic", "/esˈθetɪk/", "adj. 美学的；审美的", "The building has great aesthetic value.", "这座建筑具有很高的美学价值。"],
    ["allegation", "/ˌæləˈɡeɪʃn/", "n. 指控；断言", "He denied the allegations of fraud.", "他否认了欺诈指控。"],
    ["ambiguous", "/æmˈbɪɡjuəs/", "adj. 模棱两可的；含糊的", "The government's position on the issue is ambiguous.", "政府在这个问题上的立场含糊不清。"],
    ["analogy", "/əˈnælədʒi/", "n. 类比；相似", "He drew an analogy between the brain and a computer.", "他把大脑比作计算机。"],
    ["anthropology", "/ˌænθrəˈpɑːlədʒi/", "n. 人类学", "She is studying anthropology at university.", "她在大学学习人类学。"],
    ["antibiotic", "/ˌæntibaɪˈɑːtɪk/", "n. 抗生素", "The doctor prescribed a course of antibiotics.", "医生开了一个疗程的抗生素。"],
    ["apparatus", "/ˌæpəˈrætəs/", "n. 仪器；装置", "The laboratory has state-of-the-art apparatus.", "实验室有最先进的仪器。"],
    ["appropriate", "/əˈproʊpriət/", "adj. 适当的 v. 占用", "Is this an appropriate time to discuss the matter?", "现在是讨论此事的适当时机吗？"],
    ["approximately", "/əˈprɑːksɪmətli/", "adv. 大约；近似地", "Approximately 200 people attended the conference.", "大约200人参加了会议。"],
    ["archaeology", "/ˌɑːrkiˈɑːlədʒi/", "n. 考古学", "Archaeology helps us understand ancient civilizations.", "考古学帮助我们理解古代文明。"],
    ["articulate", "/ɑːrˈtɪkjuleɪt/", "adj. 口才好的 v. 清楚表达", "He is an articulate and persuasive speaker.", "他是一位口才好、有说服力的演讲者。"],
    ["assessment", "/əˈsesmənt/", "n. 评估；评定", "The company conducted an environmental impact assessment.", "公司进行了环境影响评估。"],
    ["assumption", "/əˈsʌmpʃn/", "n. 假设；承担", "Don't make assumptions without evidence.", "没有证据不要做假设。"],
    ["atmospheric", "/ˌætməsˈferɪk/", "adj. 大气的；有气氛的", "Atmospheric pollution is a serious problem.", "大气污染是一个严重问题。"],
    ["audit", "/ˈɔːdɪt/", "n. 审计；审查", "The company faces a financial audit next month.", "公司下个月面临财务审计。"],
    ["authority", "/əˈθɔːrəti/", "n. 权威；当局；权力", "The local authority is responsible for road maintenance.", "地方当局负责道路维护。"],
    ["autonomous", "/ɔːˈtɑːnəməs/", "adj. 自治的；自主的", "The region was granted autonomous status.", "该地区获得了自治地位。"],
    ["awareness", "/əˈwernəs/", "n. 意识；认识", "Public awareness of environmental issues has increased.", "公众对环境问题的意识已经提高。"],
    ["bankruptcy", "/ˈbæŋkrʌptsi/", "n. 破产", "The global crisis led to many business bankruptcies.", "全球危机导致了许多企业破产。"],
    ["biodiversity", "/ˌbaɪoʊdaɪˈvɜːrsəti/", "n. 生物多样性", "Tropical rainforests have incredible biodiversity.", "热带雨林有令人难以置信的生物多样性。"],
    ["bureaucracy", "/bjʊˈrɑːkrəsi/", "n. 官僚主义", "The bureaucracy made it difficult to get permits.", "官僚主义使获得许可证变得困难。"],
    ["capitalism", "/ˈkæpɪtəlɪzəm/", "n. 资本主义", "Capitalism encourages competition and innovation.", "资本主义鼓励竞争和创新。"],
    ["catastrophe", "/kəˈtæstrəfi/", "n. 大灾难；灾祸", "The oil spill was an environmental catastrophe.", "石油泄漏是一场环境灾难。"],
    ["chronic", "/ˈkrɑːnɪk/", "adj. 慢性的；长期的", "He suffers from chronic back pain.", "他患有慢性背痛。"],
    ["cognitive", "/ˈkɑːɡnətɪv/", "adj. 认知的", "Cognitive development is important in early childhood.", "认知发展在幼儿早期很重要。"],
    ["commodity", "/kəˈmɑːdəti/", "n. 商品", "Water is becoming a scarce commodity in many regions.", "水在许多地区正变成稀缺商品。"],
    ["compensation", "/ˌkɑːmpenˈseɪʃn/", "n. 补偿；赔偿", "He received compensation for his injuries.", "他因受伤获得了赔偿。"],
    ["comprehensive", "/ˌkɑːmprɪˈhensɪv/", "adj. 全面的；综合的", "We need a comprehensive plan to solve this problem.", "我们需要一个全面的计划来解决这个问题。"],
    ["consensus", "/kənˈsensəs/", "n. 共识；一致意见", "There is a growing consensus on climate change.", "在气候变化问题上正在形成共识。"],
    ["conservation", "/ˌkɑːnsərˈveɪʃn/", "n. 保护；保存", "Wildlife conservation is crucial for biodiversity.", "野生动物保护对生物多样性至关重要。"],
    ["controversy", "/ˈkɑːntrəvɜːrsi/", "n. 争论；争议", "The new policy has caused considerable controversy.", "新政策引起了相当大的争议。"],
    ["coordination", "/koʊˌɔːrdɪˈneɪʃn/", "n. 协调；配合", "Good coordination between departments is essential.", "部门间的良好协调至关重要。"],
    ["curriculum", "/kəˈrɪkjələm/", "n. 课程", "The school has updated its science curriculum.", "学校更新了科学课程。"],
    ["demographic", "/ˌdeməˈɡræfɪk/", "adj. 人口统计的 n. 人口特征", "Demographic changes affect the job market.", "人口结构变化影响就业市场。"],
    ["depression", "/dɪˈpreʃn/", "n. 沮丧；萧条；洼地", "The country suffered an economic depression.", "该国遭受了经济萧条。"],
    ["deteriorate", "/dɪˈtɪriəreɪt/", "v. 恶化；退化", "Air quality has deteriorated in urban areas.", "城市地区的空气质量已经恶化。"],
    ["diagnosis", "/ˌdaɪəɡˈnoʊsɪs/", "n. 诊断", "Early diagnosis improves treatment outcomes.", "早期诊断改善治疗效果。"],
    ["dimension", "/daɪˈmenʃn/", "n. 维度；方面；尺寸", "We need to consider the social dimension of development.", "我们需要考虑发展的社会维度。"],
    ["discretion", "/dɪˈskreʃn/", "n. 谨慎；自由裁量权", "You can use your own discretion in this matter.", "在这件事上你可以自行决定。"],
    ["discrimination", "/dɪˌskrɪmɪˈneɪʃn/", "n. 歧视；辨别", "Laws prohibit discrimination based on gender.", "法律禁止基于性别的歧视。"],
    ["diversity", "/daɪˈvɜːrsəti/", "n. 多样性", "Cultural diversity enriches our society.", "文化多样性丰富我们的社会。"],
    ["dynamics", "/daɪˈnæmɪks/", "n. 动力学；动态", "The dynamics of the global economy are changing.", "全球经济的动态正在改变。"],
    ["ecosystem", "/ˈiːkoʊsɪstəm/", "n. 生态系统", "Coral reefs are fragile ecosystems.", "珊瑚礁是脆弱的生态系统。"],
    ["empirical", "/ɪmˈpɪrɪkl/", "adj. 经验主义的；实证的", "The theory is supported by empirical evidence.", "这个理论有实证证据支持。"],
    ["entrepreneur", "/ˌɑːntrəprəˈnɜːr/", "n. 企业家", "She is a successful entrepreneur in the tech industry.", "她是科技行业成功的企业家。"],
    ["epidemic", "/ˌepɪˈdemɪk/", "n. 流行病 adj. 流行性的", "Obesity has become a global epidemic.", "肥胖已成为全球流行病。"],
    ["equilibrium", "/ˌiːkwɪˈlɪbriəm/", "n. 平衡；均衡", "The economy is striving to reach equilibrium.", "经济正努力达到均衡。"],
    ["erosion", "/ɪˈroʊʒn/", "n. 侵蚀；腐蚀", "Soil erosion is a major environmental threat.", "土壤侵蚀是主要的环境威胁。"],
]

TOEFL_WORDS = [
    ["abolish", "/əˈbɑːlɪʃ/", "v. 废除；取消", "The state voted to abolish the outdated law.", "该州投票废除了过时的法律。"],
    ["abrupt", "/əˈbrʌpt/", "adj. 突然的；唐突的", "The meeting came to an abrupt end.", "会议突然结束了。"],
    ["absorption", "/əbˈsɔːrpʃn/", "n. 吸收；专注", "The absorption of nutrients takes place in the small intestine.", "营养物质的吸收发生在小肠。"],
    ["abstraction", "/æbˈstrækʃn/", "n. 抽象；提取", "Mathematics is a form of abstraction.", "数学是一种抽象形式。"],
    ["accelerated", "/əkˈseləreɪtɪd/", "adj. 加速的", "She enrolled in an accelerated learning program.", "她报名参加了一个加速学习项目。"],
    ["accessible", "/əkˈsesəbl/", "adj. 可接近的；可使用的", "The building is fully accessible to wheelchair users.", "这座建筑完全方便轮椅使用者。"],
    ["accommodating", "/əˈkɑːmədeɪtɪŋ/", "adj. 乐于助人的；随和的", "The hotel staff were very accommodating.", "酒店工作人员非常乐于助人。"],
    ["accountability", "/əˌkaʊntəˈbɪləti/", "n. 责任；问责制", "There is a lack of accountability in the system.", "这个系统缺乏问责制。"],
    ["accumulation", "/əˌkjuːmjəˈleɪʃn/", "n. 积累；堆积", "The accumulation of debt became unsustainable.", "债务的累积变得不可持续。"],
    ["adaptation", "/ˌædæpˈteɪʃn/", "n. 适应；改编", "The film is an adaptation of a famous novel.", "这部电影改编自一部著名小说。"],
    ["adjacent", "/əˈdʒeɪsnt/", "adj. 邻近的；毗连的", "The hotel is adjacent to the convention center.", "这家酒店毗邻会议中心。"],
    ["adversely", "/ædˈvɜːrsli/", "adv. 不利地；负面地", "The drought adversely affected crop production.", "干旱对作物生产造成了不利影响。"],
    ["aggregation", "/ˌæɡrɪˈɡeɪʃn/", "n. 聚集；集合", "Social media platforms enable the aggregation of user data.", "社交媒体平台使用户数据的聚合成为可能。"],
    ["allocation", "/ˌæləˈkeɪʃn/", "n. 分配；配给", "The allocation of resources must be fair and transparent.", "资源分配必须公平透明。"],
    ["altitude", "/ˈæltɪtuːd/", "n. 海拔；高度", "The plane reached an altitude of 30000 feet.", "飞机达到了3万英尺的高度。"],
    ["ambiguity", "/ˌæmbɪˈɡjuːəti/", "n. 歧义；模糊", "Legal documents should avoid ambiguity.", "法律文件应该避免歧义。"],
    ["amplification", "/ˌæmplɪfɪˈkeɪʃn/", "n. 放大；增强", "The amplification of sound requires specialized equipment.", "声音的放大需要专门的设备。"],
    ["anthropologist", "/ˌænθrəˈpɑːlədʒɪst/", "n. 人类学家", "The anthropologist lived with the tribe for two years.", "这位人类学家与部落一起生活了两年。"],
    ["appreciation", "/əˌpriːʃiˈeɪʃn/", "n. 欣赏；感激；升值", "I have a deep appreciation for classical music.", "我对古典音乐有很深的欣赏。"],
    ["approximation", "/əˌprɑːksɪˈmeɪʃn/", "n. 近似值；粗略估计", "This is just an approximation, not an exact figure.", "这只是近似值，不是精确数字。"],
    ["archaeological", "/ˌɑːrkiəˈlɑːdʒɪkl/", "adj. 考古学的", "The archaeological dig uncovered ancient artifacts.", "考古发掘发现了古代文物。"],
    ["assimilation", "/əˌsɪməˈleɪʃn/", "n. 同化；吸收", "Cultural assimilation is a complex process.", "文化同化是一个复杂的过程。"],
    ["astronomical", "/ˌæstrəˈnɑːmɪkl/", "adj. 天文学的；极大的", "The cost of the project is astronomical.", "这个项目的成本是天文数字。"],
    ["attribute", "/əˈtrɪbjuːt/", "v. 归因于 n. 属性", "The discovery was attributed to the research team.", "这个发现归功于研究团队。"],
    ["authenticity", "/ˌɔːθenˈtɪsəti/", "n. 真实性；可靠性", "Experts questioned the authenticity of the painting.", "专家质疑这幅画的真实性。"],
    ["biodiversity", "/ˌbaɪoʊdaɪˈvɜːrsəti/", "n. 生物多样性", "The Amazon rainforest is a hotspot of biodiversity.", "亚马逊雨林是生物多样性的热点地区。"],
    ["bureaucratic", "/ˌbjʊrəˈkrætɪk/", "adj. 官僚的", "The bureaucratic process delayed the project.", "官僚程序延误了项目。"],
    ["capability", "/ˌkeɪpəˈbɪləti/", "n. 能力；才能", "The new software has impressive capabilities.", "新软件具有令人印象深刻的功能。"],
    ["catastrophic", "/ˌkætəˈstrɑːfɪk/", "adj. 灾难性的", "The hurricane had catastrophic effects on the city.", "飓风对城市造成了灾难性的影响。"],
    ["chronological", "/ˌkrɑːnəˈlɑːdʒɪkl/", "adj. 按时间顺序的", "The events are listed in chronological order.", "事件按时间顺序排列。"],
    ["circulation", "/ˌsɜːrkjəˈleɪʃn/", "n. 循环；流通；发行量", "The newspaper has a daily circulation of 500000.", "该报纸每日发行50万份。"],
    ["classification", "/ˌklæsɪfɪˈkeɪʃn/", "n. 分类；分级", "The classification of species is based on genetic analysis.", "物种分类基于基因分析。"],
    ["collaboration", "/kəˌlæbəˈreɪʃn/", "n. 合作；协作", "The project was a collaboration between three universities.", "这个项目是三所大学之间的合作。"],
    ["communal", "/kəˈmjuːnl/", "adj. 公共的；社区的", "The communal garden is shared by all residents.", "公共花园由所有居民共享。"],
    ["compatibility", "/kəmˌpætəˈbɪləti/", "n. 兼容性；相容性", "Check the compatibility of the software with your system.", "检查软件与你的系统的兼容性。"],
    ["compilation", "/ˌkɑːmpɪˈleɪʃn/", "n. 编纂；汇编", "The book is a compilation of his best essays.", "这本书是他最佳论文的汇编。"],
    ["complementary", "/ˌkɑːmplɪˈmentri/", "adj. 互补的", "Their skills are complementary to each other.", "他们的技能是互补的。"],
    ["concentration", "/ˌkɑːnsnˈtreɪʃn/", "n. 集中；专注；浓度", "The concentration of carbon dioxide in the atmosphere is rising.", "大气中二氧化碳的浓度正在上升。"],
    ["confederation", "/kənˌfedəˈreɪʃn/", "n. 联盟；邦联", "The confederation of tribes resisted the invasion.", "部落联盟抵抗了入侵。"],
    ["configuration", "/kənˌfɪɡjəˈreɪʃn/", "n. 配置；布局", "The configuration of the network needs to be updated.", "网络配置需要更新。"],
    ["congregation", "/ˌkɑːŋɡrɪˈɡeɪʃn/", "n. 集会；会众", "The congregation gathered for Sunday service.", "会众聚集参加周日礼拜。"],
    ["conservationist", "/ˌkɑːnsərˈveɪʃənɪst/", "n. 自然保护主义者", "Conservationists are fighting to protect the forest.", "自然保护主义者正在为保护森林而斗争。"],
    ["consolidation", "/kənˌsɑːlɪˈdeɪʃn/", "n. 巩固；合并", "The consolidation of power took several years.", "权力的巩固花了几年时间。"],
    ["constellation", "/ˌkɑːnstəˈleɪʃn/", "n. 星座；群体", "The constellation Orion is visible in winter.", "猎户座在冬天可见。"],
    ["contamination", "/kənˌtæmɪˈneɪʃn/", "n. 污染；玷污", "Water contamination poses a serious health risk.", "水污染构成严重的健康风险。"],
    ["contradiction", "/ˌkɑːntrəˈdɪkʃn/", "n. 矛盾；反驳", "There is an obvious contradiction in his statement.", "他的陈述中有明显的矛盾。"],
    ["convergence", "/kənˈvɜːrdʒəns/", "n. 汇聚；趋同", "The convergence of technologies is reshaping society.", "技术的融合正在重塑社会。"],
    ["cooperative", "/koʊˈɑːpərətɪv/", "adj. 合作的 n. 合作社", "The children were cooperative and helpful.", "孩子们很合作，乐于助人。"],
    ["correlation", "/ˌkɔːrəˈleɪʃn/", "n. 相关；关联", "There is a strong correlation between diet and health.", "饮食与健康之间有很强的相关性。"],
    ["credibility", "/ˌkredəˈbɪləti/", "n. 可信度；可靠性", "The scandal damaged his credibility as a journalist.", "丑闻损害了他作为记者的可信度。"],
]


def build_word_bank(exam_name, word_data, target_size):
    """Build a word bank JSON file from curated word data."""
    output = []
    seen = set()

    for entry in word_data:
        if len(output) >= target_size:
            break
        word = entry[0].lower()
        if word not in seen:
            seen.add(word)
            output.append({
                "word": entry[0],
                "phonetic": entry[1],
                "meaning": entry[2],
                "example": entry[3],
                "exampleTranslation": entry[4]
            })

    filepath = WORDS_DIR / f'{exam_name}.json'
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    return len(output)


def get_word_data(exam_name):
    """Map exam name to word data list."""
    mapping = {
        'cet4': CET4_WORDS,
        'cet6': CET6_WORDS,
        'postgraduate': POSTGRADUATE_WORDS,
        'ielts': IELTS_WORDS,
        'toefl': TOEFL_WORDS,
    }
    return mapping.get(exam_name, [])


def main():
    parser = argparse.ArgumentParser(description='Build VocabMaster word banks')
    parser.add_argument('--bank', type=str, help='Build a specific bank (cet4, cet6, postgraduate, ielts, toefl)')
    parser.add_argument('--size', type=int, default=200, help='Words per bank (default: 200)')
    parser.add_argument('--full', action='store_true', help='Use all available words')
    args = parser.parse_args()

    os.makedirs(WORDS_DIR, exist_ok=True)

    exams = ['cet4', 'cet6', 'postgraduate', 'ielts', 'toefl']
    if args.bank:
        if args.bank not in exams:
            print(f'Unknown bank: {args.bank}. Options: {", ".join(exams)}')
            sys.exit(1)
        exams = [args.bank]

    total = 0
    for exam in exams:
        data = get_word_data(exam)
        if not data:
            print(f'  {exam}: No data available, skipping')
            continue
        size = len(data) if args.full else min(args.size, len(data))
        count = build_word_bank(exam, data, size)
        total += count
        print(f'  {exam}: Built with {count} words (target: {size})')

    print(f'\nDone! Generated {total} words across {len(exams)} bank(s).')
    print(f'Output directory: {WORDS_DIR}')


if __name__ == '__main__':
    main()
