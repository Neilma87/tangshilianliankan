# 从两份网络数据集构建游戏题库 poems.js
# 数据源1: 《水墨唐诗》 https://raw.githubusercontent.com/chinese-poetry/chinese-poetry/master/水墨唐诗/shuimotangshi.json
# 数据源2: 《唐诗三百首》 https://gitee.com/api/v5/repos/juer2017/xinhuazidian/contents/app/src/main/assets/tangshisanbaishou.json
# tier: sr = 高中必背(统编高中语文/高考常见), jr = 经典名篇
$ErrorActionPreference = 'Stop'
$dir = 'c:\Users\alice\Documents\trae_projects\xiaoxiaole\web-game'

$shuimo = Get-Content "$dir\data\shuimotangshi.json" -Raw -Encoding UTF8 | ConvertFrom-Json
$t300   = Get-Content "$dir\data\tangshisanbaishou.json" -Raw -Encoding UTF8 | ConvertFrom-Json

# 拍平唐诗三百首
$flat300 = @()
foreach ($grp in $t300.content) { foreach ($p in $grp.content) { $flat300 += $p } }

# 数据源勘误：原始 JSON 的录入/OCR 错字按通行本（语文课本）修正；
# 命中题名且原文含错字才替换，避免误伤同名诗篇
$corrections = @(
  @{ title = '山行'; wrong = '远目寒山'; right = '远上寒山' }
)
foreach ($c in $corrections) {
  foreach ($p in $shuimo) {
    if ($p.title -eq $c.title) { $p.paragraphs = @($p.paragraphs | ForEach-Object { $_.Replace($c.wrong, $c.right) }) }
  }
  foreach ($p in $flat300) {
    if ($p.chapter -eq $c.title) { $p.paragraphs = @($p.paragraphs | ForEach-Object { $_.Replace($c.wrong, $c.right) }) }
  }
}

