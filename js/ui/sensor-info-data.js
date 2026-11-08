/* SensorCraft 传感器教学说明：给中学生的原理、用途与数据结构。
 * 经典脚本，无 import/export；由 js/ui 的说明弹窗读取。
 * 数据字段与单位以各卡片源码实际显示为准。 */
(function (SC) {
  'use strict';
  SC.core.sensorInfoData = {
    'accelerometer': {
      intro: '测手机在三个方向上受力的传感器，静止时也能测到重力。',
      principle: [
        '加速度计里面有个很小的质量块，连着弹簧。手机加速时，质量块会因为惯性落后一步，弹簧被拉长或压短，芯片量出这个变化，就知道加速度有多大。',
        '实际上它用的是微机电系统，也就是把弹簧和质量块做到芯片上，比米粒还小。手机平放静止时，z 轴会读到约 9.8，因为它一直在和重力较劲。'
      ],
      uses: ['计步：走路时上下起伏的规律就是步数', '横竖屏自动旋转', '摇一摇换歌或抽奖', '掉落检测：自由落体时读数接近 0', '当地震仪，记录桌面的晃动'],
      data: [
        { field: '合矢量', unit: 'm/s²', meaning: '三个方向加速度合起来的大小', example: '9.8' },
        { field: 'X / Y / Z', unit: 'm/s²', meaning: '左右 / 前后 / 上下三个方向的加速度', example: '0.0 / 0.0 / 9.8' },
        { field: '步数', unit: '步', meaning: '从起伏规律里数出来的步数，是近似值', example: '12' },
        { field: '采样间隔', unit: 'ms', meaning: '两次读数之间隔了多久', example: '16' },
        { field: '峰值', unit: 'm/s²', meaning: '这次采集里合矢量冲到的最大值', example: '12.4' }
      ],
      tryIt: '把手机平放，看 z 是不是接近 9.8，再轻轻晃一晃。',
      diagram: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><rect width="320" height="180" fill="#1b1b1f"/><rect x="30" y="25" width="110" height="130" fill="#2a2a32" shape-rendering="crispEdges"/><rect x="60" y="55" width="50" height="70" fill="#2a2a32" stroke="#7fff2a" stroke-width="2" shape-rendering="crispEdges"/><line x1="85" y1="125" x2="85" y2="165" stroke="#ff4d4d" stroke-width="3"/><polygon points="85,172 78,160 92,160" fill="#ff4d4d"/><line x1="110" y1="90" x2="150" y2="90" stroke="#7fff2a" stroke-width="3"/><polygon points="157,90 145,83 145,97" fill="#7fff2a"/><line x1="85" y1="55" x2="85" y2="15" stroke="#4a6cff" stroke-width="3"/><polygon points="85,8 78,20 92,20" fill="#4a6cff"/><text x="160" y="95" fill="#f2f2f2" font-size="12" font-family="sans-serif">X 左右</text><text x="160" y="40" fill="#f2f2f2" font-size="12" font-family="sans-serif">Z 上下 9.8</text><text x="160" y="140" fill="#f2f2f2" font-size="12" font-family="sans-serif">Y 前后</text><rect x="200" y="30" width="90" height="60" fill="#2a2a32" shape-rendering="crispEdges"/><line x1="205" y1="60" x2="285" y2="60" stroke="#ffd700" stroke-width="2"/><rect x="235" y="48" width="24" height="24" fill="#ffd700" shape-rendering="crispEdges"/><text x="200" y="105" fill="#b8b8b8" font-size="11" font-family="sans-serif">弹簧质量块</text><text x="200" y="125" fill="#b8b8b8" font-size="11" font-family="sans-serif">手机一动它就落后</text></svg>'
    },
    'biometrics': {
      intro: '网页拿不到你的脸和指纹，只能请系统帮忙验证一下。',
      principle: [
        '脸和指纹存在手机的安全区里，JavaScript 碰不到。网页只能向系统发一个请求：请验证一下这个人。系统用指纹或面部识别比对，通过就回一个通过，不通过就回不通过。',
        '网页永远看不到你的脸长什么样，也拿不到指纹图像。用来登录网站的这套标准叫 WebAuthn，俗称通行密钥。它只能做认证，不能做采集。'
      ],
      uses: ['网站免密码登录', '付款前确认是你本人', '重要操作的二次验证', '解锁 App 时代替输密码'],
      data: [
        { field: '生物数据', unit: '—', meaning: '脸或指纹的原始数据，网页永远读不到', example: '不可读取' },
        { field: '系统认证', unit: '—', meaning: '网页能用的认证标准', example: 'WebAuthn' },
        { field: '平台', unit: '—', meaning: '存生物特征的手机安全区', example: '系统安全区' },
        { field: '平台认证器', unit: '—', meaning: '这台手机能不能用指纹或面部解锁做网页认证', example: '可用（平台认证器）' },
        { field: '状态', unit: '—', meaning: '这张卡是说明卡，不做测量', example: '信息卡' }
      ],
      tryIt: '点检测平台认证器，看这台手机能不能用指纹或面部解锁登录网站。',
      diagram: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><rect width="320" height="180" fill="#1b1b1f"/><rect x="40" y="20" width="90" height="140" fill="#2a2a32" shape-rendering="crispEdges"/><circle cx="85" cy="70" r="26" fill="none" stroke="#7fff2a" stroke-width="2"/><circle cx="76" cy="66" r="3" fill="#7fff2a"/><circle cx="94" cy="66" r="3" fill="#7fff2a"/><path d="M76 80 Q85 88 94 80" stroke="#7fff2a" stroke-width="2" fill="none"/><line x1="130" y1="90" x2="195" y2="90" stroke="#ff4d4d" stroke-width="3"/><polygon points="195,90 183,83 183,97" fill="#ff4d4d"/><rect x="200" y="60" width="70" height="60" fill="#2a2a32" stroke="#ffd700" stroke-width="2" shape-rendering="crispEdges"/><circle cx="235" cy="85" r="10" fill="none" stroke="#ffd700" stroke-width="2"/><rect x="230" y="90" width="10" height="14" fill="#ffd700" shape-rendering="crispEdges"/><text x="40" y="175" fill="#f2f2f2" font-size="12" font-family="sans-serif">脸和指纹锁在安全区</text><text x="200" y="140" fill="#b8b8b8" font-size="11" font-family="sans-serif">网页只拿到</text><text x="200" y="158" fill="#b8b8b8" font-size="11" font-family="sans-serif">通过 / 不通过</text></svg>'
    },
    'camera-manual': {
      intro: '能调变焦、对焦、曝光和白平衡的相机控制卡。',
      principle: [
        '浏览器通过摄像头轨道的能力清单，知道这台手机相机支持调什么。变焦是把画面放大，对焦是让某个距离的东西变清楚，曝光是控制进光多少，白平衡是让白色在不同灯光下看起来还是白色。',
        '这些设置平时都由手机自动调，这张卡让你手动试一试。每台手机支持的项目不一样，不支持的会显示不支持。'
      ],
      uses: ['拍微距：手动对焦到很近的东西', '拍夜景：调曝光让画面更亮', '固定白平衡，做颜色对比实验', '认识变焦、对焦这些相机参数'],
      data: [
        { field: '变焦', unit: '×', meaning: '可调的放大倍数范围', example: '1 – 3' },
        { field: '对焦', unit: '—', meaning: '相机支持的对焦模式', example: '自动 / 手动' },
        { field: '曝光', unit: '—', meaning: '相机支持的曝光模式', example: '自动 / 手动' },
        { field: '白平衡', unit: '—', meaning: '相机支持的白平衡模式', example: '自动' },
        { field: '补光灯', unit: '—', meaning: '能不能打开闪光灯当补光', example: '支持' }
      ],
      tryIt: '拖变焦滑杆看画面怎么放大，再试试把曝光调暗。',
      diagram: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><rect width="320" height="180" fill="#1b1b1f"/><circle cx="90" cy="90" r="55" fill="#2a2a32" stroke="#7fc4ff" stroke-width="2"/><circle cx="90" cy="90" r="35" fill="none" stroke="#7fc4ff" stroke-width="2"/><circle cx="90" cy="90" r="15" fill="#4a6cff"/><text x="170" y="45" fill="#f2f2f2" font-size="12" font-family="sans-serif">变焦</text><rect x="170" y="52" width="90" height="6" fill="#2a2a32" shape-rendering="crispEdges"/><rect x="200" y="48" width="10" height="14" fill="#ffd700" shape-rendering="crispEdges"/><text x="170" y="85" fill="#f2f2f2" font-size="12" font-family="sans-serif">对焦</text><rect x="170" y="92" width="90" height="6" fill="#2a2a32" shape-rendering="crispEdges"/><rect x="220" y="88" width="10" height="14" fill="#ffd700" shape-rendering="crispEdges"/><text x="170" y="125" fill="#f2f2f2" font-size="12" font-family="sans-serif">曝光</text><rect x="170" y="132" width="90" height="6" fill="#2a2a32" shape-rendering="crispEdges"/><rect x="185" y="128" width="10" height="14" fill="#ffd700" shape-rendering="crispEdges"/><text x="170" y="165" fill="#b8b8b8" font-size="11" font-family="sans-serif">拍之前先调好参数</text></svg>'
    },
    'camera': {
      intro: '打开摄像头，看画面、取中心颜色、测亮度。',
      principle: [
        '摄像头把光变成电信号，再变成一格格像素。每个像素有红、绿、蓝三个值，合起来就是颜色。卡片每帧取画面正中间一个点的颜色，再算出它的亮度。',
        '分辨率就是画面有多少像素，像素越多画面越细。帧率就是一秒画多少张，帧率越高画面越顺。'
      ],
      uses: ['取色：对准东西就知道它是什么颜色', '测环境亮度，判断教室够不够亮', '做颜色混合实验', '观察植物生长，定时拍照对比'],
      data: [
        { field: '分辨率', unit: '像素', meaning: '画面一共有多少像素', example: '1920×1080' },
        { field: '帧率', unit: 'fps', meaning: '一秒钟显示多少帧画面', example: '30' },
        { field: '镜头', unit: '—', meaning: '现在用的是前置还是后置镜头', example: '后置' },
        { field: '中心颜色', unit: '—', meaning: '画面正中间那个点的颜色', example: '#3a7d2c' },
        { field: '亮度', unit: '/ 100', meaning: '画面正中间的亮度，0 最暗，100 最亮', example: '62' }
      ],
      tryIt: '把镜头对准不同颜色的东西，看中心颜色和亮度怎么变。',
      diagram: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><rect width="320" height="180" fill="#1b1b1f"/><rect x="20" y="20" width="200" height="140" fill="#2a2a32" stroke="#7fff2a" stroke-width="2" shape-rendering="crispEdges"/><line x1="120" y1="20" x2="120" y2="160" stroke="#ff4d4d" stroke-width="2"/><line x1="20" y1="90" x2="220" y2="90" stroke="#ff4d4d" stroke-width="2"/><circle cx="120" cy="90" r="8" fill="none" stroke="#ffd700" stroke-width="2"/><text x="240" y="35" fill="#f2f2f2" font-size="12" font-family="sans-serif">红</text><rect x="240" y="42" width="60" height="10" fill="#ff4d4d" shape-rendering="crispEdges"/><text x="240" y="70" fill="#f2f2f2" font-size="12" font-family="sans-serif">绿</text><rect x="240" y="77" width="45" height="10" fill="#7fff2a" shape-rendering="crispEdges"/><text x="240" y="105" fill="#f2f2f2" font-size="12" font-family="sans-serif">蓝</text><rect x="240" y="112" width="50" height="10" fill="#4a6cff" shape-rendering="crispEdges"/><text x="240" y="145" fill="#b8b8b8" font-size="11" font-family="sans-serif">亮度 / 100</text><text x="20" y="175" fill="#f2f2f2" font-size="12" font-family="sans-serif">中间一点的颜色</text></svg>'
    },
    'face-detect': {
      intro: '用 AI 模型在画面里找人脸，还能标出眼睛鼻子嘴。',
      principle: [
        '卡片用的是 MediaPipe 的 BlazeFace 模型，一个专门找人脸的小神经网络。它先把画面缩小，快速扫一遍，猜出哪里有人脸，再精修框的位置。',
        '模型还会在每张脸上标 6 个关键点：两只眼睛、鼻尖、嘴和两只耳朵。所有计算都在本机做，画面不上传。模型下不下来时，会用旧版肤色检测兜底。'
      ],
      uses: ['数画面里有几张脸', '做互动装置：人一出现就触发', '拍合影时自动找到人脸对焦', '学神经网络是怎么做检测的'],
      data: [
        { field: '引擎', unit: '—', meaning: '现在用哪个检测方法', example: 'MediaPipe' },
        { field: '模型', unit: '—', meaning: '找人脸的神经网络名字', example: 'BlazeFace short-range' },
        { field: '人面数', unit: '个', meaning: '画面里找到了几张脸', example: '2' },
        { field: '最大人面', unit: '% 宽', meaning: '最大那张脸占画面宽度的比例', example: '34% 宽' },
        { field: '检测速度', unit: '/ 秒', meaning: '一秒能检测多少次', example: '12' },
        { field: '镜头', unit: '—', meaning: '现在用的是前置还是后置镜头', example: '前置' }
      ],
      tryIt: '对着前置镜头慢慢走近走远，看人脸框和 6 个关键点怎么跟。',
      diagram: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><rect width="320" height="180" fill="#1b1b1f"/><circle cx="110" cy="85" r="50" fill="none" stroke="#f2f2f2" stroke-width="2"/><path d="M70 130 Q110 160 150 130" stroke="#f2f2f2" stroke-width="2" fill="none"/><rect x="55" y="25" width="110" height="130" fill="none" stroke="#7fff2a" stroke-width="3" shape-rendering="crispEdges"/><circle cx="90" cy="75" r="4" fill="#ffd700"/><circle cx="130" cy="75" r="4" fill="#ffd700"/><circle cx="110" cy="95" r="4" fill="#ffd700"/><circle cx="110" cy="115" r="4" fill="#ffd700"/><circle cx="62" cy="90" r="4" fill="#ffd700"/><circle cx="158" cy="90" r="4" fill="#ffd700"/><text x="180" y="50" fill="#f2f2f2" font-size="12" font-family="sans-serif">人脸框</text><text x="180" y="80" fill="#f2f2f2" font-size="12" font-family="sans-serif">6 个关键点</text><text x="180" y="110" fill="#b8b8b8" font-size="11" font-family="sans-serif">眼睛 · 鼻尖 · 嘴</text><text x="180" y="140" fill="#b8b8b8" font-size="11" font-family="sans-serif">左右耳</text></svg>'
    },
    'gamepad': {
      intro: '接上手柄，按键和摇杆的动作都会变成数字。',
      principle: [
        '浏览器有个手柄接口，插上 USB 或蓝牙手柄后就能读到它。每个按键要么按下要么松开，有些扳机还能读出按下一半。',
        '摇杆是两个方向的轴，推多少就读出 -1 到 1 之间的数。不推是 0，推到底是 1 或 -1。部分手柄还能让网页控制震动。'
      ],
      uses: ['玩网页游戏', '做遥控小车的方向盘', '学输入设备是怎么工作的', '测按键反应有多快'],
      data: [
        { field: '名称', unit: '—', meaning: '手柄的简称', example: 'Xbox 无线手柄' },
        { field: 'ID', unit: '—', meaning: '浏览器认到的手柄完整名字', example: 'Xbox 360 Controller' },
        { field: '按键 / 轴', unit: '个', meaning: '手柄一共有多少个按键和摇杆轴', example: '17 / 4' },
        { field: '震动', unit: '—', meaning: '网页能不能让手柄震动', example: '可用' },
        { field: '状态', unit: '—', meaning: '手柄现在连上没有', example: '已连接' }
      ],
      tryIt: '接上手柄按几个键，看卡片上的按键格子怎么亮起来。',
      diagram: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><rect width="320" height="180" fill="#1b1b1f"/><rect x="40" y="50" width="240" height="80" fill="#2a2a32" shape-rendering="crispEdges"/><rect x="60" y="75" width="12" height="36" fill="#f2f2f2" shape-rendering="crispEdges"/><rect x="48" y="87" width="36" height="12" fill="#f2f2f2" shape-rendering="crispEdges"/><circle cx="220" cy="80" r="8" fill="#ff4d4d"/><circle cx="240" cy="70" r="8" fill="#ffd700"/><circle cx="240" cy="95" r="8" fill="#7fff2a"/><circle cx="260" cy="80" r="8" fill="#4a6cff"/><rect x="140" y="80" width="30" height="30" fill="none" stroke="#7fc4ff" stroke-width="2" shape-rendering="crispEdges"/><circle cx="155" cy="95" r="8" fill="#7fc4ff"/><text x="40" y="150" fill="#f2f2f2" font-size="12" font-family="sans-serif">方向键</text><text x="140" y="150" fill="#f2f2f2" font-size="12" font-family="sans-serif">摇杆：推多少</text><text x="215" y="150" fill="#f2f2f2" font-size="12" font-family="sans-serif">按键</text></svg>'
    },
    'geolocation': {
      intro: '用卫星信号算出你在哪，精确到几米。',
      principle: [
        '天上有好多导航卫星，不停广播自己的位置和时间。手机同时收到 4 颗以上卫星的信号，就能算出自己离每颗卫星多远，再用这些距离算出经纬度。',
        '这叫三边测量，原理和用绳子量距离找点一样。信号要穿过大气，楼里收不到，所以室内定位会变差。'
      ],
      uses: ['跑步记轨迹，看跑了多远', '测走路和骑车的速度', '野外定向找路', '做地图实验：画出自己的行动轨迹'],
      data: [
        { field: '纬度', unit: '°', meaning: '南北方向的位置，赤道是 0', example: '22.543099' },
        { field: '经度', unit: '°', meaning: '东西方向的位置，本初子午线是 0', example: '114.057868' },
        { field: '精度', unit: 'm', meaning: '位置可能偏离多少米，数字越小越准', example: '±8 m' },
        { field: '速度', unit: 'km/h', meaning: '现在移动得有多快', example: '5.2' },
        { field: '海拔', unit: 'm', meaning: '离海平面有多高', example: '42' },
        { field: '里程', unit: 'm', meaning: '从开始记录到现在一共走了多远', example: '128' }
      ],
      tryIt: '走一段路，看轨迹点和里程怎么增加，再看精度那一格。',
      diagram: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><rect width="320" height="180" fill="#1b1b1f"/><rect x="40" y="25" width="24" height="14" fill="#ffd700" shape-rendering="crispEdges"/><line x1="40" y1="32" x2="28" y2="32" stroke="#ffd700" stroke-width="2"/><rect x="150" y="20" width="24" height="14" fill="#ffd700" shape-rendering="crispEdges"/><line x1="150" y1="27" x2="138" y2="27" stroke="#ffd700" stroke-width="2"/><rect x="260" y="30" width="24" height="14" fill="#ffd700" shape-rendering="crispEdges"/><line x1="260" y1="37" x2="248" y2="37" stroke="#ffd700" stroke-width="2"/><line x1="52" y1="39" x2="155" y2="125" stroke="#33e0e0" stroke-width="2" stroke-dasharray="4 3"/><line x1="162" y1="34" x2="160" y2="125" stroke="#33e0e0" stroke-width="2" stroke-dasharray="4 3"/><line x1="272" y1="44" x2="165" y2="125" stroke="#33e0e0" stroke-width="2" stroke-dasharray="4 3"/><rect x="140" y="125" width="40" height="50" fill="#2a2a32" stroke="#7fff2a" stroke-width="2" shape-rendering="crispEdges"/><text x="40" y="60" fill="#f2f2f2" font-size="11" font-family="sans-serif">卫星</text><text x="150" y="55" fill="#f2f2f2" font-size="11" font-family="sans-serif">卫星</text><text x="255" y="65" fill="#f2f2f2" font-size="11" font-family="sans-serif">卫星</text><text x="130" y="115" fill="#f2f2f2" font-size="12" font-family="sans-serif">手机</text><text x="190" y="170" fill="#b8b8b8" font-size="11" font-family="sans-serif">4 颗卫星定出位置</text></svg>'
    },
    'gyroscope': {
      intro: '测手机转得有多快的传感器，单位是度每秒。',
      principle: [
        '陀螺仪测的是角速度，也就是手机绕着某个轴转得有多快。手机里的陀螺仪也是微机电芯片：里面有个小东西在振动，手机一转，振动方向会被甩偏，芯片量出这个偏就知道转速。',
        '静止时读数接近零，转得越快数字越大。和加速度计合起来，手机就知道自己的姿态。'
      ],
      uses: ['体感游戏：转手机控制方向', '测转椅或陀螺转得有多快', '做平衡实验', '帮相机防抖'],
      data: [
        { field: '合角速度', unit: '°/s', meaning: '三个方向转速合起来的大小', example: '0.0' },
        { field: '峰值 RPM', unit: 'rpm', meaning: '这次转得最快时每分钟多少转', example: '12.5' },
        { field: 'α / β / γ', unit: '°/s', meaning: '绕三个轴各自的转速', example: '0 / 0 / 0' },
        { field: '零偏', unit: '°/s', meaning: '静止时三个轴的读数，用来扣掉误差', example: '0 / 0 / 0' },
        { field: '状态', unit: '—', meaning: '现在是不是在采集', example: '采集中' }
      ],
      tryIt: '把手机放桌上点开始，再快速转一圈，看合角速度冲到多少。',
      diagram: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><rect width="320" height="180" fill="#1b1b1f"/><rect x="110" y="55" width="100" height="70" fill="#2a2a32" stroke="#7fff2a" stroke-width="2" shape-rendering="crispEdges"/><path d="M110 40 Q160 10 210 40" stroke="#ff4d4d" stroke-width="3" fill="none"/><polygon points="210,40 198,34 198,48" fill="#ff4d4d"/><path d="M110 140 Q160 170 210 140" stroke="#7fff2a" stroke-width="3" fill="none"/><polygon points="210,140 198,134 198,148" fill="#7fff2a"/><path d="M70 90 A50 50 0 1 1 90 50" stroke="#33e0e0" stroke-width="3" fill="none"/><polygon points="90,50 78,52 88,62" fill="#33e0e0"/><text x="130" y="30" fill="#f2f2f2" font-size="12" font-family="sans-serif">绕 X 轴转</text><text x="130" y="165" fill="#f2f2f2" font-size="12" font-family="sans-serif">绕 Y 轴转</text><text x="20" y="110" fill="#f2f2f2" font-size="12" font-family="sans-serif">绕 Z 轴转</text><text x="230" y="100" fill="#b8b8b8" font-size="11" font-family="sans-serif">单位：度/秒</text></svg>'
    },
    'microphone': {
      intro: '把声音变成波形和频谱，还能认出音高。',
      principle: [
        '麦克风把空气振动变成电信号，浏览器再把它切成一小段一小段分析。波形图是声音随时间的变化，频谱图是声音里各种频率的成分。',
        '卡片用傅里叶分析找出最强的那个频率，再换算成音名，比如 440 Hz 就是 A4。音量这里是相对分贝，不是专业声压级，不能和分贝仪直接比。'
      ],
      uses: ['测音高：哼一个音看它是多少 Hz', '练乐器：看音准不准', '看环境噪声有多大', '学波和频率的关系'],
      data: [
        { field: '相对音量', unit: 'dB（相对）', meaning: '现在声音有多大，只是相对值', example: '62' },
        { field: '主频', unit: 'Hz', meaning: '声音里最强的那个频率', example: '440' },
        { field: '音名', unit: '—', meaning: '主频换算成的音名', example: 'A4' },
        { field: '峰值', unit: 'dB（相对）', meaning: '这次录到的最大音量', example: '78' },
        { field: '灵敏度', unit: '×', meaning: '麦克风放大倍数，越大越容易收到小声音', example: '1.0' }
      ],
      tryIt: '对着麦克风哼一个稳定的音，看主频和音名，再拍手看峰值。',
      diagram: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><rect width="320" height="180" fill="#1b1b1f"/><circle cx="60" cy="60" r="18" fill="#ffd700"/><text x="35" y="100" fill="#f2f2f2" font-size="12" font-family="sans-serif">声源</text><path d="M85 45 Q100 60 85 75" stroke="#33e0e0" stroke-width="2" fill="none"/><path d="M100 35 Q125 60 100 85" stroke="#33e0e0" stroke-width="2" fill="none"/><path d="M115 25 Q150 60 115 95" stroke="#33e0e0" stroke-width="2" fill="none"/><polyline points="20,140 40,120 60,150 80,125 100,145 120,130 140,150 160,120 180,145 200,130 220,150 240,125 260,145 280,135 300,140" fill="none" stroke="#7fff2a" stroke-width="2"/><rect x="230" y="30" width="12" height="30" fill="#4a6cff" shape-rendering="crispEdges"/><rect x="248" y="20" width="12" height="40" fill="#4a6cff" shape-rendering="crispEdges"/><rect x="266" y="38" width="12" height="22" fill="#4a6cff" shape-rendering="crispEdges"/><rect x="284" y="28" width="12" height="32" fill="#4a6cff" shape-rendering="crispEdges"/><text x="20" y="170" fill="#f2f2f2" font-size="12" font-family="sans-serif">波形：声音随时间变</text><text x="230" y="75" fill="#b8b8b8" font-size="11" font-family="sans-serif">频谱</text></svg>'
    },
    'multitouch': {
      intro: '屏幕能同时认出好几根手指，还能玩点靶游戏。',
      principle: [
        '手机屏幕下面有一层透明的电容网格，手指靠近会改变局部的电容，芯片就能算出每个触点的位置。',
        '一次能认几个点，看屏幕硬件。卡片用浏览器的触摸事件数触点，再加一个点靶小游戏测你的反应。'
      ],
      uses: ['多人同时按屏幕一起玩', '测屏幕最多能认几根手指', '点靶游戏练反应', '学电容屏是怎么定位的'],
      data: [
        { field: '当前触点', unit: '个', meaning: '现在有几根手指按在屏幕上', example: '3' },
        { field: '最大同时', unit: '个', meaning: '这次最多同时按了几根手指', example: '5' },
        { field: '命中', unit: '次', meaning: '点靶游戏 5 次里点中几次', example: '3 / 5' },
        { field: '最佳反应', unit: 'ms', meaning: '点靶最快的一次用了多少毫秒', example: '248' },
        { field: '平均反应', unit: 'ms', meaning: '点靶几次的平均用时', example: '312' },
        { field: '当前压力', unit: '—', meaning: '手指按压的力度，0 到 1 之间', example: '0.50' }
      ],
      tryIt: '三根手指同时按住压力板，再玩一次点靶看最佳反应。',
      diagram: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><rect width="320" height="180" fill="#1b1b1f"/><rect x="30" y="20" width="180" height="140" fill="#2a2a32" stroke="#7fc4ff" stroke-width="2" shape-rendering="crispEdges"/><circle cx="80" cy="70" r="14" fill="none" stroke="#7fff2a" stroke-width="3"/><circle cx="130" cy="100" r="14" fill="none" stroke="#ffd700" stroke-width="3"/><circle cx="170" cy="60" r="14" fill="none" stroke="#ff4d4d" stroke-width="3"/><circle cx="250" cy="90" r="22" fill="#ffd700"/><circle cx="250" cy="90" r="10" fill="#ff4d4d"/><text x="225" y="130" fill="#f2f2f2" font-size="12" font-family="sans-serif">靶心</text><text x="230" y="60" fill="#b8b8b8" font-size="11" font-family="sans-serif">点中它</text><text x="30" y="175" fill="#f2f2f2" font-size="12" font-family="sans-serif">同时按几根手指</text></svg>'
    },
    'orientation': {
      intro: '告诉你手机朝向哪、歪了多少，还能当指南针。',
      principle: [
        '卡片把加速度计和磁力计的数据合起来，算出手机的三个姿态角：α 是绕竖轴转了多少，也就是朝向；β 是前后俯仰；γ 是左右倾斜。',
        'iPhone 上如果系统给了指南针方向，就直接用它，更准。点水平归零，可以把当前姿势记成零，方便做水平实验。'
      ],
      uses: ['当指南针找北', '测斜坡有多陡', '做水平仪：看桌子平不平', '玩体感游戏'],
      data: [
        { field: '方位', unit: '°', meaning: '手机朝向哪里，0 是北，顺时针转到 360', example: '135' },
        { field: '中文方位', unit: '—', meaning: '方位角换成的中文方向', example: '东南' },
        { field: 'α / β / γ', unit: '°', meaning: '绕竖轴 / 前后俯仰 / 左右倾斜的角度', example: '135 / 12 / -5' },
        { field: '指北来源', unit: '—', meaning: '方位角是系统指南针给的还是算出来的', example: '指南针' },
        { field: '水平归零', unit: '°', meaning: '归零时记下的 β / γ，归零后从它开始算', example: '未启用' }
      ],
      tryIt: '慢慢转一圈看方位从 0 转到 360，再把手机放平点水平归零。',
      diagram: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><rect width="320" height="180" fill="#1b1b1f"/><circle cx="100" cy="90" r="55" fill="#2a2a32" stroke="#f2f2f2" stroke-width="2"/><polygon points="100,45 108,90 100,135 92,90" fill="#ff4d4d"/><text x="95" y="30" fill="#f2f2f2" font-size="12" font-family="sans-serif">北</text><text x="160" y="95" fill="#f2f2f2" font-size="12" font-family="sans-serif">东</text><text x="95" y="165" fill="#f2f2f2" font-size="12" font-family="sans-serif">南</text><text x="30" y="95" fill="#f2f2f2" font-size="12" font-family="sans-serif">西</text><rect x="200" y="60" width="60" height="90" fill="#2a2a32" stroke="#7fff2a" stroke-width="2" transform="rotate(15 230 105)" shape-rendering="crispEdges"/><text x="200" y="170" fill="#b8b8b8" font-size="11" font-family="sans-serif">歪了多少度</text></svg>'
    },
    'reaction-time': {
      intro: '目标一变绿就点，看你反应有多快。',
      principle: [
        '屏幕变绿是一个刺激，你的眼睛看到、大脑处理、手指点下去，这一路都要时间。卡片用动画帧的时间戳记下变绿的准确时刻，再用点按那一刻的时间相减，得到反应时间。',
        '真人一般在 200 到 300 毫秒。抢先点按、超时、画面卡顿都会让那次作废，因为数据不可靠。'
      ],
      uses: ['测自己的反应速度', '做注意力实验：累了反应会变慢吗', '和同学比一比谁更快', '学实验设计：为什么要做 15 次取中位'],
      data: [
        { field: '阶段', unit: '—', meaning: '现在是练习还是正式计分', example: '计分' },
        { field: '有效', unit: '次', meaning: '15 次计分里有效的次数，满 12 次才有可比分数', example: '7' },
        { field: '抢先', unit: '次', meaning: '变绿之前就点按的次数', example: '0' },
        { field: '中位反应', unit: 'ms', meaning: '把有效反应从快到慢排，取中间那个', example: '243' },
        { field: '四分位距', unit: 'ms', meaning: '中间一半的反应都落在这个区间里', example: '210 – 280' },
        { field: '最快 / 最慢', unit: 'ms', meaning: '有效反应里最快和最慢的一次', example: '198 / 312' }
      ],
      tryIt: '先练 3 次，等绿了再点，别抢跑，15 次做完看中位反应。',
      diagram: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><rect width="320" height="180" fill="#1b1b1f"/><line x1="20" y1="90" x2="300" y2="90" stroke="#b8b8b8" stroke-width="3"/><circle cx="60" cy="90" r="10" fill="#ffd700"/><circle cx="160" cy="90" r="10" fill="#7fff2a"/><circle cx="260" cy="90" r="10" fill="#4a6cff"/><line x1="160" y1="60" x2="260" y2="60" stroke="#ff4d4d" stroke-width="2"/><polygon points="260,60 248,54 248,66" fill="#ff4d4d"/><polygon points="160,60 172,54 172,66" fill="#ff4d4d"/><text x="35" y="120" fill="#f2f2f2" font-size="12" font-family="sans-serif">等待</text><text x="140" y="120" fill="#f2f2f2" font-size="12" font-family="sans-serif">变绿</text><text x="240" y="120" fill="#f2f2f2" font-size="12" font-family="sans-serif">点按</text><text x="180" y="50" fill="#ff4d4d" font-size="13" font-family="sans-serif">243 ms</text><text x="20" y="30" fill="#f2f2f2" font-size="12" font-family="sans-serif">刺激到点按的时间</text></svg>'
    },
    'speaker': {
      intro: '让手机发出指定频率和波形的声音，还能朗读和听你说话。',
      principle: [
        '扬声器是把电信号变成空气振动。浏览器用 Web Audio 在软件里合成波形：正弦波最纯，像笛声；方波和锯齿波带很多泛音，听起来更亮更糙。',
        '频率越高音调越高，440 Hz 就是标准音 A4。卡片还能调用系统语音朗读文字，以及语音识别听你说话。'
      ],
      uses: ['测听力范围：从低到高能听到哪里', '做共振实验：让东西跟着声音抖', '学波形和音调的关系', '练发音：朗读后听自己的声音'],
      data: [
        { field: '频率', unit: 'Hz', meaning: '一秒钟振动多少次，决定音调高低', example: '440' },
        { field: '音名', unit: '—', meaning: '频率换算成的音名', example: 'A4' },
        { field: '波形', unit: '—', meaning: '现在发的是哪种波形', example: 'sine' },
        { field: '状态', unit: '—', meaning: '现在是不是在发声', example: '播放中' },
        { field: 'TTS', unit: '—', meaning: '文字转语音能不能用', example: '可用' },
        { field: '声音', unit: '—', meaning: '朗读用的系统语音', example: '默认' }
      ],
      tryIt: '把频率从 20 滑到 2000，听音调怎么变，再换方波听听有什么不同。',
      diagram: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><rect width="320" height="180" fill="#1b1b1f"/><polygon points="40,70 70,70 90,50 90,130 70,110 40,110" fill="#7fc4ff"/><path d="M100 70 Q110 60 120 70" stroke="#7fc4ff" stroke-width="2" fill="none"/><path d="M100 110 Q115 95 130 110" stroke="#7fc4ff" stroke-width="2" fill="none"/><polyline points="140,60 150,50 160,60 170,70 180,60 190,50 200,60 210,70 220,60 230,50 240,60 250,70 260,60 270,50 280,60 290,70 300,60" fill="none" stroke="#7fff2a" stroke-width="2"/><polyline points="140,140 160,140 160,120 180,120 180,140 200,140 200,120 220,120 220,140 240,140 240,120 260,120 260,140 280,140 280,120 300,120" fill="none" stroke="#ffd700" stroke-width="2"/><text x="140" y="45" fill="#f2f2f2" font-size="12" font-family="sans-serif">正弦波：像笛声</text><text x="140" y="115" fill="#f2f2f2" font-size="12" font-family="sans-serif">方波：更亮更糙</text><text x="140" y="165" fill="#b8b8b8" font-size="11" font-family="sans-serif">440 Hz 就是标准音 A4</text></svg>'
    },
    'torch': {
      intro: '打开手机后置摄像头的补光灯当手电筒。',
      principle: [
        '手电筒不是单独的灯，是后置摄像头旁边的 LED 补光灯。网页通过摄像头轨道的 torch 开关控制它开和关。',
        '能不能开要看浏览器支不支持，有些手机或浏览器不给网页这个权限，卡片会显示不支持。'
      ],
      uses: ['停电时照亮', '做光的实验：照镜子、照水', '发摩尔斯码', '学摄像头是怎么被控制的'],
      data: [
        { field: '能力', unit: '—', meaning: '浏览器给不给网页开补光灯', example: '支持 torch' },
        { field: '状态', unit: '—', meaning: '灯现在开着还是关着', example: '开启' },
        { field: '轨道', unit: '—', meaning: '控制的是哪一路摄像头', example: 'camera' }
      ],
      tryIt: '点开关，看后置闪光灯亮不亮，再看能力那一格写什么。',
      diagram: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><rect width="320" height="180" fill="#1b1b1f"/><rect x="60" y="30" width="80" height="120" fill="#2a2a32" stroke="#f2f2f2" stroke-width="2" shape-rendering="crispEdges"/><circle cx="100" cy="55" r="10" fill="#ffd700"/><polygon points="100,65 60,170 140,170" fill="#ffd700" opacity="0.25"/><text x="170" y="60" fill="#f2f2f2" font-size="12" font-family="sans-serif">LED 补光灯</text><text x="170" y="85" fill="#b8b8b8" font-size="11" font-family="sans-serif">就是闪光灯</text><text x="170" y="110" fill="#b8b8b8" font-size="11" font-family="sans-serif">点开关控制</text><rect x="170" y="130" width="50" height="22" fill="#7fff2a" shape-rendering="crispEdges"/><text x="178" y="145" fill="#1b1b1f" font-size="11" font-family="sans-serif">开关</text></svg>'
    },
    'wakelock': {
      intro: '让屏幕在实验时不自动熄灭。',
      principle: [
        '手机平时一段时间没人碰就会锁屏省电，实验做到一半屏幕黑了很麻烦。网页可以用 Wake Lock 接口向系统申请：请别锁屏。',
        '系统同意后屏幕就一直亮着，直到网页释放或者切到后台。关掉页面，锁就自动还回去了。'
      ],
      uses: ['长时间记录实验不黑屏', '照着菜谱做菜', '做展示时屏幕一直亮', '跑步时一直看数据'],
      data: [
        { field: 'API', unit: '—', meaning: '浏览器有没有 Wake Lock 接口', example: 'wakeLock 可用' },
        { field: '状态', unit: '—', meaning: '常亮现在开着还是关着', example: '开启' },
        { field: '安全上下文', unit: '—', meaning: '页面是不是 HTTPS，只有安全页面能申请', example: 'YES' }
      ],
      tryIt: '打开常亮，等一分钟，看屏幕是不是还亮着。',
      diagram: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><rect width="320" height="180" fill="#1b1b1f"/><rect x="110" y="25" width="100" height="130" fill="#2a2a32" stroke="#7fff2a" stroke-width="2" shape-rendering="crispEdges"/><circle cx="160" cy="70" r="18" fill="#ffd700"/><line x1="160" y1="40" x2="160" y2="48" stroke="#ffd700" stroke-width="2"/><line x1="160" y1="92" x2="160" y2="100" stroke="#ffd700" stroke-width="2"/><line x1="132" y1="70" x2="140" y2="70" stroke="#ffd700" stroke-width="2"/><line x1="180" y1="70" x2="188" y2="70" stroke="#ffd700" stroke-width="2"/><text x="130" y="130" fill="#f2f2f2" font-size="12" font-family="sans-serif">屏幕一直亮</text><text x="60" y="170" fill="#b8b8b8" font-size="11" font-family="sans-serif">锁屏会停掉采集</text><text x="200" y="170" fill="#b8b8b8" font-size="11" font-family="sans-serif">常亮就不停</text></svg>'
    },
    'webgpu': {
      intro: '让网页直接用显卡算东西的新接口。',
      principle: [
        '以前网页做重计算只能用 CPU，一次算一点。WebGPU 让网页直接指挥显卡，显卡里有成百上千个小核心，可以同时算很多数，特别适合画 3D 和跑 AI。',
        '能不能用要看浏览器和系统：iPhone 需要比较新的系统版本，还可能要在 Safari 实验特性里打开。卡片只读显卡的能力清单，不做渲染和计算。'
      ],
      uses: ['画 3D 游戏和模型', '让 AI 在网页里跑得更快', '科学计算：一次算很多数', '图像处理：同时处理很多像素'],
      data: [
        { field: 'navigator.gpu', unit: '—', meaning: '浏览器有没有暴露 WebGPU 入口', example: '存在' },
        { field: '适配器', unit: '—', meaning: '浏览器找到的显卡', example: 'Apple GPU' },
        { field: '后端', unit: '—', meaning: '显卡用的底层技术', example: 'Metal' },
        { field: '特性数', unit: '个', meaning: '这块显卡支持多少个高级特性', example: '12' },
        { field: '电源偏好', unit: '—', meaning: '优先省电还是优先性能', example: '低功耗' },
        { field: '状态', unit: '—', meaning: '适配器请求到没有', example: '可用' }
      ],
      tryIt: '点重新请求适配器，看这台手机能不能用 WebGPU。',
      diagram: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><rect width="320" height="180" fill="#1b1b1f"/><rect x="30" y="40" width="70" height="100" fill="#2a2a32" stroke="#b8b8b8" stroke-width="2" shape-rendering="crispEdges"/><rect x="45" y="70" width="40" height="40" fill="#b8b8b8" shape-rendering="crispEdges"/><text x="30" y="160" fill="#f2f2f2" font-size="12" font-family="sans-serif">CPU：一次算一点</text><rect x="170" y="40" width="120" height="100" fill="#2a2a32" stroke="#7fff2a" stroke-width="2" shape-rendering="crispEdges"/><rect x="180" y="55" width="20" height="20" fill="#7fff2a" shape-rendering="crispEdges"/><rect x="205" y="55" width="20" height="20" fill="#7fff2a" shape-rendering="crispEdges"/><rect x="230" y="55" width="20" height="20" fill="#7fff2a" shape-rendering="crispEdges"/><rect x="255" y="55" width="20" height="20" fill="#7fff2a" shape-rendering="crispEdges"/><rect x="180" y="85" width="20" height="20" fill="#7fff2a" shape-rendering="crispEdges"/><rect x="205" y="85" width="20" height="20" fill="#7fff2a" shape-rendering="crispEdges"/><rect x="230" y="85" width="20" height="20" fill="#7fff2a" shape-rendering="crispEdges"/><rect x="255" y="85" width="20" height="20" fill="#7fff2a" shape-rendering="crispEdges"/><text x="170" y="160" fill="#f2f2f2" font-size="12" font-family="sans-serif">GPU：同时算很多</text></svg>'
    },
    'yolo-detect': {
      intro: '一次看图就能认出东西的 AI 检测卡，现在有三个模型。',
      principle: [
        'YOLO 是个神经网络，看一遍图就同时猜出框的位置和里面是什么。它把图分成网格，每个格子负责自己那块有没有东西，再把重叠的框合并。',
        '卡片用的是三个小模型：YOLO26n 和 YOLO11n 认 COCO 数据集里的 80 类：人、车、狗、猫、手机、椅子等等；YOLOE-26n PF 不用打字就认内置 4585 类，但标签是英文，而且词表里还有品种、部位、场景名，所以狗可能标成 pomeranian、人可能标成 rock concert——这是 prompt-free 本身的特性。模型经过量化或 FP32 压缩，跑在本机，不上传照片。PF 还是个分割模型：它除了给每个物体画框，还会输出轮廓（mask）；点「轮廓」开关，就能在框里填一层半透明轮廓，26n 和 11n 没有轮廓数据，开了也不会画。'
      ],
      uses: ['数画面里有几个人', '认出桌上的东西叫什么', '做自动拍照：看到猫就拍', '学目标检测是怎么工作的'],
      data: [
        { field: '引擎', unit: '—', meaning: '在浏览器里跑模型的工具', example: 'ONNX Runtime Web' },
        { field: '模型', unit: '—', meaning: '现在用的检测模型', example: 'YOLO26n INT8' },
        { field: '物体数', unit: '个', meaning: '这帧画面里找到了几个物体', example: '4' },
        { field: '看到的', unit: '—', meaning: '找到的物体都是什么', example: '人、车' },
        { field: '检测速度', unit: '/ 秒', meaning: '一秒能检测多少帧', example: '3' },
        { field: '单次推理', unit: 'ms', meaning: '模型看一帧图要花多少毫秒', example: '280' }
      ],
      tryIt: '切到 YOLOE-26n PF，点「轮廓」开关，看框里的物体怎么被半透明轮廓盖住；再切回 YOLO26n，看开关开了也没轮廓。',
      diagram: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><rect width="320" height="180" fill="#1b1b1f"/><rect x="20" y="20" width="200" height="140" fill="#2a2a32" shape-rendering="crispEdges"/><line x1="86" y1="20" x2="86" y2="160" stroke="#4a6cff" stroke-width="1" opacity="0.5"/><line x1="153" y1="20" x2="153" y2="160" stroke="#4a6cff" stroke-width="1" opacity="0.5"/><line x1="20" y1="66" x2="220" y2="66" stroke="#4a6cff" stroke-width="1" opacity="0.5"/><line x1="20" y1="113" x2="220" y2="113" stroke="#4a6cff" stroke-width="1" opacity="0.5"/><rect x="40" y="50" width="60" height="70" fill="none" stroke="#7fff2a" stroke-width="2" shape-rendering="crispEdges"/><rect x="40" y="38" width="52" height="14" fill="#7fff2a" shape-rendering="crispEdges"/><text x="42" y="49" fill="#1b1b1f" font-size="11" font-family="sans-serif">人 0.95</text><rect x="130" y="90" width="50" height="50" fill="none" stroke="#ff4d4d" stroke-width="2" shape-rendering="crispEdges"/><rect x="130" y="78" width="52" height="14" fill="#ff4d4d" shape-rendering="crispEdges"/><text x="132" y="89" fill="#1b1b1f" font-size="11" font-family="sans-serif">狗 0.88</text><text x="230" y="60" fill="#f2f2f2" font-size="12" font-family="sans-serif">网格分块</text><text x="230" y="85" fill="#b8b8b8" font-size="11" font-family="sans-serif">一次看完全图</text></svg>'
    },
    'ambient-light': {
      intro: '测周围有多亮的传感器，手机靠它自动调屏幕亮度。',
      principle: [
        '环境光传感器一般是光敏二极管，光越强产生的电流越大，手机据此调屏幕亮度。天黑自动变暗，太阳下自动变亮，就是它在工作。',
        '有接口的浏览器可以直接读照度：iOS 读不到，Android Chrome 要先在 chrome://flags 打开 Generic Sensor 实验特性。'
      ],
      uses: ['自动调屏幕亮度', '天黑了省电', '测教室亮度够不够', '做光照实验'],
      data: [
        { field: '照度', unit: 'lux', meaning: '照到表面的光有多强', example: '300' },
        { field: '亮度等级', unit: '—', meaning: '按照度分的亮暗等级', example: '室内明亮' },
        { field: '状态', unit: '—', meaning: '传感器现在是不是在测量', example: '测量中' }
      ],
      tryIt: '点「开始测量」，把手机拿到亮处和暗处，看照度读数怎么变。',
      note: 'iOS 不暴露环境光传感器；Android Chrome 需在 chrome://flags 打开 Generic Sensor 实验特性，网页才读得到。',
      diagram: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><rect width="320" height="180" fill="#1b1b1f"/><circle cx="70" cy="60" r="25" fill="#ffd700"/><line x1="70" y1="25" x2="70" y2="15" stroke="#ffd700" stroke-width="3"/><line x1="70" y1="95" x2="70" y2="105" stroke="#ffd700" stroke-width="3"/><line x1="35" y1="60" x2="25" y2="60" stroke="#ffd700" stroke-width="3"/><line x1="105" y1="60" x2="115" y2="60" stroke="#ffd700" stroke-width="3"/><line x1="110" y1="75" x2="190" y2="100" stroke="#ffd700" stroke-width="2" stroke-dasharray="4 3"/><rect x="200" y="90" width="80" height="50" fill="#2a2a32" stroke="#7fc4ff" stroke-width="2" shape-rendering="crispEdges"/><text x="30" y="140" fill="#f2f2f2" font-size="12" font-family="sans-serif">越亮电流越大</text><text x="200" y="160" fill="#f2f2f2" font-size="12" font-family="sans-serif">光敏二极管</text></svg>'
    },
    'magnetometer': {
      intro: '测磁场大小和方向的传感器，手机靠它找北。',
      principle: [
        '磁力计测的是磁场的大小和方向，单位是微特斯拉。地球本身是个大磁铁，手机靠磁场找北。',
        '网页只能通过姿态事件拿到系统算好的方向，看不到原始的三轴磁场数，所以这张卡锁住了。'
      ],
      uses: ['指南针找北', '测磁铁的磁场有多强', '做地磁实验', '帮地图定方向'],
      data: [
        { field: '磁场 X', unit: 'μT', meaning: '左右方向的磁场分量', example: '12.5' },
        { field: '磁场 Y', unit: 'μT', meaning: '前后方向的磁场分量', example: '-3.2' },
        { field: '磁场 Z', unit: 'μT', meaning: '上下方向的磁场分量', example: '-38.0' },
        { field: '合磁场', unit: 'μT', meaning: '三个方向合起来的磁场大小', example: '40.1' },
        { field: '方向', unit: '°', meaning: '磁场指的方向，换算成方位角', example: '135' }
      ],
      tryIt: '去姿态与指南针卡片看朝向，想看原始磁场要用原生 App。',
      note: '网页只能通过姿态事件拿到算好的方向，拿不到原始三轴磁场数据。',
      diagram: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><rect width="320" height="180" fill="#1b1b1f"/><rect x="40" y="60" width="50" height="40" fill="#ff4d4d" shape-rendering="crispEdges"/><rect x="90" y="60" width="50" height="40" fill="#f2f2f2" shape-rendering="crispEdges"/><path d="M40 50 Q90 10 140 50" stroke="#4a6cff" stroke-width="2" fill="none"/><path d="M40 110 Q90 150 140 110" stroke="#4a6cff" stroke-width="2" fill="none"/><circle cx="230" cy="80" r="35" fill="#2a2a32" stroke="#7fff2a" stroke-width="2"/><polygon points="230,50 238,80 230,110 222,80" fill="#ff4d4d"/><text x="215" y="140" fill="#f2f2f2" font-size="12" font-family="sans-serif">指北</text><text x="40" y="40" fill="#b8b8b8" font-size="11" font-family="sans-serif">单位：微特斯拉</text></svg>'
    },
    'barometer': {
      intro: '测空气压强的传感器，越往高处气压越小。',
      principle: [
        '气压计测的是空气压强，单位是百帕。越往高处空气越稀薄，气压越小，所以爬楼时气压会一点点下降，手机能用它估算你上了几层楼。',
        '天气变化时气压也会变：气压下降常常意味着要变天。网页没有气压计接口，所以这张卡锁住了。'
      ],
      uses: ['测海拔高度', '算上了几层楼', '天气预报：看气压变化', '登山时记录高度'],
      data: [
        { field: '气压', unit: 'hPa', meaning: '现在空气的压强', example: '1013' },
        { field: '海拔', unit: 'm', meaning: '用气压换算出的离海平面高度', example: '42' },
        { field: '楼层', unit: '层', meaning: '用气压变化估算的楼层', example: '3' },
        { field: '气压趋势', unit: '—', meaning: '气压在上升还是下降', example: '下降' }
      ],
      tryIt: '去 GPS 卡片看海拔（精度低一些），或用天气 App 查气压。',
      note: '网页没有气压计 API，读不到气压，也没法用它算楼层。',
      diagram: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><rect width="320" height="180" fill="#1b1b1f"/><rect x="40" y="40" width="80" height="120" fill="#2a2a32" stroke="#b8b8b8" stroke-width="2" shape-rendering="crispEdges"/><line x1="40" y1="80" x2="120" y2="80" stroke="#b8b8b8" stroke-width="1"/><line x1="40" y1="120" x2="120" y2="120" stroke="#b8b8b8" stroke-width="1"/><line x1="40" y1="140" x2="120" y2="140" stroke="#b8b8b8" stroke-width="1"/><rect x="180" y="30" width="40" height="130" fill="#4a6cff" opacity="0.3" shape-rendering="crispEdges"/><polygon points="200,20 190,35 210,35" fill="#4a6cff"/><text x="180" y="175" fill="#f2f2f2" font-size="12" font-family="sans-serif">气压</text><text x="40" y="175" fill="#f2f2f2" font-size="12" font-family="sans-serif">越高气压越小</text><text x="150" y="90" fill="#b8b8b8" font-size="11" font-family="sans-serif">空气柱</text></svg>'
    },
    'proximity': {
      intro: '测前面有没有东西的传感器，打电话时它会关屏。',
      principle: [
        '距离传感器一般在听筒旁边，用红外光测前面有没有东西。打电话把手机贴到耳朵上，它一感应到就关掉屏幕，免得脸碰到挂断键。',
        '没有网页接口读它，所以这张卡锁住了。'
      ],
      uses: ['通话时自动关屏', '防止脸误触挂断键', '做自动感应开关', '学红外是怎么测距的'],
      data: [
        { field: '距离', unit: 'cm', meaning: '前面物体离传感器有多远', example: '2.5' },
        { field: '有无物体', unit: '—', meaning: '前面有没有东西靠近', example: '有' },
        { field: '触发距离', unit: 'cm', meaning: '多近才算靠近，一般只有几厘米', example: '5' }
      ],
      tryIt: '打电话时把手盖住听筒上方，看屏幕是不是立刻熄灭。',
      note: '打电话贴脸用的距离传感器没有网页 API。',
      diagram: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><rect width="320" height="180" fill="#1b1b1f"/><rect x="60" y="30" width="80" height="120" fill="#2a2a32" stroke="#f2f2f2" stroke-width="2" shape-rendering="crispEdges"/><circle cx="100" cy="50" r="6" fill="#ff4d4d"/><rect x="180" y="60" width="70" height="40" fill="#ffd700" shape-rendering="crispEdges"/><line x1="100" y1="60" x2="180" y2="80" stroke="#ff4d4d" stroke-width="2" stroke-dasharray="4 3"/><text x="170" y="130" fill="#f2f2f2" font-size="12" font-family="sans-serif">靠近就关屏</text><text x="60" y="170" fill="#f2f2f2" font-size="12" font-family="sans-serif">红外光测距离</text></svg>'
    },
    'lidar': {
      intro: '用激光量距离的传感器，能扫出周围的 3D 形状。',
      principle: [
        'LiDAR 不停地向周围发射激光，量光飞回来要多久，就能算出每个点的距离；很多个点拼在一起，就成了 3D 点云。',
        'iPhone Pro 上的原深感摄像头也是类似原理，用红外点阵测脸的深浅。网页拿不到这些深度数据，所以这张卡锁住了。'
      ],
      uses: ['3D 扫描房间和物体', 'AR 里量家具尺寸', '人脸解锁：认脸的深浅', '做地形模型'],
      data: [
        { field: '距离', unit: 'm', meaning: '激光打到的那个点有多远', example: '1.2' },
        { field: '每秒点数', unit: '点/秒', meaning: '一秒钟能扫多少个点（不同设备差别很大）', example: '—' },
        { field: '深度图', unit: '—', meaning: '每个像素对应的距离', example: '逐点距离' },
        { field: '帧率', unit: 'fps', meaning: '一秒能扫多少次（不同设备差别很大）', example: '—' }
      ],
      tryIt: '用原生 App 扫一间屋子，看点云怎么拼成立体图。',
      note: '网页拿不到 LiDAR 或原深感摄像头的深度图。',
      diagram: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><rect width="320" height="180" fill="#1b1b1f"/><rect x="30" y="70" width="60" height="40" fill="#2a2a32" stroke="#33e0e0" stroke-width="2" shape-rendering="crispEdges"/><line x1="90" y1="80" x2="180" y2="50" stroke="#33e0e0" stroke-width="2"/><line x1="90" y1="90" x2="200" y2="90" stroke="#33e0e0" stroke-width="2"/><line x1="90" y1="100" x2="190" y2="120" stroke="#33e0e0" stroke-width="2"/><line x1="90" y1="85" x2="240" y2="60" stroke="#33e0e0" stroke-width="2"/><circle cx="180" cy="50" r="3" fill="#7fff2a"/><circle cx="210" cy="40" r="3" fill="#7fff2a"/><circle cx="240" cy="60" r="3" fill="#7fff2a"/><circle cx="200" cy="90" r="3" fill="#7fff2a"/><circle cx="230" cy="100" r="3" fill="#7fff2a"/><circle cx="260" cy="80" r="3" fill="#7fff2a"/><circle cx="190" cy="120" r="3" fill="#7fff2a"/><circle cx="240" cy="130" r="3" fill="#7fff2a"/><text x="200" y="50" fill="#f2f2f2" font-size="12" font-family="sans-serif">激光点云</text><text x="200" y="80" fill="#b8b8b8" font-size="11" font-family="sans-serif">光飞回来的时间</text><text x="200" y="110" fill="#b8b8b8" font-size="11" font-family="sans-serif">就是距离</text></svg>'
    },
    'bluetooth': {
      intro: '短距离无线技术，手机用它连耳机、手表和传感器。',
      principle: [
        '蓝牙是短距离无线技术，手机用它连耳机、手表和各种传感器。网页有个 Web Bluetooth 接口，但 iOS Safari 没实现；桌面和 Android Chrome 可以直接连。',
        '连上之后先看到设备提供的服务列表，每种服务有一个 UUID；想读心率等具体数值，要在扫描时声明对应的服务。'
      ],
      uses: ['连心率带测心率', '连 Arduino 做实验', '连耳机听歌', '做物联网小制作'],
      data: [
        { field: '设备', unit: '—', meaning: '连上的蓝牙设备叫什么', example: '心率带' },
        { field: '设备 ID', unit: '—', meaning: '浏览器给这台设备编的唯一编号', example: 'a1b2c3…' },
        { field: '服务', unit: '—', meaning: '设备提供的服务 UUID 列表', example: '0x180d' },
        { field: '状态', unit: '—', meaning: '现在连上没有、在读服务还是已断开', example: '已连接' }
      ],
      tryIt: '点「扫描设备」，连一台蓝牙设备，看它的服务列表。',
      note: 'iOS Safari 不支持 Web Bluetooth；桌面 / Android Chrome 有 API 时直接用本卡。',
      diagram: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><rect width="320" height="180" fill="#1b1b1f"/><rect x="30" y="50" width="80" height="90" fill="#2a2a32" stroke="#f2f2f2" stroke-width="2" shape-rendering="crispEdges"/><path d="M170 40 L200 90 L170 140 M185 65 L155 115 M185 115 L155 65" stroke="#4a6cff" stroke-width="3" fill="none"/><rect x="220" y="70" width="70" height="30" fill="#ff4d4d" shape-rendering="crispEdges"/><text x="30" y="160" fill="#f2f2f2" font-size="12" font-family="sans-serif">手机</text><text x="220" y="130" fill="#f2f2f2" font-size="12" font-family="sans-serif">心率带</text><text x="130" y="160" fill="#b8b8b8" font-size="11" font-family="sans-serif">短距离无线</text></svg>'
    },
    'nfc': {
      intro: '碰一碰就通信的技术，距离只有几厘米。',
      principle: [
        'NFC 是碰一碰就通信的技术，距离只有几厘米。手机靠近卡片或标签，电磁感应让标签通电，回传一小段数据。',
        '门禁卡、交通卡、碰一碰付款都是它。iOS Safari 没给网页用 NFC 的接口，Android Chrome 可以直接扫公开的 NDEF 标签。'
      ],
      uses: ['门禁卡开门', '交通卡刷卡', '碰一碰付款', '读商品标签'],
      data: [
        { field: '标签 ID', unit: '—', meaning: '每张标签唯一的编号', example: '04:A1:2B:3C' },
        { field: '记录数', unit: '条', meaning: '这张标签里有几条 NDEF 记录', example: '1' },
        { field: '文本记录', unit: '—', meaning: '标签里存的文字或链接内容', example: '一小段文字' },
        { field: '状态', unit: '—', meaning: '现在是不是在扫描、有没有读到标签', example: '扫描中…' }
      ],
      tryIt: '点「开始扫描」，把手机背面靠近一张 NFC 标签。',
      note: 'iOS Safari 不支持 Web NFC；Android Chrome 有 API 时直接用本卡。',
      diagram: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><rect width="320" height="180" fill="#1b1b1f"/><rect x="40" y="40" width="80" height="100" fill="#2a2a32" stroke="#7fff2a" stroke-width="2" shape-rendering="crispEdges"/><rect x="200" y="60" width="80" height="50" fill="#ffd700" shape-rendering="crispEdges"/><path d="M130 70 Q145 85 130 100" stroke="#33e0e0" stroke-width="2" fill="none"/><path d="M140 60 Q165 85 140 110" stroke="#33e0e0" stroke-width="2" fill="none"/><text x="40" y="160" fill="#f2f2f2" font-size="12" font-family="sans-serif">碰一碰</text><text x="200" y="130" fill="#f2f2f2" font-size="12" font-family="sans-serif">几厘米才行</text><text x="130" y="40" fill="#b8b8b8" font-size="11" font-family="sans-serif">电磁感应传数据</text></svg>'
    },
    'serial': {
      intro: '最简单的有线通信，Arduino 靠它和电脑说话。',
      principle: [
        '串口是最简单的有线通信：一次传一位，慢慢传。Arduino 和 micro:bit 都用串口和电脑说话，把传感器读数传回来。',
        '桌面 Chrome 有 Web Serial 接口，iPhone 上没有；有接口时点「选择串口」，选一个设备就能直接读数据。'
      ],
      uses: ['连 Arduino 读传感器', '给单片机烧程序', '做机器人', '调硬件时看它发回来的数据'],
      data: [
        { field: '端口', unit: '—', meaning: '设备接在哪个口上', example: 'USB 0x2341' },
        { field: '波特率', unit: 'bps', meaning: '一秒钟传多少位，传多快', example: '9600' },
        { field: '状态', unit: '—', meaning: '串口现在连上没有', example: '已连接' },
        { field: '最近数据', unit: '—', meaning: '设备刚发回来的一段读数', example: '温度 25.3' }
      ],
      tryIt: '在电脑 Chrome 上点「选择串口」，连一次 Arduino，看它发回来的数据。',
      note: 'iOS 不支持 Web Serial；桌面 Chrome 有 API 时直接用本卡。',
      diagram: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><rect width="320" height="180" fill="#1b1b1f"/><rect x="30" y="50" width="90" height="60" fill="#2a2a32" stroke="#b8b8b8" stroke-width="2" shape-rendering="crispEdges"/><rect x="40" y="60" width="70" height="40" fill="#4a6cff" opacity="0.4" shape-rendering="crispEdges"/><line x1="120" y1="80" x2="170" y2="80" stroke="#ffd700" stroke-width="3"/><rect x="170" y="55" width="90" height="50" fill="#6fbf3a" shape-rendering="crispEdges"/><circle cx="185" cy="70" r="3" fill="#1b1b1f"/><circle cx="205" cy="70" r="3" fill="#1b1b1f"/><circle cx="225" cy="70" r="3" fill="#1b1b1f"/><circle cx="245" cy="70" r="3" fill="#1b1b1f"/><text x="30" y="130" fill="#f2f2f2" font-size="12" font-family="sans-serif">电脑</text><text x="170" y="130" fill="#f2f2f2" font-size="12" font-family="sans-serif">Arduino</text><text x="120" y="40" fill="#b8b8b8" font-size="11" font-family="sans-serif">一次传一位</text></svg>'
    },
    'vibration': {
      intro: '手机里的小马达，网页在 iPhone 上叫不动它。',
      principle: [
        '手机里有个小马达，转起来偏心就震。网页有个 Vibration 接口，可以叫马达震几毫秒，桌面和 Android Chrome 可以直接用；但 iOS Safari 直接忽略这个调用。',
        '网页只能控制震多久、停多久，调不了震动的强度。'
      ],
      uses: ['按键反馈：点一下震一下', '来电提醒', '游戏里的震动', '做提醒实验'],
      data: [
        { field: '支持', unit: '—', meaning: '当前浏览器支不支持震动接口', example: '支持' },
        { field: '上次模式', unit: '—', meaning: '上一次点的是短震、长震还是节奏震动', example: '短震 100ms' },
        { field: '调用结果', unit: '—', meaning: '上一次震动请求有没有被执行', example: '已执行' }
      ],
      tryIt: '点「短震」和「节奏震动」，感受两种震动有什么不同。',
      note: 'iOS Safari 会忽略 Vibration API；桌面 / Android Chrome 有 API 时直接用本卡。',
      diagram: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><rect width="320" height="180" fill="#1b1b1f"/><rect x="110" y="30" width="100" height="120" fill="#2a2a32" stroke="#f2f2f2" stroke-width="2" shape-rendering="crispEdges"/><circle cx="160" cy="90" r="16" fill="#ffd700"/><circle cx="160" cy="90" r="6" fill="#1b1b1f"/><path d="M95 70 Q80 90 95 110" stroke="#ff4d4d" stroke-width="2" fill="none"/><path d="M225 70 Q240 90 225 110" stroke="#ff4d4d" stroke-width="2" fill="none"/><text x="110" y="170" fill="#f2f2f2" font-size="12" font-family="sans-serif">偏心马达转起来</text><text x="60" y="20" fill="#b8b8b8" font-size="11" font-family="sans-serif">网页叫不动它</text></svg>'
    },
    'battery': {
      intro: '电池电量是系统管的，网页在 iPhone 上问不到。',
      principle: [
        '电池电量是系统管的，网页有个 Battery Status 接口可以问电量和充不充电；iOS Safari 不提供，桌面和 Android Chrome 可以直接读。',
        '网页只能读电量和充放电状态，读不到电池健康度；健康度要看系统设置。'
      ],
      uses: ['省电提醒：电量低了少玩游戏', '做耗电实验：哪个 App 最费电', '看充电状态', '做续航测试'],
      data: [
        { field: '电量', unit: '%', meaning: '电池还剩多少', example: '82' },
        { field: '充电状态', unit: '—', meaning: '现在是不是在充电', example: '充电中' },
        { field: '充满时间', unit: '分钟', meaning: '充满大概还要多久，不充电时是横线', example: '45' },
        { field: '可用时间', unit: '分钟', meaning: '按现在电量大概还能用多久，充电时是横线', example: '320' }
      ],
      tryIt: '点「刷新电量」，看电量和充电状态。',
      note: 'iOS Safari 不提供 Battery Status API；桌面 / Android Chrome 有 API 时直接用本卡。',
      diagram: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><rect width="320" height="180" fill="#1b1b1f"/><rect x="50" y="60" width="180" height="60" fill="none" stroke="#f2f2f2" stroke-width="3" shape-rendering="crispEdges"/><rect x="55" y="65" width="140" height="50" fill="#7fff2a" shape-rendering="crispEdges"/><rect x="230" y="75" width="12" height="30" fill="#f2f2f2" shape-rendering="crispEdges"/><text x="55" y="145" fill="#f2f2f2" font-size="12" font-family="sans-serif">电量 82%</text><text x="180" y="145" fill="#f2f2f2" font-size="12" font-family="sans-serif">充电中</text><text x="50" y="40" fill="#b8b8b8" font-size="11" font-family="sans-serif">系统管着，网页问不到</text></svg>'
    },
    'healthkit': {
      intro: '步数、心率这些健康数据存在系统里，网页拿不到。',
      principle: [
        '步数、心率这些健康数据存在系统健康 App 里，归用户所有。网页想读，必须经过原生 App 和用户明确授权，浏览器里没有这条路。',
        '加速度计卡片可以自己数步数，做个近似版。'
      ],
      uses: ['计步：一天走了多少步', '记运动量', '看心率变化', '做健康小实验'],
      data: [
        { field: '步数', unit: '步', meaning: '今天一共走了多少步', example: '8234' },
        { field: '心率', unit: 'bpm', meaning: '一分钟心跳多少次', example: '72' },
        { field: '卡路里', unit: 'kcal', meaning: '活动消耗了多少能量', example: '320' },
        { field: '睡眠', unit: '小时', meaning: '昨晚睡了多久', example: '7.5' }
      ],
      tryIt: '去加速度计卡片走几步，看它数的步数准不准。',
      note: '健康数据需要原生 App 和用户授权，网页拿不到。',
      diagram: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><rect width="320" height="180" fill="#1b1b1f"/><path d="M160 140 C120 110 110 80 130 65 C145 55 160 65 160 75 C160 65 175 55 190 65 C210 80 200 110 160 140 Z" fill="#ff4d4d"/><rect x="40" y="50" width="70" height="40" fill="#2a2a32" stroke="#7fff2a" stroke-width="2" shape-rendering="crispEdges"/><text x="45" y="75" fill="#f2f2f2" font-size="12" font-family="sans-serif">8234 步</text><text x="130" y="170" fill="#f2f2f2" font-size="12" font-family="sans-serif">心率 72</text><text x="220" y="80" fill="#b8b8b8" font-size="11" font-family="sans-serif">健康数据</text><text x="220" y="105" fill="#b8b8b8" font-size="11" font-family="sans-serif">归用户所有</text></svg>'
    },
    'background': {
      intro: '网页切到后台或锁屏，传感器采集就会停。',
      principle: [
        '网页在前台时才能读传感器，切到后台或锁屏，系统就会停掉它，省电也保隐私。',
        '所以长时间实验要么保持屏幕亮着，要么分段记，回来再继续。'
      ],
      uses: ['长时间记录实验数据', '跑步时记轨迹', '睡眠监测', '做长期观察实验'],
      data: [
        { field: '状态', unit: '—', meaning: '现在是在前台采集还是已经停了', example: '前台采集中' },
        { field: '已记录', unit: '分钟', meaning: '这次已经连续记录了多久', example: '12' },
        { field: '采样间隔', unit: 'ms', meaning: '两次读数之间隔了多久', example: '100' },
        { field: '电量消耗', unit: '%', meaning: '这次记录用掉了多少电', example: '3' }
      ],
      tryIt: '打开屏幕常亮卡，让屏幕保持亮着再做长时间记录。',
      note: 'iOS 上的 PWA 在锁屏或切到后台后不能持续采集传感器。',
      diagram: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><rect width="320" height="180" fill="#1b1b1f"/><rect x="110" y="25" width="100" height="120" fill="#2a2a32" stroke="#7fff2a" stroke-width="2" shape-rendering="crispEdges"/><circle cx="230" cy="50" r="18" fill="#ffd700"/><text x="120" y="90" fill="#f2f2f2" font-size="12" font-family="sans-serif">前台采集中</text><rect x="30" y="60" width="50" height="80" fill="#2a2a32" opacity="0.5" shape-rendering="crispEdges"/><text x="25" y="155" fill="#b8b8b8" font-size="11" font-family="sans-serif">后台停了</text><text x="60" y="170" fill="#f2f2f2" font-size="12" font-family="sans-serif">锁屏或切后台就停</text></svg>'
    }
  };
})(window.SC = window.SC || {});
