# Eldor 是怎麼做出來的

Eldor 是一款瀏覽器上的 3D 卡通渲染 RPG，由我指揮 Claude Code 做出來。以下是重建它的提示詞，只寫技術堆疊和要達成的效果，程式全部由代理自己寫。

## 1. 遊戲概念

```text
我想做一款瀏覽器上的精靈收集對戰 RPG，電腦和手機橫向都能玩。

【類型】精靈締約、收集養成、策略回合制對戰。參考賽爾號的探索與收集、寶可夢的進化、遊戲王的蓋牌心理戰、薩爾達的古代遺跡感。

【核心玩法】雙方同時出招、能量制技能、蓋陷阱與連鎖、六屬性相剋環；每隻精靈有專屬機制和絕招演出。捕捉、抽卡、等級成長、編隊。

【結構】序章動畫、浮空島世界地圖、可自由探索的 3D 野外、每個地區一座塔當主線、競技場。

【觀感】明亮的冒險童話，底下有一層失落文明的哀愁。3D 卡通渲染加手繪墨線、有重量的打擊感、電影式鏡頭；配樂全部由程式即時合成。

【原則】單機、不需要帳號；先寫設計文件，再寫程式。
```

## 2. 技術堆疊與架構

```text
請替這款遊戲建立專案骨架。

【堆疊】Vite、React 19、TypeScript、three.js、GSAP、Web Audio API。不用遊戲引擎，不用音訊函式庫。測試用 Node 原生 test runner 直接跑 TypeScript。

【架構】確定性戰鬥引擎：純函式、seeded PRNG（mulberry32），不碰 DOM 與 WebGL。引擎輸出 event stream 加 state snapshot，演出層只做 event replay，永遠不決定結果。數值集中在單一 config 模組；內容資料驅動（JSON），特殊規則用 hook 擴充。

【交付前檢查】同一個 seed 重播，結果逐筆相同；引擎模組裡搜不到 Math.random、DOM 或 three。
```

## 3. 程序化角色建模

```text
請用 three.js 完全以程式建出角色模型，不用任何外部模型檔。

【建模】Procedural modeling：LatheGeometry、TubeGeometry 搭 CatmullRom 曲線、帶倒角的 ExtrudeGeometry。階層式骨架（root、neck pivot、四肢掛點），seeded random 讓每次生成一致。靜態部件用 mergeGeometries 合批，控制 draw call 與三角面預算。

【材質】Cel shading：MeshToonMaterial 搭 NearestFilter 的 gradient map，3～4 階硬明暗；rim light；寶石用 flat shading。

【效果】剪影一眼可辨，細節是有厚度的幾何，不是貼圖。待機只有呼吸、眨眼這類 secondary motion。

【交付前檢查】正面、側面、背面、四分之三視角加剪影各看一次，沒有斷線或三角形色塊。
```

## 4. 渲染管線

```text
請用 three.js 的 EffectComposer 建立全遊戲共用的渲染管線，做出手繪墨線的卡通質感。

【墨線】Screen-space outline：把 normal、part ID、depth 畫進 HalfFloat render target（NearestFilter），用 edge detection 畫出外輪廓、部件交界和摺線，線寬以輸出像素固定。不用 inverted hull。只在角色的螢幕範圍內運算，並寫回 depth，透明特效才蓋得對。

【後製】ACES Filmic tone mapping、NaN scrub pass、UnrealBloomPass 搭角色遮罩、color grading（vignette、flash、letterbox）。

【畫質】SSAA 與 MSAA 二擇一、三段 quality tier、依 frame time 中位數自動降級；shader precompile，特效第一次出現不卡頓。

【交付前檢查】手機橫向 667×375 不觸發降級，沒有黑塊或斷線。
```

## 5. 打擊感與絕招演出

```text
請做出戰鬥演出層，把引擎事件播成有重量的動畫。

【時鐘】World clock 與 VFX clock 分開：hit-stop 只凍結 world clock。GSAP 的 root timeline 改由遊戲時鐘驅動，倍速與停頓自然生效。

【打擊感】Hit tier 對照表：hit-stop、trauma-based screen shake（幅度為 trauma²）、slow motion、haptics、audio ducking 在同一幀觸發；anticipation、squash and stretch、knockback。

【絕招】Cinematic camera：180 度規則、orbit、tracking shot、raycast 防穿牆。腳本分階段，收尾一定還原燈光、霧、時間速度和音樂。

【交付前檢查】1 倍與 2 倍速錄影檢查節奏；中途跳過，所有狀態都要還原。
```

## 6. 粒子與特效

```text
請建立不用任何圖片檔的特效系統。

【粒子】GPU point sprites、CPU 模擬、typed array ring buffer；additive 與 normal blending 兩個粒子池；canvas 程序產生的 texture atlas。

【網格特效】Shockwave ring、slash trail、light pillar、beam、lightning、magic circle、ground decal，全部跑在 VFX clock 上，promise 化，播完自動 dispose。

【效果】每個屬性一套色彩、形狀與運動語言：蓄力內收，出手外推，衝擊爆開，餘韻落定。

【交付前檢查】低、高畫質都不過曝洗白；shader 裡 pow 的底數先 clamp，避免黑色弧線。
```

## 7. 開放場景

```text
請用 three.js 做出手機也跑得動的 3D 開放野外。

【地形】Heightfield mesh、vertex colors、value noise 上色、兩階 toon shading。不用貼圖，不用 shadow map，改用 blob shadow。

【效能】Chunked static batching（每塊最多四個 mesh）、InstancedMesh 草叢加 vertex shader 風場、fog-based culling、依距離關閉描邊。

【水與天空】Stylized water：depth-based color、shore foam，不做 reflection 與 refraction；procedural sky 只烘焙一次。

【交付前檢查】整個場景維持在幾十個 draw call。
```

## 8. 合成樂器

```text
請只用 Web Audio API 和離線 DSP 做出整個樂團，不用任何音檔或音訊函式庫。

【合成】Karplus-Strong 撥弦（allpass 微調音高、pluck position comb filter）；modal synthesis 鋼琴（inharmonicity、stretched octave、soundboard resonance）；additive synthesis 鐘與木琴；bowed string（每位演奏者各自的 vibrato、bow noise、body resonance）；FM 與 detuned saw pad；母音 formant 烘進 PeriodicWave 的合唱。

【架構】純 JavaScript 預先算好樣本，依音高快取；DynamicsCompressor master bus、獨立的 ducking gain；exponential ramp 停在 0.0001，不歸零。

【交付前檢查】播放時不即時計算樣本；iPhone 上不卡頓、不爆音。
```

## 9. 配樂引擎

```text
請做出由程式即時演奏的配樂系統。

【記譜】Song as data：16 分音符 grid、tracker 式記譜 DSL（音高:長度、和弦、重音、滑音），載入時檢查小節長度。

【排程】Lookahead scheduler：每 25 ms 預排 0.25 秒，背景分頁改排 1.6 秒；humanize timing jitter、swing。

【混音】每首歌獨立 bus、procedural convolution reverb（能量正規化）、tempo-synced ping-pong delay、mastering EQ。

【管理】Crossfade、lazy load 加 prefetch；過場音樂以 cue sheet 和動畫時間鎖在一起。

【交付前檢查】背景分頁一分鐘後切回，音樂沒有斷；快速換畫面，不會同時響兩首。
```