# 选择题: @(来源, 诗题, 名句, 学段)
# 共 100 首：sr=高中必背 12, jr=经典名篇 88
# 名句要求：纯 7 个汉字、句内无重复字、在原文中存在、全库不重复
$sel = @(
 # ---- 高中必背 12 ----
 @('s','登高',           '万里悲秋常作客', 'sr'),
 @('t','蜀相',           '出师未捷身先死', 'sr'),
 @('s','客至',           '花径不曾缘客扫', 'sr'),
 @('s','锦瑟',           '庄生晓梦迷蝴蝶', 'sr'),
 @('t','将进酒',         '天生我材必有用', 'sr'),
 @('t','行路难·金樽清酒斗十千', '长风破浪会有时', 'sr'),
 @('t','蜀道难',         '枯松倒挂倚绝壁', 'sr'),
 @('t','梦游天姥吟留别', '且放白鹿青崖间', 'sr'),
 @('t','琵琶行',         '同是天涯沦落人', 'sr'),
 @('t','长恨歌',         '梨花一枝春带雨', 'sr'),
 @('t','燕歌行',         '战士军前半死生', 'sr'),
 @('s','阁夜',           '五更鼓角声悲壮', 'sr'),
 # ---- 经典名篇 88 ----
 @('s','枫桥夜泊',       '月落乌啼霜满天', 'jr'),
 @('s','早发白帝城',     '轻舟已过万重山', 'jr'),
 @('s','别董大',         '莫愁前路无知己', 'jr'),
 @('s','出塞',           '但使龙城飞将在', 'jr'),
 @('s','绝句',           '两个黄鹂鸣翠柳', 'jr'),
 @('s','山行',           '霜叶红于二月花', 'jr'),
 @('s','泊秦淮',         '商女不知亡国恨', 'jr'),
 @('s','九月九日忆山东兄弟', '每逢佳节倍思亲', 'jr'),
 @('s','送元二使安西',   '劝君更尽一杯酒', 'jr'),
 @('s','黄鹤楼送孟浩然之广陵', '孤帆远影碧空尽', 'jr'),
 @('s','白雪歌送武判官归京', '忽如一夜春风来', 'jr'),
 @('s','清明',           '牧童遥指杏花村', 'jr'),
 @('s','大林寺桃花',     '人间四月芳菲尽', 'jr'),
 @('s','芙蓉楼送辛渐',   '一片冰心在玉壶', 'jr'),
 @('s','江南逢李龟年',   '落花时节又逢君', 'jr'),
 @('s','乌衣巷',         '旧时王谢堂前燕', 'jr'),
 @('s','咏柳',           '二月春风似剪刀', 'jr'),
 @('s','早春',           '草色遥看近却无', 'jr'),
 @('s','寒食',           '春城无处不飞花', 'jr'),
 @('s','滁州西涧',       '春潮带雨晚来急', 'jr'),
 @('s','夜上受降城闻笛', '受降城外月如霜', 'jr'),
 @('s','赠花卿',         '此曲只应天上有', 'jr'),
 @('s','逢入京使',       '凭君传语报平安', 'jr'),
 @('s','嫦娥',           '嫦娥应悔偷灵药', 'jr'),
 @('s','题金陵渡',       '两三星火是瓜洲', 'jr'),
 @('s','赤壁',           '东风不与周郎便', 'jr'),
 @('s','秋夕',           '轻罗小扇扑流萤', 'jr'),
 @('s','陇西行',         '可怜无定河边骨', 'jr'),
 @('s','暮江吟',         '一道残阳铺水中', 'jr'),
 @('s','石头城',         '潮打空城寂寞回', 'jr'),
 # ---- 新增经典名篇 58 ----
 @('t','宣州谢脁楼饯别校书叔云','长风万里送秋雁','jr'),
 @('t','长相思·其一',     '孤灯不明思欲绝', 'jr'),
 @('s','登楼',           '锦江春色来天地', 'jr'),
 @('t','咏怀古迹·其三',   '群山万壑赴荆门', 'jr'),
 @('t','和贾至舍人早朝大明宫','万国衣冠拜冕旒','jr'),
 @('t','闺怨',           '忽见陌头杨柳色', 'jr'),
 @('s','望洞庭',         '白银盘里一青螺', 'jr'),
 @('s','西塞山怀古',     '千寻铁锁沉江底', 'jr'),
 @('t','无题·相见时难别亦难','春蚕到死丝方尽','jr'),
 @('t','无题·相见时难别亦难','蜡炬成灰泪始干','jr'),
 @('t','无题·昨夜星辰昨夜风','心有灵犀一点通','jr'),
 @('s','江南春',         '千里莺啼绿映红', 'jr'),
 @('s','遣怀',           '十年一觉扬中梦', 'jr'),
 @('s','黄鹤楼',         '日暮乡关何处是', 'jr'),
 @('t','近试上张水部',   '画眉深浅入时无', 'jr'),
 @('s','蜂',             '采得百花成蜜后', 'jr'),
 @('s','早发白帝城',     '千里江陵一日还', 'jr'),
 @('s','早发白帝城',     '两岸猿声啼不住', 'jr'),
 @('s','黄鹤楼送孟浩然之广陵', '惟见长江天际流', 'jr'),
 @('s','绝句',           '一行白鹭上青天', 'jr'),
 @('s','绝句',           '窗含西岭千秋雪', 'jr'),
 @('s','绝句',           '门泊东吴万里船', 'jr'),
 @('s','江畔独步寻花',   '黄四娘家花满蹊', 'jr'),
 @('s','江南逢李龟年',   '岐王宅里寻常见', 'jr'),
 @('s','江南逢李龟年',   '崔九堂前几度闻', 'jr'),
 @('t','闻官军收河南河北','剑外忽传收蓟北', 'jr'),
 @('t','闻官军收河南河北','初闻涕泪满衣裳', 'jr'),
 @('t','闻官军收河南河北','白日放歌须纵酒', 'jr'),
 @('t','闻官军收河南河北','青春作伴好还乡', 'jr'),
 @('t','琵琶行',         '千呼万唤始出来', 'jr'),
 @('t','琵琶行',         '犹抱琵琶半遮面', 'jr'),
 @('t','琵琶行',         '江州司马青衫湿', 'jr'),
 @('t','长恨歌',         '在天愿作比翼鸟', 'jr'),
 @('t','长恨歌',         '在地愿为连理枝', 'jr'),
 @('t','长恨歌',         '天长地久有时尽', 'jr'),
 @('t','长恨歌',         '回眸一笑百媚生', 'jr'),
 @('t','长恨歌',         '三千宠爱在一身', 'jr'),
 @('s','出塞',           '不教胡马度阴山', 'jr'),
 @('s','芙蓉楼送辛渐',   '洛阳亲友如相问', 'jr'),
 @('t','凉州词',         '黄河远上白云间', 'jr'),
 @('t','凉州词',         '春风不度玉门关', 'jr'),
 @('t','回乡偶书·其一',  '少小离家老大回', 'jr'),
 @('s','咏柳',           '碧玉妆成一树高', 'jr'),
 @('s','咏柳',           '不知细叶谁裁出', 'jr'),
 @('s','枫桥夜泊',       '江枫渔火对愁眠', 'jr'),
 @('s','枫桥夜泊',       '姑苏城外寒山寺', 'jr'),
 @('s','枫桥夜泊',       '夜半钟声到客船', 'jr'),
 @('s','赤壁',           '折戟沉沙铁未销', 'jr'),
 @('s','赤壁',           '铜雀春深锁二乔', 'jr'),
 @('s','泊秦淮',         '夜泊秦淮近酒家', 'jr'),
 @('s','山行',           '远上寒山石径斜', 'jr'),
 @('s','山行',           '白云生处有人家', 'jr'),
 @('s','清明',           '路上行人欲断魂', 'jr'),
 @('s','乌衣巷',         '朱雀桥边野草花', 'jr'),
 @('t','夜雨寄北',       '巴山夜雨涨秋池', 'jr'),
 @('t','夜雨寄北',       '何当共剪西窗烛', 'jr'),
 @('t','夜雨寄北',       '却话巴山夜雨时', 'jr'),
 @('t','贾生',           '可怜夜半虚前席', 'jr')
)

