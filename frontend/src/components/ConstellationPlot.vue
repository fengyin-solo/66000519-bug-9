<template>
  <div class="panel">
    <h3>⭐ 星座图 (IQ平面)</h3>
    <div ref="wrap" class="canvas-wrap">
      <canvas ref="cvs" class="const-canvas"></canvas>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useSignalStore } from '../store/signal'
const store = useSignalStore()
const wrap = ref<HTMLDivElement>()
const cvs = ref<HTMLCanvasElement>()
let observer: ResizeObserver | null = null
let cssW = 0, cssH = 0

// 向上取整到 1/2/5 × 10^n，让刻度读数整齐
function niceRange(v: number) {
  if (!isFinite(v) || v <= 0) return 1
  const exp = Math.floor(Math.log10(v))
  const base = Math.pow(10, exp)
  const f = v / base
  const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10
  return nf * base
}

function fmt(v: number) {
  return Math.abs(v) >= 100 ? v.toFixed(0) : String(Number(v.toFixed(3)))
}

function resize() {
  const c = cvs.value, w = wrap.value
  if (!c || !w) return
  const dpr = window.devicePixelRatio || 1
  cssW = w.clientWidth
  cssH = w.clientHeight
  c.width = Math.max(1, Math.round(cssW * dpr))
  c.height = Math.max(1, Math.round(cssH * dpr))
  draw()
}

function draw() {
  const c = cvs.value
  if (!c) return
  const ctx = c.getContext('2d')!
  const dpr = window.devicePixelRatio || 1
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const W = cssW || c.width / dpr, H = cssH || c.height / dpr

  // 每次都先整幅清屏，避免上一组数据残留或叠加
  ctx.fillStyle = '#0d1520'; ctx.fillRect(0, 0, W, H)

  // 留出刻度标签空间的绘图区
  const padL = 36, padR = 12, padT = 18, padB = 24
  const pw = W - padL - padR, ph = H - padT - padB
  const cx = padL + pw / 2, cy = padT + ph / 2
  const half = Math.min(pw, ph) / 2

  ctx.strokeStyle = '#22303f'; ctx.lineWidth = 1
  ctx.strokeRect(padL, padT, pw, ph)

  const pts = store.result?.constellation || []

  // 空态：无数据时给出说明而不是留白
  if (pts.length === 0) {
    ctx.fillStyle = '#5a6a7a'; ctx.textAlign = 'center'
    ctx.font = '13px system-ui'
    ctx.fillText('暂无星座图数据', cx, cy - 6)
    ctx.font = '11px system-ui'
    ctx.fillText('生成或导入信号后在此展示 IQ 采样点', cx, cy + 14)
    ctx.textAlign = 'left'
    return
  }

  // 自适应范围：取 max(|I|,|Q|) 的 98 分位数为基准，留 20% 余量后取整齐值，
  // 极端离群点不会把主体压扁，越界点单独标注
  const radii = pts.map(p => Math.max(Math.abs(p.i), Math.abs(p.q))).sort((a, b) => a - b)
  const p98 = radii[Math.min(radii.length - 1, Math.floor(radii.length * 0.98))]
  const range = niceRange(Math.max(p98 * 1.2, 1e-3))

  // 网格与坐标刻度，使图上位置与坐标读数一一对应
  const ticks = [-1, -0.5, 0, 0.5, 1]
  ctx.font = '10px system-ui'; ctx.fillStyle = '#8899aa'
  ctx.textAlign = 'center'
  for (const t of ticks) {
    const x = cx + t * half
    ctx.strokeStyle = t === 0 ? '#2a3a4a' : '#1b2634'
    ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, padT + ph); ctx.stroke()
    ctx.fillText(fmt(t * range), x, H - 8)
  }
  ctx.textAlign = 'right'
  for (const t of ticks) {
    const y = cy - t * half
    ctx.strokeStyle = t === 0 ? '#2a3a4a' : '#1b2634'
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + pw, y); ctx.stroke()
    ctx.fillText(fmt(t * range), padL - 5, y + 3)
  }

  // 数据点：越界点按比例截断到绘图区边缘并用橙色区分
  let outCount = 0
  for (const pt of pts) {
    const m = Math.max(Math.abs(pt.i), Math.abs(pt.q))
    const out = m > range
    const k = out ? range / m : 1
    const x = cx + (pt.i * k / range) * half
    const y = cy - (pt.q * k / range) * half
    ctx.beginPath(); ctx.arc(x, y, out ? 3.5 : 3, 0, Math.PI * 2)
    if (out) { outCount++; ctx.fillStyle = '#ffa726' } else { ctx.fillStyle = '#42a5f5' }
    ctx.fill()
  }

  // 范围说明与越界点统计
  ctx.textAlign = 'left'; ctx.font = '10px system-ui'
  ctx.fillStyle = '#8899aa'
  ctx.fillText(`范围 ±${fmt(range)}`, padL + 5, padT + 12)
  ctx.fillText('I →', W - padR - 20, cy - 6)
  ctx.fillText('Q ↑', cx + 5, padT + 12)
  if (outCount > 0) {
    ctx.textAlign = 'right'
    ctx.fillStyle = '#ffa726'
    ctx.fillText(`⚠ ${outCount} 个点超出范围，已截断至边缘`, W - padR - 5, padT + 12)
    ctx.textAlign = 'left'
  }
}

onMounted(() => {
  resize()
  if (wrap.value) {
    observer = new ResizeObserver(resize)
    observer.observe(wrap.value)
  }
})
watch(() => store.result, draw)
onUnmounted(() => { observer?.disconnect() })
</script>

<style scoped>
.panel { background:#1a2332; border-radius:8px; padding:16px; border:1px solid #2a3a4a }
.panel h3 { margin-bottom:8px; color:#90caf9; font-size:14px }
.canvas-wrap { width:100%; max-width:440px; margin:0 auto; aspect-ratio:1/1 }
.const-canvas { display:block; width:100%; height:100%; border-radius:4px }
</style>
