// Effect registry: the showcase page is generated from this file.
// IDs, names and descriptions mirror docs/EFFECTS.md (the source of truth).
//
// Effect fields:
//   id, category, name, desc, tags, hint, status ('done' | 'wip' | 'planned'), wave (1 | 2)
//   load      () => import(...)          — required when status is 'done'
//   files     ['cyber/Foo.jsx', ...]     — paths under src/effects/, shown in the source viewer
//   layout    'stage' | 'bare'           — 'bare' effects provide their own full layout
//   height    CSS height for the placeholder of 'bare' effects while unmounted
//   webgl     true when the effect holds a WebGL context (counts toward the budget)

export const categories = [
  { id: 'cyber', prefix: 'CY', title: 'Cyber', subtitle: '赛博霓虹', accent: '#7c5cff',
    desc: '暗色背景、霓虹配色、金属与全息材质，强调科技感与高对比。' },
  { id: 'pixel', prefix: 'PX', title: 'Pixel', subtitle: '像素 / 8-bit', accent: '#facc15',
    desc: '低分辨率、有限调色板、抖动与复古显示设备质感。' },
  { id: 'liquid', prefix: 'LQ', title: 'Liquid', subtitle: '水滴 / 流体', accent: '#38bdf8',
    desc: '折射、流动、融合与表面张力，强调湿润和通透感。' },
  { id: 'organic', prefix: 'OR', title: 'Organic', subtitle: '自然 / 有机', accent: '#84cc16',
    desc: '生长、群体行为与自然纹理，强调生命感和缓慢的节奏。' },
  { id: 'paper', prefix: 'PP', title: 'Paper', subtitle: '纸张 / 手作', accent: '#e9d5b5',
    desc: '纸张纹理、折叠、墨水与手绘笔触，强调触感和手工温度。' },
  { id: 'glass', prefix: 'GL', title: 'Glass & Light', subtitle: '玻璃 / 光影', accent: '#a5f3fc',
    desc: '真实的折射、色散与光线，强调通透和戏剧化的明暗。' },
  { id: 'physics', prefix: 'PH', title: 'Physics', subtitle: '弹性 / 物理', accent: '#fb7185',
    desc: '软体、布料、磁力与重力，强调可以「上手玩」的物理反馈。' },
]