$out = @()
foreach ($s in $sel) {
  $src = $s[0]; $title = $s[1]; $line = $s[2]; $tier = $s[3]
  # 按题名筛出候选，再用名句精确命中（解决《凉州词》等同名诗篇）
  if ($src -eq 's') {
    $p = $shuimo | Where-Object { $_.title -eq $title } | Where-Object { ($_.paragraphs -join '') -match [regex]::Escape($line) } | Select-Object -First 1
    $author = $p.author
  } else {
    $p = $flat300 | Where-Object { $_.chapter -eq $title } | Where-Object { ($_.paragraphs -join '') -match [regex]::Escape($line) } | Select-Object -First 1
    $author = ($p.author -replace '^唐代[:：]\s*', '').Trim()
  }
  if (-not $p) { throw "未找到诗: $title" }
  $all = ($p.paragraphs -join '')
  if ($all -notmatch [regex]::Escape($line)) { throw "名句不在《$title》中: $line`n原文: $all" }
  if ($line -notmatch '^[\u4e00-\u9fa5]{7}$') { throw "不是7个汉字: $line" }
  $dup = $line.ToCharArray() | Group-Object | Where-Object Count -gt 1
  if ($dup) { throw "句内有重复字: $line ($($dup.Name -join ','))" }
  $out += [pscustomobject]@{ author = $author; title = $title; line = $line; tier = $tier; paragraphs = $p.paragraphs }
}

# 同一句不得重复
$dupLine = $out.line | Group-Object | Where-Object Count -gt 1
if ($dupLine) { throw '存在重复名句: ' + ($dupLine.Name -join ',') }

$sr = ($out | Where-Object tier -eq 'sr').Count
$jr = ($out | Where-Object tier -eq 'jr').Count
"题库共 $($out.Count) 首: 高中必背 $sr, 经典名篇 $jr"

$json = ConvertTo-Json -Depth 5 -InputObject $out
$header = @"
// 唐诗题库（共 $($out.Count) 首；sr=高中必背 $sr 首，jr=经典名篇 $jr 首）
// 数据来源（2026-10-08 下载）:
//   1. chinese-poetry/chinese-poetry《水墨唐诗》(MIT)
//      https://raw.githubusercontent.com/chinese-poetry/chinese-poetry/master/水墨唐诗/shuimotangshi.json
//   2.《唐诗三百首》(chinese-poetry 数据的简体整理版)
//      https://gitee.com/juer2017/xinhuazidian/raw/master/app/src/main/assets/tangshisanbaishou.json
window.TANG_POEMS =
"@
[IO.File]::WriteAllText("$dir\poems.js", ($header + $json + ";`r`n"), (New-Object Text.UTF8Encoding($false)))
'poems.js 已生成'