export const effects = [
  // ── CY · Cyber ──────────────────────────────────────────────
  { id: 'CY-01', category: 'cyber', name: 'LiquidChrome', status: 'done', wave: 1, webgl: true,
    desc: '液态金属表面：域扭曲 fbm 高度场 + 伪环境反射 + 虹彩',
    tags: ['WebGL2', 'GLSL', 'useShaderCanvas'], hint: '移动鼠标让金属鼓起 · 点击荡开涟漪',
    load: () => import('../effects/cyber/LiquidChrome.jsx'), files: ['cyber/LiquidChrome.jsx'] },
  { id: 'CY-02', category: 'cyber', name: 'ParticleMorph', status: 'done', wave: 1, webgl: true,
    desc: '18k 粒子在文字 / 球体 / 环面结 / 星系之间错峰变形',
    tags: ['Three.js', 'GLSL', '18k particles'], hint: '自动变形 · 点击切换形态 · 鼠标靠近粒子会被推开',
    load: () => import('../effects/cyber/ParticleMorph.jsx'), files: ['cyber/ParticleMorph.jsx'] },
  { id: 'CY-03', category: 'cyber', name: 'HoloCard', status: 'done', wave: 1,
    desc: '全息卡牌：弹簧倾斜、彩虹箔面、闪粉、高光、图层视差',
    tags: ['CSS 3D', 'blend modes', 'spring physics'], hint: '鼠标在卡面上移动 —— 箔面、闪粉、高光与图层视差',
    load: () => import('../effects/cyber/HoloCard.jsx'), files: ['cyber/HoloCard.jsx', 'cyber/HoloCard.css'] },
  { id: 'CY-04', category: 'cyber', name: 'KineticType', status: 'done', wave: 1,
    desc: '可变字重弹簧文字：近鼠标字母变粗、被推开、随速度倾斜',
    tags: ['Variable font', 'spring physics'], hint: '把鼠标划过文字 —— 字重、位移和倾斜都由物理驱动',
    load: () => import('../effects/cyber/KineticType.jsx'), files: ['cyber/KineticType.jsx'] },
  { id: 'CY-05', category: 'cyber', name: 'WaveLines', status: 'done', wave: 1,
    desc: '山脊线（Unknown Pleasures 风格），前后遮挡、噪声流动',
    tags: ['Canvas 2D', 'noise', 'occlusion'], hint: '鼠标在画面里移动会隆起山峰',
    load: () => import('../effects/cyber/WaveLines.jsx'), files: ['cyber/WaveLines.jsx'] },
  { id: 'CY-06', category: 'cyber', name: 'SpiralGallery', status: 'done', wave: 1, webgl: true,
    desc: '滚动驱动的螺旋隧道画廊，卡片随速度弯曲、RGB 色散',
    tags: ['Three.js', 'scroll-driven', 'GLSL'], hint: '继续向下滚动穿过隧道 —— 滚得越快，卡片越弯、色散越强',
    load: () => import('../effects/cyber/SpiralGallery.jsx'), files: ['cyber/SpiralGallery.jsx'],
    layout: 'bare', height: '528vh' },
  { id: 'CY-07', category: 'cyber', name: 'GlitchImage', status: 'planned', wave: 2,
    desc: '图片 RGB 通道撕裂、扫描行错位、块状数据损坏', tags: ['shader'] },
  { id: 'CY-08', category: 'cyber', name: 'HoloScanner', status: 'planned', wave: 2,
    desc: '全息扫描线自上而下显影内容，带噪点与闪烁', tags: ['shader'] },

  // ── PX · Pixel ──────────────────────────────────────────────
  { id: 'PX-01', category: 'pixel', name: 'PixelDissolve', status: 'planned', wave: 2,
    desc: '图片在高清与马赛克之间过渡，像素块逐格错峰溶解', tags: ['shader'] },
  { id: 'PX-02', category: 'pixel', name: 'DitherLens', status: 'planned', wave: 1,
    desc: 'Bayer 有序抖动（1-bit / GameBoy 四色），鼠标处像透镜一样还原全彩', tags: ['shader'] },
  { id: 'PX-03', category: 'pixel', name: 'FallingSand', status: 'planned', wave: 1,
    desc: '像素沙盘：沙、水、火、石的元胞自动机，堆积、流动、燃烧', tags: ['sim'] },
  { id: 'PX-04', category: 'pixel', name: 'PixelText', status: 'planned', wave: 2,
    desc: '文字由像素块像俄罗斯方块一样掉落拼成，点击炸散后重组', tags: ['canvas'] },
  { id: 'PX-05', category: 'pixel', name: 'CRTScreen', status: 'planned', wave: 1,
    desc: '显像管效果：扫描线、桶形畸变、荧光拖影、开关机动画', tags: ['dom', 'shader'] },
  { id: 'PX-06', category: 'pixel', name: 'PixelTrail', status: 'planned', wave: 2,
    desc: '鼠标拖尾生成像素火花，点击产生 8-bit 爆炸粒子', tags: ['canvas'] },

  // ── LQ · Liquid ─────────────────────────────────────────────
  { id: 'LQ-01', category: 'liquid', name: 'RainGlass', status: 'planned', wave: 1,
    desc: '雨滴落在玻璃上折射背景，水珠滑落、合并并留下水痕', tags: ['shader'] },
  { id: 'LQ-02', category: 'liquid', name: 'InkFluid', status: 'planned', wave: 1,
    desc: 'GPU Navier–Stokes 流体，鼠标搅动出墨水 / 烟雾', tags: ['sim'] },
  { id: 'LQ-03', category: 'liquid', name: 'RipplePond', status: 'planned', wave: 2,
    desc: '水面高度场涟漪 + 池底焦散光斑', tags: ['sim'] },
  { id: 'LQ-04', category: 'liquid', name: 'GooeyMenu', status: 'planned', wave: 1,
    desc: '元球融合的液态菜单，按钮像水银一样分离、融合', tags: ['dom'] },
  { id: 'LQ-05', category: 'liquid', name: 'BubbleField', status: 'planned', wave: 2,
    desc: '肥皂泡薄膜干涉彩虹，漂浮、碰撞，可戳破', tags: ['three'] },
  { id: 'LQ-06', category: 'liquid', name: 'LiquidButton', status: 'planned', wave: 2,
    desc: '悬停时液面晃动着注满按钮，离开时退潮', tags: ['canvas'] },

  // ── OR · Organic ────────────────────────────────────────────
  { id: 'OR-01', category: 'organic', name: 'GrassField', status: 'planned', wave: 1,
    desc: '上万根草随风摆动，鼠标划过时被压弯', tags: ['three'] },
  { id: 'OR-02', category: 'organic', name: 'Fireflies', status: 'planned', wave: 1,
    desc: '萤火虫群体行为（Boids），明灭闪烁，跟随或躲避鼠标', tags: ['three'] },
  { id: 'OR-03', category: 'organic', name: 'ReactionDiffusion', status: 'planned', wave: 1,
    desc: 'Gray–Scott 反应扩散，实时生长出豹纹 / 珊瑚 / 指纹图案', tags: ['sim'] },
  { id: 'OR-04', category: 'organic', name: 'GrowingVines', status: 'planned', wave: 2,
    desc: '藤蔓沿容器边缘生长、分叉、开花', tags: ['canvas'] },
  { id: 'OR-05', category: 'organic', name: 'AuroraSky', status: 'planned', wave: 2,
    desc: '极光丝带 + 星空，随滚动缓慢流动', tags: ['shader'] },

  // ── PP · Paper ──────────────────────────────────────────────
  { id: 'PP-01', category: 'paper', name: 'PageCurl', status: 'planned', wave: 1,
    desc: '可拖拽翻页的卷曲卡片，背面带阴影与纸张纹理', tags: ['three'] },
  { id: 'PP-02', category: 'paper', name: 'OrigamiFold', status: 'planned', wave: 2,
    desc: '内容像折纸一样分段折叠 / 展开', tags: ['dom'] },
  { id: 'PP-03', category: 'paper', name: 'TornReveal', status: 'planned', wave: 2,
    desc: '撕纸效果，撕开顶层露出下层内容，撕边不规则', tags: ['canvas'] },
  { id: 'PP-04', category: 'paper', name: 'InkBleed', status: 'planned', wave: 1,
    desc: '文字像墨水滴在宣纸上晕开显现', tags: ['shader'] },
  { id: 'PP-05', category: 'paper', name: 'ScribbleUnderline', status: 'planned', wave: 1,
    desc: '手绘笔触下划线、圈注、箭头，一笔一画绘出', tags: ['dom'] },

  // ── GL · Glass & Light ──────────────────────────────────────
  { id: 'GL-01', category: 'glass', name: 'RefractionLens', status: 'planned', wave: 1,
    desc: '真实折射的玻璃球 / 透镜在内容上滑过', tags: ['shader'] },
  { id: 'GL-02', category: 'glass', name: 'PrismText', status: 'planned', wave: 1,
    desc: '文字棱镜色散，彩虹边随光源方向变化', tags: ['shader'] },
  { id: 'GL-03', category: 'glass', name: 'GodRays', status: 'planned', wave: 1,
    desc: '体积光从元素背后透出，光束随鼠标偏转', tags: ['shader'] },
  { id: 'GL-04', category: 'glass', name: 'SpotlightReveal', status: 'planned', wave: 2,
    desc: '黑暗中用手电筒照出隐藏内容，带光晕衰减', tags: ['dom'] },

  // ── PH · Physics ────────────────────────────────────────────
  { id: 'PH-01', category: 'physics', name: 'JellyCard', status: 'planned', wave: 1,
    desc: '果冻软体卡片，拖拽时晃动并弹性回弹', tags: ['three'] },
  { id: 'PH-02', category: 'physics', name: 'ClothBanner', status: 'planned', wave: 1,
    desc: '图片变成布料（Verlet 积分），被鼠标吹动、拉扯', tags: ['three'] },
  { id: 'PH-03', category: 'physics', name: 'MagnetDots', status: 'planned', wave: 1,
    desc: '点阵像铁屑一样被鼠标磁化，沿磁力线排列', tags: ['canvas'] },
  { id: 'PH-04', category: 'physics', name: 'GravityPile', status: 'planned', wave: 2,
    desc: '标签掉落堆积，可抓起、甩出、互相碰撞', tags: ['canvas'] },
]

export const effectsByCategory = id => effects.filter(e => e.category === id)
